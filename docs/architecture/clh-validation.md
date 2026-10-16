# CLH Mobile validation status

## Verified in this build

| Area                                                               | Evidence                                                                          | Limit                                                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Contracts, authorization, journal, locks, budgets and atomic state | Node built-in unit tests                                                          | Trusted production verifier/host state protection is not configured                                      |
| Worktree ownership, resume, candidate identity and admission       | Temporary Git repository tests                                                    | Existing external linked/detached environments remain blocked for adoption                               |
| Graph queries, stale views, impact and fallback                    | Provider contract fixtures and worktree tests                                     | Graph coverage depends on provider/language and is advisory                                              |
| Graphify reference adapter                                         | `npm run test:clh:graphify` against installed graphifyy 0.8.31 and Python fixture | Python-only behavior is verified; no incremental mode is claimed; mobile-language coverage is unverified |
| Context construction and 30%/40% gates                             | Estimator and budget fixtures                                                     | Byte-based upper bound must be calibrated with the eventual model provider; model registry is empty      |
| Dispatch, repair, reviewer, completion and sync                    | Fake-adapter dispatch/completion tests                                            | Fakes are TEST_ONLY and do not prove live authorization, sandbox enforcement or Notion operation         |
| Integration, regression, compare-and-swap and cleanup              | Temporary Git integration tests                                                   | A target checked out in an unmanaged worktree requires a future managed integration/provider path        |
| End-to-end orchestration and process contention                    | `tests/clh/loop.integration.test.mjs`                                             | Notion/model/runtime/reviewer adapters are fakes; result is TEST_ONLY                                    |

## Local run

The verified run used Node 24.21.0 LTS and the installed Graphify 0.8.31 Python fixture. On this workstation Node 24 was invoked through the VS Code bundled runtime because the default shell `node` resolves to Node 25. That is a local runner detail, not a project dependency.

Standard suite: 67 tests, 66 passed, 1 optional Graphify fixture skipped when its opt-in flag is absent. Graphify opt-in suite: 3 passed, 0 skipped. The loop integration scenario has its own package script and is also included in the standard suite. Package scripts also passed on the workstation default Node 25.9.0; the LTS runtime check was separately run through Node 24.21.0.

Production readiness still requires a real Notion connector and authorization/revocation verifier, provider-calibrated tokenizer/capacity estimator, enforceable execution sandbox and usage termination, actual independent agent review, and device/Figma/accessibility adapters for UI cards. Those items remain blocked/unconfigured by design.
