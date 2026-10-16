import { checkBudget, recordUsage } from "../state/budget.mjs";
import { readEvents } from "../state/journal.mjs";
import { preflight } from "../governance/authorization.mjs";
import { acquireLock } from "../state/lock.mjs";
import { loadCheckpoint } from "./checkpoint.mjs";
import { transition } from "./dispatch.mjs";
import {
  detectWorkspace,
  snapshotWorktree,
  git,
} from "../worktrees/manager.mjs";
import { readJson, digest } from "../state/files.mjs";
async function authorize(cp, adapters) {
  const live = await adapters.notion.fetch(cp.cardId);
  const result = await preflight(
    live.card,
    live.approval,
    adapters.authorizationVerifier,
    { resume: true, completion: true },
  );
  if (
    result.status !== "PASS" ||
    result.scopeDigest !== cp.scopeDigest ||
    digest(adapters.policy) !== cp.policyDigest
  )
    throw Error("COMPLETION_AUTHORIZATION_CHANGED");
  return live.card;
}
function allowed(path, paths) {
  return paths.some((p) =>
    p.endsWith("/**")
      ? path.startsWith(p.slice(0, -2))
      : p.endsWith("/")
        ? path.startsWith(p)
        : path === p,
  );
}
async function acknowledge(cp, adapters, root) {
  await authorize(cp, adapters);
  const actual = await snapshotWorktree(cp.worktreePath);
  if (
    actual.headCommit !== cp.commit ||
    actual.patchHash !== cp.patchHash ||
    actual.dirty
  )
    throw Error("COMMITTED_SOURCE_CHANGED");
  const limit = checkBudget(
    cp.limits,
    await readEvents(root, cp.runId),
    new Date().toISOString(),
    cp.syncAttempts ? "connector" : "validation",
  );
  if (limit.status !== "PASS") throw Error("SYNC_RETRY_OR_EXECUTION_BUDGET");
  cp = await transition(
    root,
    cp,
    cp.stage,
    recordUsage({}, { connectorRetries: cp.syncAttempts ? 1 : 0 }),
    { syncAttempts: (cp.syncAttempts ?? 0) + 1 },
  );
  let reply;
  try {
    reply = await adapters.notion.verifyCard({
      cardId: cp.cardId,
      commit: cp.commit,
      treeHash: cp.treeHash,
      review: cp.reviewEvidence,
      validation: cp.validationEvidence,
      operationId: "verify:" + cp.cardId + ":" + cp.commit,
    });
  } catch {
    return {
      status: "SYNC_PENDING",
      checkpoint: await transition(root, cp, "SYNC_PENDING"),
      commit: cp.commit,
    };
  }
  if (
    reply?.status !== "PASS" ||
    reply.commit !== cp.commit ||
    reply.cardId !== cp.cardId
  )
    return {
      status: "SYNC_PENDING",
      checkpoint: await transition(root, cp, "SYNC_PENDING"),
      commit: cp.commit,
    };
  const checked = await snapshotWorktree(cp.worktreePath);
  if (
    checked.headCommit !== cp.commit ||
    checked.patchHash !== cp.patchHash ||
    checked.dirty
  )
    throw Error("SOURCE_CHANGED_DURING_SYNC");
  return {
    status: "VERIFIED",
    checkpoint: await transition(root, cp, "VERIFIED"),
    commit: cp.commit,
  };
}
export async function completeCard(checkpoint, adapters, root) {
  let writer, admin;
  try {
    writer = await acquireLock(root, "card:" + checkpoint.cardId, {
      runId: checkpoint.runId,
    });
  } catch (e) {
    return {
      status: "BLOCKED",
      reasons: [e.message],
      checkpoint,
      commit: checkpoint.commit ?? null,
    };
  }
  let cp;
  try {
    cp = await loadCheckpoint(root, checkpoint.cardId);
    if (cp.id !== checkpoint.id)
      return {
        status: "BLOCKED",
        reasons: ["STALE_COMPLETION_CHECKPOINT"],
        checkpoint: cp,
        commit: cp.commit ?? null,
      };
    if (
      cp.stage !== "REVIEW" ||
      cp.reviewEvidence?.status !== "PASS" ||
      cp.reviewEvidence.independent !== true ||
      cp.reviewEvidence.patchHash !== cp.patchHash ||
      !cp.requiredGates?.length ||
      !cp.requiredGates.every((id) =>
        cp.validationEvidence?.some(
          (g) =>
            g.gateId === id &&
            g.status === "PASS" &&
            g.patchHash === cp.patchHash,
        ),
      )
    )
      throw Error("REVIEW_OR_VALIDATION_INCOMPLETE");
    if (typeof adapters.notion.verifyCard !== "function")
      throw Error("COMPLETION_SYNC_ADAPTER_UNAVAILABLE");
    const card = await authorize(cp, adapters);
    const owned = await readJson(root, "worktrees/" + cp.cardId + ".json");
    if (owned.realPath !== cp.worktreePath || owned.ownership !== "harness")
      throw Error("WORKTREE_OWNERSHIP_MISMATCH");
    const workspace = await detectWorkspace(cp.worktreePath);
    if (
      workspace.branch !== owned.branch ||
      workspace.commonGitDir !== owned.commonGitDir ||
      workspace.detached
    )
      throw Error("WORKTREE_BRANCH_OR_REPOSITORY_MISMATCH");
    const actual = await snapshotWorktree(cp.worktreePath);
    if (
      actual.headCommit !== cp.headCommit ||
      actual.patchHash !== cp.patchHash
    )
      throw Error("REVIEWED_SOURCE_CHANGED");
    admin = await acquireLock(root, "repo-admin", { runId: cp.runId });
    const paths = (
      await git(cp.worktreePath, ["diff", owned.baseCommit, "--name-only"])
    )
      .split("\n")
      .filter(Boolean);
    paths.push(
      ...(
        await git(cp.worktreePath, [
          "ls-files",
          "--others",
          "--exclude-standard",
          "-z",
        ])
      )
        .split("\0")
        .filter(Boolean),
    );
    if (paths.some((p) => !allowed(p, card.allowedPaths)))
      throw Error("COMMIT_SCOPE_CONFLICT");
    if (paths.length)
      await git(cp.worktreePath, ["add", "--all", "--", ...new Set(paths)]);
    await git(cp.worktreePath, ["diff", "--exit-code"]);
    if (
      (
        await git(cp.worktreePath, [
          "ls-files",
          "--others",
          "--exclude-standard",
        ])
      ).length
    )
      throw Error("UNSTAGED_SOURCE_REMAINS");
    const treeHash = await git(cp.worktreePath, ["write-tree"]);
    cp = await transition(root, cp, "COMMITTING", undefined, {
      requiresReconciliation: true,
      commitIntent: {
        reviewedPatchHash: cp.patchHash,
        expectedTree: treeHash,
        oldHead: cp.headCommit,
      },
    });
    if (
      (await git(cp.worktreePath, ["diff", "--cached", "--name-only"])).length
    )
      await git(cp.worktreePath, [
        "commit",
        "-m",
        card.id + " " + card.objective,
      ]);
    const committed = await snapshotWorktree(cp.worktreePath);
    if (
      committed.dirty ||
      (await git(cp.worktreePath, ["rev-parse", "HEAD^{tree}"])) !== treeHash
    )
      throw Error("COMMIT_HOOK_CHANGED_REVIEWED_CONTENT");
    cp = await transition(root, cp, "COMMITTED", undefined, {
      ...committed,
      commit: committed.headCommit,
      treeHash,
      requiresReconciliation: false,
    });
    await admin.release();
    admin = null;
    return await acknowledge(cp, adapters, root);
  } catch (e) {
    if (cp?.runId && writer) {
      try {
        cp = await transition(root, cp, "BLOCKED", undefined, {
          requiresReconciliation:
            cp.stage === "COMMITTING" || cp.requiresReconciliation,
          completionError: e.message,
        });
      } catch {}
    }
    return {
      status: "BLOCKED",
      reasons: [e.message],
      checkpoint: cp,
      commit: cp?.commit ?? null,
    };
  } finally {
    if (admin) await admin.release();
    await writer.release();
  }
}
export async function synchronizeCompletion(cardId, adapters, root) {
  const writer = await acquireLock(root, "card:" + cardId, { runId: cardId });
  try {
    const cp = await loadCheckpoint(root, cardId);
    if (cp.stage === "VERIFIED")
      return { status: "VERIFIED", checkpoint: cp, commit: cp.commit };
    if (!["SYNC_PENDING", "COMMITTED"].includes(cp.stage))
      throw Error("Task is not awaiting completion sync");
    return await acknowledge(cp, adapters, root);
  } finally {
    await writer.release();
  }
}
