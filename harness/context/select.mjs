import { digest } from "../state/files.mjs";
export function compactContext(items) {
  const groups = new Map();
  for (const i of items) {
    if (typeof i.text !== "string" || typeof i.id !== "string")
      throw Error("Invalid context item");
    const key = digest({ text: i.text, revision: i.sourceRevision ?? null });
    if (groups.has(key)) {
      const found = groups.get(key);
      found.aliases.push({ id: i.id, source: i.source });
      found.mandatory ||= i.mandatory;
      found.priority = Math.max(found.priority ?? 0, i.priority ?? 0);
    } else groups.set(key, { ...i, aliases: [{ id: i.id, source: i.source }] });
  }
  return [...groups.values()];
}
export function selectContext(
  items,
  mandatoryIds = [],
  tokenBudget = Infinity,
  estimateText = (t) => Buffer.byteLength(t),
) {
  const all = compactContext(
    items.map((i) => ({
      ...i,
      mandatory: i.mandatory || mandatoryIds.includes(i.id),
    })),
  );
  const selected = all.filter((i) => i.mandatory);
  let used = selected.reduce((sum, i) => sum + estimateText(i.text), 0);
  for (const i of all
    .filter((i) => !i.mandatory)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))) {
    const n = estimateText(i.text);
    if (used + n <= tokenBudget) {
      selected.push(i);
      used += n;
    }
  }
  return selected;
}
