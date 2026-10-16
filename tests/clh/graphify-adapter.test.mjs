import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createGraphifyProvider,
  normalizeGraphify,
} from "../../harness/graph/adapters/graphify.mjs";
import { repositorySnapshot } from "../../harness/graph/index-service.mjs";
test("Graphify adapter rejects unsafe source references and normalizes edge directions", () => {
  const g = normalizeGraphify({
    nodes: [
      { id: "a", source_file: "a.py", label: "a", source_location: "L1" },
      { id: "b", source_file: "b.py", label: "b" },
    ],
    links: [
      {
        source: "a",
        target: "b",
        relation: "imports_from",
        confidence: "EXTRACTED",
      },
    ],
  });
  assert.equal(g.edges[0].relation, "imports");
  assert.equal(g.edges[0].source, "a");
  assert.equal(g.coverage.complete, false);
  assert.equal(g.nodes[0].range, null);
  assert.throws(() =>
    normalizeGraphify({
      nodes: [{ id: "a", source_file: "../../outside" }],
      links: [],
    }),
  );
});
test("absent or wrong Graphify identity is unavailable, not a fake index", async () => {
  const p = createGraphifyProvider({
    executable: "/missing/graphify",
    versionPin: "0.8.31",
  });
  assert.equal((await p.indexRepository({})).status, "UNAVAILABLE");
  const bad = createGraphifyProvider({
    executable: "/opt/homebrew/bin/graphify",
    pythonExecutable: "/opt/homebrew/opt/python@3.14/bin/python3.14",
    versionPin: "wrong",
  });
  assert.equal((await bad.indexRepository({})).status, "UNAVAILABLE");
});
test(
  "real installed Graphify code-only extraction runs in isolated staging",
  { skip: !process.env.CLH_TEST_GRAPHIFY },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "clh-native-"));
    await writeFile(join(root, "a.py"), "def service():\n    return 1\n");
    await writeFile(
      join(root, "b.py"),
      "from a import service\ndef caller():\n    return service()\n",
    );
    const state = await mkdtemp(join(tmpdir(), "clh-native-state-"));
    const p = createGraphifyProvider({
      executable: "/opt/homebrew/bin/graphify",
      pythonExecutable: "/opt/homebrew/opt/python@3.14/bin/python3.14",
      versionPin: "0.8.31",
    });
    const snap = await repositorySnapshot({
      id: "CLH-5",
      realPath: root,
      headCommit: "fixture",
    });
    const out = await p.indexRepository(snap, { cacheRoot: state });
    assert.equal(out.status, "PARTIAL");
    assert.ok(out.graph.nodes.length >= 4);
    assert.ok(out.graph.edges.some((e) => e.relation === "calls"));
    assert.deepEqual((await p.capabilities()).incrementalModes, []);
  },
);
