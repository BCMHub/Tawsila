import { readFile } from "node:fs/promises";
import { digest, safePath } from "../state/files.mjs";
import { retrieveFallback } from "../graph/fallback.mjs";
export async function retrieveRepositoryContext(
  card,
  worktree,
  graphService,
  fallback,
  policy,
) {
  const concepts = [
    ...new Set(
      (card.objective ?? "").match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) ?? [],
    ),
  ].slice(0, 5);
  const resolved = graphService
    ? await graphService.resolve(worktree)
    : {
        view: null,
        health: "UNAVAILABLE",
        fallbackReasons: ["NO_GRAPH_PROVIDER"],
      };
  const view = resolved.view;
  const reasons = [...(resolved.fallbackReasons ?? [])];
  if (view && resolved.health !== "OK")
    reasons.push("GRAPH_HEALTH_" + resolved.health);
  if (view?.coverage?.complete === false)
    reasons.push("GRAPH_COVERAGE_PARTIAL");
  const symbols = [];
  const queries = [];
  if (graphService) {
    for (const query of concepts) {
      const r = await graphService.query(view, "findSymbol", {
        query,
        concepts: [query],
        maxNodes: policy.max_nodes ?? 40,
        maxHops: 1,
      });
      queries.push({ query, status: r.status });
      if (r.status !== "OK" || r.coverage?.complete === false)
        reasons.push("GRAPH_QUERY_" + r.status);
      if (["OK", "PARTIAL"].includes(r.status))
        symbols.push(...(r.nodes ?? []));
    }
  }
  let neighborhood = symbols;
  if (view && symbols.length && graphService) {
    const r = await graphService.query(view, "getNeighborhood", {
      symbols: [...new Set(symbols.map((n) => n.id))],
      maxNodes: policy.max_nodes ?? 40,
      maxHops: 1,
    });
    neighborhood = r.nodes ?? symbols;
    if (r.truncated) reasons.push("GRAPH_NEIGHBORHOOD_TRUNCATED");
  }
  const items = [];
  for (const n of neighborhood.slice(0, policy.max_nodes ?? 40)) {
    try {
      const source = await readFile(
        await safePath(worktree.realPath, n.path),
        "utf8",
      );
      const expected = view?.files?.find((f) => f.path === n.path)?.hash;
      if (!expected || expected !== digest(source))
        throw Error("STALE_OR_UNVERIFIED_GRAPH_SOURCE");
      const lines = source.split("\n");
      const start =
        n.range?.startLine ??
        Number(String(n.location ?? "L1").match(/\d+/)?.[0] ?? 1);
      const end = Math.min(lines.length, n.range?.endLine ?? start + 39);
      items.push({
        id: n.id,
        source: n.path,
        sourceRevision: digest(source),
        contentHash: digest(lines.slice(start - 1, end).join("\n")),
        text: lines.slice(start - 1, end).join("\n"),
        filePath: n.path,
        range: { startLine: start, endLine: end },
        layer: "C3",
        mandatory: false,
        priority: 60,
        purpose: "graph-selected dependency neighborhood",
      });
    } catch (e) {
      reasons.push(e.message);
    }
  }
  if (!items.length || reasons.length) {
    const request = {
      concepts,
      paths: (card.allowedPaths ?? []).filter((p) =>
        /\.(mjs|js|ts|tsx|swift|kt|py)$/.test(p),
      ),
      maxFiles: 5,
      maxLines: 40,
    };
    const r = fallback
      ? await fallback.retrieve(request, worktree)
      : await retrieveFallback(request, worktree);
    items.push(...r.items);
    reasons.push(...r.diagnostics);
  }
  const graphContext = {
    id: digest({ card: card.id, view: view?.id ?? null, queries, reasons }),
    provider: view?.provider ?? null,
    providerVersion: view?.providerVersion ?? null,
    viewId: view?.id ?? null,
    worktreeId: worktree.id,
    contentFingerprint: view?.contentFingerprint ?? null,
    entrySymbols: symbols.map((n) => n.id),
    affectedFiles: [...new Set(items.map((i) => i.filePath))],
    relatedTestCandidates: items
      .filter((i) => /test|spec/.test(i.filePath))
      .map((i) => i.filePath),
    queryRefs: queries,
    health: resolved.health,
    coverage: view?.coverage ?? { complete: false },
    fallbackReasons: reasons,
  };
  return { items, graphContext };
}
