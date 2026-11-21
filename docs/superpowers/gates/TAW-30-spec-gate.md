# TAW-30 spec gate (authoring card TAW-37)

Append-only, one block per attempt (CLH docs/process/templates/gate-block.md). Raw reviewer outputs and briefs are kept outside the worktree in the Tawsila checkout under .clh/evidence/TAW-37/.

LANE (implementation card): LANE: Critical — new request and seat tables, concurrent seat allocation and weekday-series cancellation, server-side authorisation, multi-screen feature (confirmed by the owner 2026-11-21). Authoring card TAW-37: LANE: Standard — documentation.

Attempt: 1   Round: 1
Document: docs/superpowers/specs/2026-11-21-TAW-30-design.md
Revision: 73fa2c9:0bb4e3be740bb80d9576a15a45d426a9ad9bff70
Card binding: authoring card TAW-37 scope revision 1; criteria snapshot TAW-30 AC1-AC10 (scope revision 3) sha256 d4b99d6934cf4662dde3aaa750771c1c2259583aadd0f9b2adb38dea9f956472; Figma file 2j3vO1USLBA8XiRpQKCF3H section 228:810 (TAW-28 approved)
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, gpt-6.2-sol, reasoning effort high (task_routing critical_plan_gate)
Findings: P0=2 P1=19 P2=1 P3=0 (P0: F1 pilot_events has a separate event_type check that would reject new events, event_day unspecified; F2 privilege matrix incomplete (pilot_events bypass block, owner probes, column grants, RLS state). P1: F3 FK key-share locks create cycles with FOR UPDATE account locks; F4 extension vs decision cross-account deadlock; F5 now() fixed at transaction start; F6 effective expiry state/cause depends on cron timing; F7 weekday membership with zero future holds; F8 extension ignores anchor date; F9 cancellation_id vs action_id per day; F10 owner cancel lacks series_id/cancellable days; F11 service_role SELECT exposes rider text; F12 request view authorisation and disclosure tests inconsistent; F13 status precedence for parties on full/cancelled/withdrawn rides, Trips items, R8 past anchor; F14 R6 unreachable in the integration order and banner lacks counts; F15 replay before gate and retry/reconciliation contract; F16 missing concurrency scenarios and wrong outcomes; F17 emergency runbook duplicates the writer; F18 on delete restrict vs TAW-4 cascade and seat invariant on delete; F19 NotVerifiedRide and route-fixture paths; F20 R1 copy still defers to chat; F21 service-role manual path unverified, forged-token API test. P2: F22 Fact/UNVERIFIED labels for cron, view-logging statement scope)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/spec-gate-1-raw.txt (Tawsila checkout); brief spec-gate-1-brief.md; last message spec-gate-1-last.md
Usage: 117,398 tokens (reported by Codex CLI)   Started: 2026-11-21T08:50:38Z   Ended: 2026-11-21
Verdict: FAIL

Attempt: 2   Round: 2
Document: docs/superpowers/specs/2026-11-21-TAW-30-design.md
Revision: d6c7b07:9309102a1ecc20c2fc1d8d984864e4b52b9af0e1
Card binding: authoring card TAW-37 scope revision 1; criteria snapshot TAW-30 AC1-AC10 (scope revision 3) sha256 d4b99d6934cf4662dde3aaa750771c1c2259583aadd0f9b2adb38dea9f956472; Figma file 2j3vO1USLBA8XiRpQKCF3H section 228:810
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, gpt-6.2-sol, reasoning effort high (task_routing critical_plan_gate)
Findings: P0=1 P1=15 P2=2 P3=0 (round 1: F1-F4, F7-F12, F14, F17, F20 resolved; F5, F6, F13, F15, F16, F18, F19, F21 open (P1), F22 open (P2). New: P0 F29 required timestamps not set on owner cancellation; P1 F23 extension vs publish_ride deadlock through the share-code unique index; F24 stated lock order inconsistent, expiry query target, FK waits on inherited for-update locks, lock-strength verification; F25 service_role SELECT on pilot_events links riders to requests; F26 rate limit off by one; F27 request button enablement vs AC1 message, profile_incomplete; F28 zero-day 'all' on once rides and one-day requests rewrites history; F31 caller/argument rules vs owner-only helpers. P2: F30 D2 privacy copy still promises chat)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/spec-gate-2-raw.txt (Tawsila checkout); brief spec-gate-2-brief.md; last message spec-gate-2-last.md
Usage: 158,272 tokens (reported by Codex CLI)   Started: 2026-11-21T09:02:05Z   Ended: 2026-11-21
Verdict: FAIL

Attempt: 3   Round: 3
Document: docs/superpowers/specs/2026-11-21-TAW-30-design.md
Revision: 2bdf6a9:c1b5f91a04b0d6982e97934c4102e1fa0e26bfab
Card binding: authoring card TAW-37 scope revision 1; criteria snapshot TAW-30 AC1-AC10 (scope revision 3) sha256 d4b99d6934cf4662dde3aaa750771c1c2259583aadd0f9b2adb38dea9f956472; Figma file 2j3vO1USLBA8XiRpQKCF3H section 228:810
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, gpt-6.2-sol, reasoning effort high (task_routing critical_plan_gate)
Findings: P0=1 P1=15 P2=0 P3=1 (resolved: F6, F16, F22, F25, F27, F29, F30, F31. Open P1: F5 share-code wait after v_now; F13 R4 closed requests, non-anchor pending, cancelled driving days, rider closed copy; F15 new key while first attempt in flight; F18 release procedure (departed holds, fencing, expiry deadlock); F19 PostRideFlow outside paths; F21 identity substitution probe; F23 three-transaction share-code cycle; F24 release multi-series order, TAW-4 writer inventory; F26 distinct-key boundary race; F28 series stop closes departed one-day requests. New: P0 F32 regression tests outside paths (taw29_events, rides.integration); P1 F33 sweep misses cancelled future anchors; F34 ride lookup before gate; F35 grant mutations masked by RLS; F36 service_role reads of rides/ride_series boundary; F37 ±60-minute predicate misstated. P3 F38 function count)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/spec-gate-3-raw.txt (Tawsila checkout); brief spec-gate-3-brief.md; last message spec-gate-3-last.md
Usage: 141,115 tokens (reported by Codex CLI)   Started: 2026-11-21   Ended: 2026-11-21
Verdict: FAIL

Attempt: 4   Round: 4
Document: docs/superpowers/specs/2026-11-21-TAW-30-design.md
Revision: 0cf73ce:099ae567cb7ef9099800307e585ea522183ef5ec
Card binding: authoring card TAW-37 scope revision 1; criteria snapshot TAW-30 AC1-AC10 (scope revision 3) sha256 d4b99d6934cf4662dde3aaa750771c1c2259583aadd0f9b2adb38dea9f956472; Figma file 2j3vO1USLBA8XiRpQKCF3H section 228:810
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, gpt-6.2-sol, reasoning effort high (task_routing critical_plan_gate)
Findings: P0=0 P1=11 P2=1 P3=0 (resolved: F5, F18, F19, F21, F23, F26, F33, F34, F35, F37, F38. Open P1: F13 cancelled weekday seat visibility while membership active; F15 unresolved key across R1 re-entry and delayed original; F24 owner-deletion cascade vs expiry; F28 party detail shows series-cancelled for departed days; F32 owner event check after fixture cleanup; F36 service-role boundary statement too broad. New P1: F39 one timestamp through nested views; F40 Next card may pick a cancelled day; F41 R1 entry eligibility and empty states; F42 withdraw locks before ownership check; F43 column REFERENCES isolation probes, account matrix alignment. New P2: F44 deletion handoff wording)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/spec-gate-4-raw.txt (Tawsila checkout); brief spec-gate-4-brief.md; last message spec-gate-4-last.md
Usage: 148,068 tokens (reported by Codex CLI)   Started: 2026-11-21   Ended: 2026-11-21
Verdict: FAIL

Attempt: 5   Round: 5
Document: docs/superpowers/specs/2026-11-21-TAW-30-design.md
Revision: 9b45096:c960935ba23bc06bbc52be0a83d2ed6658afc44f
Card binding: authoring card TAW-37 scope revision 1; criteria snapshot TAW-30 AC1-AC10 (scope revision 3) sha256 d4b99d6934cf4662dde3aaa750771c1c2259583aadd0f9b2adb38dea9f956472; Figma file 2j3vO1USLBA8XiRpQKCF3H section 228:810
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, gpt-6.2-sol, reasoning effort high (task_routing critical_plan_gate)
Findings: P0=2 P1=9 P2=2 P3=0 (resolved: F13, F24, F28, F32, F36, F40, F44. Open: P0 F39 privilege matrix lists the old two-argument request-view signature, projection must be evaluated at p_at in one snapshot; P0 F43 profile_completed_at is on accounts, not profiles; P1 F41 driver's own R1 entry and profile_incomplete as exception; P1 F42 withdraw ownership-before-lock needs a blocking test; P2 F15 residual delayed-original risk needs owner approval. New P1: F45 pending-attempt store not bound to the signed-in user; F46 fixture cleanup inflates seats_taken; F47 stopped-membership copy; F48 concurrency mutations need committed DDL in a disposable DB; F49 sweep with future cancelled_at can loop; F50 TAW-29 integration uses service-role account writes; F52 My trips cap without pagination. New P2: F51 TAW-4 lock summary)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/spec-gate-5-raw.txt (Tawsila checkout); brief spec-gate-5-brief.md; last message spec-gate-5-last.md
Usage: 204,977 tokens (reported by Codex CLI)   Started: 2026-11-21   Ended: 2026-11-21
Verdict: FAIL

Attempt: 6   Round: 6
Document: docs/superpowers/specs/2026-11-21-TAW-30-design.md
Revision: 98e1d12:bb056255da412f9c4b1836aa20877bd9fda1db73
Card binding: authoring card TAW-37 scope revision 1; criteria snapshot TAW-30 AC1-AC10 (scope revision 3) sha256 d4b99d6934cf4662dde3aaa750771c1c2259583aadd0f9b2adb38dea9f956472; Figma file 2j3vO1USLBA8XiRpQKCF3H section 228:810
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, gpt-6.2-sol, reasoning effort high (task_routing critical_plan_gate)
Findings: P0=0 P1=8 P2=1 P3=0 (resolved: F41, F42, F43, F48, F49, F50, F51, F52. Open P1: F15 a gate error does not prove the key unused (owner-accepted residual itself not disputed); F39 STABLE volatility for the whole read chain and a barrier test; F45 dispatch bound to the attempt's session; F46 section 13 cleanup contradicts 3.5; F47 day vs series cancellation copy for expired pending weekdays requests. New P1: F53 reload the anchor under the series lock; F54 writers must run under READ COMMITTED; F55 concurrency-mutation runner must observe the intended failure. New P2: F56 sharePrivacy copy still mentions chat)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/spec-gate-6-raw.txt (Tawsila checkout); brief spec-gate-6-brief.md; last message spec-gate-6-last.md
Usage: 152,002 tokens (reported by Codex CLI)   Started: 2026-11-21T09:54:03Z   Ended: 2026-11-21
Verdict: FAIL
