import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  taskNames,
  detectWorkspace,
  ensureTaskWorktree,
  snapshotWorktree,
} from "../../harness/worktrees/manager.mjs";
import { admitParallel } from "../../harness/worktrees/admission.mjs";
const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
async function repo() {
  const p = await mkdtemp(join(tmpdir(), "clh-git-"));
  git(p, "init", "-b", "main");
  git(p, "config", "user.email", "test@example.invalid");
  git(p, "config", "user.name", "Test");
  await writeFile(join(p, "a.mjs"), "export const a=1;\n");
  await writeFile(join(p, ".gitignore"), ".clh-worktrees/\n");
  git(p, "add", ".");
  git(p, "commit", "-m", "baseline");
  return p;
}
const policy = {
  root: ".clh-worktrees",
  dedicated_required: true,
  parallel_enabled: true,
  max_active_cards: 2,
};
const card = {
  id: "CLH-3",
  type: "Feature",
  slug: "Worktrees",
  status: "READY",
  allowedPaths: ["a.mjs"],
  dependencies: [],
  executionPolicy: { parallelEligible: true, conflictGroups: [] },
};
test("names bind a stable safe card/branch pair", () => {
  assert.deepEqual(taskNames("CLH-3", "Feature", "Worktrees"), {
    branch: "feat/CLH-3-worktrees",
    pathSegment: "CLH-3-worktrees",
  });
  assert.throws(() => taskNames("../bad", "Bug", "x"));
  assert.throws(() => taskNames("CLH-3", "Feature", "../x"));
});
test("dedicated worktree is reused and source changes stay isolated", async () => {
  const p = await repo(),
    state = await mkdtemp(join(tmpdir(), "clh-state-"));
  const w = await ensureTaskWorktree(card, p, state, policy);
  assert.equal((await detectWorkspace(w.realPath)).linked, true);
  assert.equal(
    (await ensureTaskWorktree(card, p, state, policy)).realPath,
    w.realPath,
  );
  await writeFile(join(w.realPath, "a.mjs"), "export const a=2;\n");
  assert.equal(await readFile(join(p, "a.mjs"), "utf8"), "export const a=1;\n");
  await assert.rejects(ensureTaskWorktree(card, p, state, policy));
  const checkpoint = await snapshotWorktree(w.realPath);
  assert.equal(
    (await ensureTaskWorktree(card, p, state, policy, checkpoint)).realPath,
    w.realPath,
  );
});
test("branch collision and external detached worktrees are not forced", async () => {
  const p = await repo(),
    state = await mkdtemp(join(tmpdir(), "clh-state-"));
  git(p, "branch", "feat/CLH-3-worktrees");
  await assert.rejects(ensureTaskWorktree(card, p, state, policy));
  const other = join(await mkdtemp(join(tmpdir(), "clh-external-")), "view");
  git(p, "worktree", "add", "--detach", other, "HEAD");
  const d = await detectWorkspace(other);
  assert.equal(d.linked, true);
  assert.equal(d.detached, true);
  assert.equal(d.branch, null);
  await assert.rejects(
    ensureTaskWorktree({ ...card, id: "CLH-4" }, other, state, policy),
  );
  assert.equal(git(other, "branch", "--show-current"), "");
});
test("parallel admission considers paths, dependencies and semantic risk", () => {
  const active = [{ card: { ...card, id: "CLH-4", allowedPaths: ["b/"] } }];
  assert.equal(
    admitParallel(card, active, {}, [], { level: "LOW" }, policy).status,
    "PASS",
  );
  for (const risk of ["POTENTIAL", "UNKNOWN"])
    assert.equal(
      admitParallel(card, active, {}, [], { level: risk }, policy).status,
      "BLOCKED",
    );
  assert.equal(
    admitParallel(
      card,
      [{ card: { ...card, id: "CLH-4", allowedPaths: ["a.mjs"] } }],
      {},
      [],
      { level: "LOW" },
      policy,
    ).status,
    "BLOCKED",
  );
  assert.equal(
    admitParallel(
      { ...card, dependencies: [{ id: "CLH-4", status: "IN PROGRESS" }] },
      active,
      {},
      [],
      { level: "LOW" },
      policy,
    ).status,
    "BLOCKED",
  );
  assert.equal(
    admitParallel(
      card,
      active,
      {},
      [],
      { level: "LOW" },
      { ...policy, parallel_enabled: false },
    ).status,
    "BLOCKED",
  );
});
test("clean commits with different content have different candidate hashes", async () => {
  const p = await repo();
  const a = await snapshotWorktree(p);
  await writeFile(join(p, "a.mjs"), "export const a=9;\n");
  git(p, "add", "a.mjs");
  git(p, "commit", "-m", "changed");
  const b = await snapshotWorktree(p);
  assert.equal(a.dirty, false);
  assert.equal(b.dirty, false);
  assert.notEqual(a.patchHash, b.patchHash);
});
