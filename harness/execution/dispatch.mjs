import { usableCapacity } from "../context/capacity.mjs";
import { resolveGraphView, queryRepository } from "../graph/index-service.mjs";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { digest, immutableJson, readJson, safePath } from "../state/files.mjs";
import { acquireLock } from "../state/lock.mjs";
import { appendEvent, readEvents } from "../state/journal.mjs";
import { checkBudget, recordUsage } from "../state/budget.mjs";
import { preflight } from "../governance/authorization.mjs";
import {
  ensureTaskWorktree,
  snapshotWorktree,
  git,
} from "../worktrees/manager.mjs";
import { reserveCard } from "../worktrees/admission.mjs";
import { buildContextPack } from "../context/manifest.mjs";
import { estimateInput } from "../context/estimate.mjs";
import { recordInvocation } from "../telemetry/invocations.mjs";
import { saveCheckpoint, loadCheckpoint } from "./checkpoint.mjs";
const zero = () => recordUsage();
export async function transition(
  root,
  cp,
  newState,
  usage = zero(),
  changes = {},
) {
  const events = await readEvents(root, cp.runId);
  const next = {
    ...cp,
    ...changes,
    id: randomUUID(),
    stage: newState,
    lastObservedAt: new Date().toISOString(),
  };
  await saveCheckpoint(root, next);
  await appendEvent(root, {
    schemaVersion: 3,
    sequence: events.length + 1,
    runId: cp.runId,
    cardId: cp.cardId,
    operationId: randomUUID(),
    previousState: events.at(-1)?.newState ?? null,
    newState,
    timestamp: next.lastObservedAt,
    scopeDigest: cp.scopeDigest,
    usage,
    artifacts: [],
    worktreeId: cp.worktreeId,
    invocationId: next.invocationId ?? null,
    checkpointId: next.id,
    policyDigest: cp.policyDigest,
    graphContextId: next.graphContextId ?? null,
  });
  return next;
}
export async function resumeCard(cardId, adapters, root) {
  const cp = await loadCheckpoint(root, cardId);
  if (cp.requiresReconciliation)
    throw Error("UNCERTAIN_DISPATCH_REQUIRES_RECONCILIATION");
  const live = await adapters.notion.fetch(cardId);
  const approval = await preflight(
    live.card,
    live.approval,
    adapters.authorizationVerifier,
    { resume: true },
  );
  if (approval.status !== "PASS" || approval.scopeDigest !== cp.scopeDigest)
    throw Error("Resume authorization invalid");
  const snap = await snapshotWorktree(cp.worktreePath);
  if (snap.headCommit !== cp.headCommit || snap.patchHash !== cp.patchHash)
    throw Error("Checkpoint source changed; explicit rebuild required");
  return cp;
}
export async function prepareInvocation(cardId, role, adapters, root) {
  let writer, reservation, checkpoint;
  try {
    if (!["implementer", "debugger", "reviewer"].includes(role))
      throw Error("Unsupported agent role");
    const live = await adapters.notion.fetch(cardId);
    let previous = null;
    try {
      previous = await loadCheckpoint(root, cardId);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const decision = await preflight(
      live.card,
      live.approval,
      adapters.authorizationVerifier,
      { resume: Boolean(previous) },
    );
    if (decision.status !== "PASS") return { decision };
    if (previous?.requiresReconciliation)
      throw Error("UNCERTAIN_DISPATCH_REQUIRES_RECONCILIATION");
    writer = await acquireLock(root, "card:" + cardId, {
      runId: previous?.runId ?? cardId,
    });
    reservation = await reserveCard(
      live.card,
      root,
      adapters.policy.worktrees,
      adapters.semanticEvidence ?? { level: "UNKNOWN" },
    );
    const card = structuredClone(live.card);
    const worktree = await ensureTaskWorktree(
      card,
      adapters.cwd,
      root,
      adapters.policy.worktrees,
      previous,
    );
    const snap = await snapshotWorktree(worktree.realPath);
    if (previous && previous.scopeDigest !== decision.scopeDigest)
      throw Error("Authorization scope changed");
    if (!previous) {
      const runId = randomUUID();
      const startedAt = new Date().toISOString();
      checkpoint = {
        id: randomUUID(),
        cardId,
        runId,
        scopeDigest: decision.scopeDigest,
        policyDigest: digest(adapters.policy),
        worktreeId: worktree.id,
        worktreePath: worktree.realPath,
        headCommit: snap.headCommit,
        patchHash: snap.patchHash,
        stage: "CLAIMED",
        pendingActions: [],
        failureArtifacts: [],
        criteriaCoverage: [],
        contextManifestId: null,
        graphContextId: null,
        budgetUsage: zero(),
        lastObservedAt: new Date().toISOString(),
        startedAt,
        limits: {
          ...card.budget,
          startedAt,
          deadline: new Date(
            Date.parse(startedAt) + card.budget.durationMs,
          ).toISOString(),
        },
      };
      await immutableJson(root, "cards/" + cardId + ".json", { runId });
      checkpoint = await transition(root, checkpoint, "CLAIMED");
    } else checkpoint = previous;
    if (
      !(
        role === "reviewer"
          ? ["REVIEW"]
          : ["CLAIMED", "BLOCKED", "REPAIR_PENDING", "WORKTREE_READY"]
      ).includes(checkpoint.stage)
    )
      throw Error("Task stage does not allow another invocation");
    if (role !== "reviewer" && checkpoint.stage !== "WORKTREE_READY")
      checkpoint = await transition(root, checkpoint, "WORKTREE_READY");
    await adapters.notion.updateStatus(
      role === "reviewer" ? "REVIEW" : "IN PROGRESS",
    );
    const budget = checkBudget(
      checkpoint.limits,
      await readEvents(root, checkpoint.runId),
      new Date().toISOString(),
      role === "debugger"
        ? "repair"
        : role === "reviewer"
          ? "validation"
          : "implementation",
    );
    if (budget.status !== "PASS") throw Error(budget.reasons.join(","));
    const profile = await adapters.models.resolve(role, card);
    const sources = await adapters.contextSources(
      role,
      card,
      worktree,
      checkpoint,
    );
    sources.repository ??= {
      graphService: adapters.graphService ?? {
        resolve: (w) =>
          resolveGraphView(
            w,
            adapters.graphProvider ?? null,
            adapters.policy.code_graph,
            root,
          ),
        query: (view, operation, request) =>
          queryRepository(view, operation, request),
      },
      fallback: adapters.sourceFallback,
    };
    if (role === "debugger" || role === "reviewer") {
      sources.items = (sources.items ?? []).filter((i) => i.mandatory);
      let diff = await git(worktree.realPath, [
        "diff",
        worktree.baseCommit,
        "--binary",
      ]);
      const untracked = (
        await git(worktree.realPath, [
          "ls-files",
          "--others",
          "--exclude-standard",
          "-z",
        ])
      )
        .split("\0")
        .filter(Boolean);
      for (const path of untracked)
        diff +=
          "\nNEW " +
          path +
          "\n" +
          (await readFile(await safePath(worktree.realPath, path), "utf8"));
      sources.items.push(
        {
          id: "current-diff",
          text: diff,
          source: "git-current-diff",
          sourceRevision: snap.patchHash,
          mandatory: true,
          priority: 100,
        },
        {
          id: "failure-evidence",
          text: JSON.stringify(
            checkpoint.validationEvidence ?? checkpoint.failureArtifacts,
          ),
          source: "validation",
          sourceRevision: checkpoint.id,
          mandatory: true,
          priority: 100,
        },
      );
    }
    const pack = await buildContextPack(
      card,
      worktree,
      checkpoint,
      sources,
      profile,
      adapters.estimator,
      adapters.policy,
    );
    if (pack.decision.status !== "PASS") {
      checkpoint = await transition(root, checkpoint, "BLOCKED");
      await reservation.release();
      await writer.release();
      return { ...pack, checkpoint };
    }
    if (pack.graphContext) {
      const part = "graph-contexts/" + pack.graphContext.id + ".json";
      try {
        await immutableJson(root, part, pack.graphContext);
      } catch (e) {
        if (
          e.code !== "EEXIST" ||
          digest(await readJson(root, part)) !== digest(pack.graphContext)
        )
          throw e;
      }
    }
    await immutableJson(
      root,
      "contexts/" + pack.manifest.id + ".json",
      pack.manifest,
    );
    checkpoint = await transition(
      root,
      checkpoint,
      role === "reviewer" ? "REVIEW" : "CONTEXT_READY",
      zero(),
      {
        contextManifestId: pack.manifest.id,
        graphContextId: pack.graphContext?.id ?? null,
        invocationId: pack.manifest.invocationId,
      },
    );
    let released = false;
    return {
      ...pack,
      card,
      role,
      worktree,
      checkpoint,
      profile,
      adapters,
      root,
      profileHash: digest(profile),
      exceptionVerifier: sources.exceptionVerifier,
      envelopeHash: digest(pack.envelope),
      release: async () => {
        if (released) return;
        released = true;
        await reservation.release();
        await writer.release();
      },
    };
  } catch (e) {
    if (checkpoint) {
      try {
        checkpoint = await transition(root, checkpoint, "BLOCKED");
      } catch {}
    }
    if (reservation) await reservation.release();
    if (writer) await writer.release();
    return {
      decision: { status: "BLOCKED", reasons: [e.message] },
      checkpoint,
    };
  }
}
function allowed(path, patterns) {
  return patterns.some((p) =>
    p.endsWith("/**")
      ? path.startsWith(p.slice(0, -2))
      : p.endsWith("/")
        ? path.startsWith(p)
        : p === path,
  );
}
export async function dispatchInvocation(prepared, runtime) {
  if (prepared.decision?.status !== "PASS")
    return {
      status: "BLOCKED",
      reasons: prepared.decision?.reasons ?? ["NOT_PREPARED"],
    };
  const p = prepared;
  let cp = p.checkpoint,
    launched = false,
    pendingUsage = zero();
  try {
    const live = await p.adapters.notion.fetch(p.card.id);
    const auth = await preflight(
      live.card,
      live.approval,
      p.adapters.authorizationVerifier,
      { resume: true },
    );
    if (auth.status !== "PASS" || auth.scopeDigest !== cp.scopeDigest)
      throw Error("AUTHORIZATION_CHANGED");
    if (
      digest(p.envelope) !== p.envelopeHash ||
      digest(p.adapters.policy) !== cp.policyDigest
    )
      throw Error("PREPARED_CONTEXT_CHANGED");
    const now = await snapshotWorktree(p.worktree.realPath);
    if (now.headCommit !== cp.headCommit || now.patchHash !== cp.patchHash)
      throw Error("SOURCE_CHANGED_AFTER_PREPARATION");
    const estimate = await estimateInput(p.envelope, p.adapters.estimator);
    if (estimate.upperBound !== p.manifest.estimatedInputTokens)
      throw Error("CONTEXT_ESTIMATE_CHANGED");
    const currentProfile = await p.adapters.models.resolve(p.role, live.card);
    if (digest(currentProfile) !== p.profileHash)
      throw Error("MODEL_PROFILE_CHANGED");
    const ratio = estimate.upperBound / usableCapacity(currentProfile);
    if (
      ratio > (p.adapters.policy.context_budget?.maximum_normal_ratio ?? 0.4)
    ) {
      const e = p.adapters.policy.exceptions?.find(
        (x) => x.id === p.manifest.exceptionId,
      );
      const trusted =
        e && p.exceptionVerifier
          ? await p.exceptionVerifier.verify(e, live.card)
          : null;
      if (
        !e ||
        e.cardId !== live.card.id ||
        e.scopeDigest !== auth.scopeDigest ||
        e.model !== currentProfile.model ||
        Date.parse(e.expiresAt) <= Date.now() ||
        !(e.maximumRatio < 1 && ratio <= e.maximumRatio) ||
        trusted?.status !== "VALID" ||
        trusted.human !== true
      )
        throw Error("CONTEXT_EXCEPTION_EXPIRED_OR_REVOKED");
    }
    const caps = await runtime.capabilities();
    const trust = await p.adapters.runtimeVerifier?.verify(caps, runtime);
    if (
      trust?.status !== "VALID" ||
      ![
        "scopeEnforcement",
        "usageLimits",
        "termination",
        "contextObservation",
        "readOnlyReview",
      ].every((k) => caps[k] === true)
    )
      throw Error("RUNTIME_ENFORCEMENT_UNAVAILABLE");
    const budget = checkBudget(
      cp.limits,
      await readEvents(p.root, cp.runId),
      new Date().toISOString(),
      p.role === "debugger"
        ? "repair"
        : p.role === "reviewer"
          ? "validation"
          : "implementation",
    );
    if (
      budget.status !== "PASS" ||
      (budget.used.tokens ?? 0) + estimate.upperBound > cp.limits.maxTokens
    )
      throw Error("EXECUTION_BUDGET");
    const remaining = {
      ...cp.limits,
      maxTokens: cp.limits.maxTokens - (budget.used.tokens ?? 0),
      maxCostMicrounits:
        cp.limits.maxCostMicrounits - (budget.used.costMicrounits ?? 0),
      durationMs: Math.max(0, Date.parse(cp.limits.deadline) - Date.now()),
    };
    cp = await transition(
      p.root,
      cp,
      p.role === "reviewer" ? "REVIEW" : "DISPATCHING",
      recordUsage(
        {},
        {
          attempts: p.role === "reviewer" ? 0 : 1,
          repairs: p.role === "debugger" ? 1 : 0,
          tokens: estimate.upperBound,
        },
      ),
      { requiresReconciliation: true },
    );
    launched = true;
    const result = await runtime.invoke({
      invocationId: p.manifest.invocationId,
      sessionMode: "fresh",
      cwd: p.worktree.realPath,
      allowedPaths: p.role === "reviewer" ? [] : p.card.allowedPaths,
      envelope: p.envelope,
      model: p.profile.model,
      effort: p.profile.effort,
      limits: remaining,
    });
    if (
      !result.usage ||
      !Number.isSafeInteger(result.usage.tokens) ||
      !Number.isSafeInteger(result.usage.costMicrounits) ||
      result.usage.tokens < 0 ||
      result.usage.costMicrounits < 0
    )
      throw Error("ACTUAL_USAGE_UNKNOWN");
    pendingUsage = recordUsage(
      {},
      {
        tokens: Math.max(0, result.usage.tokens - estimate.upperBound),
        costMicrounits: result.usage.costMicrounits,
      },
    );
    if (
      result.usage.tokens > remaining.maxTokens ||
      result.usage.costMicrounits > remaining.maxCostMicrounits
    )
      throw Error("RUNTIME_USAGE_EXCEEDED_REMAINING_BUDGET");
    const after = await snapshotWorktree(p.worktree.realPath);
    const paths = (
      await git(p.worktree.realPath, [
        "diff",
        p.worktree.baseCommit,
        "--name-only",
      ])
    )
      .split("\n")
      .filter(Boolean);
    paths.push(
      ...(
        await git(p.worktree.realPath, [
          "ls-files",
          "--others",
          "--exclude-standard",
          "-z",
        ])
      )
        .split("\0")
        .filter(Boolean),
    );
    if (
      paths.some((path) => !allowed(path, p.card.allowedPaths)) ||
      (p.role === "reviewer" && after.patchHash !== cp.patchHash)
    )
      throw Error("OUT_OF_SCOPE_CHANGE");
    if (p.role === "reviewer") {
      if (
        result.review?.patchHash !== cp.patchHash ||
        result.review.contextId !== p.manifest.invocationId ||
        !["PASS", "FAIL"].includes(result.review.status) ||
        p.manifest.invocationId === cp.implementationInvocationId
      )
        throw Error("INVALID_INDEPENDENT_REVIEW_EVIDENCE");
      cp = await transition(p.root, cp, "REVIEW", pendingUsage, {
        ...after,
        requiresReconciliation: false,
        reviewEvidence: { ...result.review, independent: true },
      });
      pendingUsage = zero();
      await recordInvocation(p.root, {
        ...p.manifest,
        actualTokens: result.usage.tokens,
        actualCostMicrounits: result.usage.costMicrounits,
        status:
          "REVIEW_" + (result.review.status === "PASS" ? "PASSED" : "FAILED"),
      });
      return {
        status:
          result.review.status === "PASS" ? "REVIEW_PASSED" : "REVIEW_FAILED",
        checkpoint: cp,
        result,
      };
    }
    cp = await transition(
      p.root,
      cp,
      "IMPLEMENTING",
      recordUsage(
        {},
        {
          tokens: Math.max(0, result.usage.tokens - estimate.upperBound),
          costMicrounits: result.usage.costMicrounits,
        },
      ),
      {
        ...after,
        requiresReconciliation: false,
        implementationInvocationId: p.manifest.invocationId,
      },
    );
    pendingUsage = zero();
    cp = await transition(p.root, cp, "VALIDATING");
    await p.adapters.notion.updateStatus("VALIDATING");
    await recordInvocation(p.root, {
      ...p.manifest,
      actualTokens: result.usage.tokens,
      actualCostMicrounits: result.usage.costMicrounits,
      status: "VALIDATING",
    });
    return { status: "VALIDATING", checkpoint: cp, result };
  } catch (e) {
    try {
      cp = await transition(p.root, cp, "BLOCKED", pendingUsage, {
        requiresReconciliation: launched,
      });
    } catch {}
    return { status: "BLOCKED", reasons: [e.message], checkpoint: cp };
  } finally {
    await p.release();
  }
}
export async function recordValidation(cp, gates, requiredGates, root) {
  if (!Array.isArray(requiredGates) || !requiredGates.length)
    throw Error("Missing required validation policy");
  const current = await loadCheckpoint(root, cp.cardId);
  if (current.id !== cp.id || current.stage !== "VALIDATING")
    throw Error("Stale validation checkpoint");
  const snap = await snapshotWorktree(cp.worktreePath);
  if (snap.headCommit !== cp.headCommit || snap.patchHash !== cp.patchHash)
    throw Error("Validation source changed");
  const pass = requiredGates.every((id) =>
    gates.some(
      (g) =>
        g.gateId === id &&
        g.status === "PASS" &&
        g.patchHash === cp.patchHash &&
        g.exitCode === 0 &&
        typeof g.command === "string" &&
        Number.isFinite(Date.parse(g.startedAt)) &&
        Number.isFinite(Date.parse(g.endedAt)),
    ),
  );
  return transition(root, cp, pass ? "REVIEW" : "REPAIR_PENDING", zero(), {
    failureArtifacts: pass ? [] : gates,
    validationEvidence: gates,
    requiredGates,
  });
}
