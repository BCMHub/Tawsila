import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { git, detectWorkspace, snapshotWorktree } from "./manager.mjs";
import { acquireLock } from "../state/lock.mjs";
import {
  digest,
  immutableJson,
  readJson,
  safePath,
  relativePath,
  identifier,
} from "../state/files.mjs";
function serial(record) {
  const { adapters, lease, validator, ...data } = record;
  return data;
}
function gatesPass(record, gates) {
  return (
    record.requiredGates.length > 0 &&
    record.requiredGates.every((id) =>
      gates.some(
        (g) =>
          g.gateId === id &&
          g.status === "PASS" &&
          g.exitCode === 0 &&
          g.commit === record.mergeCommit &&
          g.treeHash === record.treeHash &&
          typeof g.command === "string" &&
          g.command &&
          Number.isFinite(Date.parse(g.startedAt)) &&
          Number.isFinite(Date.parse(g.endedAt)),
      ),
    )
  );
}
export async function prepareIntegration(
  cardId,
  candidateCommit,
  targetRef,
  adapters,
) {
  identifier(cardId);
  if (!/^[a-f0-9]{40}$/.test(candidateCommit) || !/^\w[\w/-]*$/.test(targetRef))
    throw Error("Invalid integration refs");
  if (
    adapters.review?.independent !== true ||
    adapters.review.reviewedCommit !== candidateCommit ||
    !adapters.review.reviewerContextId
  )
    throw Error("Independent exact-commit review missing");
  const stateRoot = adapters.stateRoot;
  const lease = await acquireLock(stateRoot, "integration", { runId: cardId });
  let admin;
  try {
    admin = await acquireLock(stateRoot, "repo-admin", { runId: cardId });
    const workspace = await detectWorkspace(adapters.cwd);
    const oldTarget = await git(adapters.cwd, ["rev-parse", targetRef]);
    relativePath(adapters.worktreeRoot);
    await git(adapters.cwd, ["check-ignore", adapters.worktreeRoot + "/"]);
    const id = randomUUID();
    const path = await safePath(
      workspace.topLevel,
      adapters.worktreeRoot + "/integration-" + cardId + "-" + id,
      true,
    );
    const branch = "integration/" + cardId + "-" + id;
    const record = {
      id,
      cardId,
      candidateCommit,
      targetRef: "refs/heads/" + targetRef,
      oldTarget,
      realPath: path,
      branch,
      repositoryRoot: workspace.topLevel,
      stateRoot,
      ownership: "harness",
      requiredGates: adapters.requiredIntegrationGates ?? ["regression"],
      review: adapters.review,
      state: "INTEGRATION_PENDING",
    };
    await immutableJson(
      stateRoot,
      "integrations/" + id + "/intent.json",
      record,
    );
    await git(adapters.cwd, ["worktree", "add", "-b", branch, path, oldTarget]);
    await git(path, ["merge", "--no-ff", "--no-edit", candidateCommit]);
    record.mergeCommit = await git(path, ["rev-parse", "HEAD"]);
    record.treeHash = await git(path, ["rev-parse", "HEAD^{tree}"]);
    record.state = "INTEGRATION_VALIDATING";
    await immutableJson(
      stateRoot,
      "integrations/" + id + "/prepared.json",
      record,
    );
    return { ...record, adapters, lease };
  } catch (e) {
    await lease.release();
    throw e;
  } finally {
    if (admin) await admin.release();
  }
}
export async function verifyIntegration(record, validator) {
  const gates = await validator(record);
  if (!gatesPass(record, gates))
    throw Error("Integration regression gate failed");
  if (
    (await git(record.realPath, ["rev-parse", "HEAD"])) !==
      record.mergeCommit ||
    (await snapshotWorktree(record.realPath)).dirty
  )
    throw Error("Integration candidate changed");
  record.validator = validator;
  await immutableJson(
    record.stateRoot,
    "integrations/" + record.id + "/verified.json",
    { recordHash: digest(serial(record)), gatesHash: digest(gates), gates },
  );
  return gates;
}
export async function mergeIntegration(record, gates, approvalVerifier) {
  let admin;
  try {
    const prepared = await readJson(
      record.stateRoot,
      "integrations/" + record.id + "/prepared.json",
    );
    if (digest(prepared) !== digest(serial(record)))
      throw Error("Integration record changed");
    const verified = await readJson(
      record.stateRoot,
      "integrations/" + record.id + "/verified.json",
    );
    if (
      verified.recordHash !== digest(serial(record)) ||
      verified.gatesHash !== digest(gates) ||
      !gatesPass(record, gates)
    )
      throw Error("Stale integration gates");
    const approval = await approvalVerifier?.verify(record);
    if (approval?.status !== "VALID" || approval.human !== true)
      throw Error("Human integration approval unavailable");
    admin = await acquireLock(record.stateRoot, "repo-admin", {
      runId: record.cardId,
    });
    const current = await git(record.repositoryRoot, [
      "rev-parse",
      record.targetRef,
    ]);
    if (current !== record.oldTarget) throw Error("Integration target moved");
    const inventory = await git(record.repositoryRoot, [
      "worktree",
      "list",
      "--porcelain",
    ]);
    if (inventory.split("\n").includes("branch " + record.targetRef))
      throw Error(
        "Target is checked out; managed provider integration required",
      );
    if (
      (await snapshotWorktree(record.realPath)).dirty ||
      (await git(record.realPath, ["rev-parse", "HEAD"])) !== record.mergeCommit
    )
      throw Error("Integration worktree changed");
    await immutableJson(
      record.stateRoot,
      "integrations/" + record.id + "/merge-intent.json",
      {
        target: record.targetRef,
        old: record.oldTarget,
        next: record.mergeCommit,
      },
    );
    await git(record.repositoryRoot, [
      "update-ref",
      record.targetRef,
      record.mergeCommit,
      record.oldTarget,
    ]);
    await admin.release();
    admin = null;
    const post = await record.validator(record);
    if (!gatesPass(record, post))
      throw Error("Post-merge regression failed; retain integration worktree");
    if (
      (await snapshotWorktree(record.realPath)).dirty ||
      (await git(record.realPath, ["rev-parse", "HEAD"])) !== record.mergeCommit
    )
      throw Error(
        "Post-merge source changed; retain advanced target and evidence",
      );
    const sync = await record.adapters.syncIntegration?.(serial(record));
    if (
      (await snapshotWorktree(record.realPath)).dirty ||
      (await git(record.realPath, ["rev-parse", "HEAD"])) !== record.mergeCommit
    )
      throw Error("Source changed during synchronization");
    const integrated = {
      ...serial(record),
      state: "INTEGRATED",
      syncPending: sync?.status !== "PASS",
      postGates: post,
    };
    await immutableJson(
      record.stateRoot,
      "integrations/" + record.id + "/integrated.json",
      integrated,
    );
    return integrated;
  } finally {
    if (admin) await admin.release();
    await record.lease.release();
  }
}
export async function cleanupWorktree(record, policy) {
  if (!policy.cleanup_after_integration)
    return { status: "RETAINED", reason: "RETENTION_POLICY" };
  if (
    record.ownership !== "harness" ||
    record.retainReason ||
    record.state === "BLOCKED"
  )
    return { status: "RETAINED", reason: "EXTERNAL_OR_BLOCKED" };
  let writer, admin;
  try {
    const integrated = await readJson(
      record.stateRoot,
      "integrations/" + identifier(record.integrationId) + "/integrated.json",
    );
    if (integrated.cardId !== record.cardId || integrated.syncPending)
      return { status: "RETAINED", reason: "INTEGRATION_OR_SYNC_INCOMPLETE" };
    const owned = await readJson(
      record.stateRoot,
      "worktrees/" + identifier(record.cardId) + ".json",
    );
    if (
      owned.realPath !== record.realPath ||
      owned.ownership !== "harness" ||
      owned.branch !== record.branch
    )
      return { status: "RETAINED", reason: "OWNERSHIP_MISMATCH" };
    const marker =
      "cleanups/" + record.integrationId + "/" + record.cardId + ".json";
    try {
      return await readJson(record.stateRoot, marker);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    writer = await acquireLock(record.stateRoot, "card:" + record.cardId, {
      runId: record.cardId,
    });
    admin = await acquireLock(record.stateRoot, "repo-admin", {
      runId: record.cardId,
    });
    const snap = await snapshotWorktree(owned.realPath);
    const current = await detectWorkspace(owned.realPath);
    if (
      snap.dirty ||
      snap.headCommit !== integrated.candidateCommit ||
      current.branch !== owned.branch
    )
      return { status: "RETAINED", reason: "DIRTY_OR_CHANGED_WORKTREE" };
    await git(integrated.repositoryRoot, [
      "merge-base",
      "--is-ancestor",
      integrated.candidateCommit,
      integrated.targetRef,
    ]);
    await git(integrated.repositoryRoot, [
      "worktree",
      "remove",
      owned.realPath,
    ]);
    const result = {
      status: "CLEANED",
      cardId: record.cardId,
      integrationId: record.integrationId,
      realPath: owned.realPath,
    };
    await immutableJson(record.stateRoot, marker, result);
    return result;
  } catch (e) {
    return { status: "RETAINED", reason: e.message };
  } finally {
    if (admin) await admin.release();
    if (writer) await writer.release();
  }
}
