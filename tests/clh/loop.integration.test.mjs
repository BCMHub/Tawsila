import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, readFile, mkdtemp, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn, execFileSync } from "node:child_process";
import { environment } from "../fixtures/clh/environment.mjs";
import {
  prepareInvocation,
  dispatchInvocation,
  recordValidation,
} from "../../harness/execution/dispatch.mjs";
import { completeCard } from "../../harness/execution/completion.mjs";
import {
  prepareIntegration,
  verifyIntegration,
  mergeIntegration,
  cleanupWorktree,
} from "../../harness/worktrees/integration.mjs";
import { git, ensureTaskWorktree } from "../../harness/worktrees/manager.mjs";
const capabilities = async () => ({
  scopeEnforcement: true,
  usageLimits: true,
  termination: true,
  contextObservation: true,
  readOnlyReview: true,
});
test(
  "TEST_ONLY card→graph→ranges→budget→fresh agent→review→commit→sync→integration→cleanup",
  { timeout: 15000 },
  async () => {
    const e = await environment();
    e.adapters.graphProvider = {
      capabilities: async () => ({
        provider: "fixture",
        version: "1",
        schemaVersion: 1,
        incrementalModes: [],
      }),
      indexRepository: async () => ({
        status: "OK",
        graph: {
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
        },
      }),
    };
    e.adapters.notion.verifyCard = async (metadata) => {
      e.card.status = "VERIFIED";
      return {
        status: "PASS",
        cardId: metadata.cardId,
        commit: metadata.commit,
      };
    };
    const p = await prepareInvocation(
      e.card.id,
      "implementer",
      e.adapters,
      e.state,
    );
    assert.equal(p.decision.status, "PASS");
    assert.equal(p.graphContext.health, "OK");
    assert.ok(p.manifest.ratio <= 0.4);
    const executed = await dispatchInvocation(p, {
      capabilities,
      invoke: async (request) => {
        await writeFile(
          join(request.cwd, "service.mjs"),
          "export const service=2;\n",
        );
        return { usage: { tokens: 300, costMicrounits: 0 } };
      },
    });
    assert.equal(executed.status, "VALIDATING");
    const startedAt = new Date().toISOString();
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "import{service}from'./service.mjs';if(service!==2)process.exit(1)",
      ],
      { cwd: p.worktree.realPath, env: process.env, stdio: "pipe" },
    );
    await recordValidation(
      executed.checkpoint,
      [
        {
          gateId: "unit",
          status: "PASS",
          patchHash: executed.checkpoint.patchHash,
          command: "node assert service=2",
          exitCode: 0,
          startedAt,
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
    assert.equal(rp.decision.status, "PASS");
    const reviewed = await dispatchInvocation(rp, {
      capabilities,
      invoke: async (request) => {
        assert.deepEqual(request.allowedPaths, []);
        assert.ok(
          request.envelope.messages.some((m) => m.id === "current-diff"),
        );
        return {
          usage: { tokens: 200, costMicrounits: 0 },
          review: {
            status: "PASS",
            patchHash: rp.checkpoint.patchHash,
            contextId: request.invocationId,
          },
        };
      },
    });
    assert.equal(reviewed.status, "REVIEW_PASSED");
    const completed = await completeCard(
      reviewed.checkpoint,
      e.adapters,
      e.state,
    );
    assert.equal(completed.status, "VERIFIED");
    assert.equal(e.card.status, "VERIFIED");
    // The disposable base checkout is detached explicitly; no user's checked-out target is mutated.
    await git(e.root, ["switch", "--detach"]);
    const integration = await prepareIntegration(
      e.card.id,
      completed.commit,
      "main",
      {
        cwd: e.root,
        stateRoot: e.state,
        worktreeRoot: ".clh-worktrees",
        review: {
          independent: true,
          reviewedCommit: completed.commit,
          reviewerContextId: rp.manifest.invocationId,
        },
        requiredIntegrationGates: ["regression"],
        syncIntegration: async () => ({ status: "PASS" }),
      },
    );
    const gates = await verifyIntegration(integration, async (r) => {
      const start = new Date().toISOString();
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          "import{service}from'./service.mjs';if(service!==2)process.exit(1)",
        ],
        { cwd: r.realPath, env: process.env, stdio: "pipe" },
      );
      return [
        {
          gateId: "regression",
          status: "PASS",
          commit: r.mergeCommit,
          treeHash: r.treeHash,
          command: "node integration regression",
          exitCode: 0,
          startedAt: start,
          endedAt: new Date().toISOString(),
        },
      ];
    });
    const merged = await mergeIntegration(integration, gates, {
      verify: async () => ({ status: "VALID", human: true }),
    });
    assert.equal(await git(e.root, ["rev-parse", "main"]), merged.mergeCommit);
    const cleaned = await cleanupWorktree(
      { ...p.worktree, integrationId: merged.id, stateRoot: e.state },
      { cleanup_after_integration: true },
    );
    assert.equal(cleaned.status, "CLEANED");
    await assert.rejects(access(p.worktree.realPath));
    const manifest = JSON.parse(
      await readFile(join(e.state, "contexts", rp.manifest.id + ".json")),
    );
    assert.ok(manifest.graphContextId);
    await access(
      join(e.state, "graph-contexts", manifest.graphContextId + ".json"),
    );
  },
);
test("independent task worktrees cannot overwrite each other", async () => {
  const e = await environment();
  const a = await ensureTaskWorktree(
    { ...e.card, type: "Feature", slug: "first" },
    e.root,
    e.state,
    e.adapters.policy.worktrees,
  );
  const b = await ensureTaskWorktree(
    { ...e.card, id: "CLH-11", type: "Feature", slug: "second" },
    e.root,
    e.state,
    e.adapters.policy.worktrees,
  );
  await writeFile(join(a.realPath, "service.mjs"), "first");
  assert.equal(
    await readFile(join(b.realPath, "service.mjs"), "utf8"),
    "export const service=1;\n",
  );
  await writeFile(join(b.realPath, "service.mjs"), "second");
  assert.equal(
    await readFile(join(a.realPath, "service.mjs"), "utf8"),
    "first",
  );
});
test(
  "two separate processes cannot own the same execution lease",
  { timeout: 10000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "clh-process-"));
    const module = new URL("../../harness/state/lock.mjs", import.meta.url)
      .href;
    const script = `import{acquireLock}from${JSON.stringify(module)};import{createInterface}from'node:readline';const lines=createInterface({input:process.stdin});console.log('READY');let lease;for await(const line of lines){if(line==='GO'){try{lease=await acquireLock(${JSON.stringify(root)},'card:CLH-7',{runId:'child'});console.log('WON');}catch{console.log('LOST');}}if(line==='RELEASE'){await lease?.release();process.exit(0);}}`;
    const children = [0, 1].map(() =>
      spawn(process.execPath, ["--input-type=module", "-e", script], {
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      }),
    );
    let ready = 0;
    const outcomes = children.map(
      (child) =>
        new Promise((resolve, reject) => {
          let buffer = "";
          child.stdout.on("data", (data) => {
            buffer += data;
            const lines = buffer.split("\n");
            buffer = lines.pop();
            for (const line of lines) {
              if (line === "READY" && ++ready === 2)
                children.forEach((c) => c.stdin.write("GO\n"));
              if (["WON", "LOST"].includes(line)) resolve(line);
            }
          });
          child.on("error", reject);
        }),
    );
    try {
      assert.deepEqual((await Promise.all(outcomes)).sort(), ["LOST", "WON"]);
    } finally {
      children.forEach((c) => {
        if (!c.killed) c.stdin.write("RELEASE\n");
      });
      await Promise.all(
        children.map(
          (c) =>
            new Promise((resolve) => {
              if (c.exitCode !== null) resolve();
              else c.once("exit", resolve);
            }),
        ),
      );
    }
  },
);
