# TAW-7 spec gate (append-only)

Attempt: 1   Round: 1
Document: docs/superpowers/specs/2026-10-21-TAW-7-design.md
Revision: 4f8917dff110035c96a9e748d1bf0e9a71c1f04e:b05018e7b5f817b000e98cbf35c1f4db8de213e6
Card binding: scope digest n/a (manual attended gate; the harness digest is unavailable, no adapter); criteria snapshot AC1-AC12 revision 3 (hash 315b162a1682c7ae); Figma revision n/a (file 2j3vO1USLBA8XiRpQKCF3H, frames 14:2 and 14:80)
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=4 P2=1 P3=0 (register_phone could overwrite a verified number; session-without-account routing; no server-enforced registration limiter; Android evidence vs AC9; cleanup activity signal). Fixes: all applied in round 2 (Android by owner decision).
Criteria mapping: AC1..AC12 each mapped to a section by the reviewer (exhaustive, no UNCOVERED); see raw output
Raw output: .clh/evidence/TAW-8/spec-gate-1-raw.txt (Tawsila checkout, outside the worktree)
Usage: 43,994 tokens (Codex reported)   Started/Ended: 2026-10-21 (see accounting-TAW-8.md)
Verdict: FAIL

Attempt: 2   Round: 2
Document: docs/superpowers/specs/2026-10-21-TAW-7-design.md
Revision: 9ad9dd1081f6f772a1e57c9d5ec5becbe6eb18b7:407a8f874941431b64f43a506fe72950a9b8bc53
Card binding: scope digest n/a (manual attended gate; the harness digest is unavailable, no adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a (file 2j3vO1USLBA8XiRpQKCF3H, frames 14:2 and 14:80)
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=2 P2=1 P3=0 (non-atomic limiter; terminal session loss versus local marker; cleanup fallback signal). Fixes: applied in round 3.
Criteria mapping: AC1..AC12 each mapped to a section by the reviewer (exhaustive, no UNCOVERED); see raw output
Raw output: .clh/evidence/TAW-8/spec-gate-2-raw.txt (Tawsila checkout, outside the worktree)
Usage: 66,335 tokens (Codex reported)   Started/Ended: 2026-10-21 (see accounting-TAW-8.md)
Verdict: FAIL

Attempt: 3   Round: 3
Document: docs/superpowers/specs/2026-10-21-TAW-7-design.md
Revision: 36a8bae8ff3ae31fbda656007c3b308cbc0f5f67:76f0dac4bab5d5fbbc961ca6707a30f20c68b430
Card binding: scope digest n/a (manual attended gate; the harness digest is unavailable, no adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a (file 2j3vO1USLBA8XiRpQKCF3H, frames 14:2 and 14:80)
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=1 P2=0 P3=0 (section 9 test text clears the session on an authorization error, contradicting section 4's refresh-once-first rule). Fix: pending; stop rule reached (round 3 with P1 open): escalated to the owner.
Criteria mapping: AC1..AC12 each mapped to a section by the reviewer (exhaustive, no UNCOVERED); see raw output
Raw output: .clh/evidence/TAW-8/spec-gate-3-raw.txt (Tawsila checkout, outside the worktree)
Usage: 68,688 tokens (Codex reported)   Started/Ended: 2026-10-21 (see accounting-TAW-8.md)
Verdict: FAIL

