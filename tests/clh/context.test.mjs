import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  usableCapacity,
  contextZone,
} from "../../harness/context/capacity.mjs";
import {
  estimateInput,
  conservativeByteEstimator,
} from "../../harness/context/estimate.mjs";
import {
  selectContext,
  compactContext,
} from "../../harness/context/select.mjs";
import { buildContextPack } from "../../harness/context/manifest.mjs";
import { retrieveRepositoryContext } from "../../harness/context/repository.mjs";
const profile = {
  model: "fixture",
  effort: "medium",
  context_window_tokens: 110000,
  reserved_output_tokens: 9000,
  provider_overhead_tokens: 1000,
  supported_efforts: ["medium"],
  capacity_source: "fixture documented capacity",
  estimator_id: "bytes-v1",
  estimator_version: "1",
};
const item = (id, text, mandatory = false, priority = 1) => ({
  id,
  source: "fixture",
  sourceRevision: "v1",
  text,
  mandatory,
  priority,
  layer: "C3",
});
test("usable capacity and 30/40% boundaries are enforced without padding", () => {
  assert.equal(usableCapacity(profile), 100000);
  for (const [n, zone] of [
    [20000, "green"],
    [30000, "green"],
    [40000, "amber"],
    [40001, "red"],
  ])
    assert.equal(contextZone(n, 100000).zone, zone);
  assert.throws(() => usableCapacity({ ...profile, context_window_tokens: 0 }));
});
test("unknown estimator or unbounded attachments block estimation", async () => {
  await assert.rejects(estimateInput({ messages: [] }, null));
  await assert.rejects(
    estimateInput(
      { attachments: [{ image: "unknown" }] },
      conservativeByteEstimator,
    ),
  );
});
test("mandatory context survives deduplication while optional low priority is removed first", () => {
  const items = [
    item("rule", "must preserve", true),
    item("alias", "must preserve", true),
    item("optional", "x".repeat(10000), false, 1),
    item("high", "important", false, 100),
  ];
  const out = selectContext(items, [], 100, (t) => Buffer.byteLength(t));
  assert.equal(
    out.some((i) => i.id === "optional"),
    false,
  );
  assert.equal(
    out.some((i) => i.text === "must preserve"),
    true,
  );
  assert.equal(
    out.some((i) => i.id === "high"),
    true,
  );
  assert.ok(compactContext(items).length < items.length);
});
test("mandatory context too broad proposes decomposition and never dispatches", async () => {
  const pack = await buildContextPack(
    {
      id: "CLH-6",
      objective: "service",
      acceptanceCriteria: [{ id: "AC1", text: "complete" }],
      allowedPaths: ["a.mjs"],
    },
    { id: "CLH-6", headCommit: "abc" },
    null,
    { items: [item("C0", "x".repeat(60000), true)] },
    profile,
    conservativeByteEstimator,
    { context_budget: { preferred_ratio: 0.3, maximum_normal_ratio: 0.4 } },
  );
  assert.equal(pack.decision.status, "BLOCKED");
  assert.equal(pack.proposal.status, "PROPOSED");
  assert.ok(pack.manifest.ratio > 0.4);
});
test("graph discovery precedes targeted reads and stale source selects fallback", async () => {
  const root = await mkdtemp(join(tmpdir(), "clh-context-"));
  await writeFile(
    join(root, "service.mjs"),
    "export function service(){ return 1; }\n",
  );
  let queried = false;
  const service = {
    resolve: async () => ({ view: null, health: "UNAVAILABLE" }),
    query: async () => {
      queried = true;
      return { status: "NOT_FOUND", nodes: [] };
    },
  };
  const out = await retrieveRepositoryContext(
    {
      id: "CLH-6",
      objective: "service",
      allowedPaths: ["service.mjs"],
      acceptanceCriteria: [],
    },
    { id: "CLH-6", realPath: root },
    service,
    null,
    { max_nodes: 40, max_hops: 2 },
  );
  assert.equal(queried, true);
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].filePath, "service.mjs");
  assert.ok(out.graphContext.fallbackReasons.length);
});
test("full input envelope counts graph summaries and optional code is pruned below ceiling", async () => {
  const card = {
    id: "CLH-6",
    objective: "service",
    acceptanceCriteria: [],
    allowedPaths: ["service.mjs"],
  };
  const p = await buildContextPack(
    card,
    { id: "CLH-6", headCommit: "abc" },
    null,
    {
      items: [
        item("C0", "Constitution", true),
        item("huge", "x".repeat(50000)),
      ],
    },
    profile,
    conservativeByteEstimator,
    { context_budget: { preferred_ratio: 0.3, maximum_normal_ratio: 0.4 } },
  );
  assert.equal(p.decision.status, "PASS");
  assert.ok(p.manifest.ratio <= 0.4);
  assert.ok(p.manifest.omitted.some((o) => o.id === "huge"));
  assert.ok(p.manifest.estimatedInputTokens > 0);
});
test("context exceptions require trusted human approval and exact scope/model binding", async () => {
  const { fixtureCard } = await import("../fixtures/clh/card.mjs");
  const { scopeDigest } =
    await import("../../harness/governance/authorization.mjs");
  const c = fixtureCard("CLH-6");
  c.executionPolicy.contextExceptionId = "exception";
  const exception = {
    id: "exception",
    cardId: c.id,
    scopeDigest: scopeDigest(c),
    model: profile.model,
    maximumRatio: 0.8,
    expiresAt: "2099-01-01T00:00:00Z",
  };
  const source = {
    items: [item("C0", "x".repeat(60000), true)],
    exceptionVerifier: {
      verify: async () => ({ status: "VALID", human: true }),
    },
  };
  const policy = {
    context_budget: { preferred_ratio: 0.3, maximum_normal_ratio: 0.4 },
    exceptions: [exception],
  };
  const p = await buildContextPack(
    c,
    { id: c.id },
    null,
    source,
    profile,
    conservativeByteEstimator,
    policy,
  );
  assert.equal(p.decision.status, "PASS");
  assert.equal(p.manifest.exceptionId, "exception");
  const denied = await buildContextPack(
    c,
    { id: c.id },
    null,
    { items: source.items },
    profile,
    conservativeByteEstimator,
    policy,
  );
  assert.equal(denied.decision.status, "BLOCKED");
});
test("healthy graph source is accepted while partial/ambiguous coverage triggers fallback", async () => {
  const { resolveGraphView, queryRepository } =
    await import("../../harness/graph/index-service.mjs");
  const root = await mkdtemp(join(tmpdir(), "clh-healthy-")),
    state = await mkdtemp(join(tmpdir(), "clh-healthy-state-"));
  await writeFile(join(root, "service.mjs"), "export const service=1;\n");
  const w = { id: "CLH-6", realPath: root, headCommit: "abc" };
  const graph = {
    nodes: [
      {
        id: "service",
        name: "service",
        path: "service.mjs",
        range: { startLine: 1, endLine: 1 },
      },
    ],
    edges: [],
    coverage: { complete: true },
  };
  const provider = {
    capabilities: async () => ({
      provider: "fixture",
      version: "1",
      schemaVersion: 1,
      incrementalModes: [],
    }),
    indexRepository: async () => ({ status: "OK", graph }),
  };
  const resolved = await resolveGraphView(w, provider, {}, state);
  let fallbacks = 0;
  const fallback = {
    retrieve: async () => {
      fallbacks++;
      return { items: [], diagnostics: ["FIXTURE_FALLBACK"] };
    },
  };
  const svc = {
    resolve: async () => resolved,
    query: (v, o, r) => queryRepository(v, o, r),
  };
  const clean = await retrieveRepositoryContext(
    { id: w.id, objective: "service", allowedPaths: ["service.mjs"] },
    w,
    svc,
    fallback,
    {},
  );
  assert.equal(fallbacks, 0);
  assert.equal(
    clean.items[0].purpose,
    "graph-selected dependency neighborhood",
  );
  const partial = {
    resolve: async () => ({ ...resolved, health: "PARTIAL" }),
    query: async (v, o, r) =>
      r.query === "ambiguous"
        ? { status: "AMBIGUOUS", nodes: [] }
        : queryRepository(v, o, r),
  };
  await retrieveRepositoryContext(
    { id: w.id, objective: "service ambiguous", allowedPaths: ["service.mjs"] },
    w,
    partial,
    fallback,
    {},
  );
  assert.equal(fallbacks, 1);
});
