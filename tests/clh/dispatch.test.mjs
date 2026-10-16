import { environment } from "../fixtures/clh/environment.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fixtureCard } from "../fixtures/clh/card.mjs";
import { scopeDigest } from "../../harness/governance/authorization.mjs";
import { conservativeByteEstimator } from "../../harness/context/estimate.mjs";
import {
  prepareInvocation,
  dispatchInvocation,
  resumeCard,
  recordValidation,
} from "../../harness/execution/dispatch.mjs";
const runtime = {
  capabilities: async () => ({
    scopeEnforcement: true,
    usageLimits: true,
    termination: true,
    contextObservation: true,
    readOnlyReview: true,
  }),
  invoke: async ({ cwd, sessionMode }) => {
    assert.equal(sessionMode, "fresh");
    await writeFile(join(cwd, "service.mjs"), "export const service=2;\n");
    return { usage: { tokens: 200, costMicrounits: 0 } };
  },
};
test("unconfigured human/runtime capabilities cannot launch code", async () => {
  const e = await environment();
  delete e.adapters.authorizationVerifier;
  const p = await prepareInvocation(
    e.card.id,
    "implementer",
    e.adapters,
    e.state,
  );
  assert.equal(p.decision.status, "BLOCKED");
});
test("fresh dispatch preserves isolated worktree and resumes without prior conversation", async () => {
  const e = await environment();
  const p = await prepareInvocation(
    e.card.id,
    "implementer",
    e.adapters,
    e.state,
  );
  assert.equal(p.decision.status, "PASS");
  const result = await dispatchInvocation(p, runtime);
  assert.equal(result.status, "VALIDATING", JSON.stringify(result.reasons));
  const cp = await resumeCard(e.card.id, e.adapters, e.state);
  assert.equal(cp.worktreeId, e.card.id);
  assert.equal(cp.patchHash, result.checkpoint.patchHash);
  assert.equal(
    await readFile(join(e.root, "service.mjs"), "utf8"),
    "export const service=1;\n",
  );
});
test("revoked authorization between preparation and dispatch prevents launch", async () => {
  const e = await environment();
  const p = await prepareInvocation(
    e.card.id,
    "implementer",
    e.adapters,
    e.state,
  );
  e.approval.revoked = true;
  const r = await dispatchInvocation(p, runtime);
  assert.equal(r.status, "BLOCKED");
});
test("failed validation repairs with fresh context, same worktree and current diff", async () => {
  const e = await environment();
  const p = await prepareInvocation(
    e.card.id,
    "implementer",
    e.adapters,
    e.state,
  );
  const r = await dispatchInvocation(p, runtime);
  await recordValidation(
    r.checkpoint,
    [
      {
        gateId: "unit",
        status: "FAIL",
        patchHash: r.checkpoint.patchHash,
        command: "fixture unit",
        exitCode: 1,
      },
    ],
    ["unit"],
    e.state,
  );
  const repair = await prepareInvocation(
    e.card.id,
    "debugger",
    e.adapters,
    e.state,
  );
  assert.equal(repair.decision.status, "PASS");
  assert.equal(repair.worktree.realPath, p.worktree.realPath);
  assert.ok(
    repair.envelope.messages.some(
      (m) => m.id === "current-diff" && m.text.includes("service=2"),
    ),
  );
  const next = await dispatchInvocation(repair, runtime);
  assert.equal(next.status, "VALIDATING");
});
test("default dispatch still performs repository retrieval when graph provider is absent", async () => {
  const e = await environment();
  const p = await prepareInvocation(
    e.card.id,
    "implementer",
    e.adapters,
    e.state,
  );
  assert.equal(p.decision.status, "PASS");
  assert.ok(
    p.envelope.messages.some((m) => m.text.includes("export const service=1")),
  );
  await p.release();
});
test("deadline is anchored to one persisted start time", async () => {
  const e = await environment();
  const now = Date.now;
  Date.now = () => now() + 20;
  try {
    const p = await prepareInvocation(
      e.card.id,
      "implementer",
      e.adapters,
      e.state,
    );
    assert.equal(p.decision.status, "PASS");
    assert.equal(
      Date.parse(p.checkpoint.limits.deadline) -
        Date.parse(p.checkpoint.limits.startedAt),
      1800000,
    );
    await p.release();
  } finally {
    Date.now = now;
  }
});
test("fresh reviewer can continue REVIEW with exact diff and read-only scope", async () => {
  const e = await environment();
  const first = await prepareInvocation(
    e.card.id,
    "implementer",
    e.adapters,
    e.state,
  );
  const result = await dispatchInvocation(first, runtime);
  await recordValidation(
    result.checkpoint,
    [
      {
        gateId: "unit",
        status: "PASS",
        patchHash: result.checkpoint.patchHash,
        command: "fixture unit",
        exitCode: 0,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      },
    ],
    ["unit"],
    e.state,
  );
  const review = await prepareInvocation(
    e.card.id,
    "reviewer",
    e.adapters,
    e.state,
  );
  assert.equal(review.decision.status, "PASS");
  const r = await dispatchInvocation(review, {
    capabilities: runtime.capabilities,
    invoke: async (request) => {
      assert.deepEqual(request.allowedPaths, []);
      assert.ok(
        request.envelope.messages.some(
          (m) => m.id === "current-diff" && m.text.includes("service=2"),
        ),
      );
      return {
        usage: { tokens: 100, costMicrounits: 0 },
        review: {
          status: "PASS",
          patchHash: review.checkpoint.patchHash,
          contextId: request.invocationId,
        },
      };
    },
  });
  assert.equal(r.status, "REVIEW_PASSED");
});
test("repair receives remaining cost allowance and overrun is retained but blocked", async () => {
  const e = await environment();
  const first = await prepareInvocation(
    e.card.id,
    "implementer",
    e.adapters,
    e.state,
  );
  const expensive = {
    capabilities: runtime.capabilities,
    invoke: async (request) => ({
      ...(await runtime.invoke(request)),
      usage: { tokens: 200, costMicrounits: 60000 },
    }),
  };
  const r = await dispatchInvocation(first, expensive);
  await recordValidation(
    r.checkpoint,
    [
      {
        gateId: "unit",
        status: "FAIL",
        patchHash: r.checkpoint.patchHash,
        command: "fixture unit",
        exitCode: 1,
      },
    ],
    ["unit"],
    e.state,
  );
  const repair = await prepareInvocation(
    e.card.id,
    "debugger",
    e.adapters,
    e.state,
  );
  let allowance;
  const next = await dispatchInvocation(repair, {
    capabilities: runtime.capabilities,
    invoke: async (request) => {
      allowance = request.limits.maxCostMicrounits;
      return expensive.invoke(request);
    },
  });
  assert.equal(allowance, 40000);
  assert.equal(next.status, "BLOCKED");
  const { readEvents } = await import("../../harness/state/journal.mjs");
  assert.equal(
    (await readEvents(e.state, next.checkpoint.runId)).reduce(
      (sum, x) => sum + x.usage.costMicrounits,
      0,
    ),
    120000,
  );
});
test("expired context exception is checked again before any runtime launch", async () => {
  const e = await environment();
  e.card.executionPolicy.contextExceptionId = "exception";
  e.approval.scopeDigest = scopeDigest(e.card);
  e.adapters.contextSources = async () => ({
    items: [
      {
        id: "C0",
        source: "rule",
        sourceRevision: "1",
        text: "x".repeat(60000),
        mandatory: true,
      },
    ],
    exceptionVerifier: {
      verify: async () => ({ status: "VALID", human: true }),
    },
  });
  e.adapters.policy.exceptions = [
    {
      id: "exception",
      cardId: e.card.id,
      scopeDigest: scopeDigest(e.card),
      model: "fixture",
      maximumRatio: 0.8,
      expiresAt: new Date(Date.now() + 1000).toISOString(),
    },
  ];
  const p = await prepareInvocation(
    e.card.id,
    "implementer",
    e.adapters,
    e.state,
  );
  assert.equal(p.decision.status, "PASS");
  let launched = false;
  const original = Date.now;
  Date.now = () => original() + 2000;
  try {
    const out = await dispatchInvocation(p, {
      capabilities: runtime.capabilities,
      invoke: async () => {
        launched = true;
        return { usage: { tokens: 1, costMicrounits: 0 } };
      },
    });
    assert.equal(out.status, "BLOCKED");
    assert.equal(launched, false);
  } finally {
    Date.now = original;
  }
});
