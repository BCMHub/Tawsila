# CLH Mobile

CLH Mobile is a dependency-light Node.js harness foundation for governed, agent-assisted mobile development. Notion cards authorize work, Figma governs approved design, Git contains implementation, and the harness assembles bounded context and records evidence. This repository contains the harness framework; it does not contain or implement the Tawsila mobile app.

## Requirements and checks

Use Node.js 24 LTS or newer. The test suite uses Node's built-in test runner:

```sh
npm run test:clh
npm run test:clh:integration
npm run test:clh:graphify
```

The Graphify test requires the optional pinned `graphifyy` 0.8.31 command and runs its Python fixture in isolated staging. Graphify is a pluggable, advisory context provider; code and runtime evidence remain authoritative. If Graphify is unavailable, the context engine uses bounded source search and retrieval.

`policies/harness.json` intentionally ships with an empty model registry. The CLI and library cannot launch an agent until a host supplies verified model capacity/estimator metadata, a human authorization verifier, and a runtime adapter that enforces scope, usage limits, termination, context observation, and read-only review. Set up these host adapters and trust checks before any unattended execution. Do not replace them with test fixtures.

The read-only CLI commands are:

```sh
node harness/cli.mjs check --card CARD.json --approval APPROVAL.json
node harness/cli.mjs inspect --run RUN_ID
node harness/cli.mjs inspect-worktree --card CARD_ID
node harness/cli.mjs inspect-graph --card CARD_ID
node harness/cli.mjs context-check --manifest MANIFEST.json
```

`check` does not grant authorization when the trusted verifier is unavailable. `context-check` requires configured model metadata and a manifest bound to the active policy. Inspection commands do not modify state.

## Execution shape

```text
Authorized Notion card → isolated card worktree → graph-first retrieval
→ context budget gate (≤40%) → fresh bounded agent session → evidence gates
→ independent diff review → commit and Notion sync → separate integration
→ regression checks → safe cleanup
```

Each repair or role change can start with a fresh agent context while reusing the same card worktree and persisted checkpoint. Worktrees do not directly reduce model tokens; isolation allows the context builder to select a smaller, task-specific code neighborhood. Graph summaries, source excerpts, instructions, schemas and retained conversation count toward the active input estimate.

See [the governance architecture](docs/architecture/clh-governance.md), [the graph provider boundary](docs/architecture/clh-graph-provider.md), [the approved design specification](docs/superpowers/specs/2026-10-16-clh-mobile-design.md), and [the revised implementation plan](docs/superpowers/plans/2026-10-16-clh-governance-state.md).
