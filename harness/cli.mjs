import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateCard, validatePolicy } from "./governance/contracts.mjs";
import { preflight } from "./governance/authorization.mjs";
import { safePath, readJson, identifier, digest } from "./state/files.mjs";
import { readEvents } from "./state/journal.mjs";
import { usableCapacity, contextZone } from "./context/capacity.mjs";
const usage = {
  check: ["card", "approval"],
  inspect: ["run"],
  "inspect-worktree": ["card"],
  "inspect-graph": ["card"],
  "context-check": ["manifest"],
};
export async function main(argv, io = {}) {
  const output = io.stdout ?? ((s) => console.log(s));
  const cwd = io.cwd ?? process.cwd(),
    stateRoot = io.stateRoot ?? resolve(cwd, ".clh");
  try {
    const [command, ...args] = argv;
    if (!Object.hasOwn(usage, command) || args.length % 2)
      throw Error(
        "Usage: check --card FILE --approval FILE | inspect --run ID | inspect-worktree --card ID | inspect-graph --card ID | context-check --manifest FILE",
      );
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      const k = args[i].replace(/^--/, "");
      if (
        !args[i].startsWith("--") ||
        !usage[command].includes(k) ||
        k in options ||
        !args[i + 1]
      )
        throw Error("Invalid command options");
      options[k] = args[i + 1];
    }
    if (usage[command].some((k) => !(k in options)))
      throw Error("Missing command options");
    async function input(file) {
      const p = await safePath(cwd, file);
      if ((await stat(p)).size > 2 * 1024 * 1024)
        throw Error("Input exceeds inspection limit");
      return JSON.parse(await readFile(p, "utf8"));
    }
    let result,
      code = 0;
    if (command === "check") {
      const card = validateCard(await input(options.card));
      result = await preflight(card, await input(options.approval));
      code = result.status === "PASS" ? 0 : 2;
    }
    if (command === "inspect") {
      identifier(options.run);
      result = { events: await readEvents(stateRoot, options.run) };
    }
    if (command === "inspect-worktree" || command === "inspect-graph") {
      identifier(options.card);
      const w = await readJson(
        stateRoot,
        "worktrees/" + options.card + ".json",
      );
      if (!w.graphViewId) {
        try {
          w.graphViewId = (
            await readJson(stateRoot, "graph-links/" + options.card + ".json")
          ).viewId;
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
      }
      if (command === "inspect-worktree") result = w;
      else if (!w.graphViewId)
        result = {
          status: "UNAVAILABLE",
          cardId: options.card,
          fallback: "targeted-source",
        };
      else {
        const { graph, files, ...metadata } = await readJson(
          stateRoot,
          "graphs/" + identifier(w.graphViewId) + ".json",
        );
        result = metadata;
      }
    }
    if (command === "context-check") {
      const m = await input(options.manifest);
      const policy = validatePolicy(
        io.policy ??
          JSON.parse(
            await readFile(
              new URL("../policies/harness.json", import.meta.url),
              "utf8",
            ),
          ),
      );
      const p = policy.models[m.model];
      if (!p) {
        result = { status: "BLOCKED", reasons: ["MODEL_CAPACITY_UNAVAILABLE"] };
        code = 2;
      } else {
        const capacity = usableCapacity({
          ...p,
          model: m.model,
          effort: m.effort,
        });
        const zone = contextZone(m.estimatedInputTokens, capacity);
        const bound =
          m.usableTokens === capacity &&
          m.policyDigest === digest(policy) &&
          m.estimator?.id === p.estimator_id &&
          m.estimator?.version === p.estimator_version &&
          m.capacitySource === p.capacity_source;
        const pass =
          bound && zone.ratio <= policy.context_budget.maximum_normal_ratio;
        result = {
          status: pass ? "PASS" : "BLOCKED",
          ...zone,
          reasons: pass ? [] : ["UNVERIFIED_MANIFEST_OR_CONTEXT_CEILING"],
          authorizationGranted: false,
        };
        code = pass ? 0 : 2;
      }
    }
    output(JSON.stringify(result));
    return code;
  } catch (e) {
    output(JSON.stringify({ status: "ERROR", error: e.message }));
    return 1;
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  process.exitCode = await main(process.argv.slice(2));
