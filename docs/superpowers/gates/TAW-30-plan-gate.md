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

Attempt: 2   Round: 2
Document: docs/superpowers/plans/2026-11-21-TAW-30.md
Revision: 7f3ea411fa8b2b1e079234fb34e53c8f9efbc85d:66be7e988ce7d97b17e9e6f0caf88d491a393291
Spec revision (plan gate only): a7917ad:f98f06429df127d138ca5a587e2faca857a71902 (spec gate PASS round 28)
Card binding: authoring card TAW-37; criteria snapshot TAW-30 AC1-AC10 (scope revision 4), .clh/evidence/TAW-37/criteria-TAW-30-rev4.md
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, model gpt-6.2-sol, effort high (task_routing critical_plan_gate), read-only sandbox
Findings: P0=0 P1=9 P2=0 P3=0 (resolved: P-F1, P-F2, P-F3, P-F5, P-F6, P-F8 to P-F12. Open: P-F4 future-cancellation inventory after the first reset, upgrade psql invocation; P-F7 placeholder substitution and README-only snippet mode; P-F13 bundle check treats grep errors as PASS. New: P-F14 Q before T3 needs the expiry job that T3 creates, no schema-only command; P-F15 reset and Q not fail-closed, TAW-29 run without reset trap, T8 omits it; P-F16 request routes and _layout.tsx registration missing from T7 files, no guarded direct-entry tests; P-F17 R6 banner on R5 untested; P-F18 device gate lacks local fixtures and endpoint check; P-F19 checkbox tracking would edit the approved plan)
Criteria mapping: exhaustive, AC1 to AC10 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-37/plan-gate-2-raw.txt (Tawsila checkout); brief plan-gate-2-brief.md; last message plan-gate-2-last.md
Usage: 134,222 tokens (reported by Codex CLI)   Started: 2026-11-21T20:42Z   Ended: 2026-11-21T20:46:38Z
Verdict: FAIL

Attempt: 3   Round: 3 (technical failure, no review result)
Document: docs/superpowers/plans/2026-11-21-TAW-30.md
Revision: 29a968b47a2f34709d52b82b70fef6b972161c0d:122afe03c4b6d6d5b15930d9e2b9a894189dcf0c
Spec revision (plan gate only): a7917ad:f98f06429df127d138ca5a587e2faca857a71902 (spec gate PASS round 28)
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, model gpt-6.2-sol, effort high (task_routing critical_plan_gate), read-only sandbox
Findings: none reported; the run stopped mid-review with "You've hit your usage limit ... try again at Nov 22nd, 2026 1:23 AM" (exit 1, empty last message)
Raw output: .clh/evidence/TAW-37/plan-gate-3-raw.txt (Tawsila checkout); brief plan-gate-3-brief.md
Usage: 95,418 tokens (reported by Codex CLI)   Started: 2026-11-21T20:47Z   Ended: 2026-11-21T20:50:18Z
Verdict: none (technical failure 1 of 3; the same revision is resubmitted when the Codex allowance resets)

Attempt: 4   Round: 3 (resubmission of the attempt-3 revision after the Codex allowance reset)
Document: docs/superpowers/plans/2026-11-21-TAW-30.md
Revision: 29a968b47a2f34709d52b82b70fef6b972161c0d:122afe03c4b6d6d5b15930d9e2b9a894189dcf0c
Spec revision (plan gate only): a7917ad:f98f06429df127d138ca5a587e2faca857a71902 (spec gate PASS round 28)
Card binding: authoring card TAW-37; criteria snapshot TAW-30 AC1-AC10 (scope revision 4), .clh/evidence/TAW-37/criteria-TAW-30-rev4.md
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, model gpt-6.2-sol, effort high (task_routing critical_plan_gate), read-only sandbox
Findings: P0=0 P1=10 P2=0 P3=0 (resolved: P-F4, P-F7, P-F15, P-F17, P-F19. Open: P-F13 bundle check does not verify effective public inputs or dotenv overrides; P-F14 pgtap-schema checkpoint has no assertion-level procedure or accepted exit statuses; P-F16 app/request/_layout.tsx missing so the request guard misses request/[id]; P-F18 device gate fixtures, owner-only phone verification and per-device endpoint check. New: P-F20 runbook-snippet green at T4 before T8 adds markers; P-F21 blanket Q after reset defeats cron-run.sh active-job assertion; P-F22 upgrade SQL under supabase/tests is discovered by supabase test db; P-F23 scenario 28(a) RPC not pinned; P-F24 integration command keeps inherited SUPABASE_* values on status failure; P-F25 no runbook check for legacy service-role and direct-cancel paths)
Criteria mapping: exhaustive, AC1 to AC10 each mapped, none UNCOVERED
Raw output: .clh/evidence/TAW-37/plan-gate-4-raw.txt (Tawsila checkout); brief plan-gate-4-brief.md; last message plan-gate-4-last.md
Usage: 138,800 tokens (reported by Codex CLI)   Started: 2026-11-22T06:38Z   Ended: 2026-11-22T06:43:35Z
Verdict: FAIL (stall rule: P-F13 open after two repairs; owner asked)

Attempt: 5   Round: 4
Document: docs/superpowers/plans/2026-11-21-TAW-30.md
Revision: 400678edb300c2fc0719849cd39956a0d1c8b950:942200a76bc0c16f2d2a107cdef48149b56d0382
Spec revision (plan gate only): a7917ad:f98f06429df127d138ca5a587e2faca857a71902 (spec gate PASS round 28)
Card binding: authoring card TAW-37; criteria snapshot TAW-30 AC1-AC10 (scope revision 4), .clh/evidence/TAW-37/criteria-TAW-30-rev4.md
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.171.0, model gpt-6.2-sol, effort high (task_routing critical_plan_gate), read-only sandbox
Findings: P0=0 P1=6 P2=0 P3=0 (resolved: P-F13, P-F16, P-F20 to P-F24. Open: P-F14 red classifier accepts unrelated not-ok lines, and the fixture-only taw29_series change should be green on the baseline; P-F18 local Google Auth and Metro prerequisites, explicit t_reset input, T8 dependency; P-F25 rule (c) passes on the current README line 191. New: P-F26 cron-run marker must be clock_timestamp() in the activation transaction per spec 8.4 step 4, not max(runid); P-F27 integration runs lack an explicit local fixture setup; P-F28 per-script expected T1 statuses and an explicit T12 final suite list)
Criteria mapping: exhaustive, AC1 to AC10 each mapped, none UNCOVERED
Raw output: .clh/evidence/TAW-37/plan-gate-5-raw.txt (Tawsila checkout); brief plan-gate-5-brief.md; last message plan-gate-5-last.md
Usage: 157,574 tokens (reported by Codex CLI)   Ended: 2026-11-22T07:09:41Z
Verdict: FAIL (stall rule: P-F14 and P-F18 open after two repairs; owner asked)
