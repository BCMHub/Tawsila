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

Attempt: 7   Round: 7
Document: docs/superpowers/specs/2026-11-21-TAW-30-design.md
Revision: a78b48f:49b18973fda76f3f2a8183f78e1583de36da96d2
Card binding: authoring card TAW-37 scope revision 1; criteria snapshot TAW-30 AC1-AC10 (scope revision 3) sha256 d4b99d6934cf4662dde3aaa750771c1c2259583aadd0f9b2adb38dea9f956472; Figma file 2j3vO1USLBA8XiRpQKCF3H section 228:810
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, gpt-6.2-sol, reasoning effort high (task_routing critical_plan_gate)
Findings: P0=0 P1=6 P2=0 P3=0 (resolved: F39, F45, F46, F53, F54, F55, F56. Open P1: F15 only after-lookup errors may settle an attempt; F47 a series stop sets equal timestamps, so the tie must mean series. New P1: F57 cancellation status must be re-read under the locks; F58 D2 seat count and button from the status response; F59 sweep second-run zero only for unlocked rows, catch-up test; F60 day_state of future days on a cancelled series)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/spec-gate-7-raw.txt (Tawsila checkout); brief spec-gate-7-brief.md; last message spec-gate-7-last.md
Usage: 111,187 tokens (reported by Codex CLI)   Started: 2026-11-21   Ended: 2026-11-21
Verdict: FAIL

Attempt: 8   Round: 8
Document: docs/superpowers/specs/2026-11-21-TAW-30-design.md
Revision: ad5b864:e95748e99be10852afbb4a3d5ed5a8321f5d5026
Card binding: authoring card TAW-37 scope revision 1; criteria snapshot TAW-30 AC1-AC10 (scope revision 3) sha256 d4b99d6934cf4662dde3aaa750771c1c2259583aadd0f9b2adb38dea9f956472; Figma file 2j3vO1USLBA8XiRpQKCF3H section 228:810
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, gpt-6.2-sol, reasoning effort high (task_routing critical_plan_gate)
Findings: P0=0 P1=7 P2=0 P3=0 (resolved: F57, F59. Open P1: F15 no guaranteed caller-scoped lookup by client_request_id for reconciliation; F47 null series timestamp and once-ride copy; F58 status response must be authoritative for every viewer on D2 and the shared view, UI test; F60 cancelled-series day_state must compare with the stop time, not the read time. New P1: F61 offerability and departure need one decision point in request_seat; F62 no durable app entry to stop a weekday series with zero future days; F63 effective isolation of the pg_cron job unverified)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/spec-gate-8-raw.txt (Tawsila checkout); brief spec-gate-8-brief.md; last message spec-gate-8-last.md
Usage: 128,312 tokens (reported by Codex CLI)   Started: 2026-11-21   Ended: 2026-11-21
Verdict: FAIL
Stop: review pass rule stall (F15 and F47 open after two repairs; P1 6→7) and the 1,125,000 stop-and-ask threshold crossed; escalated to the owner.

Attempt: 9   Round: 9
Document: docs/superpowers/specs/2026-11-21-TAW-30-design.md
Revision: f272127:d09b3d170e0fba3f77740bd8ee3108a5c722996e
Card binding: authoring card TAW-37 scope revision 1; criteria snapshot TAW-30 AC1-AC10 (scope revision 3) sha256 d4b99d6934cf4662dde3aaa750771c1c2259583aadd0f9b2adb38dea9f956472; Figma file 2j3vO1USLBA8XiRpQKCF3H section 228:810
Author: Claude (revision drafted by a Fable subagent at the owner's direction, reviewed by Claude Opus 5.5)   Reviewer: Codex CLI 0.171.0, gpt-6.2-sol, reasoning effort high (task_routing critical_plan_gate)
Findings: P0=0 P1=4 P2=0 P3=0 (resolved: F15, F47, F58, F60, F62. Open P1: F61 car_types.passenger_seats read by offerability is not locked; F63 hosted cron check must require runs started after the migration. New P1: F64 no reachable action on D2 to resume an unsettled attempt; F65 one cancellation-eligibility predicate for readers and writers on a cancelled series)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/spec-gate-9-raw.txt (Tawsila checkout); brief spec-gate-9-brief.md; last message spec-gate-9-last.md
Usage: 160,024 tokens (reported by Codex CLI)   Started: 2026-11-21   Ended: 2026-11-21
Verdict: FAIL

Attempt: 10   Round: 10
Document: docs/superpowers/specs/2026-11-21-TAW-30-design.md
Revision: b72bffa:fc9195aeddb7403218ce9539e0538a22c1669f3c
Card binding: authoring card TAW-37 scope revision 1; criteria snapshot TAW-30 AC1-AC10 (scope revision 3) sha256 d4b99d6934cf4662dde3aaa750771c1c2259583aadd0f9b2adb38dea9f956472; Figma file 2j3vO1USLBA8XiRpQKCF3H section 228:810
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, gpt-6.2-sol, reasoning effort high (task_routing critical_plan_gate)
Findings: P0=0 P1=7 P2=0 P3=0 (resolved: F63, F64. Open P1: F61 the weekday job must also lock vehicle and car type before offerability; F65 owner refusal on a stopped series and list_my_series omission need their own outcomes. New P1: F66 multi-row catalogue updates vs share locks on car_types; F67 an anchor with a future cancelled_at can still be accepted; F68 R1 direct entry lacks ride summary, repeat and pickup note; F69 list_my_trips item keys per type; F70 scheduler test must assert command, role, database and real extension work)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/spec-gate-10-raw.txt (Tawsila checkout); brief spec-gate-10-brief.md; last message spec-gate-10-last.md
Usage: 153,453 tokens (reported by Codex CLI)   Started: 2026-11-21   Ended: 2026-11-21
Verdict: FAIL
Stop: budget ceiling reached (1,474,808 of 1,500,000) and review pass rule stall (P1 4→7; F61 open after two repairs); escalated to the owner.

Attempt: 11   Round: 11 (first round on TAW-30 scope revision 4)
Document: docs/superpowers/specs/2026-11-21-TAW-30-design.md
Revision: c1f27f4:70010e342aa1e3b4286d61d61150d1168dfa70f0
Card binding: authoring card TAW-37 scope revision 2; criteria snapshot TAW-30 AC1-AC10 (scope revision 4) sha256 9f4feee4031dbfd9ac5ec479c37199ea5fe7b50cffe7ddc9de54ac410f4a54ac; Figma file 2j3vO1USLBA8XiRpQKCF3H section 228:810
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, gpt-6.2-sol, reasoning effort high (task_routing critical_plan_gate)
Findings: P0=0 P1=9 P2=1 P3=0 (resolved: F61, F65, F67, F68, F69, F70. Open P1: F66 four-transaction cycle job/cancel_my_ride/submit_car/catalogue. New P1: F71 TAW-29 concurrency scenario_car_rejection expects the job to wait; F72 future cancelled_at keeps a request withdrawable/declinable; F73 full ride rule in can_request; F74 Trips loses requests expired at departure; F75 two tests contradict the contract; F76 service_role on accounts gate inputs unasserted; F77 R4 cancel entry eligibility; F78 cron-run fixture race and guard order. New P2: F79 empty pickup note display)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/spec-gate-11-raw.txt (Tawsila checkout); brief spec-gate-11-brief.md; last message spec-gate-11-last.md
Usage: 140,274 tokens (reported by Codex CLI)   Started: 2026-11-21   Ended: 2026-11-21
Verdict: FAIL
Stop: cumulative Codex 1,615,082 of 2,200,000; a further round (~150,000) would cross the 1,650,000 stop-and-ask threshold; escalated to the owner.

Attempt: 12   Round: 12
Document: docs/superpowers/specs/2026-11-21-TAW-30-design.md
Revision: 0c0e1c7:262ba6fe03b9608d5a2e6fb137c842f82c6551d7
Card binding: authoring card TAW-37 scope revision 2; criteria snapshot TAW-30 AC1-AC10 (scope revision 4) sha256 9f4feee4031dbfd9ac5ec479c37199ea5fe7b50cffe7ddc9de54ac410f4a54ac; Figma file 2j3vO1USLBA8XiRpQKCF3H section 228:810
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, gpt-6.2-sol, reasoning effort high (task_routing critical_plan_gate)
Findings: P0=0 P1=5 P2=1 P3=0 (resolved: F66, F71, F72, F73, F74, F75, F76, F77, F78. Open P2: F79 R1 helper with null pickup note. New P1: F80 client-writer chain through a late account foreign-key wait; F81 scenarios 10 and 12 contradict chosen_days scope and job skipping; F82 open-for-seats mutation has no failing named test; F83 ride_series column privileges unasserted; F84 rider screens for unavailable and departed holds)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/spec-gate-12-raw.txt (Tawsila checkout); brief spec-gate-12-brief.md; last message spec-gate-12-last.md
Usage: 153,467 tokens (reported by Codex CLI)   Started: 2026-11-21   Ended: 2026-11-21
Verdict: FAIL
