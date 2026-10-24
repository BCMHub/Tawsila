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

Attempt: 4   Round: 4 (attempts extended by the owner: "round 4", 2026-10-21; the gate was not waived)
Document: docs/superpowers/specs/2026-10-21-TAW-7-design.md
Revision: e7873d3f785a19e376889a51dcfce4370f6f3b9d:93113774653cd21cd755feb187addb1ea1363d32
Card binding: scope digest n/a (manual attended gate; the harness digest is unavailable, no adapter); criteria snapshot AC1-AC12 revision 4 (hash 7e887b8a398e284b); Figma revision n/a (file 2j3vO1USLBA8XiRpQKCF3H, frames 14:2 and 14:80)
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=0 P2=0 P3=0 (round-3 inconsistency between sections 4 and 9 resolved)
Criteria mapping: AC1->1,2,4,5; AC2->1,2,3,7; AC3->2,3,4,9; AC4->2,3,9; AC5->4,6,9; AC6->1,4,7; AC7->3; AC8->9; AC9->1,6,9,10; AC10->1; AC11->3,7; AC12->8,9,10 (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/spec-gate-4-raw.txt (Tawsila checkout, outside the worktree)
Usage: 53,997 tokens (Codex reported)   Started/Ended: 2026-10-21 (see accounting-TAW-8.md)
Verdict: PASS


# Revision 5 (social sign-in): spec gate, 2026-10-24 (round counter restarted by the owner's requirements change; target about 3 rounds)

Attempt: 12   Round: 1 (revision 5)
Document: docs/superpowers/specs/2026-10-21-TAW-7-design.md
Revision: d5cb0d0746253e840baee6eed88ce72ed6c37fbf:02d52947fdbe3fdb1725b924cd9b0d6976227fe3
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC13 revision 5 (hash 632a7e1e9e25238e); Figma revision n/a (file 2j3vO1USLBA8XiRpQKCF3H; Welcome 14:2 empty, no social frames)
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=2 P2=0 P3=0 (session storage replacement could mix old and new chunks after an interrupted write; section 9 lacked automated cases required by AC8: replay, nonce mismatch, concurrent first sign-ins, returning sign-in). Fixes applied in round 2.
Criteria mapping: AC1..AC13 each mapped by the reviewer (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/spec-gate-r5-1-raw.txt
Usage: 53,071 tokens (Codex reported)
Verdict: FAIL

