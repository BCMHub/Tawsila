import { relativePath } from "../state/files.mjs";
export function normalizeGraph(input) {
  if (!input || !Array.isArray(input.nodes) || !Array.isArray(input.edges))
    throw Error("Invalid graph shape");
  const seen = new Set();
  const nodes = input.nodes.map((n) => {
    if (typeof n.id !== "string" || !n.id || seen.has(n.id))
      throw Error("Duplicate/missing symbol");
    seen.add(n.id);
    relativePath(n.path);
    if (
      n.range &&
      (!Number.isSafeInteger(n.range.startLine) ||
        !Number.isSafeInteger(n.range.endLine) ||
        n.range.startLine < 1 ||
        n.range.endLine < n.range.startLine)
    )
      throw Error("Invalid source range");
    return { ...n };
  });
  const edges = input.edges.map((e) => {
    if (
      !seen.has(e.source) ||
      !seen.has(e.target) ||
      typeof e.relation !== "string"
    )
      throw Error("Invalid graph edge");
    return { ...e, confidence: e.confidence ?? "unknown" };
  });
  return { nodes, edges, coverage: input.coverage ?? { complete: false } };
}
export function graphProvider(input) {
  const graph = normalizeGraph(input);
  function result(view, nodes, edges = [], status = "OK", truncated = false) {
    return {
      status,
      viewId: view?.id ?? null,
      fingerprint: view?.contentFingerprint ?? null,
      nodes,
      edges,
      coverage: graph.coverage,
      truncated,
      diagnostics: [],
    };
  }
  function related(view, request, direction, relations) {
    const ids = new Set(request.symbols ?? []);
    const edges = graph.edges.filter(
      (e) =>
        (direction === "in" ? ids.has(e.target) : ids.has(e.source)) &&
        (!relations || relations.includes(e.relation)),
    );
    const targets = new Set(
      edges.map((e) => (direction === "in" ? e.source : e.target)),
    );
    return result(
      view,
      graph.nodes.filter((n) => targets.has(n.id)),
      edges,
    );
  }
  const p = {
    capabilities: async () => ({
      provider: "normalized",
      version: "1",
      schemaVersion: 1,
      languages: graph.coverage.languages ?? [],
      relations: [...new Set(graph.edges.map((e) => e.relation))],
      incrementalModes: [],
      worktreeIsolation: true,
      codeOnly: true,
    }),
    indexRepository: async () => ({
      status: "UNSUPPORTED",
      diagnostics: ["Snapshot provider cannot index"],
    }),
    refreshChanges: async () => ({
      status: "UNSUPPORTED",
      diagnostics: ["No incremental extractor"],
    }),
    findSymbol: async (v, r) => {
      const exact = graph.nodes.filter(
        (n) => n.id === r.query || n.name === r.query || n.path === r.query,
      );
      return result(
        v,
        exact,
        [],
        exact.length > 1 ? "AMBIGUOUS" : exact.length ? "OK" : "NOT_FOUND",
      );
    },
    findCallers: async (v, r) => related(v, r, "in", ["calls"]),
    findCallees: async (v, r) => related(v, r, "out", ["calls"]),
    findDependencies: async (v, r) =>
      related(v, r, "out", ["imports", "calls", "inherits"]),
    findDependents: async (v, r) =>
      related(v, r, "in", ["imports", "calls", "inherits"]),
    findRelatedTests: async (v, r) => {
      const x = related(v, r, "in", null);
      return {
        ...x,
        nodes: x.nodes.filter((n) => /test|spec/i.test(n.path)),
        coverage: { ...x.coverage, testCoverageProven: false },
      };
    },
    getNeighborhood: async (v, r) => {
      const selected = new Set(r.symbols ?? []),
        max = r.maxNodes ?? 40,
        depth = r.maxHops ?? 1;
      let frontier = [...selected],
        truncated = selected.size > max;
      if (truncated)
        return {
          ...result(v, [], [], "PARTIAL", true),
          diagnostics: ["Entry symbols exceed bound"],
        };
      for (let hop = 0; hop < depth; hop++) {
        const next = [];
        for (const e of graph.edges) {
          if (r.relations && !r.relations.includes(e.relation)) continue;
          let neighbor = null;
          if (frontier.includes(e.source) && r.direction !== "upstream")
            neighbor = e.target;
          if (frontier.includes(e.target) && r.direction !== "downstream")
            neighbor = e.source;
          if (neighbor && !selected.has(neighbor)) {
            if (selected.size >= max) {
              truncated = true;
              continue;
            }
            selected.add(neighbor);
            next.push(neighbor);
          }
        }
        frontier = next;
        if (!next.length) break;
      }
      return result(
        v,
        graph.nodes.filter((n) => selected.has(n.id)),
        graph.edges.filter(
          (e) => selected.has(e.source) && selected.has(e.target),
        ),
        truncated ? "PARTIAL" : "OK",
        truncated,
      );
    },
    compareViews: async () => ({
      status: "UNSUPPORTED",
      diagnostics: ["Use source diff and separate view queries"],
    }),
  };
  p.findImpactRadius = (v, r) =>
    p.getNeighborhood(v, { ...r, direction: "upstream" });
  p.findRelatedFiles = (v, r) => p.getNeighborhood(v, r);
  return p;
}
export function semanticRisk(candidateSymbols, activeSymbols, input) {
  if (!input) return { level: "UNKNOWN", reasons: ["NO_GRAPH"] };
  const g = normalizeGraph(input),
    a = new Set(candidateSymbols),
    b = new Set(activeSymbols);
  if ([...a, ...b].some((id) => !g.nodes.some((n) => n.id === id)))
    return { level: "UNKNOWN", reasons: ["UNRESOLVED_SYMBOLS"] };
  if (
    g.edges.some(
      (e) =>
        (a.has(e.source) && b.has(e.target)) ||
        (b.has(e.source) && a.has(e.target)),
    ) ||
    [...a].some((x) => b.has(x))
  )
    return { level: "POTENTIAL", reasons: ["SHARED_DEPENDENCY_NEIGHBORHOOD"] };
  return {
    level: g.coverage.complete === true ? "LOW" : "UNKNOWN",
    reasons: g.coverage.complete === true ? [] : ["INCOMPLETE_GRAPH_COVERAGE"],
  };
}
