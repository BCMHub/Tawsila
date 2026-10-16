import { scopeDigest } from "../governance/authorization.mjs";
import { randomUUID } from "node:crypto";
import { digest, canonical } from "../state/files.mjs";
import { usableCapacity, contextZone } from "./capacity.mjs";
import { estimateInput } from "./estimate.mjs";
import { selectContext, compactContext } from "./select.mjs";
import { retrieveRepositoryContext } from "./repository.mjs";
export async function buildContextPack(
  card,
  worktree,
  checkpoint,
  sources,
  profile,
  estimator,
  policy,
) {
  const invocationId = randomUUID();
  const items = [
    ...(sources.items ?? []),
    {
      id: "authorized-card",
      text: canonical(card),
      source: card.notionUrl ?? "authorized-card",
      sourceRevision: card.scopeRevision ?? "unknown",
      mandatory: true,
      layer: "C1",
      priority: 100,
    },
  ];
  let graphContext = null;
  try {
    const usableTokens = usableCapacity(profile);
    if (
      estimator?.id !== profile.estimator_id ||
      estimator?.version !== profile.estimator_version
    )
      throw Error("ESTIMATOR_PROFILE_MISMATCH");
    if (!items.some((i) => i.id === "C0" && i.mandatory))
      throw Error("MISSING_CONSTITUTION");
    if (
      card.designRequired &&
      !items.some((i) => i.layer === "C2" && i.mandatory)
    )
      throw Error("MISSING_DESIGN_CONTEXT");
    if (sources.repository) {
      const r = await retrieveRepositoryContext(
        card,
        worktree,
        sources.repository.graphService,
        sources.repository.fallback,
        policy.code_graph ?? {},
      );
      items.push(...r.items);
      graphContext = r.graphContext;
      const summary = {
        viewId: graphContext.viewId,
        health: graphContext.health,
        entrySymbols: graphContext.entrySymbols.slice(0, 10),
        affectedFiles: graphContext.affectedFiles.slice(0, 10),
        fallbackReasons: graphContext.fallbackReasons.slice(0, 3),
      };
      const graphBudget = policy.code_graph?.max_query_summary_tokens ?? 1000;
      while (
        (
          await estimateInput(
            { messages: [{ text: canonical(summary) }] },
            estimator,
          )
        ).upperBound > graphBudget
      ) {
        if (summary.affectedFiles.length) summary.affectedFiles.pop();
        else if (summary.entrySymbols.length) summary.entrySymbols.pop();
        else if (summary.fallbackReasons.length) summary.fallbackReasons.pop();
        else throw Error("GRAPH_SUMMARY_BUDGET_UNAVAILABLE");
      }
      items.push({
        id: "graph-summary",
        text: canonical(summary),
        source: "derived-graph-context",
        sourceRevision: graphContext.contentFingerprint,
        mandatory: false,
        priority: 20,
        layer: "C3",
      });
    }
    if (checkpoint)
      items.push({
        id: "checkpoint",
        text: canonical(checkpoint),
        source: "persisted-task-state",
        sourceRevision: checkpoint.id,
        mandatory: true,
        priority: 100,
        layer: "C5",
      });
    let selected = compactContext(items);
    const envelopeFor = (selection) => ({
      system: sources.system ?? "",
      toolSchemas: sources.toolSchemas ?? [],
      attachments: sources.attachments ?? [],
      messages: selection.map((i) => ({
        id: i.id,
        source: i.source,
        revision: i.sourceRevision,
        text: i.text,
      })),
    });
    let envelope = envelopeFor(selected);
    let estimate = await estimateInput(envelope, estimator);
    const preferred = policy.context_budget?.preferred_ratio ?? 0.3;
    const maximum = policy.context_budget?.maximum_normal_ratio ?? 0.4;
    if (maximum > 0.4 || preferred > maximum)
      throw Error("INVALID_CONTEXT_POLICY");
    const reductions = [];
    while (
      estimate.upperBound > usableTokens * preferred &&
      selected.some((i) => !i.mandatory)
    ) {
      const candidates = selected
        .filter((i) => !i.mandatory)
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      const drop = candidates[0];
      selected = selected.filter((i) => i !== drop);
      reductions.push("Removed optional " + drop.id);
      envelope = envelopeFor(selected);
      estimate = await estimateInput(envelope, estimator);
    }
    const zone = contextZone(estimate.upperBound, usableTokens);
    const manifest = {
      id: invocationId,
      cardId: card.id,
      invocationId,
      worktreeId: worktree.id,
      headCommit: worktree.headCommit ?? null,
      patchHash: checkpoint?.patchHash ?? null,
      checkpointId: checkpoint?.id ?? null,
      policyDigest: digest(policy),
      model: profile.model,
      effort: profile.effort,
      capacitySource: profile.capacity_source,
      usableTokens,
      estimatedInputTokens: estimate.upperBound,
      ...zone,
      estimator: {
        id: estimator.id,
        version: estimator.version,
        confidence: estimate.confidence,
      },
      selected: selected.map(({ text, ...metadata }) => metadata),
      omitted: items
        .filter(
          (i) =>
            !selected.some(
              (x) => x.id === i.id || x.aliases?.some((a) => a.id === i.id),
            ),
        )
        .map((i) => ({ id: i.id, reason: "optional-context-budget" })),
      reductions,
      exceptionId: null,
      graphContextId: graphContext?.id ?? null,
      retrievalMode: graphContext?.fallbackReasons?.length
        ? "fallback"
        : "graph-first",
      fallbackReasons: graphContext?.fallbackReasons ?? [],
    };
    let effectiveMaximum = maximum;
    if (zone.ratio > maximum && card.executionPolicy?.contextExceptionId) {
      const exception = policy.exceptions?.find(
        (e) => e.id === card.executionPolicy.contextExceptionId,
      );
      if (
        exception &&
        exception.cardId === card.id &&
        exception.scopeDigest === scopeDigest(card) &&
        exception.model === profile.model &&
        exception.maximumRatio < 1 &&
        exception.maximumRatio > maximum &&
        Date.parse(exception.expiresAt) > Date.now() &&
        sources.exceptionVerifier
      ) {
        const trust = await sources.exceptionVerifier.verify(exception, card);
        if (trust.status === "VALID" && trust.human === true) {
          effectiveMaximum = exception.maximumRatio;
          manifest.exceptionId = exception.id;
        }
      }
    }
    const blocked = estimate.upperBound > usableTokens * effectiveMaximum;
    return {
      decision: {
        status: blocked ? "BLOCKED" : "PASS",
        reasons: blocked ? ["BLOCKED_CONTEXT_TOO_BROAD"] : [],
      },
      manifest,
      envelope,
      graphContext,
      proposal: blocked
        ? {
            status: "PROPOSED",
            cardId: card.id,
            reason:
              "Mandatory context exceeds ceiling; decompose criteria or seek trusted context exception",
            criteria: card.acceptanceCriteria,
          }
        : null,
    };
  } catch (e) {
    return {
      decision: { status: "BLOCKED", reasons: [e.message] },
      manifest: { id: invocationId, cardId: card.id, invocationId },
      envelope: null,
      graphContext,
    };
  }
}
