# TAW-7 plan gate (append-only)

Attempt: 1   Round: technical-failure
Document: docs/superpowers/plans/2026-10-21-TAW-7.md
Revision: 5b02be1431d1b30e674a88661727deed1f2c4f33:4dfa2c647aeb8695747fc9e0da0ff4cc6e07d52f
Spec revision (plan gate only): 5b02be1:93113774653cd21cd755feb187addb1ea1363d32
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a
Author: Claude Sonnet 5.5   Reviewer: Codex (not reached)
Findings: none (the reviewer produced no review)
Criteria mapping: none
Raw output: .clh/evidence/TAW-8/plan-gate-1-raw.txt (Tawsila checkout, outside the worktree): "You've hit your usage limit ... try again at Oct 22nd, 2026 2:46 AM."
Usage: 0 reported; charged conservatively per workflow section 7 (never zero): see accounting-TAW-8.md
Verdict: TECHNICAL-FAILURE (counts as 1 of 3 consecutive technical failures for the plan document; no fallback to Claude self-review, no skipped gate)

Attempt: 2   Round: 1
Document: docs/superpowers/plans/2026-10-21-TAW-7.md
Revision: 5b02be1431d1b30e674a88661727deed1f2c4f33:4dfa2c647aeb8695747fc9e0da0ff4cc6e07d52f
Spec revision (plan gate only): 5b02be1:93113774653cd21cd755feb187addb1ea1363d32
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=13 P2=0 P3=0 (incomplete code and prose test lists; unachievable pgTAP counts and exhausted limiter fixtures; incomplete limiter/concurrency coverage; Jest discovery excludes new tests and wrong CLI flag; dependency order; weak client-permission assertion; offline-session startup; provider transitions and stale results; confirmation failures invisible and HTTP status shape; cleanup signal not proven; error-text contrast; self-matching secret grep; AC7 handoff not planned). Fixes: plan rewritten in round 2.
Criteria mapping: AC1..AC12 mapped by the reviewer with AC7 -> UNCOVERED (see raw output)
Raw output: .clh/evidence/TAW-8/plan-gate-2-raw.txt
Usage: 81,478 tokens (Codex reported)   Started/Ended: 2026-10-22 (see accounting-TAW-8.md)
Verdict: FAIL

Attempt: 3   Round: 2
Document: docs/superpowers/plans/2026-10-21-TAW-7.md
Revision: d62d9c16ba1b6a691a3576b2768c93218fcdee0f:8c852c34d9bfc9127d839db79bb63fd68376ab80
Spec revision (plan gate only): d62d9c1:93113774653cd21cd755feb187addb1ea1363d32
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=6 P2=1 P3=0 (a7 fixture would trip the verified-number unique index; RNTL 14 interactions not awaited; SIGNED_OUT re-entrancy loop; stale confirmation side effects before the generation check; unreadable stored session could create a second identity; Auth 5xx treated as terminal; concurrency script isolation and PASS count). Fixes: all applied in round 3.
Criteria mapping: AC1..AC12 each mapped by the reviewer (exhaustive, no UNCOVERED; AC7 now mapped to Tasks 3 and 13)
Raw output: .clh/evidence/TAW-8/plan-gate-3-raw.txt
Usage: 104,213 tokens (Codex reported)   Started/Ended: 2026-10-22 (see accounting-TAW-8.md)
Verdict: FAIL

Attempt: 4   Round: 3 (last round before the stop rule)
Document: docs/superpowers/plans/2026-10-21-TAW-7.md
Revision: 07f271c494d9518d41465295367379ea77863ba7:bc7a2f29cd479a6e3def867bb52b35868284c01f
Spec revision (plan gate only): 07f271c:93113774653cd21cd755feb187addb1ea1363d32
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=1 P2=1 P3=0 (P1: marker writes are not serialized, so an older slow clear can erase a newer registration marker; P2: the re-entry guard covers only the sign-out part of recovery, not the refresh that itself emits SIGNED_OUT). Fixes prepared after the gate (serialized commit queue, exclusive recovery, tests with a slow clear and an event-emitting refresh), not yet reviewed.
Criteria mapping: AC1..AC12 each mapped by the reviewer (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/plan-gate-4-raw.txt
Usage: 117,845 tokens (Codex reported)   Started/Ended: 2026-10-22 (see accounting-TAW-8.md)
Verdict: FAIL (stop rule: round 3 with a P1 open; escalated to the owner)

Attempt: 5   Round: 4 (attempts extended by the owner: "round 4", 2026-10-22; the gate was not waived)
Document: docs/superpowers/plans/2026-10-21-TAW-7.md
Revision: a72ae69328f56bf5b51528ff2a17968b06bedfb4:a81331e1d46f7a90c28888e5c09050f66a734c1d
Spec revision (plan gate only): a72ae69:93113774653cd21cd755feb187addb1ea1363d32
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=1 P2=0 P3=0 (the confirmation's own token refresh emits SIGNED_OUT, which started an independent recovery whose sign-out was not tied to the originating generation; the stale-terminal test and the single-refresh expectation therefore failed as written). Fix prepared after the gate: confirmation vetoable before refreshing, events during a confirmation ignored, recoveries bound to their starting generation, exact refresh-count expectations restored. Not yet reviewed.
Criteria mapping: AC1..AC12 each mapped by the reviewer (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/plan-gate-5-raw.txt
Usage: 85,723 tokens (Codex reported)   Started/Ended: 2026-10-22 (see accounting-TAW-8.md)
Verdict: FAIL (the owner's extension covered round 4 only; escalated again)

Attempt: 6   Round: technical-failure (owner-authorized round 5 not completed)
Document: docs/superpowers/plans/2026-10-21-TAW-7.md
Revision: 94d1c3a36b89a09bf75486ca79ce96bdc92ab3f8:4732b24c3ec7132e38eca11217187489f6ab9435
Spec revision (plan gate only): 94d1c3a:93113774653cd21cd755feb187addb1ea1363d32
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a
Author: Claude Sonnet 5.5   Reviewer: Codex (stopped by its usage limit before a final answer)
Findings: none issued. The reviewer's visible working notes (not a verdict) traced all 39 service and provider test cases as passing in a harness and identified one gap: an external SIGNED_OUT arriving during a pending confirmation was discarded and left the user registered with no recovery. Fix applied after the attempt (held-event handling, one test); not reviewed.
Criteria mapping: none
Raw output: .clh/evidence/TAW-8/plan-gate-6-raw.txt ("You've hit your usage limit ... try again at 1:15 PM")
Usage: 98,777 tokens (Codex reported before it stopped); charged 98,777
Verdict: TECHNICAL-FAILURE (no final structured answer; 1 consecutive technical failure; no fallback to Claude self-review, no skipped gate)

Attempt: 7   Round: 5 (owner-authorized "round 5"; rerun after the attempt-6 usage-limit stall)
Document: docs/superpowers/plans/2026-10-21-TAW-7.md
Revision: 2c82ea8c4b3457b90c81918085797e543e182631:d95b4d677e88e4ba0df3feed6b6d45c194f280ba
Spec revision (plan gate only): 2c82ea8:93113774653cd21cd755feb187addb1ea1363d32
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=2 P2=0 P3=0 (P1: a confirmation's queued marker write bumped the generation and made a needed session recovery discard itself; P1: a held SIGNED_OUT boolean lost its originating generation and could sign out a newer registration). The reviewer executed the plan's provider code and reproduced both. Fix prepared after the gate: the provider is redesigned as a single sequential event queue (no generation counters, held flags or exclusivity flags), with tests for each scenario; not yet reviewed.
Criteria mapping: AC1..AC12 each mapped by the reviewer (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/plan-gate-7-raw.txt
Usage: 178,626 tokens (Codex reported; includes executing the plan's code to reproduce the findings)   Started/Ended: 2026-10-22 (see accounting-TAW-8.md)
Verdict: FAIL

Attempt: 8   Round: 6 (owner-authorized "round 6")
Document: docs/superpowers/plans/2026-10-21-TAW-7.md
Revision: 4cb5616b94d867c5daaf899395aff4d8be135d6d:fc00f907852297f22c60319b35159380a85f806b
Spec revision (plan gate only): 4cb5616:93113774653cd21cd755feb187addb1ea1363d32
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=3 P2=0 P3=0 (test fake misclassified AuthRetryableFetchError so one external event looped; recovery's refresh had no timeout so a hung refresh blocked the queue; in-flight handlers at unmount could still write storage or end the session). The sequential-queue redesign produced no race findings. Fixes applied after the gate (consistent fake, bounded recovery refresh, alive checks after every await, four new tests); not yet reviewed.
Criteria mapping: AC1..AC12 each mapped by the reviewer (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/plan-gate-8-raw.txt
Usage: 81,665 tokens (Codex reported)   Started/Ended: 2026-10-22 (see accounting-TAW-8.md)
Verdict: FAIL

Attempt: 9   Round: 7 (owner-authorized "round 7")
Document: docs/superpowers/plans/2026-10-21-TAW-7.md
Revision: 7909d84133258405cbcb8ffc332b489bb8871d48:0347551d532f4fbe850548a5d229b37bb961e75d
Spec revision (plan gate only): 7909d84:93113774653cd21cd755feb187addb1ea1363d32
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=2 P2=0 P3=0 (the timeout fallback `{ error: TIMED_OUT }` does not satisfy the AuthResponse type (TS2741, reproduced); a confirmation that is already in flight at unmount can still start a token refresh, which removes the stored session on a terminal failure, and the new unmount test did not check refresh counts or session storage). No race findings.
Criteria mapping: AC1..AC12 each mapped by the reviewer (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/plan-gate-9-raw.txt
Usage: 106,835 tokens (Codex reported)   Started/Ended: 2026-10-22 (see accounting-TAW-8.md)
Verdict: FAIL (the owner's "round 7" is used up; escalated)

Attempt: 10   Round: 8 (owner-authorized final round)
Document: docs/superpowers/plans/2026-10-21-TAW-7.md
Revision: bf782aad27e5f078fa8b660b91cc936f592a1595:6313e2e9ac445eebe408643125593032f2b48689
Spec revision (plan gate only): bf782aa:93113774653cd21cd755feb187addb1ea1363d32
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=1 P2=0 P3=0 (a confirmation abandoned by its timeout is still "current" while mounted, so a late 401 would start a token refresh whose terminal failure removes the stored session; the timeout test used a read that never answers). First round on the lean plan (provider code replaced by requirements and tests): no race findings. Fix applied after the gate: expiry of the timeout invalidates the call's isCurrent; late events from an abandoned refresh follow invariant 5; two new tests; not yet reviewed.
Criteria mapping: AC1..AC12 each mapped by the reviewer (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/plan-gate-10-raw.txt
Usage: 88,846 tokens (Codex reported)   Started/Ended: 2026-10-22 (see accounting-TAW-8.md)
Verdict: FAIL (the owner called round 8 final; escalated)

Attempt: 11   Round: 9 (owner-authorized with a hard stop: the last gate round)
Document: docs/superpowers/plans/2026-10-21-TAW-7.md
Revision: ecf4cebb9b2b76b6c32a5e40929d0f3d3e6289c2:456ad29efbe038eb4a839b00758e0b1adc2722a7
Spec revision (plan gate only): ecf4ceb:93113774653cd21cd755feb187addb1ea1363d32
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=1 P2=0 P3=0 (the round-8 finding is resolved; the new test "a refresh that settles terminally after its timeout does not undo a later registration" contradicts invariants 5-7: the abandoned refresh's SIGNED_OUT is a queued event, the fake fails every refresh terminally, so the queued recovery signs out and clears the marker; an execution reproduced refresh=2, signOut=1, marker=null). The flaw is in a test the author added in round 8, not in an invariant.
Criteria mapping: AC1..AC12 each mapped by the reviewer (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/plan-gate-11-raw.txt
Usage: 72,478 tokens (Codex reported)   Started/Ended: 2026-10-22 (see accounting-TAW-8.md)
Verdict: FAIL (hard stop reached: no further gate rounds; escalated to the owner for an explicit decision)

Owner exception (recorded 2026-10-22, process deviation from authoring workflow section 4 and Checklist A item 3/5; the gate itself was run to its end and not waived silently)
Context: 9 reviewed plan-gate rounds (attempts 2-5, 7-11; attempts 1 and 6 were Codex usage-limit technical failures) without a clean PASS; the last round (round 9) had P0=0 P1=1, a self-contradicting test the author had added in round 8, since removed; later, after the owner asked for a risk assessment, the author found and fixed one more issue (AuthRefreshDiscardedError handling, auth-js lockless coordination) outside any gate round. The spec gate PASSED (round 4).
Exception: the owner approved proceeding to document approval and integration of TAW-8 without a clean plan-gate PASS, bound to plan blob e7b0b7da441303c9c4c3c041c658260f1d674ab8 (commit da0763b) and spec blob 93113774653cd21cd755feb187addb1ea1363d32, with these conditions: (1) the carry-over checklist .clh/evidence/TAW-8/carry-over-diff-review-checklist.md is applied in the TAW-7 diff review; (2) the exception and the cost of the plan gate (about 1.02M Codex tokens) are recorded in the CLH-16 report as a process finding; (3) TAW-7 implementation still needs its own owner go-ahead after TAW-8 is DONE.
Owner words: "approved" (answer to: "Do you approve the exception on those terms?").
Risk assessment given to the owner (low likelihood, moderate UX impact, low data-loss impact), corrected by the owner's review input on: lockless auth-js coordination (verify installed version), user-visible impact (unexpected sign-out, interrupted verification), and timeouts not cancelling operations (the SDK session state is authoritative).


# Revision 5 (social sign-in): plan gate, 2026-10-24 (lean plan; target about 3 rounds)

Attempt: 16   Round: 1 (revision 5)
Document: docs/superpowers/plans/2026-10-21-TAW-7.md
Revision: 9aa81a1952d404286b108b75a6851bf097fec479:72e75557dd966a7e2b6e91df3fb96ca586238c49
Spec revision (plan gate only): 9aa81a1:ebb6994b5bde5edf482cbad2c350445aa0c9a35d (owner-approved)
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC13 revision 5 as amended (hash e7606d0dd7d25cfa); Figma revision n/a
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=3 P2=1 P3=0 (no provider-wrapper tests and no automated nonce, returning-identity or concurrent first-sign-in tests; invariant tests did not reach the refresh paths and lacked timeout and in-flight token-exchange abandonment cases; no executable routing regression test; the storage corruption test could damage a key outside the store under test). All test-coverage gaps; no race or design findings. Fixes: applied in round 2 (provider wrapper tests, integration tests and a concurrency script, SIGNED_OUT re-read semantics and abandonment tests, a routing test, a corrected corruption test).
Criteria mapping: AC1..AC13 each mapped by the reviewer (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/plan-gate-r5-1-raw.txt
Usage: 43,978 tokens (Codex reported)
Verdict: FAIL

Attempt: 17   Round: 2 (revision 5)
Document: docs/superpowers/plans/2026-10-21-TAW-7.md
Revision: 112a5c25ee58b402a8c20b79bedd2fe5acfaa554:1c0bafb9040248ee63f4dc4fba773c41fb45d2cf
Spec revision (plan gate only): 112a5c2:ebb6994b5bde5edf482cbad2c350445aa0c9a35d (owner-approved)
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC13 revision 5 as amended (hash e7606d0dd7d25cfa); Figma revision n/a
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=2 P2=1 P3=0 (test 4b: an in-flight token exchange completing after unmount changes the SDK session, the boundary was undefined; unmount calls not awaited under RNTL 14; required behaviour said a discarded refresh shows a notice while test 3b requires none). Fixes: applied in round 3 (explicit abandonment boundary, test 4b documents it, unmounts awaited, wording aligned).
Criteria mapping: AC1..AC13 each mapped by the reviewer (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/plan-gate-r5-2-raw.txt
Usage: 67,289 tokens (Codex reported)
Verdict: FAIL

