import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fixtureCard } from "./card.mjs";
import { scopeDigest } from "../../../harness/governance/authorization.mjs";
import { conservativeByteEstimator } from "../../../harness/context/estimate.mjs";
export async function environment() {
  const root = await mkdtemp(join(tmpdir(), "clh-dispatch-")),
    state = await mkdtemp(join(tmpdir(), "clh-run-"));
  const git = (...a) =>
    execFileSync("git", a, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  git("init", "-b", "main");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.invalid");
  await writeFile(join(root, ".gitignore"), ".clh-worktrees/\n");
  await writeFile(join(root, "service.mjs"), "export const service=1;\n");
  git("add", ".");
  git("commit", "-m", "baseline");
  const card = fixtureCard();
  const approval = {
    cardId: card.id,
    scopeDigest: scopeDigest(card),
    approverId: "human",
    approvedAt: "2026-10-16T10:00:00Z",
    evidenceUrl: "https://notion.so/approval",
    revoked: false,
    riskExceptions: [],
  };
  const policy = JSON.parse(
    await readFile(new URL("../../../policies/harness.json", import.meta.url)),
  );
  const profile = {
    model: "fixture",
    effort: "medium",
    context_window_tokens: 110000,
    reserved_output_tokens: 9000,
    provider_overhead_tokens: 1000,
    supported_efforts: ["medium"],
    capacity_source: "test fixture",
    estimator_id: "bytes-v1",
    estimator_version: "1",
  };
  const adapters = {
    cwd: root,
    policy,
    notion: {
      fetch: async () => ({ card, approval }),
      updateStatus: async (s) => {
        card.status = s;
      },
    },
    authorizationVerifier: {
      verify: async () => ({ status: "VALID", human: true }),
    },
    models: { resolve: async () => profile },
    estimator: conservativeByteEstimator,
    contextSources: async () => ({
      items: [
        {
          id: "C0",
          source: "constitution",
          sourceRevision: "1",
          text: "Respect authorized paths",
          mandatory: true,
          priority: 100,
        },
      ],
    }),
    runtimeVerifier: { verify: async () => ({ status: "VALID" }) },
  };
  return { root, state, card, approval, adapters };
}
