# TAW-30 plan gate (authoring card TAW-37)

Append-only, one block per attempt (CLH docs/process/templates/gate-block.md). Raw reviewer outputs and briefs are kept outside the worktree in the Tawsila checkout under .clh/evidence/TAW-37/.

LANE (implementation card): LANE: Critical — new request tables, security definer RPCs, RLS, pg_cron expiry job, multi-screen feature. Authoring card TAW-37: LANE: Standard — documentation.

Attempt: 1   Round: 1
Document: docs/superpowers/plans/2026-11-21-TAW-30.md
Revision: 389cb11c0ef64568c58ca2f414fd734773689073:caed8d458b0cae13129f5c8f8b3ee56fe20bf2e8
Spec revision (plan gate only): d40c0ee:00988b401a9b9b6f6b88eb6d4821fbc528474e72 (spec gate last block FAIL round 21; F104 and F107 reported RESOLVED against this blob by this reviewer)
Card binding: authoring card TAW-37; criteria snapshot TAW-30 AC1-AC10 (scope revision 4), .clh/evidence/TAW-37/criteria-TAW-30-rev4.md
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, model gpt-6.2-sol, effort high (task_routing critical_plan_gate), read-only sandbox
Findings: P0=1 P1=12 P2=0 P3=0 (P-F1 P0 the spec gate cannot be waived by owner acceptance; a recorded spec-gate PASS for blob 00988b40 is required (CLH authoring-workflow §4 stop rule, §5 items 2-3); P-F2 T6 checkpoint needs screen work from T7; P-F3 integration runner env injection and Docker-backed runs not assigned to Claude; P-F4 first db reset before backup, and no upgrade-path test on a populated TAW-29 database; P-F5 scenario runner resets would remove the scenario-14 mutation; P-F6 taw30_no_future_cancel ACL not checked at creation (T2); P-F7 operator cancellation snippet BEGIN/COMMIT inside pgTAP rollback; P-F8 missing focus/pull-to-refresh tests and promised no-fare assertion; P-F9 iPhone evidence reduced to "key frames"; P-F10 evidence root and evidence-only commits; P-F11 request_limits() must be IMMUTABLE; P-F12 public pilot must be recorded BLOCKED until TAW-5 DONE; P-F13 exported bundles not checked for the service credential)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/plan-gate-1-raw.txt (Tawsila checkout); brief plan-gate-1-brief.md; last message plan-gate-1-last.md
Usage: 153,130 tokens (reported by Codex CLI)   Started: 2026-11-21T19:43:30Z   Ended: 2026-11-21T19:49:39Z
Verdict: FAIL
