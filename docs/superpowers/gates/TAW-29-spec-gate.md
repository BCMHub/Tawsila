# TAW-29 spec gate (authoring card TAW-34)

Append-only, one block per attempt (CLH docs/process/templates/gate-block.md). Raw reviewer outputs and briefs are kept outside the worktree in the Tawsila checkout under .clh/evidence/TAW-34/.

LANE (implementation card): LANE: Critical — new ride tables and RLS, server-side publish authorisation, multi-screen feature (confirmed by the owner 2026-11-19). Authoring card TAW-34: LANE: Standard — documentation.

Attempt: 1   Round: 1
Document: docs/superpowers/specs/2026-11-19-TAW-29-design.md
Revision: 779c084681cd9bc8f87090deb01f797fe76fcdab:ee99d4e2fb46b8097a59b114a78da52440c6308d
Card binding: authoring card TAW-34 scope revision 1; criteria snapshot TAW-29 AC1-AC8 (scope revision 2) sha256 5990b1c27448ed74ec4f5e8b51005ab1e09881fe4c8b4416e62625096313ab0f; Figma file 2j3vO1USLBA8XiRpQKCF3H sections 228:808, 228:809 (TAW-28 approved)
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.163.0 (default model; model name not reported)
Findings: P0=1 P1=7 P2=1 P3=0 (P0 F1: least-privilege matrix and mutation checks not exhaustive. P1: F2 ambiguous-time rule contradicts Postgres; F3 extension job concurrency, lock order and authorisation point; F4 replay result not stored; F5 NULL and cursor argument contract; F6 approved car cannot be changed in TAW-4 (spec claimed it could); F7 free-text disclosure via car_label and digit classes; F8 non-failing view logging needs exception isolation. P2: F9 provider placement and route guard in _layout.tsx)
Criteria mapping: exhaustive, AC1 to AC8 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-34/spec-gate-1-raw.txt (Tawsila checkout); brief spec-gate-1-brief.md
Usage: 57,466 tokens (reported by Codex CLI)   Started: 2026-11-19   Ended: 2026-11-19
Verdict: FAIL

Attempt: 2   Round: 2
Document: docs/superpowers/specs/2026-11-19-TAW-29-design.md
Revision: a94266c1a69363aeac4c707c6af577956bc74063:337615859ba741b04a61e83eb5c60142d1ee5d73
Card binding: authoring card TAW-34 scope revision 1; criteria snapshot TAW-29 AC1-AC8 (scope revision 2) sha256 5990b1c27448ed74ec4f5e8b51005ab1e09881fe4c8b4416e62625096313ab0f; Figma file 2j3vO1USLBA8XiRpQKCF3H sections 228:808, 228:809
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.163.0 (default model; model name not reported)
Findings: P0=1 P1=5 P2=0 P3=0 (P0 F10: owner-role behavioural checks and the Postgres 17 MAINTAIN privilege missing from the matrix. P1: F11 contact filter strips dots and slashes before the e-mail and link checks, and the digit-script claim is too broad; F12 DST UTC offsets reversed, and projection time for a skipped hour ambiguous; F13 time 24:00 accepted; F14 replay equality contradicts replayed flag; F15 installed-app link discarded during sign-in or onboarding)
Criteria mapping: exhaustive, AC1 to AC8 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-34/spec-gate-2-raw.txt (Tawsila checkout); brief spec-gate-2-brief.md
Usage: 70,934 tokens (reported by Codex CLI)   Started: 2026-11-19   Ended: 2026-11-19
Verdict: FAIL

Attempt: 3   Round: 3
Document: docs/superpowers/specs/2026-11-19-TAW-29-design.md
Revision: 9c84bf36e327af7e2e847ea80797f49961e37973:f6461f17d4f291cab50ce6f404de93ecc8a8a41d
Card binding: authoring card TAW-34 scope revision 1; criteria snapshot TAW-29 AC1-AC8 (scope revision 2) sha256 5990b1c27448ed74ec4f5e8b51005ab1e09881fe4c8b4416e62625096313ab0f; Figma file 2j3vO1USLBA8XiRpQKCF3H sections 228:808, 228:809
Author: Claude Opus 5.5   Reviewer: Codex CLI 0.163.0 (default model; model name not reported)
Findings: P0=1 P1=2 P2=0 P3=0 (P0 F16: owner behavioural check missing for some functions. P1: F17 grouped function expectations contradict sections 5.1-5.3; F18 an approved car can be rejected by review_item and resubmitted, so an existing ride could show an unapproved car)
Criteria mapping: exhaustive, AC1 to AC8 each mapped once, none UNCOVERED
Raw output: .clh/evidence/TAW-34/spec-gate-3-raw.txt (Tawsila checkout); brief spec-gate-3-brief.md
Usage: 71,062 tokens (reported by Codex CLI)   Started: 2026-11-19   Ended: 2026-11-19
Verdict: FAIL
