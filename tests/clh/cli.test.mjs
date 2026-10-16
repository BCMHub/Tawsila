import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../harness/cli.mjs";
import { fixtureCard } from "../fixtures/clh/card.mjs";
import { scopeDigest } from "../../harness/governance/authorization.mjs";
test("CLI checks never authorize a card through a user-supplied approval file", async () => {
  const root = await mkdtemp(join(tmpdir(), "clh-cli-"));
  const c = fixtureCard();
  await writeFile(join(root, "card.json"), JSON.stringify(c));
  await writeFile(
    join(root, "approval.json"),
    JSON.stringify({
      cardId: c.id,
      scopeDigest: scopeDigest(c),
      approverId: "fixture",
      approvedAt: "2026-10-16T10:00:00Z",
      evidenceUrl: "https://notion.so/a",
      revoked: false,
      riskExceptions: [],
    }),
  );
  let out;
  assert.equal(
    await main(
      ["check", "--card", "card.json", "--approval", "approval.json"],
      { cwd: root, stdout: (s) => (out = JSON.parse(s)) },
    ),
    2,
  );
  assert.equal(out.status, "BLOCKED");
});
test("CLI rejects malformed input, unsafe identifiers and unknown commands", async () => {
  for (const argv of [
    [],
    ["destroy"],
    ["inspect", "--run", "../outside"],
    ["check", "--card"],
    ["inspect", "--run", "r", "--unexpected", "x"],
  ])
    assert.equal(await main(argv, { stdout: () => {} }), 1);
});
test("CLI context diagnostics block unknown model capacity and above-ceiling manifests", async () => {
  const root = await mkdtemp(join(tmpdir(), "clh-cli-budget-"));
  await writeFile(
    join(root, "manifest.json"),
    JSON.stringify({
      model: "unknown",
      estimatedInputTokens: 40001,
      usableTokens: 100000,
    }),
  );
  let out;
  assert.equal(
    await main(["context-check", "--manifest", "manifest.json"], {
      cwd: root,
      stdout: (s) => (out = JSON.parse(s)),
    }),
    2,
  );
  assert.equal(out.status, "BLOCKED");
});
test("graph inspection resolves persisted worktree association without dumping graph", async () => {
  const { mkdir } = await import("node:fs/promises");
  const root = await mkdtemp(join(tmpdir(), "clh-inspect-graph-"));
  for (const path of ["worktrees", "graph-links", "graphs"])
    await mkdir(join(root, path));
  await writeFile(
    join(root, "worktrees/CLH-7.json"),
    JSON.stringify({ cardId: "CLH-7", graphViewId: null }),
  );
  await writeFile(
    join(root, "graph-links/CLH-7.json"),
    JSON.stringify({ viewId: "view1" }),
  );
  await writeFile(
    join(root, "graphs/view1.json"),
    JSON.stringify({
      id: "view1",
      provider: "fixture",
      graph: { secret: "must not dump" },
      files: [],
    }),
  );
  let out;
  assert.equal(
    await main(["inspect-graph", "--card", "CLH-7"], {
      stateRoot: root,
      stdout: (s) => (out = JSON.parse(s)),
    }),
    0,
  );
  assert.equal(out.provider, "fixture");
  assert.equal(out.graph, undefined);
});
