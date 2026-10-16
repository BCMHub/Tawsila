# CLH Governance and Persistent State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a governed single-card harness foundation joining Notion authorization, isolated Git worktrees, graph-first repository retrieval, budgeted task context, fresh agent sessions, persistent state, independent review, and separately verified integration. Production execution remains disabled until real authorization, sandbox, estimator, and runtime adapters meet their contracts.

**Revision:** 3 — incorporates Graph-First Repository Context Retrieval alongside the user’s worktree and context-budget requirements. Revision 2 remains the baseline; only affected architecture, contracts, tasks and verification are revised. Tasks 1–4 retain their identifiers; inserted tasks use letter suffixes. This is a plan revision, not implementation authorization.

**Architecture:** The authorization/state core coordinates a card-bound task worktree, a provider-independent code graph view, and a revision-stamped context manifest before every agent invocation. The Context Agent first queries a bounded dependency neighborhood, verifies graph results against current worktree source, and then loads selected symbol/file ranges; unavailable or unreliable graph results trigger targeted source-based fallback. The dispatcher uses a fresh session when required while continuing the same worktree, checkpoint, and budgets; reviewers consume the exact diff and integration uses a separate serialized worktree. Notion remains the work authority; exported snapshots are inputs, not independent authorization. Worktrees do not directly reduce LLM tokens: filesystem isolation enables narrower retrieval and cleaner context construction, which can reduce input tokens.

**Tech Stack:** Proposed for plan approval: JavaScript ES modules, Node.js built-in test runner, crypto, filesystem, and child-process APIs; no additional core runtime dependency. An optional Graphify subprocess adapter has its own pinned external runtime; the core remains usable without it. Require a supported Node LTS version at execution time and record its exact version. This choice concerns the harness only, not the mobile app.

**Spec:** `docs/superpowers/specs/2026-10-16-clh-mobile-design.md`, plus the user’s subsequent worktree/context-budget and graph-first retrieval requirements captured below. Where the original spec assumes one project writer or defers context/execution entirely, this revision supersedes those points without changing product, design, or authorization decisions.

## Global Constraints

- **Graph First, Files Second:** use repository structural knowledge to identify the smallest relevant code neighborhood before loading source. The graph guides retrieval; source code and runtime evidence remain authoritative. The Code Knowledge Graph is a Context Optimization Layer, not the source of truth for behavior.
- Graph-first is the default workflow, not a mandatory Graphify dependency. Missing/stale/incomplete/unsupported graph data triggers bounded fallback; required context and ≤40% dispatch gates still apply. A graph outage alone must not block ordinary sequential work.
- No Notion Card → No Implementation applies to framework code as well as application code.
- Begin sequentially by default; parallel mode requires explicit configuration and successful dependency, scope-overlap, semantic-impact, and observed-diff conflict checks. Graph evidence supplements explicit dependencies, paths and architecture boundaries; an empty graph result never proves independence.
- Use one exclusive writer per card worktree; serialize shared Git administration and integration using a short-lived repository lock. A project-wide lock must not span agent execution. Multi-host execution remains unsupported.
- Each active implementation card uses a dedicated task worktree whenever practical. An explicitly recorded isolation exception is required otherwise. Implement, debug, test, and repair in the same task worktree.
- Preferred preloaded context is approximately 20–30% of usable model capacity; 30–40% is amber; the normal hard ceiling is 40%, not a target. Every invocation, including review and repair, must pass this gate.
- Missing estimator, unknown capacity, or mandatory context exceeding the ceiling blocks normal dispatch; an explicitly human-authorized, time-bounded exception may raise the ratio only within usable capacity.
- Agent sessions are disposable; card state, worktree mapping, context manifests, evidence, and cumulative budgets survive rotation.
- Integration and cleanup require regression evidence and ownership checks; never force-reset, force-remove, or silently delete a dirty worktree.
- Independent review requires a separate execution context.
- Unsupported enforcement blocks unattended execution.
- Initial proposed defaults per card: three total implementation attempts, two repair attempts within that total, two transient connector retries, and a 30-minute execution ceiling.
- Persist cumulative consumption across restarts. Escalation never resets budgets.
- Missing mandatory context blocks work; silent truncation is prohibited.
- Any subsequent code change invalidates affected results and review.
- No paid unattended execution without configured limits.

## Review Focus

1. Reordered object keys must not change the approved scope digest; changed scope must invalidate it (Task 1).
2. A truncated/corrupt journal must fail closed rather than silently create a new run (Task 2).
3. Concurrent processes and expired locks must not permit two writers for the same card; independent cards may proceed only after admission checks (Tasks 2, 2A).
4. Clock rollback or restart must not reset spent budget or extend the deadline (Task 3).
5. Symlinks and path traversal must not escape configured state/worktree roots (Tasks 2A, 4).

Graph-specific review focus: stale main-branch results must not be used as current worktree evidence (2B/3A); missing edges are unknown, not proof of no impact (2B/3B); graph service failure must select targeted fallback without bypassing budget/authority gates (2C/4B).

Additional review focus: unknown model capacity or underestimated context must fail closed (3A); stale checkpoints/diffs must rebuild before dispatch (3B); moved integration HEAD invalidates merge evidence and dirty worktrees survive cleanup (4A).

## Prerequisites and authorization

The approved design is recorded. The new private Notion ledger is at https://app.notion.com/p/8f532f99b27d491fae9cc9b5ad71643b, data source `d947bd35-1f59-4234-b382-75b5977a6377`.

Bootstrap isolation: after the authorized Git initialization/sanitized baseline, manually create a dedicated CLH-2 worktree using Git and the using-git-worktrees skill until Task 2A is available. Apply the same naming/detection/ownership rules; journal the mapping in a sanitized bootstrap record and migrate it to the manager without changing its path. A detected external/detached environment follows Task 2A’s safe fallback instead of forced branch operations.

Before executing any task: user reviews this revised plan and selects native or subagent-driven execution; the governance bootstrap card must be human-authorized READY with approved scope and allowed paths. The Notion initiative and cards remain PROPOSED until then. No Git repository currently exists in this folder: initializing Git, baseline contents, and ignore rules must be included in that bootstrap card's allowed scope. Never commit node_modules, credentials, private run logs, or the large Figma evidence dump by default.

Human approval verification is a trust boundary. For this subsystem, `AuthorizationVerifier` is an injected interface. The shipped default returns UNAVAILABLE; test fakes are limited to tests. Live approval validation belongs to a later connector plan, so this harness cannot authorize unattended implementation by itself. New tasks can be validated end-to-end with test adapters, but production fails closed until real adapters are configured and verified. No test verifier or fake agent is shipped as a production fallback. Notion editable properties and this chat's design approval are not substitutes for card authorization evidence.

## Configuration, ordering, and normal loop

Create `policies/harness.json` in Task 1; validate its schema before use. JSON preserves the dependency-light stack while expressing the requested policy:

```json
{
  "worktrees": {
    "root": ".clh-worktrees",
    "dedicated_required": true,
    "parallel_enabled": false,
    "max_active_cards": 1,
    "review_mode": "diff-first",
    "cleanup_after_integration": true,
    "retain_blocked": true,
    "integration_branch": "main"
  },
  "context_budget": {
    "preferred_min_ratio": 0.2,
    "preferred_ratio": 0.3,
    "maximum_normal_ratio": 0.4,
    "maximum_rebuilds": 2,
    "zones": {
      "green": { "max": 0.3 },
      "amber": {
        "max": 0.4,
        "actions": ["deduplicate", "compact", "narrow_retrieval"]
      },
      "red": {
        "above": 0.4,
        "actions": [
          "block_normal_dispatch",
          "rebuild_context_pack",
          "decompose_task",
          "rotate_agent_context"
        ]
      }
    }
  },
  "code_graph": {
    "strategy": "graph-first",
    "provider": "graphify",
    "cache_root": ".clh/graphs",
    "local_code_only": true,
    "max_hops": 2,
    "max_nodes": 40,
    "max_query_summary_tokens": 1000,
    "query_timeout_ms": 5000,
    "refresh_timeout_ms": 60000,
    "max_refresh_attempts": 1,
    "full_rebuild_changed_file_ratio": 0.2,
    "max_full_rebuilds_per_card": 1,
    "fallback_order": [
      "lsp",
      "symbol-search",
      "git",
      "ripgrep",
      "targeted-read",
      "selective-packaging"
    ],
    "semantic_parallel_policy": "serialize-on-risk-or-unknown"
  },
  "models": {},
  "exceptions": []
}
```

`models` is intentionally empty by default: each configured model must supply verified `context_window_tokens`, `reserved_output_tokens`, `provider_overhead_tokens`, supported effort values, estimator ID/version, and a documented capacity source/version/date. `usable_context_tokens = context_window_tokens - reserved_output_tokens - provider_overhead_tokens`; active input includes system/developer instructions, task context, retained conversation, tool schemas, attachments, and message framing counted by the estimator. Never subtract the same overhead twice. Reject nonpositive usable capacity. The remaining capacity preserves headroom for reasoning, tool output, diffs, tests, simulator/device evidence, debugging, repairs, review feedback, and final output. Provider-specific hidden reasoning/output constraints remain subject to model adapter validation; 40% is a project policy, not a guarantee from the provider.

A context exception records card ID, scope digest, approver/evidence, model, invocation or bounded validity period, maximum ratio, reason, and headroom assessment. Agents cannot create their own exceptions. Isolation exceptions record why a dedicated worktree is impractical and disable parallel execution for that task. Policy changes cannot retroactively invalidate evidence silently: record policy digest in each invocation.

**Build order:** 1 → 2 → 2A → 3 → 2B → 2C → 3A → 3B → 4 → 4A → 4B. New Tasks 2B/2C supply the graph contract/index service and optional reference adapter before context/dispatch integration. Their identifiers preserve existing numbering; 2B has no dependency on 3A/3B, avoiding a graph/context cycle. Task 3 could be developed after 2, but keep execution sequential initially. Before implementation, draft the dependency cards as PROPOSED; human authorization is required for each. Each new component gets a separately authorized card; CLH-2 covers modified original Tasks 1, 2 and 3 only; letter-suffixed tasks are excluded. Task 4 becomes a separate dependent card because it now consumes 2A/3A/3B; keeping it inside CLH-2 would create a card dependency cycle. Every inserted task needs its own authorized card. The work ledger must link dependency cards before execution.

**Runtime order:** READY card → verify human authorization/dependencies → reserve scope and create/reuse task worktree → resolve current graph view or targeted fallback → extract card entities and query/rank smallest dependency neighborhood → retrieve verified symbol ranges → minimum context pack → estimate full invocation → reduce/recalculate if needed → dispatch only at ≤40% or valid exception → persist checkpoint → validate → repair with fresh session, same worktree, compact state + current diff + new failures + refreshed graph references/targeted fallback → independent diff-centered review → separate integration regression verification → authorized merge → safe cleanup. Persist intent and result around each side effect.

Notion advances IN PROGRESS only after claim; VALIDATING and REVIEW reflect those stages. Context/worktree failures record BLOCKED with a reason. VERIFIED retains the original technical completion meaning; it does not imply integration. Record integration and cleanup states separately; DONE waits for required integration and product/human completion. Never erase a valid verification record when a merge conflict requires further work: record the new revision and invalidate affected gates/review.

## Repository context hierarchy, freshness, and source authority

Notion supplies authorized product scope; Figma supplies approved design context. Repository code flows through graph discovery → selective source retrieval → optional selective Repomix packaging. Context7 or equivalent supplies current external documentation. The Context Agent combines these bounded inputs into a task pack and applies the same ≤40% gate. The graph determines what may be relevant; retrieval/Repomix determines how selected code is packaged; neither replaces Notion, Figma, documentation grounding or runtime evidence. No full graph/report or repository-wide Repomix bundle is injected by default.

Extract entry concepts from card objectives, acceptance criteria, affected modules and current diff. Resolve ambiguous entities to explicit symbol candidates, then query callers/callees, upstream dependencies/downstream dependents, class/module edges, related test candidates, boundaries, communities and changed-symbol impact where the provider supports them. Rank exact symbol/path matches first, then direct explicit edges, architecture-boundary relevance, related tests, and more distant/inferred edges. Community membership is a coarse hint; related tests do not prove coverage and static call edges do not prove runtime data flow.

Start with exact matches and one hop, expand only for missing criterion/impact evidence, and cap at two hops/40 nodes by default. Return bounded references and brief edge explanations, with at most 1000 estimated summary tokens per invocation across all graph queries; these tokens count within the context envelope, not outside the 40% limit. Rank/prune before reading source. If expected input exceeds 30%, prune optional graph neighborhoods and narrow ranges before using amber headroom. Never prune mandatory callers/interfaces/constraints solely to meet a graph-size cap; use bounded fallback, decomposition or the existing context exception path if sufficiency cannot fit. Repeated graph queries have finite node/time budgets, not an unbounded exploration loop.

Deterministic indexers may read the permitted source corpus once without loading those files into an LLM context; indexing cost and model input tokens are tracked separately. Only selected graph summaries/source excerpts enter agent context.

Resolve configured cache_root against the canonical shared repository state root, not each task cwd. Graph caches are outside disposable worktrees, keyed by repository identity + provider/version/schema + parser/config fingerprint + commit/content fingerprint. An immutable base graph may be shared for the same exact commit; each worktree gets a separate view/overlay or independent snapshot for HEAD plus staged, unstaged, relevant untracked files, renames and deletions. A graph from main is not a current feature-worktree graph. Never merge active worktree graphs into a mutable global graph or let one provider refresh overwrite another worktree's view.

Before queries, verify the view fingerprint and language/relation coverage; before source loading, verify returned file hashes/symbol ranges against the current worktree. Time-to-live alone is not freshness. Edits invalidate affected nodes and edges immediately. Use incremental updates only if capabilities and tests establish deletion, rename, caller/import resolution and config-change correctness. Reconcile changed files plus affected resolution dependents; invalidate wider graph regions when dependency resolution/build/parser configuration changes. Publish refreshed snapshots atomically after validation; concurrent edits make that view stale rather than silently current.

Refresh at checkpoints, before graph-assisted repair/review and before semantic parallel admission; integration uses the actual merged candidate view. Significant change means ≥20% of indexed source files changed, or any resolver/parser/build/lockfile configuration change. That triggers a bounded full refresh when incremental correctness cannot be established. Without incremental support, batch one scoped/full rebuild at a checkpoint or on-demand (at most one full rebuild per card by default); changed areas meanwhile use targeted fallback. Exhausted index budget or absent provider is a performance degradation, not permission to trust stale edges or fail the whole card. Required source context may still block independently if unavailable.

Fallback order is capability-driven: LSP/symbol search → Git diff/history → ripgrep/repository search → targeted reads → selective packaging. Use structured argv, bounded output/ranges and current-worktree provenance. Record why the graph could not answer; retain unsupported/incomplete/ambiguous status rather than fabricating empty certainty. Contradictory graph/source findings invalidate the graph result and trigger refresh/fallback. Source wins. Graph indexers get read-only source and read/write access only to designated caches, no implicit hooks/AGENTS rewrites, network, semantic-LLM extraction or automatic dependency installation.

## Files and contracts

- `AGENTS.md`: concise approved CLH constitution and boundaries.
- `.gitignore`: node_modules, secrets, local run records, exported private context; retain existing user files.
- `package.json`: add `clh:check` and `test:clh` scripts; preserve REA dependency.
- `harness/governance/contracts.mjs`: runtime-validated input contracts and exported result codes.
- `harness/governance/authorization.mjs`: canonical scope digest and preflight policy.
- `harness/state/journal.mjs`: atomic persistent event records and replay.
- `harness/state/lock.mjs`: common-repository admin lock and exclusive per-card execution locks.
- `policies/harness.json`: versioned worktree, context, routing, and exception policy.
- `harness/worktrees/{manager,admission,integration}.mjs`: task isolation, conflict reservations, serialized integration and cleanup.
- `harness/graph/{provider,index-service,health,fallback,impact}.mjs`: provider contracts, worktree views, freshness, fallback and semantic-risk evidence.
- `harness/graph/adapters/graphify.mjs`: optional reference adapter, capability-probed and version-pinned.
- `harness/context/repository.mjs`: graph-first discovery, source verification and bounded retrieval.
- `harness/context/{capacity,estimate,select,compact,manifest}.mjs`: model-aware bounded context assembly.
- `harness/execution/{dispatch,checkpoint}.mjs`: budgeted invocation and fresh-session continuation.
- `harness/telemetry/invocations.mjs`: per-card manifest/usage records without sensitive prompt bodies.
- `harness/state/budget.mjs`: cumulative limits and deadline checks.
- `harness/cli.mjs`: read-only preflight and run inspection.
- `tests/clh/*.test.mjs`: behavioral, filesystem, and multi-process tests.
- `docs/architecture/clh-governance.md`: contracts, recovery, limitations.

Contracts use plain objects validated at runtime:

`CardSnapshot = {id, notionUrl, status, scopeRevision, objective, acceptanceCriteria: [{id,text}], allowedPaths: string[], dependencies: [{id,status}], origin, designRequired, figmaReferences: string[], requiredPlatforms: string[], risk, budget, executionPolicy: {worktreeRequired, isolationExceptionId, parallelEligible, conflictGroups: string[], contextPolicyId, contextExceptionId}}`.

`Approval = {cardId, scopeDigest, approverId, approvedAt, evidenceUrl, revoked, riskExceptions: string[]}`.

`AuthorizationVerifier.verify(approval, card) -> Promise<{status: 'VALID'|'INVALID'|'UNAVAILABLE', reason: string}>`.

`Decision = {status: 'PASS'|'BLOCKED', reasons: string[], scopeDigest: string|null}`.

`RunEvent = {schemaVersion: 3, sequence, runId, cardId, operationId, previousState, newState, timestamp, scopeDigest, usage: {attempts, repairs, connectorRetries, tokens, costMicrounits, elapsedMs}, artifacts: string[], worktreeId: string|null, invocationId: string|null, checkpointId: string|null, policyDigest: string, graphContextId: string|null}`.

`WorktreeRecord = {id, cardId, runId, commonGitDir, realPath, branch: string|null, baseCommit, headCommit, ownership: 'harness'|'external', detached: boolean, state, retainReason: string|null, graphViewId: string|null}`.

`ContextItem = {id, source, sourceRevision, contentHash, layer, priority, mandatory, text, filePath: string|null, range: {startLine,endLine}|null, purpose}`. Mandatory roles include constitution, authorized scope/criteria, permissions, relevant interfaces and design constraints, current state and failure evidence.

`ContextManifest = {id, cardId, invocationId, worktreeId, headCommit, patchHash, checkpointId, policyDigest, model, effort, capacitySource, usableTokens, estimatedInputTokens, ratio, zone, estimator, selected: ContextItem[], omitted: [{id,reason}], reductions: string[], exceptionId: string|null, graphContextId: string|null, retrievalMode, fallbackReasons: string[]}`.

`Checkpoint = {id, cardId, runId, scopeDigest, worktreeId, headCommit, patchHash, stage, pendingActions, criteriaCoverage, failureArtifacts, contextManifestId, budgetUsage, lastObservedAt, graphContextId: string|null}`. Store metadata/references and a concise factual summary, not private reasoning or credentials.

`GraphContext = {id, provider, providerVersion, schemaVersion, viewId, repositoryId, worktreeId, headCommit, contentFingerprint, configFingerprint, entrySymbols: string[], affectedFiles: string[], relatedTestCandidates: string[], queryRefs: string[], health, coverage, fallbackReasons: string[], summaryArtifact}`. Persist references, identifiers, concise summaries and hashes only; full graph data stays in external cache, never in task checkpoints/prompts. Graph facts are derived, revocable context, not authorization or permanent project learning. Raw graph IDs may be provider/version-local; references include their view ID and are re-resolved after any provider/revision change.

Task 2 initially implements CLAIMED, BLOCKED, CANCELLED. Task 3B adds WORKTREE_READY, CONTEXT_READY, DISPATCHING, IMPLEMENTING, VALIDATING, REPAIR_PENDING, REVIEW, VERIFIED, SYNC_PENDING behind verified adapter/gate contracts. Task 4A adds separate integration/cleanup states. Illegal transitions and missing required evidence block. Production remains unavailable without live authorization and enforced execution adapters; CLI inspection cannot promote cards.

## Task 1: Card contract and fail-closed authorization (modified)

**Files:** Create `harness/governance/contracts.mjs`, `harness/governance/authorization.mjs`, `tests/clh/authorization.test.mjs`, `AGENTS.md`, `.gitignore`; modify `package.json`; create `policies/harness.json` and `tests/clh/policy.test.mjs`.

**Interfaces:** Export `validateCard(value) -> CardSnapshot`, `scopeDigest(card) -> string`, and `preflight(card, approval, verifier) -> Promise<Decision>`. Digest all scope-bearing fields, including executionPolicy and budget, excluding workflow status; sort object keys recursively and preserve array order. Use SHA-256 over UTF-8 canonical JSON. Reject unknown scope fields rather than dropping them silently.

- [ ] Write failing tests: READY without approval blocks; PROPOSED blocks despite valid approval; agent approver blocks; revoked/mismatched-card/mismatched-digest approval blocks; verifier UNAVAILABLE blocks; missing/circular dependency information blocks; every dependency must be DONE; missing objective/criterion IDs/paths/budgets blocks; UI work without design references blocks. For direct dependencies reject self-reference and duplicate IDs; require connector cycle-check evidence before live authorization in the later connector plan.
- [ ] Add digest tests: reordered object keys match; a changed criterion, path, dependency, design reference, risk exception, or platform invalidates authorization. Risk exceptions belong to the approved authorization payload; verify them through the verifier, not a card digest field that does not exist.
- [ ] Run `node --test tests/clh/authorization.test.mjs`; confirm expected failures before implementation.
- [ ] Add failing policy tests for preferred 0.30/maximum 0.40, invalid threshold ordering, absent model capacity, unsupported effort, invalid exceptions, and parallel=true without max_active_cards >1 and admission enforcement. Changed isolation/context exception or conflict groups must invalidate scope approval. Add graph policy tests for bounded hops/nodes/time/summary tokens, valid fallback order, local-only execution and semantic-parallel policy. Record graph policy in policyDigest; provider selection never grants broader source/tool/network permissions.
- [ ] Implement the configuration above and contracts; validate safe integer nonnegative budgets, timestamps and approval fields. Trust human identity only through the verifier; an `approverId` string alone is not proof.
- [ ] Add scripts `test:clh` = `node --test tests/clh/*.test.mjs` and `clh:check` = `node harness/cli.mjs check`; document the constitution. The CLI script becomes usable in Task 4.
- [ ] Run `npm run test:clh`; require all current tests pass. Obtain independent review and commit with the actual authorized Notion card ID.

## Task 2: Card-scoped state journal, locks, and recovery (modified)

**Dependencies:** Task 1. Common state lives outside disposable worktrees at a configured, canonical repository-owned state root; all worktrees resolve the same common Git directory. Scope reservations and admin lock are shared; run logs are card-scoped.

**Files:** Create `harness/state/journal.mjs`, `harness/state/lock.mjs`, `tests/clh/journal.test.mjs`, `tests/clh/lock.test.mjs`.

**Interfaces:** `acquireLock(stateRoot, resource, owner) -> Promise<{release(): Promise<void>}>`; `appendEvent(stateRoot, event) -> Promise<void>`; `readEvents(stateRoot, runId) -> Promise<RunEvent[]>`. Resource is `repo-admin`, `integration`, `card:<id>`, or `graph:<viewId>`; graph locks are introduced by 2B and must not be acquired while holding repo-admin/integration locks. Owner contains runId, hostname, pid, acquisition time, expiry, and random ownership token. Lock ordering is repo-admin before card reservation updates; never hold repo-admin while an agent runs. Integration acquires integration then repo-admin for brief Git/ref mutations; no reverse acquisition is allowed.

- [ ] Write failing tests for two simultaneous child processes for the same card (exactly one wins), two independent card locks (both succeed), conflicting scope reservations (one denied), foreign-host lock rejection, expired lock refusal pending explicit recovery, and release by wrong owner rejection.
- [ ] Write failing journal tests: replay survives restart; duplicate identical operationId is idempotent; conflicting duplicate rejects; bad sequence, unknown schema, illegal state transition, truncated JSON, and corrupt records block recovery. Persist worktree mappings, graph-view/context references, content/config fingerprints, health/fallback reasons, context manifest/checkpoint IDs and policy digest; validate references on replay. Existing schema v1/v2 records require explicit migration with backup to schema v3, never silent reinterpretation; migrated graphContextId=null requires graph resolution/fallback before the next invocation, not a claim of fresh graph coverage.
- [ ] Run `node --test tests/clh/journal.test.mjs tests/clh/lock.test.mjs`; confirm failures.
- [ ] Implement exclusive lock creation and ownership-checked release. Never steal an expired lock automatically. Store each event as a separate immutable sequence file: write temporary file, flush, publish atomically without replacing existing events, then flush the directory where supported. Fail closed if required atomicity cannot be provided. Reject unjournaled transitions.
- [ ] Run the two test files, then `npm run test:clh`; require all pass. Obtain independent review and card-linked commit.

## Task 2A: Card worktree manager and parallel admission (modified in revision 3)

**Dependencies:** Tasks 1 and 2. No agent can run before a valid worktree mapping or approved isolation exception is journaled.

**Files:** Create `harness/worktrees/manager.mjs`, `harness/worktrees/admission.mjs`, `tests/clh/worktrees.test.mjs`, `tests/clh/admission.test.mjs`.

**Interfaces:** `detectWorkspace(cwd) -> Promise<{commonGitDir, topLevel, linked, detached, branch, head}>`; `taskNames(cardId, type, slug) -> {branch,pathSegment}`; `ensureTaskWorktree(card, cwd, stateRoot, policy) -> Promise<WorktreeRecord>`; `admitParallel(candidate, activeRecords, dependencyGraph, reservations, semanticEvidence) -> Decision`. semanticEvidence is supplied by Task 2B at runtime; Task 2A tests use fixtures and do not import a not-yet-built graph service. Consume Task 1 preflight and Task 2 journal/locks. Git commands use argument arrays, never shell interpolation.

- [ ] Write naming tests: feature CLH-2/governance maps to `feat/CLH-2-governance`, bug to `fix/CLH-2-governance`, other types to `chore/...`; path segment is `CLH-2-governance`. Validate card IDs, normalize slug to lowercase ASCII `[a-z0-9-]`, trim to 48 characters, reject empty/unsafe inputs and case-insensitive collisions. Store names once; title edits do not rename a live branch/worktree.
- [ ] Write real temporary-Git tests: create isolated worktree from recorded base commit; repeat call reuses the same path/branch; fresh process finds the same mapping. Detect `.git` file linked worktree versus main checkout using Git common-dir/top-level and porcelain worktree inventory, not directory-name guesses. Resolve paths canonically, including common-dir relative paths.
- [ ] Add failure tests: occupied/unowned path, branch already checked out elsewhere, dirty index/worktree, unresolved merge, moved HEAD, wrong repository/card/branch, detached HEAD, and externally managed linked worktree. Existing valid dirty task worktree is resumable only when checkpoint/diff ownership matches; unexplained changes block rather than reset. Preserve untracked changes and evidence.
- [ ] Run `node --test tests/clh/worktrees.test.mjs tests/clh/admission.test.mjs`; confirm failures before implementation.
- [ ] Implement detection and create/reuse under repo-admin lock. In an existing linked worktree reuse only if its ownership/card mapping is confirmed. For detached/Codex-managed environments, retain the current HEAD and external ownership; do not switch, attach, reset, or delete it. Either create a separate task worktree from that exact commit when policy/environment permits, or require an isolation exception and sequential execution. Missing Git baseline blocks; do not invent an integration branch or auto-commit user files.
- [ ] Write admission tests: disjoint independent cards admitted only with parallel enabled; default remains one card. Unmet/cyclic/unknown dependencies, ancestor card relationships, common conflict groups, overlapping allowed paths including parent/child directories/globs, or unknown scope deny parallelism. Start conservatively: only normalized literal file/subtree scopes can be proven disjoint; unsupported glob forms conflict. Recheck actual changed paths after each checkpoint; unauthorized/conflicting changes pause affected dispatch and integration. Shared dependency manifests/navigation/schema changes use conflict groups even when filenames differ. Add service-A/component-B different-file fixture with a direct dependency: semantic risk flags and serializes them. Graph shared explicit neighborhoods/architecture components trigger risk; coarse shared utility/community membership emits a warning and requires conservative assessment, not automatic proof of conflict. Graph absence/staleness/unknown coverage uses targeted structural fallback; insufficient independence evidence serializes these cards without blocking sequential work. Negative graph evidence cannot override overlapping paths, Notion dependencies or conflict groups.
- [ ] Implement atomic scope reservations with the common admin lock. Separate worktrees isolate files but do not isolate external services, credentials, caches or simulators; serialize shared resources unless a configured adapter provides isolation. Keep execution lock for the same card across role handoffs, not across idle blocked retention. Persist graphViewId on create/reuse; Task 2B resolves the view after creation, so graph unavailability never prevents filesystem isolation. On checkpoint edits mark the view stale and schedule bounded refresh/fallback. Card/branch naming and detached safety remain unchanged.
- [ ] Run the two test files and full `npm run test:clh`; require two child processes to write disjoint files in separate worktrees without changing either other's worktree or the main checkout. Obtain independent review and a card-linked commit.

**Acceptance:** A human-authorized READY card creates/reuses one persisted task worktree; fresh contexts find it without conversation history. Existing linked/detached environments are correctly detected. Parallel admission is conservative, journaled and enforced. Graph view association/fingerprint must match the worktree or be explicitly degraded to fallback. Lifecycle: DETECTED → RESERVED → ACTIVE → RETAINED/BLOCKED or INTEGRATION_PENDING; Task 4A owns integration/cleanup. Failure never destroys user changes.

## Task 3: Persistent execution and invocation budgets (modified)

**Dependencies:** Task 2. Token/cost totals and context-window occupancy are different limits: neither substitutes for the other.

**Files:** Create `harness/state/budget.mjs`, `tests/clh/budget.test.mjs`; modify journal contract only if necessary and keep Task 1 interfaces consistent.

**Interfaces:** `checkBudget(limits, events, now) -> Decision`; `recordUsage(previous, delta) -> Usage`. Limits include attempts=3, repairs=2, connectorRetries=2, durationMs=1800000, maxTokens, maxCostMicrounits, and persisted startedAt/deadline. Time supplied by caller is an ISO timestamp; money uses integer micro-units in one configured currency.

- [ ] Write failing tests: 3 used attempts denies a fourth; 2 repairs denies a third; 2 retries denies another retry; repair cannot exceed total attempt limit; deadline reached blocks; missing token/cost limits blocks paid execution; negative/noninteger/overflow usage rejects.
- [ ] Add restart test replaying usage from disk; totals stay spent. Add backward-clock test: time preceding last observed timestamp blocks, rather than extending the deadline. Add escalation and fresh-agent rotation tests demonstrating limits remain unchanged, even when a worktree or invocation ID changes. Usage records include cardId, invocationId, model, effort, estimated versus actual tokens, and estimator confidence; unknown actual use is not zero. Account graph query/index wall time and any authorized external extraction cost separately but within the same card budget; repeated fallback/reindex cannot reset time/cost ceilings.
- [ ] Run `node --test tests/clh/budget.test.mjs`; confirm failures.
- [ ] Implement budget functions using journal-derived cumulative usage. No billing/token telemetry adapter means paid autonomous execution remains unavailable; this task does not claim hard enforcement over an external model process.
- [ ] Run `npm run test:clh`; require all pass. Obtain independent review and card-linked commit.

## Task 2B: Portable code-graph contracts, worktree indexing, health and fallback (new in revision 3)

**Dependencies:** Tasks 1, 2, 2A and 3. Consumes worktree records/locks and cumulative budgets; does not depend on Context Engine or dispatcher. A test provider exercises the core; production can return UNAVAILABLE and use fallback.

**Files:** Create `harness/graph/provider.mjs`, `harness/graph/index-service.mjs`, `harness/graph/health.mjs`, `harness/graph/fallback.mjs`, `harness/graph/impact.mjs`; create `tests/clh/graph-contract.test.mjs`, `tests/clh/graph-index.test.mjs`, `tests/clh/graph-fallback.test.mjs`, `tests/clh/graph-impact.test.mjs`.

**Interfaces:** `CodeGraphProvider.capabilities() -> Promise<GraphCapabilities>`; `indexRepository(snapshot, options) -> Promise<GraphResult>`; `refreshChanges(view, changes, options) -> Promise<GraphResult>`; all query methods use `(view, request) -> Promise<GraphResult>`: `findSymbol`, `findCallers`, `findCallees`, `findDependencies`, `findDependents`, `findRelatedTests`, `findImpactRadius`, `findRelatedFiles`, `getNeighborhood`, `compareViews`. A request contains symbol IDs/path/concepts, relationship/direction filters, maxHops/maxNodes and deadline. Optional operations return UNSUPPORTED explicitly.

`GraphCapabilities = {provider,version,schemaVersion,languages,relations,incrementalModes,worktreeIsolation,codeOnly,queryMethods}`; advertise only tested capabilities. `GraphResult = {status: 'OK'|'PARTIAL'|'UNAVAILABLE'|'STALE'|'UNSUPPORTED'|'NOT_FOUND'|'AMBIGUOUS'|'ERROR', viewId, fingerprint, artifactRef: string|null, nodes, edges, coverage, truncated, diagnostics}`. Nodes carry qualified symbol ID, kind, relative path, source hash/range, module/boundary and optional community. Edges carry source/target, relation/direction, evidence reference and extracted/inferred/unknown confidence. Coverage identifies known language/relation/file exclusions; empty results with incomplete coverage remain unknown.

`RepositorySnapshot = {repositoryId, worktreeId, root, headCommit, contentFingerprint, configFingerprint, files: [{path,hash,language}], permittedReadRoots}`; `GraphView = {id, repositoryId, worktreeId, baseViewId: string|null, provider, providerVersion, schemaVersion, headCommit, contentFingerprint, configFingerprint, artifactRef, coverage, createdAt}`. Changes enumerate added/modified/deleted/renamed paths with old/new hashes; resolveGraphView returns view=null when unavailable and explicit fallback reasons. GraphResult indexing operations return the validated artifact reference, and the service wraps it in immutable view metadata.

Service exports `resolveGraphView(worktree, provider, policy, stateRoot) -> Promise<{view,health,fallbackReasons}>`, `queryRepository(view, operation, request, provider, fallback) -> Promise<GraphResult>`, and `semanticRisk(candidate, activeCards, evidence) -> {level:'LOW'|'POTENTIAL'|'UNKNOWN',reasons,evidenceRefs}`. `fallback.retrieve(request, worktree) -> Promise<{items,coverage,diagnostics}>` returns source-backed path/range references, not a pretend graph. Task 2A consumes semanticRisk evidence; Task 3A consumes queryRepository results and fallback retrieval.

- [ ] Write failing provider conformance tests for every method, typed unsupported/timeout/missing/ambiguous results, caller/callee direction, dependency/dependent direction, distinct same-name symbols, related test candidates, module/class/communities, depth/node/relationship filtering and truncation. A diamond/cycle fixture must terminate and retain required direct dependents. Test a second provider fake without changing consumers to demonstrate portability.
- [ ] Write failing index tests using temporary Git worktrees: immutable base view pinned to commit; two different worktree overlays never contaminate each other; staged/unstaged/untracked modifications, deleted/renamed files and changed imports produce new fingerprints and correct queries. Main graph cannot satisfy a changed task view. Source hash/range mismatch, parser/config/lockfile changes, concurrent edits during indexing, corrupt cache, or provider/schema changes invalidate view health. Ignore generated/cache/node_modules/secret paths and reject symlinks outside permitted read roots.
- [ ] Write failing incremental tests: refresh only changed files plus invalidated resolution dependents when supported; compare normalized symbol/edge results with a clean full rebuild of the same snapshot. Deletes remove edges, renames rebind references, and changed imports update reverse impact. If comparison fails, disable that incremental mode for the pinned provider and use batch rebuild/fallback. Test ≥20% changed-file threshold, empty initial corpus, config-change invalidation and one-full-rebuild limit; denominator is indexed source-file count, not all repository files.
- [ ] Write failing fallback/risk tests: provider unavailable/stale/partial/unsupported language/missing symbol/contradictory source triggers bounded LSP/Git/ripgrep/range retrieval; ordinary sequential task succeeds if sufficient source is available. Different-file service/component dependency yields POTENTIAL; shared coarse community alone is not proof of runtime dependency; incomplete or absent graph yields UNKNOWN unless source-based structural checks establish sufficient independence. File conflict/Notion dependency always overrides a LOW graph risk. No graph evidence can clear a mandatory source or authorization failure.
- [ ] Run `node --test tests/clh/graph-contract.test.mjs tests/clh/graph-index.test.mjs tests/clh/graph-fallback.test.mjs tests/clh/graph-impact.test.mjs`; confirm expected failures.
- [ ] Implement contracts, service and health checks: isolate cache keys by repository/provider/parser/config/worktree snapshot; read source manifest before/after index and reject publication on changes; serialize publication per view using a graph-specific lock. Do not hold Git admin/card-reservation locks during expensive indexing. Recheck fingerprints when reserving execution. Publish immutable view metadata and graph artifact atomically; never equate provider process success with verified freshness/completeness.
- [ ] Implement bounded refresh/fallback and semanticRisk. Preserve provider diagnostics, unresolved relationships and original source provenance. On permission/read errors, do not broaden permissions; surface the missing source requirement. Graph fallback is permitted; context estimator fallback remains governed by its stricter existing policy. Record one refresh attempt/query timeout then degrade, not an infinite index/retry loop.
- [ ] Run all four test files and `npm run test:clh`; require current-worktree answers or explicit fallback, no cross-worktree corruption, and correct risk semantics. Obtain independent review and a commit linked to this task's separately authorized card.

**Acceptance:** Contract supports the requested relationships where available and explicitly describes unknowns. Graph health accounts for uncommitted work and config changes. Incremental correctness is compared to full indexing; unsupported modes use bounded checkpoint rebuild/fallback. Graph failure alone does not fail sequential development. State stores references/summaries, never a full graph dump.

## Task 2C: Graphify reference adapter and capability verification (new in revision 3)

**Dependencies:** Task 2B. Provider-specific implementation only; no Context Engine policy, authorization or dispatch logic lives here. Optional external installation/version pinning needs its own authorized scope. Missing Graphify selects the same tested fallback path.

**Files:** Create `harness/graph/adapters/graphify.mjs`, `tests/clh/graphify-adapter.test.mjs`, `tests/clh/graphify-live.test.mjs`, `docs/architecture/clh-graph-provider.md`; add an opt-in `test:clh:graphify` script in `package.json` for the live capability fixture. Core tests always run without Graphify; live tests skip with an explicit reason if unavailable, never count as passing provider conformance.

**Interfaces:** `createGraphifyProvider({executable,versionPin,cacheRoot,limits,processRunner}) -> CodeGraphProvider`. processRunner accepts an absolute executable and argv array, controlled environment, cwd, timeout/output limits and isolated cache location; no shell strings. Normalize Graphify graph/query output to the Task 2B contract, retaining edge evidence/direction and schema version. Unsupported native queries may be derived from validated directed graph data inside the adapter; otherwise return UNSUPPORTED.

- [ ] Write failing adapter tests with recorded sanitized fixtures: executable absent, nonzero/ambiguous/not-found exits, malformed/truncated output, wrong graph schema/version, incorrect edge direction, unsafe returned path, no symbol range and timeout. Do not infer a source range, relationship or freshness marker that the provider does not supply; let the service verify/fall back.
- [ ] Run `node --test tests/clh/graphify-adapter.test.mjs`; confirm failures.
- [ ] Inspect and record the installed package identity/version/source and CLI/API/graph schema. Verify local code-only indexing, cache/output path control, language/relation coverage, update behavior, deletion/rename correctness and command exit semantics against a small authorized fixture. Probe rather than assume flags listed in online docs exist in the installed version. No `graphify install`, hooks, instruction rewriting, global graph merging or network/semantic extraction by default.
- [ ] Implement the adapter using the pinned provider's supported headless code path. Prefer machine-readable validated graph artifacts over scraping prose. If only full-code re-extraction is supported, report `incrementalModes=[]` or `full-rebuild-only`; `update`/watch presence does not prove fine-grained correctness. If the provider cannot isolate outputs or guarantee the approved local-only path, mark indexing UNSUPPORTED and fall back instead of leaking worktree state or invoking an LLM implicitly.
- [ ] Write/run the live fixture: index module A/service and module B/caller, query callers/dependents; modify an import and delete/rename a symbol in a task worktree; refresh and compare to full rebuild. Record results and limitations in clh-graph-provider.md, including dynamic dispatch/generated-code/language gaps and related-tests-as-candidates. Enable only passing capabilities for that exact version/parser configuration.
- [ ] Run `node --test tests/clh/graphify-adapter.test.mjs`, `npm run test:clh`, and opt-in `npm run test:clh:graphify` when the pinned provider is present. Missing live capability evidence leaves that provider feature disabled; core fallback tests must still pass. Obtain independent review and card-linked commit.

**Acceptance:** Consumers can replace Graphify without changes to their interfaces. Missing/incompatible provider degrades to source retrieval. Graphify capability claims are recorded and tested per version; incremental refresh is enabled only for verified modes. No assumed token-reduction percentage or test-coverage guarantee.

**Reference evidence for adapter investigation (not a compatibility promise):** The [Graphify source README](https://github.com/Graphify-Labs/graphify) documents local code parsing, query/path/explain commands, persisted schema/version metadata, and a changed-file update workflow. Local `graphify --help` inspected during this plan revision lists query/affected/update/watch, but installed flags may differ. These observations motivate the live conformance task; they do not establish incremental correctness or worktree support. Code-only/no-network behavior and provider versions must be verified before use.

## Task 3A: Graph-first, model-aware context construction and enforced occupancy (modified in revision 3)

**Dependencies:** Tasks 1, 2A, 2B, 2C and 3. The graph contract and resilience behavior are required; a running Graphify installation is not. Retrieve repository context exclusively from the card's mapped task worktree; combine it with the current approved Notion snapshot, relevant Figma references and C0–C5 sources.

**Files:** Create `harness/context/repository.mjs`, `tests/clh/repository-context.test.mjs`; create `harness/context/capacity.mjs`, `harness/context/estimate.mjs`, `harness/context/select.mjs`, `harness/context/compact.mjs`, `harness/context/manifest.mjs`, `harness/telemetry/invocations.mjs`; create `tests/clh/context.test.mjs`, `tests/clh/context-policy.test.mjs`, `tests/clh/telemetry.test.mjs`.

**Interfaces:** `usableCapacity(modelProfile) -> number`; `estimateInput(envelope, estimator) -> Promise<{tokens,method,version,confidence,upperBound}>`; `selectContext(items, mandatoryIds, tokenBudget) -> ContextItem[]`; `compactContext(items, reductionPlan) -> ContextItem[]`; `buildContextPack(card, worktree, checkpoint, sources, profile, estimator, policy) -> Promise<{decision,manifest,envelope}>`; `recordInvocation(stateRoot, invocationRecord) -> Promise<void>`. Export `retrieveRepositoryContext(card, worktree, graphService, fallback, queryPolicy) -> Promise<{items: ContextItem[], graphContext: GraphContext}>` from repository.mjs. buildContextPack consumes it before selecting/estimating content; `sources.repository` carries the graphService, fallback and query policy, while worktree is the already authorized mapping. An envelope includes every known input component, not only retrieved files, including graph summaries and fallback diagnostics actually sent. Estimator returns a conservative upper bound; ratio uses that bound. Unknown or unbounded attachment/tool overhead blocks. An estimator adapter may be provider tokenizer or validated conservative estimator; arbitrary characters/4 is not adequate verification.

- [ ] Write failing ratio tests: usable capacity 100000 with estimated input 20000/30000/40000/40001 yields 0.20/0.30/0.40/0.40001; green includes 0.30, amber includes 0.40, red blocks above 0.40. Below 0.20 is valid; never pad context to a target. Validate output/overhead reservations, stale/unknown capacity, unsupported model/effort and missing estimator fail closed. Route model first and recompute after every model/effort/envelope change; never assume a larger tier has a larger context window.
- [ ] Write failing selection tests: mandatory constitution, approval/scope/criteria, permissions, critical interfaces/design, current state/failure constraints are preserved; low-priority optional history/examples disappear first. Deduplicate equal content hashes while retaining all provenance; do not collapse different versions or contradictory requirements. Mandatory duplicates can share content but retain mandatory labels. Token overflow must not silently truncate constraints.
- [ ] Write failing retrieval/compaction tests: symbol lookup returns exact file revision and line range; required imports/types/callers are included by reference or bounded snippets; ambiguous symbol requests block or use explicit fallback within budget. Oversized optional files narrow to relevant ranges; no fabricated snippets. Re-estimate compacted output, including wrappers and manifest text actually sent. Remove duplicate/irrelevant optional material before summarizing; critical mandatory wording stays verbatim or source-backed lossless representation. Unresolved semantic ambiguity blocks rather than being summarized away.
- [ ] Add failing repository-context tests: card entities → bounded graph query before broad file exploration → ranked symbols/neighborhood → exact hash-verified source ranges → pack → budget gate. Broad result prunes optional hubs/communities; expands one hop only for missing required evidence; capped result never pretends completeness. Corrupt/stale/unsupported/missing-symbol results select fallback; source/graph contradiction invalidates graph provenance. Fixture code retrieval excludes an unrelated large module and stays within the approved scope.
- [ ] Run `node --test tests/clh/repository-context.test.mjs`; confirm failures.
- [ ] Run `node --test tests/clh/context.test.mjs tests/clh/context-policy.test.mjs tests/clh/telemetry.test.mjs`; confirm failures.
- [ ] Implement capacity, estimator contract, priority selection, deduplication and bounded file-range/symbol retrieval. Implement graph-first retrieveRepositoryContext via Task 2B service and Task 2C adapter; verify source ranges/hash before inclusion. Preserve required upstream/downstream/test context, then use bounded LSP/Git/ripgrep/file-range fallback as needed. Optional Repomix packages only the selected paths/ranges and its output is re-estimated; optional Context7 supplies versioned external docs through sources, never repository graph facts. No mandatory dependency on either packaging/docs tool. Build a manifest with token estimate by item/envelope component, provenance, ranges, omissions/reasons, source hashes, model/effort, worktree/diff/checkpoint, policy and exception evidence. Hash manifests and redact secrets before dispatch/storage.
- [ ] Implement zone enforcement with graph summary + retrieved source counted together: prune/narrow optional neighborhoods before source loading/compaction, expand only for insufficient evidence. Green may dispatch immediately; amber attempts deduplication/compaction/narrow retrieval toward ≤0.30, then may dispatch if still ≤0.40 with a recorded amber warning. Red cannot normally dispatch; rebuild and recalculate up to two times. Validate exceptions through the trusted approval verifier; cap at explicitly approved ratio below 1.0 and provider hard limits. Rotation alone cannot make oversized mandatory context smaller.
- [ ] Add failing decomposition tests: mandatory context still >0.40 after bounded reductions returns BLOCKED_CONTEXT_TOO_BROAD plus a proposed decomposition artifact with criterion mapping/dependencies and no READY status; if decomposition is unsuitable, return NEEDS_CONTEXT_EXCEPTION. Proposed subcards require human review/authorization and cannot be executed under the original approval. An exception denial or missing capacity never causes automatic expensive-model escalation.
- [ ] Implement escape hatch and telemetry: record per card/invocation pre/post token estimates, ratios/zones, capacity source, reductions, selected/omitted counts, estimator confidence, rotation reason, actual usage when available and block reasons. Actual unknown usage remains null; no private prompt/code bodies in summary telemetry. Record provider/view/fingerprint/coverage, graph query count/latency, refresh mode/time/cache hits, fallback reasons, candidate versus selected symbols/files/ranges, graph-summary tokens, source tokens and reductions. Compare deterministic matched graph-first/fallback fixture runs at equal criterion/impact coverage; report measured tokens/reads, not an assumed saving. Promote reusable project learning separately from task checkpoint state.
- [ ] Run all four context test files then `npm run test:clh`; require every fixture >0.40 either reduces and passes with evidence or blocks/uses verified exception. Obtain independent review and card-linked commit.

**Acceptance:** Normal dispatch cannot exceed 40% of selected model usable capacity. Optional context is removed first; mandatory material is never silently lost. Every invocation has an auditable manifest and occupancy telemetry. Preferred 20–30% is guidance, not a minimum or padding target. Decomposition proposes work but never authorizes it. Graph-first call ordering and targeted retrieval are verified; graph-unavailable sequential flow succeeds through fallback at the same budget/authority gates.

## Task 3B: Orchestrated dispatch, checkpoints, and diff-first fresh sessions (modified in revision 3)

**Dependencies:** Tasks 1, 2, 2A, 2B, 2C, 3 and 3A. This connects isolation and context budgeting; neither can be bypassed by a role switch or repair.

**Files:** Create `harness/execution/dispatch.mjs`, `harness/execution/checkpoint.mjs`, `tests/clh/dispatch.test.mjs`, `tests/clh/resume.test.mjs`.

**Interfaces:** `prepareInvocation(cardId, role, adapters, stateRoot) -> Promise<{decision,manifest,checkpoint}>`; `dispatchInvocation(prepared, runtime) -> Promise<InvocationResult>`; `saveCheckpoint(stateRoot, checkpoint) -> Promise<void>`; `resumeCard(cardId, adapters, stateRoot) -> Promise<Checkpoint>`. Adapters contain live card/approval fetch, dependency check, worktree manager, graph service/health/fallback and semantic-impact assessment, context sources, capability/model registry, estimator, sandbox runtime, validator, and independent reviewer. Runtime exposes `capabilities()` and `invoke({invocationId,sessionMode:'fresh',cwd,allowedPaths,envelope,model,effort,limits})`; capabilities must attest enforceable restrictions and usage/termination support, not just role labels.

- [ ] Write failing tests: card preflight → scope reservation → worktree mapping → current graph view/fallback → targeted retrieval → minimum pack → token gate → dispatch occurs in that exact worktree. Unavailable live authorization/estimator/sandbox/runtime blocks before launch. Fixture adapters are used only in tests. Invocation intent persists before launch; uncertain launch state blocks automatic duplicate dispatch until runtime reconciliation.
- [ ] Add fresh-process resume tests: persisted checkpoint, approval scope digest, worktree head and patch hashes reconstruct a task with no prior conversation. Graph references may be reused only when HEAD/content/config/provider fingerprints match; otherwise refresh or fallback. Changed scope blocks; changed repository content invalidates affected manifest/review and triggers an authorized rebuild. Resume same card while Notion is IN PROGRESS uses original verified authorization plus current recheck, not a fabricated READY transition.
- [ ] Add repair tests: fresh debugger session receives mandatory scope/constraints, compact factual checkpoint, current base-to-worktree diff (including staged, unstaged and relevant untracked changes), and new failure evidence plus bounded graph callers/dependencies/impact for the failing component. Statically inferred data-flow hints remain hypotheses verified against source/runtime; graph does not establish root cause. Missing graph uses targeted debugging fallback. It does not reload the original optional full context. Large diffs use bounded hunks + changed-symbol context with full-diff artifact reference; missing mandatory changes block. Re-estimate each repair and reviewer envelope. Attempts/tokens/cost/deadline persist and limits terminate further launches.
- [ ] Run `node --test tests/clh/dispatch.test.mjs tests/clh/resume.test.mjs`; confirm failures.
- [ ] Implement orchestrator ordering, capability-aware routing and checkpoint writes. Resolve graph health/view and re-evaluate semantic reservations before dispatch; perform costly graph work outside repo-admin locks and revalidate fingerprints/reservations atomically before launching. Evaluate budgets and ≤0.40 gate immediately before invoke. Source edits invalidate graph-derived context just as they invalidate diffs; do not rebuild the entire graph after every tool edit. Use fresh sessions for repairs, role changes, stale accumulated context, or projected input above ceiling. Long tool output is stored as an artifact with bounded summary; if active context is near/above ceiling, checkpoint and rotate before another turn. Runtime without reliable context observation/rotation enforcement cannot run unattended.
- [ ] Implement independent diff-first review: reviewers get requirements, mandatory architecture/design constraints, exact diff and validation evidence without implementer private reasoning. Prefer a clean detached review worktree pinned to the candidate commit; enforce filesystem read-only access through runtime permissions (Git alone does not make it read-only). If a read-only review worktree is impractical, use immutable diff/evidence artifacts and an explicit recorded review mode. For changed symbols query bounded callers/dependents/test candidates on both base and candidate views (include deleted-symbol impact from base); give concise findings and source references, not graph dumps. Tests are proposed candidates until coverage/runtime evidence confirms them. Unsupported or incomplete relationships trigger targeted fallback, never a false no-impact review. A changed candidate hash invalidates review.
- [ ] Run both test files and `npm run test:clh`; require budget manifests for implementer/debugger/reviewer, same task worktree across rotations, and no unauthorized Notion promotion. Obtain independent review and card-linked commit.

**Acceptance:** One persisted chain links Notion scope + worktree + context pack + occupancy gate + fresh invocation + checkpoint + diff/failure evidence. Validation/test commands use the task worktree. Card lifecycle advances only with actual evidence; fakes cannot produce production VERIFIED status.

## Task 4: Safe inspection CLI and documented handoff (modified in revision 3)

**Dependencies:** Tasks 2A, 2B, 2C, 3A, 3B. The CLI remains read-only by default; adapter-backed execution is exercised through library integration tests until production prerequisites are met.

**Files:** Create `harness/cli.mjs`, `tests/clh/cli.test.mjs`, `docs/architecture/clh-governance.md`.

**Interfaces:** `main(argv, io) -> Promise<number>` with injectable stdout/stderr. Commands: `check --card <json> --approval <json>`, `inspect --run <id>`, `inspect-worktree --card <id>`, `context-check --manifest <json>`, and `inspect-graph --card <id>`. Graph inspection shows provider/version, view/worktree fingerprints, health/coverage, refresh mode and fallback reasons without index mutation or full graph output. All commands are read-only. `context-check` returns 2 above 0.40 without a verified exception, or if provenance/capacity/estimate is unavailable. Output one JSON result. Exit 0 for a successful inspection; 2 for policy BLOCKED; 1 for invalid input or I/O error. No shell interpolation or agent launch.

- [ ] Write failing tests: production check returns BLOCKED because live verifier is unavailable; malformed input returns 1; inspect replays valid events; traversal run IDs and symlinked `.clh` directories reject without reading/writing outside root. Empty/unknown commands reject with usage information. Add manifest ratio 0.30/0.40/>0.40 boundary tests, external/detached worktree display, and missing checkpoint/manifest blocking diagnostics. Add inspect-graph tests for unavailable/stale/partial views, with actionable fallback diagnostics and no claim that graph absence alone blocks the card.
- [ ] Run `node --test tests/clh/cli.test.mjs`; confirm failures.
- [ ] Implement CLI; restrict run IDs to `[A-Za-z0-9_-]+`, resolve paths and reject symlinks in the state path. `check` is read-only and cannot claim or implement cards. Library claim APIs are not an unattended execution path.
- [ ] Document the contracts, exact recovery steps, unsupported multi-host execution, unavailable live authorization, and worktree ownership/recovery/retention, conflict admission, context thresholds and telemetry, fresh-session continuation, integration boundaries, and graph/provider/fallback trust boundaries and remaining production adapter prerequisites. Include the Notion ledger link.
- [ ] Run `npm run test:clh` and `node harness/cli.mjs check --card tests/fixtures/clh/proposed-card.json --approval tests/fixtures/clh/approval.json` after creating sanitized fixtures in this task. Require tests pass and CLI exits 2 with a structured BLOCKED result. Review the final diff independently and commit with the authorized card ID.

## Task 4A: Serialized integration verification and safe cleanup (modified in revision 3)

**Dependencies:** Tasks 2A, 3B and 4. Task execution does not merge to main. The integration target is explicitly configured and must already exist; no force operations or production deployment are included.

**Files:** Create `harness/worktrees/integration.mjs`, `tests/clh/integration.test.mjs`, `tests/clh/cleanup.test.mjs`; extend journal validators and architecture documentation.

**Interfaces:** `prepareIntegration(cardId, candidateCommit, targetRef, adapters) -> Promise<IntegrationRecord>`; `verifyIntegration(record, validator) -> Promise<GateEvidence[]>`; `mergeIntegration(record, gates, approvalVerifier) -> Promise<IntegrationRecord>`; `cleanupWorktree(record, policy) -> Promise<{status,reason}>`. `IntegrationRecord` includes card/worktree ID, candidate commit, target ref and original SHA, dedicated integration worktree path, merge commit/tree SHA, regression evidence hashes, approval evidence, and lifecycle state.

- [ ] Write failing temporary-Git tests: candidate reviewed and committed; create a clean integration worktree on a temporary harness-owned integration branch based on the recorded target SHA; merge candidate there, verify the resulting tree and regression checks, then advance target only with expected-old-SHA protection and configured integration authorization. Never mutate a target branch checked out in an unmanaged worktree; require a managed clean integration checkout or block. Remote/protected branches use authorized PR/provider merge flow, not local-ref updates masquerading as a remote merge.
- [ ] Add failures: merge conflict, target HEAD changed after tests, regression failure, missing review/approval, dirty integration checkout, review for another revision, Notion sync outage, or mismatched integration record. Merge conflict is BLOCKED/repair work in the same task worktree under authorized scope; no hidden conflict resolution by the integration runner. Changed target requires a new integration candidate and fresh regression evidence.
- [ ] Write cleanup tests: remove only harness-owned task/review/integration worktrees after successful integration evidence and recorded commit identity; untracked/dirty changes, active leases, unresolved merges, external/Codex-managed ownership, blocked tasks or unresolved sync/evidence retention prevent removal. Normal `git worktree remove` only; no `--force`, recursive shell deletion, branch force-delete, or blind prune. Repeated cleanup is idempotent; branch deletion is separate and disabled by default. Retain reason and path are visible in task state.
- [ ] Run `node --test tests/clh/integration.test.mjs tests/clh/cleanup.test.mjs`; confirm failures.
- [ ] Implement journaled integration transitions INTEGRATION_PENDING → INTEGRATION_VALIDATING → INTEGRATED → CLEANUP_PENDING → CLEANED, with BLOCKED/RETAINED paths. Persist operation intent before Git mutations, reconcile refs/worktree inventory after a crash, and never repeat an uncertain merge blindly. Serialize integration and Git administration; shared state survives worktree removal. Detach the cleaned worktree view reference; cache garbage collection removes only harness-owned unreferenced views under a separate graph lock, never shared base views still referenced by other cards/reviews. Retain manifest/fingerprint/summary evidence after cache eviction; next use can rebuild or fall back.
- [ ] Implement gates and cleanup. Resolve a fresh graph view or targeted impact fallback for the exact integration candidate, then record pre-merge regression evidence against exact integration candidate tree; run configured post-merge smoke/regression checks and record outcomes before cleanup. Failure after target advancement retains artifacts and blocks DONE; do not automatically reset a shared branch. Notion VERIFIED is not permission to merge, and DONE cannot precede required integration/sync/product gates.
- [ ] Run both test files and `npm run test:clh`; require verified integration and clean worktree removal, plus every retention failure preserves files. Obtain independent review and card-linked commit.

**Acceptance:** Integration occurs separately from task execution with regression verification before target advancement. Completed integrated owned worktrees clean safely; blocked/dirty/external worktrees remain. Record task branch/path/base/candidate/integration hashes and cleanup reason for traceability even after removal.

## Task 4B: End-to-end contract verification and release-readiness evidence (modified in revision 3)

**Dependencies:** All earlier tasks. This is a test/reconciliation unit, not a new source of implementation authority.

**Files:** Create `tests/clh/loop.integration.test.mjs`, `tests/fixtures/clh/scenarios.mjs`, `docs/architecture/clh-validation-matrix.md`; update `package.json` with `test:clh:integration` = `node --test tests/clh/loop.integration.test.mjs`.

- [ ] Write failing contract scenarios using explicit fake Notion/model/runtime adapters and real temporary Git worktrees: READY authorized card → dependency check → worktree → graph query/targeted fallback → verified symbol retrieval → context manifest → budget gate → agent invoke → checkpoint → validation → independent review → integration verification → merge → cleanup. Assert call order, exact cwd, scope/hash linkage, actual persisted records and final status. Simulation evidence must be labeled TEST_ONLY.
- [ ] Add >40% optional-context scenario: 45000 estimated input / 100000 usable capacity blocks first launch; removal/compaction produces ≤40000 and only then dispatches. Mandatory-only >40000 remains blocked with decomposition proposal or verified bounded exception, never fake success. Estimator unavailable and overbroad task after two rebuilds make zero runtime calls.
- [ ] Add fresh-process repair scenario with same dirty-but-checkpoint-consistent task worktree: reconstruct compact state + current diff + new failures, rotate session, recompute occupancy and preserve cumulative budgets. Assert original optional pack/history is absent and mandatory criteria/permissions remain. Recover uncertain dispatch and merge states without duplicate side effects.
- [ ] Add two-card scenarios: safe independent paths admit only when enabled; conflicting paths/dependencies/conflict groups block before parallel launch; observed out-of-scope/conflicting diff stops subsequent work. Existing branch/worktree collisions, dirty inconsistent state and detached HEAD never cause forced checkout/removal.
- [ ] Add graph integration scenarios: base/main graph → change uncommitted imports/calls in task worktree → refresh → updated dependency query; second worktree retains its own view. Two different-file cards with a service dependency produce semantic risk and serialize. Compare graph-first versus provider-unavailable fallback on the same card: both satisfy mandatory coverage and ≤40%; telemetry distinguishes them. Stale/unsupported/missing/ambiguous/too-broad/contradictory graph fixtures must refresh or fall back with no silent stale edges. Fresh repair/review uses concise graph references/current diff, not a raw graph.
- [ ] Run `npm run test:clh:integration`; confirm scenario failures before any test-driven corrections. Corrections must stay within each owning task's authorized scope; unrelated discoveries become PROPOSED cards.
- [ ] Run `npm run test:clh` and `npm run test:clh:integration`; require all pass with manifest/journal/gate artifact references. Repeating integration tests is justified here by end-to-end failure/recovery coverage.
- [ ] Record a validation matrix distinguishing tests with fake external adapters from real Notion/runtime/provider tests. Live readiness additionally requires real approval-revocation test, provider capacity/tokenizer calibration, enforceable sandbox/usage termination, device/Figma adapters for UI cards, and authorized merge-provider checks. Missing mandatory live authorization/sandbox/estimator/runtime capabilities remain BLOCKED, not marked NOT_APPLICABLE or VERIFIED. An optional missing graph provider is recorded UNAVAILABLE with a passing tested fallback path; it does not block live readiness by itself. Independent final review checks the exact branch diff and policy/schema consistency; commit and update authorized card evidence only after successful checks.

## Completion and following plans (revised)

Original Tasks 1, 2 and 3 remain the CLH-2 kernel deliverable; Task 4 is independently verifiable on its separate dependent card. The complete revised foundation additionally requires 2A, 2B, 2C, 3A, 3B, 4A and 4B, each linked to an authorized Notion card. Keep their status/evidence separate; completing CLH-2 does not imply all additions are done. Runtime and connector contracts can be tested with fakes; production authorization, dispatch and Notion VERIFIED stay unavailable until real adapters satisfy contracts.

Remaining separately scoped work implements live Notion snapshot/approval verification and synchronization, actual sandboxed agent/model-provider adapters, and Figma/device/visual gates. Optional graph-provider installation/version pinning is approved separately; graph health never substitutes for those mandatory capabilities. Context selection, budgeting, worktree lifecycle and integration are no longer deferred or optional. Notion lifecycle updates must preserve the authorized scope revision and reference worktree/invocation/integration metadata without treating Notion property edits as proof of approval.

## Requirement coverage and change log

| Requirement                                                 | Owning tasks       | Measurable verification                                                                 |
| ----------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------- |
| Card/branch naming, linked/detached detection, create/reuse | 1, 2, 2A           | Stable mapping and real-Git detection/collision tests                                   |
| Same worktree across implement/debug/test/repair            | 2, 2A, 3B          | Fresh-process repair retains path/branch/diff                                           |
| Parallel safety and isolation                               | 2, 2A, 4B          | Independent writes isolated; conflicting paths/dependencies denied                      |
| Separate review/integration/cleanup                         | 3B, 4A             | Exact revision review, pre-merge regression, owned clean removal                        |
| Estimation, usable model capacity, ratios, manifests        | 1, 3, 3A           | Full-envelope estimates; exact 0.30/0.40 boundary tests                                 |
| Selection, dedup, ranges, compaction                        | 3A                 | Optional context removed first, mandatory constraints preserved                         |
| Diff-first repair, fresh rotation, persisted state          | 2, 3B, 4B          | Restart has no dependence on prior conversation                                         |
| Metrics and enforcement                                     | 3, 3A, 3B, 4       | Per-invocation estimates/actuals; missing estimate blocks                               |
| Too-broad escape hatch                                      | 3A, 4B             | Bounded rebuilds then PROPOSED decomposition or trusted exception                       |
| Graph provider/freshness/fallback                           | 1, 2, 2B, 2C       | Conformance, per-worktree hashes, rename/delete refresh and provider-outage fallback    |
| Graph-first targeted context                                | 3A, 3B, 4B         | Query-before-exploration ordering, range verification and graph+source token accounting |
| Semantic conflicts/review/debug                             | 2A, 2B, 3B, 4A, 4B | Different-file dependency flags; bounded impact findings; source/runtime authority      |
| Notion/execution integration                                | 1, 3B, 4A, 4B      | Scope recheck, lifecycle guards, no agent self-authorization                            |

**Revision 2 history — existing tasks changed:** 1 authorization/configuration; 2 lock/journal/state scope; 3 cumulative invocation accounting; 4 diagnostics/handoff. Their identifiers and original tests are retained.

**Revision 2 history — new tasks:** 2A worktree/admission; 3A context engine/enforcement; 3B dispatch/checkpoint/repair orchestration; 4A integration/cleanup; 4B end-to-end verification. Execute in the documented order, not as unrelated optimizations after a completed harness.

**Architecture decisions reconsidered:** repository-wide single-writer lock becomes per-card locks plus serialized administration/integration; state moves outside disposable worktrees; context/dispatch are part of the foundation rather than deferred; full original context reload becomes diff-first reconstruction; integration and cleanup get distinct states; model routing requires verified capacity/estimator metadata. Parallel execution stays opt-in and unavailable until all checks are enforced. JavaScript harness choice, Notion/Figma authorities, human authorization and mobile-stack independence remain intact.

## Revision 3 change summary

1. **Existing tasks modified:** 1 policy/authority, 2 graph references/schema, 2A view association and semantic admission, 3 indexing/query accounting, 3A graph-first selection/budget/telemetry, 3B resume/debug/review, 4 health diagnostics, 4A merged-candidate freshness/cache retention, 4B end-to-end failure/efficiency tests. Prior decisions/tests and task IDs remain.
2. **New units:** 2B pluggable provider/index/freshness/fallback service; 2C Graphify reference adapter and capability verification. Graph-assisted context/conflict/review/debug work is integrated into existing tasks, not a separate tail-end feature.
3. **Dependencies:** 2B follows 2A/3; 2C follows 2B; 3A/3B/4/4A/4B consume them. Task 2A accepts semantic fixtures until 2B is available, preventing a dependency cycle. New cards remain PROPOSED until human authorization.
4. **Context engine:** extract entities → bounded graph neighborhood → source-verified ranges → optional selective packaging + external docs/design/product sources → ≤40% gate. Graph summaries are budgeted; raw dumps prohibited. Missing graph falls back without relaxing context requirements.
5. **Worktrees:** immutable base graphs plus isolated per-worktree views/fingerprints including uncommitted changes; incremental refresh where proven; bounded rebuild/fallback otherwise; cleanup cannot erase shared graph evidence.

## Build execution record — 2026-10-17

The approved plan was implemented as a Node.js harness foundation in this repository. CLH-2 through CLH-10 implementation cards cover Tasks 1, 2, 3, 2A, 2B, 2C, 3A, 3B, 4, 4A and 4B. The original identifiers and order were retained. Worktree isolation, graph-first retrieval, context budget checks, fresh-session continuation, independent review, journaled completion, integration and guarded cleanup are implemented with unit and temporary-Git integration coverage. Card completion requires the linked validation evidence and commit; this execution record does not grant live adapter readiness.

Task 3B includes the final completion transaction: it loads the authoritative persisted checkpoint under the card lock, rejects stale/caller-altered state, verifies task-worktree branch and common Git repository ownership before committing, records COMMITTING/COMMITTED intent and evidence, and records VERIFIED only after an exact Notion card/commit acknowledgement. Lock contention does not append a task transition. Failed synchronization remains SYNC_PENDING and retries sync without repeating the commit.

The final local suite on Node 24.21.0 reports 67 tests: 66 passed and the opt-in Graphify fixture skipped in the default run. The Graphify opt-in run reports 3 passed. The end-to-end loop is explicitly TEST_ONLY because its Notion, model, runtime and review adapters are fixtures. See `docs/architecture/clh-validation.md` for evidence boundaries and `docs/architecture/clh-build-rulings.md` for execution rulings.

Remaining readiness work is host integration rather than an unimplemented framework core: trusted live Notion authorization and synchronization, calibrated provider tokenizer/capacity data, enforceable runtime sandbox/termination/context observation, a real independent review adapter, and device/Figma/accessibility adapters for UI tasks. Graphify incremental indexing and mobile-language completeness remain unverified; the framework marks the provider view/fallback state and does not claim those capabilities. A target ref already checked out in an unmanaged worktree remains blocked until a managed merge provider is supplied. 6. **Parallel execution:** shared paths + graph neighborhoods + architecture components + Notion dependencies determine conservative risk. Graph is advisory; stale/unknown semantic evidence serializes uncertain cards rather than blocking sequential execution. 7. **Provider limitations:** Graphify is optional and capability/version-gated. Incremental correctness, language/resolver coverage, edge confidence and test relationships must be demonstrated, not assumed. No claims of runtime behavior, proven test coverage, complete semantic independence or guaranteed token savings are derived from the graph.

## Plan self-review

Original authorization, budget, corruption, clock, path-safety and independent-review requirements remain covered. Worktree state and context-budget policy now affect the architecture, contracts, configuration, original tasks, dispatch/review/repair, Notion states and test strategy. Each inserted task has inputs, interfaces, failing tests, verification and card-linked completion. No live feature is represented as implemented; no new work is self-authorized. The original spec's narrower scope is superseded only by the user-requested amendments described here.

Revision 3 self-review: graph-first discovery now precedes retrieval and appears in state/configuration, worktree admission, budgets, every agent role, integration, telemetry and tests. Graph outages degrade to bounded fallback; authority, context sufficiency and occupancy gates remain enforced. No implementation, dependency installation or card authorization is part of this documentation update.
