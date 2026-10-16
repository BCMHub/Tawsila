# CLH Mobile build rulings

These decisions were needed to execute the approved framework plan safely in this workspace:

1. The workspace Git metadata is read-only under the active filesystem sandbox. The source build and card worktrees were created in `/private/tmp/clh-mobile-build`; the delivered Git bundle preserves the resulting branch history because the workspace `.git` could not be initialized or updated.
2. The plan's original kernel tasks were executed before worktree task 2A, avoiding the circular bootstrap dependency while preserving the authorized task order. Subsequent work used card-named branches/worktrees and state handoff.
3. The default shell runtime is Node 25, outside the required supported LTS line. Verification used the locally available Node 24.21.0 bundled with VS Code; the framework itself has no VS Code dependency.
4. An unmanaged checked-out integration target cannot be safely advanced by a local Git ref update. Integration therefore fails closed for that case and requires a future host/provider-managed checkout or merge path.
5. Production Notion, model, runtime sandbox, and device/Figma integrations were not available. Contract and end-to-end tests use explicit TEST_ONLY fakes; no live readiness is inferred from them.

No plan requirement was silently waived. The remaining host integrations and provider-calibration work are listed in [the validation matrix](clh-validation.md).
