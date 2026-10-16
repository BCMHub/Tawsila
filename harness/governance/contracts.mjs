import { relativePath } from "../state/files.mjs";
export function object(value, keys) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k)) ||
    keys.some((k) => !(k in value))
  )
    throw Error("Invalid object fields");
}
export function text(v) {
  if (typeof v !== "string" || !v.trim()) throw Error("Expected nonempty text");
  return v;
}
export function url(v) {
  text(v);
  if (new URL(v).protocol !== "https:") throw Error("Expected HTTPS URL");
}
export function list(v, check = text) {
  if (!Array.isArray(v)) throw Error("Expected array");
  v.forEach(check);
}
export function integer(v, min = 0) {
  if (!Number.isSafeInteger(v) || v < min)
    throw Error("Expected bounded integer");
}
function choice(v, values) {
  if (!values.includes(v)) throw Error("Unsupported value");
}
export function validateCard(c) {
  object(c, [
    "id",
    "notionUrl",
    "status",
    "scopeRevision",
    "objective",
    "acceptanceCriteria",
    "allowedPaths",
    "dependencies",
    "origin",
    "designRequired",
    "figmaReferences",
    "requiredPlatforms",
    "risk",
    "budget",
    "executionPolicy",
  ]);
  text(c.id);
  if (!/^[A-Z][A-Z0-9]*-\d+$/.test(c.id)) throw Error("Invalid card ID");
  url(c.notionUrl);
  text(c.scopeRevision);
  text(c.objective);
  choice(c.status, [
    "IDEA",
    "PROPOSED",
    "DRAFT",
    "READY",
    "IN PROGRESS",
    "VALIDATING",
    "REVIEW",
    "VERIFIED",
    "DONE",
    "BLOCKED",
    "CANCELLED",
  ]);
  choice(c.origin, ["Human", "Agent-discovered"]);
  choice(c.risk, ["Low", "Medium", "High"]);
  list(c.acceptanceCriteria, (a) => {
    object(a, ["id", "text"]);
    text(a.id);
    text(a.text);
  });
  if (
    !c.acceptanceCriteria.length ||
    new Set(c.acceptanceCriteria.map((a) => a.id)).size !==
      c.acceptanceCriteria.length
  )
    throw Error("Invalid acceptance criteria");
  list(c.allowedPaths, (p) => relativePath(text(p).replace(/\/$/, "")));
  if (!c.allowedPaths.length) throw Error("Missing paths");
  list(c.dependencies, (d) => {
    object(d, ["id", "status"]);
    text(d.id);
    text(d.status);
    if (d.id === c.id) throw Error("Circular dependency");
  });
  if (new Set(c.dependencies.map((d) => d.id)).size !== c.dependencies.length)
    throw Error("Duplicate dependency");
  if (typeof c.designRequired !== "boolean") throw Error("Invalid design flag");
  list(c.figmaReferences, url);
  list(c.requiredPlatforms, (p) => choice(p, ["Harness", "iOS", "Android"]));
  if (
    !c.requiredPlatforms.length ||
    (c.designRequired && !c.figmaReferences.length)
  )
    throw Error("Missing design/platform context");
  object(c.budget, [
    "attempts",
    "repairs",
    "connectorRetries",
    "durationMs",
    "maxTokens",
    "maxCostMicrounits",
  ]);
  Object.values(c.budget).forEach((v) => integer(v));
  if (
    !c.budget.attempts ||
    !c.budget.durationMs ||
    c.budget.repairs > c.budget.attempts
  )
    throw Error("Invalid budget");
  const p = c.executionPolicy;
  object(p, [
    "worktreeRequired",
    "isolationExceptionId",
    "parallelEligible",
    "conflictGroups",
    "contextPolicyId",
    "contextExceptionId",
  ]);
  if (
    typeof p.worktreeRequired !== "boolean" ||
    typeof p.parallelEligible !== "boolean"
  )
    throw Error("Invalid execution flags");
  list(p.conflictGroups);
  text(p.contextPolicyId);
  for (const k of ["isolationExceptionId", "contextExceptionId"])
    if (p[k] !== null) text(p[k]);
  if (!p.worktreeRequired && !p.isolationExceptionId)
    throw Error("Missing isolation exception");
  return c;
}
export function validatePolicy(p) {
  if (!p || typeof p !== "object") throw Error("Missing policy");
  const c = p.context_budget,
    g = p.code_graph,
    w = p.worktrees;
  if (
    !c ||
    !(
      c.preferred_ratio > 0 &&
      c.preferred_ratio <= 0.3 &&
      c.maximum_normal_ratio >= c.preferred_ratio &&
      c.maximum_normal_ratio <= 0.4
    )
  )
    throw Error("Invalid context thresholds");
  if (!w || typeof w.parallel_enabled !== "boolean")
    throw Error("Invalid parallel policy");
  integer(w.max_active_cards, 1);
  if (w.parallel_enabled ? w.max_active_cards < 2 : w.max_active_cards !== 1)
    throw Error("Invalid parallel limit");
  relativePath(w.root);
  text(w.integration_branch);
  if (
    !g ||
    g.strategy !== "graph-first" ||
    g.local_code_only !== true ||
    g.semantic_parallel_policy !== "serialize-on-risk-or-unknown"
  )
    throw Error("Invalid graph policy");
  relativePath(g.cache_root);
  list(g.fallback_order, (x) =>
    choice(x, [
      "lsp",
      "symbol-search",
      "git",
      "ripgrep",
      "targeted-read",
      "selective-packaging",
    ]),
  );
  if (!g.fallback_order.length) throw Error("Missing fallback");
  for (const k of [
    "max_hops",
    "max_nodes",
    "max_query_summary_tokens",
    "query_timeout_ms",
    "refresh_timeout_ms",
    "max_refresh_attempts",
    "max_full_rebuilds_per_card",
  ])
    integer(g[k], 1);
  if (!p.models || typeof p.models !== "object" || Array.isArray(p.models))
    throw Error("Invalid model registry");
  for (const m of Object.values(p.models)) {
    integer(m.context_window_tokens, 1);
    integer(m.reserved_output_tokens, 1);
    integer(m.provider_overhead_tokens);
    if (
      m.context_window_tokens <=
      m.reserved_output_tokens + m.provider_overhead_tokens
    )
      throw Error("No usable capacity");
    list(m.supported_efforts);
    if (!m.supported_efforts.length) throw Error("Missing efforts");
    text(m.estimator_id);
    text(m.estimator_version);
    text(m.capacity_source);
  }
  list(p.exceptions, (e) => {
    for (const k of ["cardId", "scopeDigest", "approverId", "reason", "model"])
      text(e[k]);
    url(e.evidenceUrl);
    if (
      !Number.isFinite(Date.parse(e.expiresAt)) ||
      !(e.maximumRatio > 0 && e.maximumRatio < 1)
    )
      throw Error("Invalid exception");
  });
  return p;
}
