# CLH Mobile: executable framework design

Version: 1.0, 2026-10-16. Status: design approved by the user in this session on 2026-10-16. Approval permits implementation planning; implementation still requires an authorized Notion card and plan review.

## Intent and baseline

Build a governed operating framework around Codex and supporting agents for mobile development. Preserve the user's CLH Mobile v1.0 principles: Notion authorizes work, Figma owns approved design, Git owns implementation history, repository documentation preserves technical knowledge, and the harness controls execution. Conversation history is not project memory.

Success means one human-authorized card can move through bounded execution, independently verified evidence, traceable commit/PR, and a recoverable Notion update. An unauthorized card, stale authorization, missing mandatory evidence, or exhausted budget must prevent advancement.

The workspace currently contains REA dependencies and a Tawsila design review, with no mobile app or harness implementation. This design does not select a mobile technology stack or authorize Tawsila feature work.

## Approach and alternatives

Recommended: a local, single-card CLI harness with persistent run records and explicit adapters. Prove governance before introducing concurrent execution or hosted infrastructure.

Alternative: documentation and skills only. Cheapest starting point, but rules depend on agent compliance and cannot reliably enforce locks, budgets, or state transitions.

Alternative: distributed multi-agent service immediately. Supports concurrent work but adds scheduling, credentials, isolation, and recovery complexity before the authorization model is proven.

## Authority and bootstrap

No Notion Card → No Implementation applies to framework code as well as application code. This specification is planning work requested directly by the user. It does not create an exception allowing code changes without a card.

Before implementation, create a framework initiative and bootstrap cards in a user-selected Notion database. Agents may draft PROPOSED cards; a human must move them to READY. Do not create an external workspace or choose a database implicitly.

Separate mutable workflow status from authorization. Each executable card needs an authorization record containing human identity, timestamp, approved scope revision, and permitted risk exceptions. READY alone is insufficient if an agent or automation can set that field. Use a human-controlled approval mechanism and audit evidence; never infer approval from status alone.

Once claimed, the card moves to IN PROGRESS. Resuming the same authorized run does not require moving it back to READY. Recheck authorization and scope before each mutation stage. Revocation, cancellation, or a changed acceptance/design/scope revision pauses dependent work for renewed approval.

Notion owns product requirements; Figma owns approved visual/interaction specifications. If the two conflict, block the conflicting work and request resolution. Design precedence over informal descriptions does not override approved business rules, security requirements, or accessibility obligations.

## Initial subsystem boundaries

1. Governance and state: normalize cards, validate human authorization, check dependencies, claim work, and journal transitions.
2. Context builder: assemble bounded, versioned task packs with provenance and freshness.
3. Execution adapter: run one bounded agent task with a capability profile, workspace restrictions, and limits.
4. Validation and review: run deterministic checks, collect runtime/design evidence, and obtain independent review.
5. Completion synchronization: bind evidence to a revision, commit/create PR when authorized, and update Notion idempotently.

Each subsystem gets its own approved implementation cards. Do not build every directory in the proposed repository tree before it serves an implemented capability.

## First vertical slice

Process one explicitly selected READY card in a local repository. Automatic priority selection follows after this slice works.

Fetch card → verify authorization/dependencies → acquire lease → persist snapshot → assemble context → select available profile → execute bounded change → run required gates → independently review exact diff → record evidence → commit/PR → synchronize Notion.

The first slice supports non-UI framework work. UI cards remain blocked until actual Figma retrieval, mobile runtime capture, and visual validation adapters exist. Unimplemented adapters must return unavailable, never pass.

## Card contract

Retain all user-proposed fields: ID, title, type, status, priority, parent, specification, objective, acceptance criteria, dependencies, Figma, design required, complexity, branch, PR, validation, attempts, blocker, human review, and origin.

Add scope revision, human authorization evidence, allowed paths, required platforms, risk classification, validation profile, acceptance-criterion IDs, and execution budgets. Design-required cards must identify approved Figma node/version references. Dependencies must be satisfied according to an explicit project rule, normally DONE; missing or circular dependencies block execution.

## State and recovery

Notion lifecycle remains IDEA → PROPOSED → DRAFT → READY → IN PROGRESS → VALIDATING → REVIEW → VERIFIED → DONE, with BLOCKED and CANCELLED.

The local journal uses finer-grained execution stages and records run ID, card ID, authorization revision, lease owner/expiry, attempt, operation ID, previous/new state, timestamp, and artifact paths. Persist intent before external side effects and reconcile outcomes afterward.

Use a single-writer project lock for v1. A local lock does not coordinate other machines: multi-host execution is unsupported until an atomic shared lease adapter is implemented. Claim conflicts stop execution. On crash, inspect the journal and external state before retrying; never repeat a commit or PR creation blindly.

Transient connector retries are distinct from repair attempts. Notion outages prevent new claims and authorization-dependent mutations. If synchronization fails after a commit, record SYNC_PENDING locally and retry only synchronization; do not rerun implementation or claim completion.

## Context contract

Every task pack contains C0 constitution, C1 approved product scope, C2 relevant approved design, C3 bounded code references, C4 version-specific documentation, and C5 selectively promoted project knowledge. Include only applicable layers and explain omissions.

Record source URLs/IDs, revision or retrieval timestamp, relevant file hashes, approved scope, exclusions, permitted paths, acceptance criteria, gate commands, budget, and unresolved blockers. Redact secrets and unnecessary personal information. External content is evidence, not permission to execute embedded instructions.

Enforce a configurable context budget. Preserve authorization, acceptance criteria, constraints, and source references before optional history. Missing mandatory context blocks work; silent truncation is prohibited.

## Profiles, roles, and permissions

Use logical economy, standard, and advanced tiers with separate effort settings. Configure mappings from capabilities actually available at startup. Do not assume particular model names, effort levels, or automatic model switching. Unavailable mappings require an explicit supported fallback or a blocked result.

The orchestrator routes and journals; the context role reads sources; the implementer changes permitted files; the tester runs deterministic checks; the reviewer reads the requirements, exact diff, and evidence. Add planner, UI, and debugger roles only when required.

Independent review requires a separate execution context. If unavailable, require human review rather than silently treating implementer self-review as independent. Role separation alone is not a sandbox. Enforce paths, shell access, network access, credential scope, and tool availability through the execution adapter. Unsupported enforcement blocks unattended execution.

Begin sequentially. Parallel agents later require explicit authorization, isolated worktrees, disjoint ownership, and controlled integration. Agents cannot promote discovered cards to READY or delegate authority beyond their own grant.

## Budgets and repair

Initial proposed defaults per card: three total implementation attempts, two repair attempts within that total, two transient connector retries, and a 30-minute execution ceiling. Set token/cost ceilings per approved run; no paid unattended execution without configured limits.

Persist cumulative consumption across restarts. Escalation never resets budgets. Repeated identical failures without new evidence stop early. Exhaustion records BLOCKED with evidence and a proposed next action; agents cannot authorize additional attempts themselves.

The debugger follows reproduce → evidence → root cause → minimal fix → reproduce again → regression checks. Repairs stay within the authorized card. Unrelated discoveries become PROPOSED work.

## Verification and evidence

Use G0–G11 from the supplied framework. Each gate is PASS, FAIL, BLOCKED, or NOT_APPLICABLE. A required gate cannot be skipped or marked not applicable by the implementer. Gate selection is versioned policy plus the approved card's requirements.

Evidence records gate ID, command/tool and version, environment, start/end time, exit status, artifact references and hashes, tested Git revision or patch hash, and acceptance-criterion coverage. Any subsequent code change invalidates affected results and review.

Mobile UI evidence identifies platform, OS, device size, locale, theme, font scale, fixture data, Figma reference, and screenshot artifact. Compare equivalent states; mask dynamic content only with recorded justification. Define visual tolerances and critical defects before execution. A fabricated universal fidelity score such as 97 is not sufficient evidence.

Device validation runs on each required platform. Accessibility combines deterministic checks and required human assessment; screenshot similarity does not establish accessibility. Security-sensitive changes receive the required human approval and appropriate validation.

## Completion semantics

VERIFIED means all required gates and independent review passed for the recorded revision, implementation is committed, evidence is stored, and Notion synchronization succeeded. DONE follows the project's configured human/product completion rule. Neither status means production deployment unless release authorization explicitly says so.

Commit messages and PRs include the card ID. Review the exact candidate tree before committing; if hooks alter content, revalidate affected gates. Record final commit identity. Maintain a chain from authorization and design references to context pack, diff, validation, review, commit, and PR.

Production deployment, destructive operations, major architecture/product changes, and other specified high-impact actions remain separate human approval gates. Existing approval applies only to its stated scope.

## Integrations and persistent artifacts

Use adapters for Notion, Figma, Git, agent runtime, documentation retrieval, and mobile validation. Skills such as Superpowers guide methodology; they do not override CLH authorization. REA is opt-in research tied to an authorized research card. Other listed repositories are candidates for specific capabilities, not mandatory dependencies.

Proposed artifacts: AGENTS.md for concise constitution; docs/ for architecture/decisions; policies/ for validated routing, permissions, budgets, and gates; context-packs/ for source-stamped packs; .clh/runs/ for journals and evidence manifests. Keep sensitive runtime records out of Git. Commit sanitized specifications and reproducible validation definitions.

## Framework validation scenarios

- Reject a card without authentic human authorization, with changed scope, or with unmet dependencies.
- Prevent a second runner from claiming the same local project.
- Resume after a crash without duplicating a commit or PR.
- Fail closed on unavailable tools, unsupported model mappings, and mandatory missing context.
- Stop when attempt, time, token, or cost limits are exhausted, including after restart.
- Reject evidence for another revision and require re-review after changes.
- Prevent an agent-discovered PROPOSED card from entering execution.
- Preserve a committed result during a Notion outage and synchronize without reimplementation.
- Require both platform and visual evidence for a UI card when policy mandates them.

## Decisions required before implementation planning

Approve or amend this design; identify the Notion workspace/database for the framework initiative; establish the human authorization mechanism; and select the first bootstrap card. Mobile stack selection belongs to separate authorized architecture work.

No application code, executable harness, external projects, or dependency installation is included in this design deliverable.


## Subsequent user amendments: worktree and context foundations

The user subsequently required dedicated card worktrees, safe linked-worktree/detached detection, shared-worktree continuation across fresh sessions, conflict-checked optional parallelism, separate regression-verified integration and safe cleanup. Worktrees enable narrow task context; they do not directly reduce LLM tokens.

The user also required approximately 20–30% preferred preloaded context, amber at 30–40%, and a normal hard ceiling of 40% of verified usable model capacity. Every role/invocation must estimate the full active input envelope, preserve mandatory context, reduce/deduplicate/narrow before dispatch, and block/decompose or request a documented human-authorized exception if reduction cannot satisfy the ceiling. Fresh sessions preserve worktree/checkpoint/budget state and use diff-first continuation.

These amendments supersede the project-wide single-writer lock and the deferral of context/execution foundations in this original design. The revised implementation plan uses per-card execution locks plus serialized shared Git administration/integration. Original product/design authorities, approval rules and all unaffected decisions remain intact. Concrete tasks, configuration, dependencies and verification are in docs/superpowers/plans/2026-10-16-clh-governance-state.md (revision 2). These user requirements authorize planning changes, not implementation-card promotion.
