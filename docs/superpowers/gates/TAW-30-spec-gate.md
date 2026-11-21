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
