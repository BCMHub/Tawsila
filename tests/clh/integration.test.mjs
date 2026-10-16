import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { ensureTaskWorktree, git } from "../../harness/worktrees/manager.mjs";
import {
  prepareIntegration,
  verifyIntegration,
  mergeIntegration,
  cleanupWorktree,
} from "../../harness/worktrees/integration.mjs";
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "clh-merge-")),
    state = await mkdtemp(join(tmpdir(), "clh-merge-state-"));
  const run = (cwd, ...a) =>
    execFileSync("git", a, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  run(root, "init", "-b", "main");
  run(root, "config", "user.name", "Test");
  run(root, "config", "user.email", "test@example.invalid");
  await writeFile(join(root, ".gitignore"), ".clh-worktrees/\n");
  await writeFile(join(root, "service.mjs"), "export const value=1;\n");
  run(root, "add", ".");
  run(root, "commit", "-m", "baseline");
  const w = await ensureTaskWorktree(
    { id: "CLH-9", type: "Feature", slug: "integration", status: "READY" },
    root,
    state,
    { root: ".clh-worktrees" },
  );
  await writeFile(join(w.realPath, "service.mjs"), "export const value=2;\n");
  run(w.realPath, "add", "service.mjs");
  run(w.realPath, "commit", "-m", "CLH-9 change");
  const candidate = run(w.realPath, "rev-parse", "HEAD");
  run(root, "switch", "--detach");
  const adapters = {
    cwd: root,
    stateRoot: state,
    worktreeRoot: ".clh-worktrees",
    review: {
      independent: true,
      reviewedCommit: candidate,
      reviewerContextId: "separate-review",
    },
    requiredIntegrationGates: ["regression"],
    syncIntegration: async () => ({ status: "PASS" }),
  };
  return { root, state, w, candidate, adapters };
}
async function validator(record) {
  const start = new Date().toISOString();
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import{value}from'./service.mjs';if(value!==2)process.exit(1)",
    ],
    { cwd: record.realPath, env: process.env, stdio: "pipe" },
  );
  return [
    {
      gateId: "regression",
      status: "PASS",
      commit: record.mergeCommit,
      treeHash: record.treeHash,
      command: "node assert merged value=2",
      exitCode: 0,
      startedAt: start,
      endedAt: new Date().toISOString(),
    },
  ];
}
const human = { verify: async () => ({ status: "VALID", human: true }) };
test("separate integration verifies exact candidate, advances target and cleans owned worktree", async () => {
  const e = await setup();
  const p = await prepareIntegration("CLH-9", e.candidate, "main", e.adapters);
  const gates = await verifyIntegration(p, validator);
  const integrated = await mergeIntegration(p, gates, human);
  assert.equal(
    await git(e.root, ["rev-parse", "main"]),
    integrated.mergeCommit,
  );
  const cleanup = await cleanupWorktree(
    { ...e.w, integrationId: integrated.id, stateRoot: e.state },
    { cleanup_after_integration: true },
  );
  assert.equal(cleanup.status, "CLEANED");
  await assert.rejects(access(e.w.realPath));
  assert.equal(
    (
      await cleanupWorktree(
        { ...e.w, integrationId: integrated.id, stateRoot: e.state },
        { cleanup_after_integration: true },
      )
    ).status,
    "CLEANED",
  );
});
test("dirty owned worktree remains after successful integration", async () => {
  const e = await setup();
  const p = await prepareIntegration("CLH-9", e.candidate, "main", e.adapters);
  const gates = await verifyIntegration(p, validator);
  const integrated = await mergeIntegration(p, gates, human);
  await writeFile(join(e.w.realPath, "untracked.txt"), "keep");
  assert.equal(
    (
      await cleanupWorktree(
        { ...e.w, integrationId: integrated.id, stateRoot: e.state },
        { cleanup_after_integration: true },
      )
    ).status,
    "RETAINED",
  );
  await access(e.w.realPath);
});
test("changed target and missing human merge approval block advancement", async () => {
  const e = await setup();
  const p = await prepareIntegration("CLH-9", e.candidate, "main", e.adapters);
  const gates = await verifyIntegration(p, validator);
  await assert.rejects(
    mergeIntegration(p, gates, {
      verify: async () => ({ status: "UNAVAILABLE" }),
    }),
  );
  assert.notEqual(await git(e.root, ["rev-parse", "main"]), p.mergeCommit);
});
test("post-merge validator cannot certify modified source and target is not reset", async () => {
  const e = await setup();
  const p = await prepareIntegration("CLH-9", e.candidate, "main", e.adapters);
  let calls = 0;
  const mutation = async (r) => {
    calls++;
    if (calls === 2)
      await writeFile(
        join(r.realPath, "service.mjs"),
        "export const value=2;\n// modified during post-validation\n",
      );
    return validator(r);
  };
  const gates = await verifyIntegration(p, mutation);
  await assert.rejects(mergeIntegration(p, gates, human));
  assert.equal(await git(e.root, ["rev-parse", "main"]), p.mergeCommit);
  await assert.rejects(
    access(join(e.state, "integrations", p.id, "integrated.json")),
  );
});
