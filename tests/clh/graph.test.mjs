import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  normalizeGraph,
  graphProvider,
  semanticRisk,
} from "../../harness/graph/provider.mjs";
import {
  repositorySnapshot,
  resolveGraphView,
  queryRepository,
} from "../../harness/graph/index-service.mjs";
import { retrieveFallback } from "../../harness/graph/fallback.mjs";
const nodes = [
  {
    id: "service",
    path: "service.mjs",
    name: "service",
    range: { startLine: 1, endLine: 1 },
  },
  {
    id: "component",
    path: "component.mjs",
    name: "component",
    range: { startLine: 1, endLine: 1 },
  },
  {
    id: "test",
    path: "service.test.mjs",
    name: "test",
    range: { startLine: 1, endLine: 1 },
  },
];
const graph = {
  nodes,
  edges: [
    {
      source: "component",
      target: "service",
      relation: "calls",
      confidence: "extracted",
    },
    {
      source: "test",
      target: "service",
      relation: "imports",
      confidence: "extracted",
    },
  ],
  coverage: { complete: true, languages: ["javascript"] },
};
test("directed graph queries find callers, dependents and bounded neighborhoods", async () => {
  const p = graphProvider(graph);
  const view = { id: "v", contentFingerprint: "f" };
  assert.deepEqual(
    (await p.findCallers(view, { symbols: ["service"] })).nodes.map(
      (n) => n.id,
    ),
    ["component"],
  );
  assert.equal(
    (await p.findSymbol(view, { query: "missing" })).status,
    "NOT_FOUND",
  );
  const n = await p.getNeighborhood(view, {
    symbols: ["service"],
    maxHops: 1,
    maxNodes: 2,
  });
  assert.equal(n.nodes.length, 2);
  assert.equal(n.truncated, true);
  assert.throws(() =>
    normalizeGraph({
      ...graph,
      edges: [{ source: "missing", target: "service" }],
    }),
  );
});
test("semantic risk flags different-file dependencies and unknown coverage", () => {
  assert.equal(
    semanticRisk(["service"], ["component"], graph).level,
    "POTENTIAL",
  );
  assert.equal(
    semanticRisk(["x"], ["y"], { ...graph, coverage: { complete: false } })
      .level,
    "UNKNOWN",
  );
});
test("worktree content changes invalidate graph view rather than reuse main data", async () => {
  const root = await mkdtemp(join(tmpdir(), "clh-graph-"));
  await writeFile(join(root, "service.mjs"), "export const service=1;\n");
  const state = await mkdtemp(join(tmpdir(), "clh-graph-state-"));
  const w = { id: "CLH-4", realPath: root, headCommit: "abc" };
  const before = await repositorySnapshot(w);
  await writeFile(join(root, "service.mjs"), "export const service=2;\n");
  const after = await repositorySnapshot(w);
  assert.notEqual(before.contentFingerprint, after.contentFingerprint);
  const unavailable = {
    capabilities: async () => ({
      provider: "none",
      version: "1",
      schemaVersion: 1,
    }),
    indexRepository: async () => ({ status: "UNAVAILABLE" }),
  };
  const resolved = await resolveGraphView(
    w,
    unavailable,
    { refresh_timeout_ms: 500, max_refresh_attempts: 1 },
    state,
  );
  assert.equal(resolved.health, "UNAVAILABLE");
  const items = await retrieveFallback(
    { concepts: ["service"], paths: [], maxFiles: 3, maxLines: 5 },
    w,
  );
  assert.equal(items.items.length, 1);
  assert.equal(items.items[0].text, "export const service=2;\n");
});
test("unsupported/stale provider uses targeted fallback with explicit reason", async () => {
  const root = await mkdtemp(join(tmpdir(), "clh-fallback-"));
  await writeFile(join(root, "service.mjs"), "export const service=1;\n");
  const w = { id: "CLH-4", realPath: root };
  const result = await queryRepository(
    null,
    "findSymbol",
    { concepts: ["service"], maxFiles: 2, maxLines: 4 },
    null,
    { retrieve: (r) => retrieveFallback(r, w) },
  );
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.fallback.items.length, 1);
  assert.ok(result.diagnostics.length);
});
test("missing symbol coverage cannot prove parallel safety", () => {
  assert.equal(semanticRisk(["absent"], ["component"], graph).level, "UNKNOWN");
});
test("incremental refresh receives changed files when supported and remains isolated", async () => {
  const root = await mkdtemp(join(tmpdir(), "clh-incremental-"));
  for (let i = 0; i < 10; i++)
    await writeFile(
      join(root, `module${i}.mjs`),
      `export const value${i}=${i};\n`,
    );
  const state = await mkdtemp(join(tmpdir(), "clh-index-"));
  const w = { id: "CLH-4", realPath: root, headCommit: "abc" };
  let mode = "initial";
  const provider = {
    capabilities: async () => ({
      provider: "fixture",
      version: "1",
      schemaVersion: 1,
      incrementalModes: ["file-delta"],
    }),
    indexRepository: async () => ({ status: "OK", graph }),
    refreshChanges: async (view, changes) => {
      assert.deepEqual(
        changes.map((c) => c.path),
        ["module0.mjs"],
      );
      mode = "incremental";
      return { status: "OK", graph };
    },
  };
  const initial = await resolveGraphView(
    w,
    provider,
    { refresh_timeout_ms: 1000 },
    state,
  );
  await writeFile(join(root, "module0.mjs"), "export const value0=99;\n");
  const updated = await resolveGraphView(
    w,
    provider,
    { refresh_timeout_ms: 1000, full_rebuild_changed_file_ratio: 0.2 },
    state,
    initial.view,
  );
  assert.equal(mode, "incremental");
  assert.notEqual(updated.view.id, initial.view.id);
});
test("fresh invocations recover prior view and cannot reset rebuild allowance", async () => {
  const root = await mkdtemp(join(tmpdir(), "clh-budget-graph-")),
    state = await mkdtemp(join(tmpdir(), "clh-budget-state-"));
  await writeFile(join(root, "service.mjs"), "export const value=1;\n");
  const w = { id: "CLH-4", realPath: root, headCommit: "abc" };
  let indexes = 0;
  const p = {
    capabilities: async () => ({
      provider: "fixture",
      version: "1",
      schemaVersion: 1,
      incrementalModes: [],
    }),
    indexRepository: async () => {
      indexes++;
      return { status: "OK", graph };
    },
  };
  const policy = { max_full_rebuilds_per_card: 1 };
  await resolveGraphView(w, p, policy, state);
  await writeFile(join(root, "service.mjs"), "export const value=2;\n");
  await resolveGraphView(w, p, policy, state);
  await writeFile(join(root, "service.mjs"), "export const value=3;\n");
  const third = await resolveGraphView(w, p, policy, state);
  assert.equal(indexes, 2);
  assert.equal(third.view, null);
  assert.ok(third.fallbackReasons.includes("GRAPH_REBUILD_BUDGET"));
});
