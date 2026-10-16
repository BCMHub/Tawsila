import { readFile, readdir } from "node:fs/promises";
import { sourcePaths, retrieveFallback } from "./fallback.mjs";
import {
  digest,
  safePath,
  readJson,
  immutableJson,
  atomicJson,
} from "../state/files.mjs";
import { acquireLock } from "../state/lock.mjs";
import { graphHealth } from "./health.mjs";
import { normalizeGraph, graphProvider } from "./provider.mjs";
export async function repositorySnapshot(worktree) {
  const files = [];
  for (const p of await sourcePaths(worktree.realPath)) {
    const data = await readFile(await safePath(worktree.realPath, p));
    files.push({ path: p, hash: digest(data), language: p.split(".").at(-1) });
  }
  return {
    repositoryId: digest(worktree.commonGitDir ?? worktree.realPath),
    worktreeId: worktree.id,
    root: worktree.realPath,
    headCommit: worktree.headCommit ?? null,
    files,
    contentFingerprint: digest(files),
    configFingerprint: digest(
      files.filter((f) =>
        /(package|lock|tsconfig|config|Cargo|gradle)/.test(f.path),
      ),
    ),
    permittedReadRoots: [worktree.realPath],
  };
}
async function bounded(promise, ms) {
  let id;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        id = setTimeout(() => reject(Error("GRAPH_TIMEOUT")), ms);
      }),
    ]);
  } finally {
    clearTimeout(id);
  }
}
export async function resolveGraphView(
  worktree,
  provider,
  policy,
  stateRoot,
  previousView = null,
) {
  let lock;
  try {
    if (!provider)
      return {
        view: null,
        health: "UNAVAILABLE",
        fallbackReasons: ["NO_GRAPH_PROVIDER"],
      };
    const caps = await bounded(
      provider.capabilities(),
      policy.query_timeout_ms ?? 5000,
    );
    const before = await repositorySnapshot(worktree);
    const id = digest({
      repo: before.repositoryId,
      worktree: worktree.id,
      head: before.headCommit,
      fp: before.contentFingerprint,
      config: before.configFingerprint,
      provider: caps.provider,
      version: caps.version,
      schema: caps.schemaVersion,
    });
    lock = await acquireLock(stateRoot, "graph:" + worktree.id, {
      runId: worktree.id,
    });
    const associationPath = "graph-links/" + worktree.id + ".json";
    async function associate(view) {
      await atomicJson(stateRoot, associationPath, {
        worktreeId: worktree.id,
        viewId: view.id,
        repositoryId: before.repositoryId,
        contentFingerprint: view.contentFingerprint,
      });
    }
    try {
      const view = await readJson(stateRoot, "graphs/" + id + ".json");
      if (
        view.graphHash !== digest(view.graph) ||
        digest(view.files) !== before.contentFingerprint
      )
        throw Error("GRAPH_CACHE_INTEGRITY");
      await associate(view);
      return {
        view,
        health: graphHealth(view, before, caps),
        fallbackReasons: [],
      };
    } catch (e) {
      if (e.code !== "ENOENT")
        return {
          view: null,
          health: "STALE",
          fallbackReasons: ["CORRUPT_GRAPH_CACHE"],
        };
    }
    if (!previousView) {
      try {
        const link = await readJson(stateRoot, associationPath);
        if (link.repositoryId !== before.repositoryId)
          throw Error("GRAPH_REPOSITORY_MISMATCH");
        previousView = await readJson(
          stateRoot,
          "graphs/" + link.viewId + ".json",
        );
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
    if (
      previousView &&
      (previousView.worktreeId !== worktree.id ||
        previousView.repositoryId !== before.repositoryId)
    )
      throw Error("GRAPH_VIEW_BINDING_MISMATCH");
    const previousFiles = new Map(
      (previousView?.files ?? []).map((f) => [f.path, f]),
    );
    const currentFiles = new Map(before.files.map((f) => [f.path, f]));
    const changes = [
      ...new Set([...previousFiles.keys(), ...currentFiles.keys()]),
    ]
      .filter(
        (path) =>
          previousFiles.get(path)?.hash !== currentFiles.get(path)?.hash,
      )
      .map((path) => ({
        path,
        oldHash: previousFiles.get(path)?.hash ?? null,
        newHash: currentFiles.get(path)?.hash ?? null,
      }));
    const canIncrement =
      previousView?.providerVersion === caps.version &&
      previousView.configFingerprint === before.configFingerprint &&
      caps.incrementalModes?.includes("file-delta") &&
      changes.length / Math.max(1, previousFiles.size) <
        (policy.full_rebuild_changed_file_ratio ?? 0.2);
    const metadataOnly =
      previousView?.contentFingerprint === before.contentFingerprint &&
      previousView.providerVersion === caps.version;
    if (previousView && !canIncrement && !metadataOnly) {
      let old = [];
      try {
        old = await readdir(
          await safePath(stateRoot, "graph-rebuilds/" + worktree.id),
        );
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      if (old.length >= (policy.max_full_rebuilds_per_card ?? 1))
        return {
          view: null,
          health: "STALE",
          fallbackReasons: ["GRAPH_REBUILD_BUDGET"],
        };
      await immutableJson(
        stateRoot,
        "graph-rebuilds/" + worktree.id + "/" + id + ".json",
        { id },
      );
    }
    const output = await bounded(
      metadataOnly
        ? Promise.resolve({ status: "OK", graph: previousView.graph })
        : canIncrement
          ? provider.refreshChanges(previousView, changes, {
              snapshot: before,
              cacheRoot: stateRoot,
              codeOnly: true,
            })
          : provider.indexRepository(before, {
              cacheRoot: stateRoot,
              codeOnly: true,
            }),
      policy.refresh_timeout_ms ?? 60000,
    );
    if (!["OK", "PARTIAL"].includes(output.status))
      return {
        view: null,
        health: output.status,
        fallbackReasons: output.diagnostics ?? ["INDEX_UNAVAILABLE"],
      };
    const after = await repositorySnapshot(worktree);
    if (before.contentFingerprint !== after.contentFingerprint)
      return {
        view: null,
        health: "STALE",
        fallbackReasons: ["SOURCE_CHANGED_DURING_INDEX"],
      };
    const graph = normalizeGraph(output.graph);
    const view = {
      id,
      repositoryId: before.repositoryId,
      worktreeId: worktree.id,
      provider: caps.provider,
      providerVersion: caps.version,
      schemaVersion: caps.schemaVersion,
      headCommit: before.headCommit,
      contentFingerprint: before.contentFingerprint,
      configFingerprint: before.configFingerprint,
      files: before.files,
      refreshMode: metadataOnly
        ? "metadata"
        : canIncrement
          ? "incremental"
          : "full",
      graphHash: digest(graph),
      coverage: graph.coverage,
      graph,
      createdAt: new Date().toISOString(),
    };
    await immutableJson(stateRoot, "graphs/" + id + ".json", view);
    await associate(view);
    return {
      view,
      health: graphHealth(view, before, caps),
      fallbackReasons: [],
    };
  } catch (e) {
    return { view: null, health: "UNAVAILABLE", fallbackReasons: [e.message] };
  } finally {
    if (lock) await lock.release();
  }
}
export async function queryRepository(
  view,
  operation,
  request,
  provider = null,
  fallback = null,
) {
  let result;
  try {
    if (view) {
      const p = provider ?? graphProvider(view.graph);
      if (typeof p[operation] === "function")
        result = await bounded(
          p[operation](view, request),
          request.timeoutMs ?? 5000,
        );
    }
  } catch (e) {
    result = { status: "ERROR", diagnostics: [e.message] };
  }
  if (result && ["OK", "PARTIAL"].includes(result.status)) return result;
  const output = fallback ? await fallback.retrieve(request) : null;
  return {
    status: "PARTIAL",
    nodes: [],
    edges: [],
    coverage: { complete: false },
    truncated: false,
    diagnostics: result?.diagnostics ?? ["GRAPH_UNAVAILABLE_OR_UNRESOLVED"],
    fallback: output,
  };
}
