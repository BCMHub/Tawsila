# CLH governance and execution contracts

Notion controls work authorization; the default verifier returns UNAVAILABLE. A local approval JSON is evidence to inspect, not a trusted grant. The host must supply a trusted human identity/revocation/scope verifier before autonomous execution. Context and execution adapters are injected by an authorized host; an agent must never choose its own trust adapters.

Card snapshots use strict known fields. Approval hashes bind scope, criteria, dependencies, permissions and budgets. A status change does not change the scope digest. Journal schema 3 records immutable, sequence-checked events with content hashes and idempotent operation IDs. Invalid/incomplete records block replay; no automatic journal repair or migration is performed. Old schemas require an explicit backed-up migration outside this release.

State roots must exist and be canonical, with no explicitly symlinked root/descendants. The host is responsible for OS sandbox isolation against adversarial concurrent symlink replacement; JavaScript path checks alone are not an OS sandbox. Locks never steal stale ownership; after a crash inspect process/host identity and journal before explicit recovery. Unknown launch outcome retains reconciliation state and cannot automatically re-dispatch.

Each card has an isolated Git branch/worktree, shared common repository metadata, exclusive writer lease and atomic scope reservation. Existing external linked/detached worktrees are detected and preserved. This release conservatively blocks adoption unless an explicit host-managed isolation path is provided. No force checkout/reset/remove occurs. Resume requires the recorded HEAD and dirty patch hash to match. Unknown semantic safety serializes work; the graph cannot override shared paths or Notion dependencies.

Graph-first source discovery uses current-worktree fingerprints. Graph summaries and code excerpts count in the complete input envelope. Preferred occupancy is 20–30%; normal ceiling is 40%. A conservative UTF-8 byte upper bound plus explicit framing is available for text-only envelopes; it is intentionally pessimistic and must be validated/configured for the actual provider. Images/unknown attachments block until a provider estimator exists. Empty model registry blocks dispatch. Exceptional ratios require a trusted human verifier and exact card/scope/model/expiry binding.

Fresh invocations reuse persisted worktree/checkpoint state, not prior reasoning. Repair packs preserve mandatory context, current base-to-worktree diff, untracked changes and failure evidence. Token reservations remain spent across crashes/rotations; unknown actual usage blocks further normal progress rather than becoming zero. Runtime trust must independently verify path/tool/network/credential enforcement, limits, termination and context observation. Self-declared capability flags alone are insufficient.

Validation records bind commands, exit codes, timestamps and patch hashes. A reviewed card completes through a journaled COMMITTING → COMMITTED transaction, then a separately bounded Notion acknowledgement; only an exact card and commit acknowledgement records VERIFIED. Caller-provided checkpoint fields are discarded in favor of persisted checkpoint state, and completion rechecks worktree branch/repository ownership. Lock contention does not mutate the journal. A failed or uncertain sync remains SYNC_PENDING and retries synchronization without repeating the commit.

Integration remains a separate serialized process with a dedicated integration worktree, pre/post regression evidence, exact-target compare-and-swap and a human merge verifier. Cleanup removes only an owned, clean task worktree after integration and sync evidence; blocked or changed worktrees remain. A target checked out in an unmanaged workspace is deliberately blocked pending a managed provider integration path.

UI cards remain unavailable without real device/Figma/accessibility adapters. No simulator or visual score is fabricated. Fake Notion/model/runtime adapters in integration scenarios are TEST_ONLY and do not establish live readiness.

The inspection CLI is read-only. Exit codes: 0 successful inspection, 2 policy blocked, 1 invalid input/I/O. Commands: check, inspect, inspect-worktree, inspect-graph and context-check. Default policy has no configured model or trusted live runtime and intentionally cannot launch agents.

Ledger: https://app.notion.com/p/8f532f99b27d491fae9cc9b5ad71643b
