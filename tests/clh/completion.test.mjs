import test from "node:test";
import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { environment } from "../fixtures/clh/environment.mjs";
import {
  prepareInvocation,
  dispatchInvocation,
  recordValidation,
} from "../../harness/execution/dispatch.mjs";
import {
  completeCard,
  synchronizeCompletion,
} from "../../harness/execution/completion.mjs";
import { git } from "../../harness/worktrees/manager.mjs";
import { acquireLock } from "../../harness/state/lock.mjs";
import { loadCheckpoint } from "../../harness/execution/checkpoint.mjs";
import { readEvents } from "../../harness/state/journal.mjs";
const caps = async () => ({
  scopeEnforcement: true,
  usageLimits: true,
  termination: true,
  contextObservation: true,
  readOnlyReview: true,
});
async function reviewed() {
  const e = await environment();
  const p = await prepareInvocation(
    e.card.id,
    "implementer",
    e.adapters,
    e.state,
  );
  const r = await dispatchInvocation(p, {
    capabilities: caps,
    invoke: async (x) => {
      await writeFile(join(x.cwd, "service.mjs"), "export const service=2;\n");
      return { usage: { tokens: 200, costMicrounits: 0 } };
    },
  });
  await recordValidation(
    r.checkpoint,
    [
      {
        gateId: "unit",
        status: "PASS",
        patchHash: r.checkpoint.patchHash,
        command: "test fixture",
        exitCode: 0,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      },
    ],
    ["unit"],
    e.state,
  );
  const rp = await prepareInvocation(
    e.card.id,
    "reviewer",
    e.adapters,
    e.state,
  );
  const rr = await dispatchInvocation(rp, {
    capabilities: caps,
    invoke: async (x) => ({
      usage: { tokens: 100, costMicrounits: 0 },
      review: {
        status: "PASS",
        patchHash: rp.checkpoint.patchHash,
        contextId: x.invocationId,
      },
    }),
  });
  assert.equal(rr.status, "REVIEW_PASSED");
  return { ...e, checkpoint: rr.checkpoint };
}
test("completion commits reviewed content and records VERIFIED only after sync acknowledgement", async () => {
  const e = await reviewed();
  let synchronized;
  e.adapters.notion.verifyCard = async (metadata) => {
    synchronized = metadata;
    e.card.status = "VERIFIED";
    return { status: "PASS", commit: metadata.commit, cardId: metadata.cardId };
  };
  const done = await completeCard(e.checkpoint, e.adapters, e.state);
  assert.equal(done.status, "VERIFIED");
  assert.equal(
    await git(e.checkpoint.worktreePath, ["rev-parse", "HEAD"]),
    done.commit,
  );
  assert.equal(synchronized.commit, done.commit);
  assert.ok(
    (
      await git(e.checkpoint.worktreePath, ["log", "-1", "--format=%s"])
    ).startsWith("CLH-7"),
  );
});
test("failed synchronization retries only sync and never reimplements or duplicates a commit", async () => {
  const e = await reviewed();
  e.adapters.notion.verifyCard = async () => {
    throw Error("offline");
  };
  const pending = await completeCard(e.checkpoint, e.adapters, e.state);
  assert.equal(pending.status, "SYNC_PENDING");
  const before = await git(e.checkpoint.worktreePath, [
    "rev-list",
    "--count",
    "HEAD",
  ]);
  e.adapters.notion.verifyCard = async (metadata) => ({
    status: "PASS",
    commit: metadata.commit,
    cardId: metadata.cardId,
  });
  const done = await synchronizeCompletion(e.card.id, e.adapters, e.state);
  assert.equal(done.status, "VERIFIED");
  assert.equal(
    await git(e.checkpoint.worktreePath, ["rev-list", "--count", "HEAD"]),
    before,
  );
  assert.equal(done.commit, pending.commit);
});
test("completion rejects an acknowledgement for another revision", async () => {
  const e = await reviewed();
  e.adapters.notion.verifyCard = async () => ({
    status: "PASS",
    commit: "wrong",
    cardId: e.card.id,
  });
  assert.equal(
    (await completeCard(e.checkpoint, e.adapters, e.state)).status,
    "SYNC_PENDING",
  );
});
test("completion retry ceiling persists without repeating commits", async () => {
  const e = await reviewed();
  let calls = 0;
  e.adapters.notion.verifyCard = async () => {
    calls++;
    throw Error("offline");
  };
  await completeCard(e.checkpoint, e.adapters, e.state);
  await synchronizeCompletion(e.card.id, e.adapters, e.state);
  await synchronizeCompletion(e.card.id, e.adapters, e.state);
  await assert.rejects(synchronizeCompletion(e.card.id, e.adapters, e.state));
  assert.equal(calls, 3);
});

test("completion trusts the persisted checkpoint rather than caller fields", async () => {
  const e = await reviewed();
  e.adapters.notion.verifyCard = async (metadata) => ({
    status: "PASS",
    commit: metadata.commit,
    cardId: metadata.cardId,
  });
  const forged = {
    ...e.checkpoint,
    reviewEvidence: { status: "PASS", independent: true, patchHash: "forged" },
    patchHash: "forged",
  };
  const result = await completeCard(forged, e.adapters, e.state);
  assert.equal(result.status, "VERIFIED");
  const persisted = await loadCheckpoint(e.state, e.card.id);
  assert.equal(persisted.stage, "VERIFIED");
  assert.equal(persisted.reviewEvidence.patchHash, e.checkpoint.patchHash);
});

test("completion lock contention does not mutate the active task journal", async () => {
  const e = await reviewed();
  const before = await readEvents(e.state, e.checkpoint.runId);
  const lock = await acquireLock(e.state, "card:" + e.card.id, {
    runId: e.checkpoint.runId,
  });
  const result = await completeCard(e.checkpoint, e.adapters, e.state);
  await lock.release();
  assert.equal(result.status, "BLOCKED");
  assert.equal(
    (await readEvents(e.state, e.checkpoint.runId)).length,
    before.length,
  );
});

test("completion verifies branch ownership before committing reviewed content", async () => {
  const e = await reviewed();
  await git(e.checkpoint.worktreePath, ["switch", "-c", "unexpected-branch"]);
  e.adapters.notion.verifyCard = async () => {
    throw Error("should not reach sync");
  };
  const result = await completeCard(e.checkpoint, e.adapters, e.state);
  assert.equal(result.status, "BLOCKED");
  assert.match(result.reasons[0], /WORKTREE/);
});

test("missing persisted checkpoint returns a blocked result and releases its lock", async () => {
  const e = await reviewed();
  await rm(join(e.state, "checkpoints", e.checkpoint.id + ".json"));
  const result = await completeCard(e.checkpoint, e.adapters, e.state);
  assert.equal(result.status, "BLOCKED");
  assert.match(result.reasons[0], /ENOENT/);
  assert.equal(result.commit, null);
  const lock = await acquireLock(e.state, "card:" + e.card.id, {
    runId: e.checkpoint.runId,
  });
  await lock.release();
});

test("stale completion request preserves pending synchronization for retry", async () => {
  const e = await reviewed();
  e.adapters.notion.verifyCard = async () => {
    throw Error("offline");
  };
  const pending = await completeCard(e.checkpoint, e.adapters, e.state);
  assert.equal(pending.status, "SYNC_PENDING");
  const retryable = await loadCheckpoint(e.state, e.card.id);
  const stale = await completeCard(e.checkpoint, e.adapters, e.state);
  assert.equal(stale.status, "BLOCKED");
  assert.equal(stale.reasons[0], "STALE_COMPLETION_CHECKPOINT");
  assert.equal((await loadCheckpoint(e.state, e.card.id)).id, retryable.id);
  e.adapters.notion.verifyCard = async (metadata) => ({
    status: "PASS",
    commit: metadata.commit,
    cardId: metadata.cardId,
  });
  const done = await synchronizeCompletion(e.card.id, e.adapters, e.state);
  assert.equal(done.status, "VERIFIED");
  assert.equal(done.commit, pending.commit);
});
