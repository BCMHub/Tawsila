import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname, isAbsolute } from "node:path";
import { safePath } from "../../state/files.mjs";
import { normalizeGraph, graphProvider } from "../provider.mjs";
const exec = promisify(execFile);
export function normalizeGraphify(input) {
  if (
    !Array.isArray(input?.nodes) ||
    !Array.isArray(input.links ?? input.edges)
  )
    throw Error("Invalid Graphify schema");
  const nodes = input.nodes.map((n) => ({
    id: n.id,
    name: n.label ?? n.id,
    path: n.source_file,
    range: null,
    location: n.source_location ?? null,
  }));
  const edges = (input.links ?? input.edges).map((e) => ({
    source: e.source,
    target: e.target,
    relation:
      {
        imports_from: "imports",
        imports: "imports",
        calls: "calls",
        inherits: "inherits",
      }[e.relation] ?? e.relation,
    confidence: String(e.confidence ?? "unknown").toLowerCase(),
    evidence: e.source_location ?? null,
  }));
  return normalizeGraph({
    nodes,
    edges,
    coverage: {
      complete: false,
      languages: [],
      notes: [
        "Static extraction; related tests are candidates; exact end ranges unavailable",
      ],
    },
  });
}
export function createGraphifyProvider({
  executable,
  pythonExecutable,
  versionPin,
  processRunner,
} = {}) {
  async function run(binary, args, cwd, timeout = 60000) {
    if (!isAbsolute(binary ?? ""))
      throw Error("Absolute configured executable required");
    const env = {
      PATH: "/opt/homebrew/bin:/usr/bin:/bin",
      HOME: cwd,
      XDG_CACHE_HOME: join(cwd, "cache"),
      GRAPHIFY_NO_TIPS: "1",
      GRAPHIFY_QUERY_LOG_DISABLE: "1",
    };
    const options = {
      cwd,
      env,
      timeout,
      maxBuffer: 2 * 1024 * 1024,
      encoding: "utf8",
    };
    return processRunner
      ? processRunner({ executable: binary, args, ...options })
      : exec(binary, args, options);
  }
  async function identity(cwd) {
    if (versionPin !== "0.8.31")
      throw Error("Graphify version not capability-verified");
    const result = await run(
      pythonExecutable,
      [
        "-c",
        "import importlib.metadata; print(importlib.metadata.version('graphifyy'))",
      ],
      cwd,
    );
    if (result.stdout.trim() !== versionPin)
      throw Error("Graphify version mismatch");
  }
  const unavailable = (reason) => ({
    status: "UNAVAILABLE",
    diagnostics: [reason],
  });
  const p = {
    capabilities: async () => ({
      provider: "graphify",
      version: versionPin ?? "unknown",
      schemaVersion: 1,
      languages: ["python", "javascript"],
      relations: ["calls", "imports", "contains", "inherits"],
      incrementalModes: [],
      worktreeIsolation: true,
      codeOnly: true,
    }),
    async indexRepository(snapshot, options = {}) {
      try {
        if (!snapshot?.root || !options.cacheRoot)
          throw Error("Missing snapshot/cache");
        await identity(options.cacheRoot);
        await mkdir(await safePath(options.cacheRoot, "graphify-staging"), {
          recursive: true,
        });
        const stage = await mkdtemp(
          join(options.cacheRoot, "graphify-staging", "snapshot-"),
        );
        for (const f of snapshot.files) {
          const dest = await safePath(stage, f.path, true);
          await writeFile(
            dest,
            await readFile(await safePath(snapshot.root, f.path)),
            { flag: "wx" },
          );
        }
        await run(executable, ["update", stage, "--no-cluster"], stage);
        const raw = JSON.parse(
          await readFile(
            await safePath(stage, "graphify-out/graph.json"),
            "utf8",
          ),
        );
        return {
          status: "PARTIAL",
          graph: normalizeGraphify(raw),
          artifactRef: join(stage, "graphify-out/graph.json"),
          diagnostics: ["Full AST refresh only; incomplete static coverage"],
        };
      } catch (e) {
        return unavailable(e.message);
      }
    },
    refreshChanges: async () => ({
      status: "UNSUPPORTED",
      diagnostics: [
        "Incremental correctness not verified for this version; full refresh/fallback required",
      ],
    }),
  };
  for (const name of [
    "findSymbol",
    "findCallers",
    "findCallees",
    "findDependencies",
    "findDependents",
    "findRelatedTests",
    "findImpactRadius",
    "findRelatedFiles",
    "getNeighborhood",
    "compareViews",
  ])
    p[name] = async (view, request) =>
      graphProvider(view.graph)[name](view, request);
  return p;
}
