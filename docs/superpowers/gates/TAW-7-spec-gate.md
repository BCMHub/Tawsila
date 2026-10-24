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

Attempt: 13   Round: 2 (revision 5)
Document: docs/superpowers/specs/2026-10-21-TAW-7-design.md
Revision: d40724aa7ccbb5c304a8ddd22a6881735aeb5096:5341c7f045088e71712ad6337ea9f3b35feeb0f0
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC13 revision 5 (hash 632a7e1e9e25238e); Figma revision n/a (file 2j3vO1USLBA8XiRpQKCF3H; Welcome 14:2 empty, no social frames)
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=0 P2=0 P3=0 (both round-1 findings resolved)
Criteria mapping: AC1->1,2,4,5,9; AC2->2,3,4,9; AC3->3,9; AC4->4,9; AC5->4,9; AC6->1,5; AC7->1,10; AC8->9; AC9->6,7,9; AC10->1,13; AC11->1,3,8; AC12->8; AC13->2,7,12 (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/spec-gate-r5-2-raw.txt
Usage: 66,317 tokens (Codex reported)
Verdict: PASS

Attempt: 14   Round: 3 (revision 5, after the owner-review remediation)
Document: docs/superpowers/specs/2026-10-21-TAW-7-design.md
Revision: ecaf22a2eaac860e8db4587daaf03d6d0c6eaf80:b99af66246eba5cd865eb7069ced20952045f276
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC13 revision 5 as amended 2026-10-24 (hash 4367e8b31025335c); Figma revision n/a (file 2j3vO1USLBA8XiRpQKCF3H; Welcome 14:2 empty, no social frames)
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=0 P2=0 P3=0 (remediation of P1-01..P1-03, P2-01..P2-05 and the corrections verified consistent with the discovery files)
Criteria mapping: AC1->1,2,4,5,9; AC2->2,3,4,9; AC3->3,9; AC4->4,9; AC5->4,9; AC6->1,5,9; AC7->1,3,10; AC8->9; AC9->6,7,9; AC10->1; AC11->1,3,8; AC12->8; AC13->2,4,7,12 (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/spec-gate-r5-3-raw.txt
Usage: 80,578 tokens (Codex reported)
Verdict: PASS

Attempt: 15   Round: 4 (revision 5, owner decisions D1-D8 recorded)
Document: docs/superpowers/specs/2026-10-21-TAW-7-design.md
Revision: 7bcfc6be91c546ca1fb39b7ff3658b1404d64a7f:ebb6994b5bde5edf482cbad2c350445aa0c9a35d
Card binding: scope digest n/a (manual attended gate; no harness adapter); criteria snapshot AC1-AC13 revision 5 as amended 2026-10-24 (hash e7606d0dd7d25cfa); Figma revision n/a (file 2j3vO1USLBA8XiRpQKCF3H; Welcome 14:2 empty, no social frames)
Author: Claude Sonnet 5.5   Reviewer: Codex gpt-6.1-sol (medium effort, read-only)
Findings: P0=0 P1=0 P2=0 P3=0 (review limited to the changes: D1-D8 decisions, the D2 reinstall requirement, section 7 statuses, the verification register)
Criteria mapping: AC1->1,2,5,9; AC2->2,3,4,9; AC3->3,9; AC4->4,9; AC5->4,9,12; AC6->1,5,9; AC7->1,10; AC8->9; AC9->6,7,9; AC10->1; AC11->1,3,8; AC12->8; AC13->2,7,12 (exhaustive, no UNCOVERED)
Raw output: .clh/evidence/TAW-8/spec-gate-r5-4-raw.txt
Usage: 51,335 tokens (Codex reported)
Verdict: PASS

