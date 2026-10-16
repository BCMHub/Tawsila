import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import {
  digest,
  relativePath,
  safePath,
  immutableJson,
  readJson,
} from "../state/files.mjs";
import { acquireLock } from "../state/lock.mjs";
const run = promisify(execFile);
export async function git(cwd, args) {
  const r = await run("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return r.stdout.trimEnd();
}
export function taskNames(cardId, type, slug) {
  if (
    !/^[A-Z][A-Z0-9]*-\d+$/.test(cardId) ||
    typeof slug !== "string" ||
    /[\\/\0]/.test(slug)
  )
    throw Error("Unsafe task name");
  const clean = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    .replace(/-$/, "");
  if (!clean) throw Error("Empty slug");
  const pathSegment = cardId + "-" + clean;
  return {
    branch:
      (type === "Bug" ? "fix/" : type === "Feature" ? "feat/" : "chore/") +
      pathSegment,
    pathSegment,
  };
}
export async function detectWorkspace(cwd) {
  const topLevel = await realpath(
    await git(cwd, ["rev-parse", "--show-toplevel"]),
  );
  const commonGitDir = await realpath(
    await git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]),
  );
  const gitDir = await realpath(
    await git(cwd, ["rev-parse", "--absolute-git-dir"]),
  );
  const branch = (await git(cwd, ["branch", "--show-current"])) || null;
  const superproject = await git(cwd, [
    "rev-parse",
    "--show-superproject-working-tree",
  ]);
  return {
    topLevel,
    commonGitDir,
    linked: gitDir !== commonGitDir && !superproject,
    detached: branch === null,
    branch,
    head: await git(cwd, ["rev-parse", "HEAD"]),
  };
}
export async function snapshotWorktree(cwd) {
  const d = await detectWorkspace(cwd);
  const diff = await git(cwd, ["diff", "HEAD", "--binary"]);
  const untracked = (
    await git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"])
  )
    .split("\0")
    .filter(Boolean);
  const files = [];
  for (const p of untracked)
    files.push([p, digest(await readFile(await safePath(d.topLevel, p)))]);
  return {
    headCommit: d.head,
    patchHash: digest({ headCommit: d.head, diff, untracked: files }),
    dirty: Boolean((await git(cwd, ["status", "--porcelain"])).length),
  };
}
export async function ensureTaskWorktree(
  card,
  cwd,
  stateRoot,
  policy,
  checkpoint = null,
) {
  if (
    card.status !== "READY" &&
    !["IN PROGRESS", "VALIDATING", "REVIEW"].includes(card.status)
  )
    throw Error("Card not executable");
  const d = await detectWorkspace(cwd);
  const lock = await acquireLock(stateRoot, "repo-admin", { runId: card.id });
  try {
    const key = "worktrees/" + card.id + ".json";
    let record;
    try {
      record = await readJson(stateRoot, key);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    if (record) {
      if (record.commonGitDir !== d.commonGitDir || record.cardId !== card.id)
        throw Error("Worktree repository/card mismatch");
      const current = await detectWorkspace(record.realPath);
      const snap = await snapshotWorktree(record.realPath);
      if (
        current.branch !== record.branch ||
        current.commonGitDir !== record.commonGitDir ||
        current.detached
      )
        throw Error("Worktree branch changed");
      const expected = checkpoint ?? {
        headCommit: record.headCommit,
        patchHash: null,
      };
      if (
        snap.headCommit !== expected.headCommit ||
        (snap.dirty && snap.patchHash !== expected.patchHash)
      )
        throw Error("Unexplained worktree change");
      if ((await git(record.realPath, ["ls-files", "-u"])).length)
        throw Error("Unresolved merge");
      return { ...record, headCommit: snap.headCommit };
    }
    if (d.linked || d.detached)
      throw Error(
        "Externally managed linked/detached workspace requires explicit isolation handling",
      );
    relativePath(policy.root);
    const names = taskNames(
      card.id,
      card.type ?? "Feature",
      card.slug ?? "task",
    );
    const target = await safePath(
      d.topLevel,
      policy.root + "/" + names.pathSegment,
      true,
    );
    await git(d.topLevel, ["check-ignore", policy.root + "/"]);
    if ((await git(d.topLevel, ["status", "--porcelain"])).length)
      throw Error("Base checkout must be clean");
    await git(d.topLevel, [
      "worktree",
      "add",
      "-b",
      names.branch,
      target,
      d.head,
    ]);
    record = {
      id: card.id,
      cardId: card.id,
      runId: card.id,
      commonGitDir: d.commonGitDir,
      realPath: await realpath(target),
      branch: names.branch,
      baseCommit: d.head,
      headCommit: d.head,
      ownership: "harness",
      detached: false,
      state: "ACTIVE",
      retainReason: null,
      graphViewId: null,
    };
    await immutableJson(stateRoot, key, record);
    return record;
  } finally {
    await lock.release();
  }
}
