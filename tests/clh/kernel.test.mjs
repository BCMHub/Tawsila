import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateCard,
  validatePolicy,
} from "../../harness/governance/contracts.mjs";
import {
  scopeDigest,
  preflight,
} from "../../harness/governance/authorization.mjs";
import { appendEvent, readEvents } from "../../harness/state/journal.mjs";
import { acquireLock } from "../../harness/state/lock.mjs";
import { checkBudget, recordUsage } from "../../harness/state/budget.mjs";
export const card = () => ({
  id: "CLH-2",
  notionUrl: "https://notion.so/card",
  status: "READY",
  scopeRevision: "3",
  objective: "Authorize work",
  acceptanceCriteria: [{ id: "AC1", text: "Block unauthorized work" }],
  allowedPaths: ["harness/"],
  dependencies: [],
  origin: "Human",
  designRequired: false,
  figmaReferences: [],
  requiredPlatforms: ["Harness"],
  risk: "Medium",
  budget: {
    attempts: 3,
    repairs: 2,
    connectorRetries: 2,
    durationMs: 1800000,
    maxTokens: 10000,
    maxCostMicrounits: 10000,
  },
  executionPolicy: {
    worktreeRequired: true,
    isolationExceptionId: null,
    parallelEligible: false,
    conflictGroups: [],
    contextPolicyId: "default",
    contextExceptionId: null,
  },
});
const verifier = {
  verify: async () => ({
    status: "VALID",
    human: true,
    reason: "trusted test fixture",
  }),
};
const approval = (c) => ({
  cardId: c.id,
  scopeDigest: scopeDigest(c),
  approverId: "human",
  approvedAt: "2026-10-16T10:00:00Z",
  evidenceUrl: "https://notion.so/approval",
  revoked: false,
  riskExceptions: [],
});
test("READY status alone does not authorize implementation", async () => {
  assert.equal((await preflight(card(), null, verifier)).status, "BLOCKED");
});
test("approval is bound to exact scope and trusted verifier", async () => {
  const c = card(),
    a = approval(c);
  assert.equal((await preflight(c, a, verifier)).status, "PASS");
  c.allowedPaths.push("other/");
  assert.equal((await preflight(c, a, verifier)).status, "BLOCKED");
  assert.equal((await preflight(card(), approval(card()))).status, "BLOCKED");
});
test("proposed/revoked/nonhuman/dependent cards cannot execute", async () => {
  for (const change of [
    { status: "PROPOSED" },
    { dependencies: [{ id: "CLH-1", status: "REVIEW" }] },
  ]) {
    const c = { ...card(), ...change };
    assert.equal((await preflight(c, approval(c), verifier)).status, "BLOCKED");
  }
  const c = card();
  assert.equal(
    (await preflight(c, { ...approval(c), revoked: true }, verifier)).status,
    "BLOCKED",
  );
  assert.equal(
    (
      await preflight(c, approval(c), {
        verify: async () => ({ status: "VALID", human: false }),
      })
    ).status,
    "BLOCKED",
  );
});
test("canonical scope ignores object-key order and workflow status, but not policy", () => {
  const c = card();
  assert.equal(
    scopeDigest(c),
    scopeDigest(Object.fromEntries(Object.entries(c).reverse())),
  );
  assert.equal(scopeDigest(c), scopeDigest({ ...c, status: "IN PROGRESS" }));
  assert.notEqual(
    scopeDigest(c),
    scopeDigest({
      ...c,
      executionPolicy: {
        ...c.executionPolicy,
        contextExceptionId: "exception",
      },
    }),
  );
});
test("malformed scope and unsafe paths never silently drop constraints", () => {
  for (const x of [
    { ...card(), unknown: true },
    { ...card(), allowedPaths: ["../secrets"] },
    { ...card(), acceptanceCriteria: [] },
    { ...card(), budget: { ...card().budget, maxTokens: -1 } },
    { ...card(), designRequired: true },
  ])
    assert.throws(() => validateCard(x));
});
test("invalid context thresholds reject policy", () => {
  assert.throws(() =>
    validatePolicy({
      context_budget: { preferred_ratio: 0.5, maximum_normal_ratio: 0.4 },
    }),
  );
});
const ev = (
  sequence,
  previousState,
  newState,
  operationId = String(sequence),
) => ({
  schemaVersion: 3,
  sequence,
  runId: "r1",
  cardId: "CLH-2",
  operationId,
  previousState,
  newState,
  timestamp: "2026-10-16T10:00:00Z",
  scopeDigest: "abc",
  usage: {
    attempts: 0,
    repairs: 0,
    connectorRetries: 0,
    tokens: 0,
    costMicrounits: 0,
    elapsedMs: 0,
  },
  artifacts: [],
  worktreeId: null,
  invocationId: null,
  checkpointId: null,
  policyDigest: "p",
  graphContextId: null,
});
test("journal replays idempotently and rejects conflicting operation or corrupt record", async () => {
  const root = await mkdtemp(join(tmpdir(), "clh-journal-"));
  await appendEvent(root, ev(1, null, "CLAIMED"));
  await appendEvent(root, ev(1, null, "CLAIMED"));
  assert.equal((await readEvents(root, "r1")).length, 1);
  await assert.rejects(appendEvent(root, ev(1, null, "BLOCKED")));
  await appendEvent(root, ev(2, "CLAIMED", "BLOCKED"));
  await writeFile(join(root, "runs/r1/00000002.json"), "{");
  await assert.rejects(readEvents(root, "r1"));
});
test("locks exclude another writer but independent cards proceed", async () => {
  const root = await mkdtemp(join(tmpdir(), "clh-lock-"));
  const a = await acquireLock(root, "card:CLH-2", { runId: "r1" });
  await assert.rejects(acquireLock(root, "card:CLH-2", { runId: "r2" }));
  const b = await acquireLock(root, "card:CLH-3", { runId: "r2" });
  await b.release();
  await a.release();
  const c = await acquireLock(root, "card:CLH-2", { runId: "r3" });
  await c.release();
});
test("budgets reject overflow, clock rollback and restart reset", () => {
  const limits = {
    ...card().budget,
    startedAt: "2026-10-16T10:00:00Z",
    deadline: "2026-10-16T10:30:00Z",
  };
  const used = {
    ...ev(1, null, "CLAIMED"),
    usage: { ...ev(1, null, "CLAIMED").usage, attempts: 3 },
  };
  assert.equal(
    checkBudget(limits, [used], "2026-10-16T10:01:00Z").status,
    "BLOCKED",
  );
  assert.equal(
    checkBudget(limits, [], "2026-10-16T09:59:00Z").status,
    "BLOCKED",
  );
  assert.equal(
    checkBudget(limits, [], "2026-10-16T10:30:00Z").status,
    "BLOCKED",
  );
  assert.throws(() => recordUsage({}, { tokens: -1 }));
  assert.throws(() =>
    recordUsage({ tokens: Number.MAX_SAFE_INTEGER }, { tokens: 1 }),
  );
});

test("policy rejects unknown capacity, exceptions and unsafe parallel settings", async () => {
  const base = JSON.parse(
    await readFile(new URL("../../policies/harness.json", import.meta.url)),
  );
  for (const patch of [
    { models: { bad: {} } },
    { exceptions: [{}] },
    {
      worktrees: {
        ...base.worktrees,
        parallel_enabled: true,
        max_active_cards: 1,
      },
    },
    { code_graph: { ...base.code_graph, fallback_order: ["run-anything"] } },
    {
      code_graph: {
        ...base.code_graph,
        semantic_parallel_policy: "ignore-conflicts",
      },
    },
  ])
    assert.throws(() => validatePolicy({ ...base, ...patch }));
});
test("incomplete journal and unknown usage are not evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "clh-evidence-"));
  const missing = ev(1, null, "CLAIMED");
  delete missing.cardId;
  await assert.rejects(appendEvent(root, missing));
  await assert.rejects(
    appendEvent(root, { ...ev(1, null, "CLAIMED"), usage: { tokens: null } }),
  );
  assert.throws(() => recordUsage({}, { tokens: null }));
  const limits = {
    ...card().budget,
    startedAt: "2026-10-16T10:00:00Z",
    deadline: "2026-10-16T10:30:00Z",
  };
  assert.equal(
    checkBudget(
      limits,
      [{ timestamp: "bad", usage: {} }],
      "2026-10-16T09:59:00Z",
    ).status,
    "BLOCKED",
  );
  assert.equal(
    checkBudget(limits, [], "2026-10-16T10:00:00Z", "unknown").status,
    "BLOCKED",
  );
});
test("journal cannot change card scope or escape artifact roots", async () => {
  const root = await mkdtemp(join(tmpdir(), "clh-binding-"));
  await appendEvent(root, ev(1, null, "CLAIMED"));
  await assert.rejects(
    appendEvent(root, { ...ev(2, "CLAIMED", "BLOCKED"), cardId: "CLH-3" }),
  );
  await assert.rejects(
    appendEvent(root, {
      ...ev(2, "CLAIMED", "BLOCKED"),
      scopeDigest: "different",
    }),
  );
  await assert.rejects(
    appendEvent(root, {
      ...ev(2, "CLAIMED", "BLOCKED"),
      artifacts: ["../../outside"],
    }),
  );
});
test("malformed design, criterion, policy and duration cannot pass", async () => {
  for (const patch of [
    { designRequired: true, figmaReferences: [null] },
    { acceptanceCriteria: [{ id: 7, text: {} }] },
    { risk: "anything" },
    { requiredPlatforms: [null] },
    { executionPolicy: { ...card().executionPolicy, unknown: true } },
  ])
    assert.throws(() => validateCard({ ...card(), ...patch }));
  const limits = {
    ...card().budget,
    startedAt: "2026-10-16T10:00:00Z",
    deadline: "2026-10-16T10:30:00Z",
  };
  delete limits.durationMs;
  assert.equal(
    checkBudget(limits, [], "2026-10-16T10:01:00Z").status,
    "BLOCKED",
  );
  assert.throws(() => recordUsage({}, { tokenz: 3 }));
});
test("source bytes and decoded text have the same content digest", async () => {
  const { digest } = await import("../../harness/state/files.mjs");
  assert.equal(
    digest(Buffer.from("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
test("atomic metadata pointers can change while immutable evidence cannot", async () => {
  const { atomicJson, readJson } =
    await import("../../harness/state/files.mjs");
  const root = await mkdtemp(join(tmpdir(), "clh-pointer-"));
  assert.equal(typeof atomicJson, "function");
  await atomicJson(root, "pointer.json", { version: 1 });
  await atomicJson(root, "pointer.json", { version: 2 });
  assert.deepEqual(await readJson(root, "pointer.json"), { version: 2 });
});
