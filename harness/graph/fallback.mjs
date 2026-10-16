import { readdir, readFile, lstat } from "node:fs/promises";
import { join, relative } from "node:path";
import { safePath, digest, relativePath } from "../state/files.mjs";
export const codePattern =
  /\.(mjs|cjs|js|jsx|ts|tsx|swift|kt|java|py|go|rs|json)$/;
export async function sourcePaths(root, maxFiles = 10000) {
  const out = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (
        e.name.startsWith(".") ||
        [
          "node_modules",
          "vendor",
          "dist",
          "build",
          "outputs",
          "coverage",
        ].includes(e.name)
      )
        continue;
      const p = join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) await walk(p);
      else if (codePattern.test(e.name)) {
        out.push(relative(root, p));
        if (out.length > maxFiles) throw Error("SOURCE_INVENTORY_TOO_BROAD");
      }
    }
  }
  await walk(root);
  return out.sort();
}
export async function retrieveFallback(request, worktree) {
  const root = worktree.realPath;
  const concepts = (request.concepts ?? [request.query ?? ""]).filter(
    (x) => typeof x === "string" && x.length,
  );
  const items = [];
  const paths = request.paths?.length
    ? request.paths
    : await sourcePaths(root, request.inventoryLimit ?? 10000);
  let inspected = 0;
  for (const path of paths) {
    relativePath(path);
    if (!codePattern.test(path) || /\.(env|pem|key)$/.test(path)) continue;
    const text = await readFile(await safePath(root, path), "utf8");
    if (Buffer.byteLength(text) > 1024 * 1024) continue;
    inspected++;
    const lines = text.split("\n");
    const matches = lines
      .map((line, i) =>
        concepts.some((c) => path.includes(c) || line.includes(c)) ? i : -1,
      )
      .filter((i) => i >= 0);
    if (!matches.length && !request.paths?.length) continue;
    const start = matches[0] ?? 0,
      end = Math.min(lines.length, start + (request.maxLines ?? 40));
    items.push({
      id: path + ":" + (start + 1),
      source: path,
      sourceRevision: digest(text),
      contentHash: digest(lines.slice(start, end).join("\n")),
      filePath: path,
      range: { startLine: start + 1, endLine: end },
      text: lines.slice(start, end).join("\n"),
      layer: "C3",
      priority: 50,
      mandatory: false,
      purpose: "targeted source fallback",
    });
    if (items.length >= (request.maxFiles ?? 5)) break;
  }
  return {
    items,
    coverage: { complete: false, inspectedFiles: inspected },
    diagnostics: ["TARGETED_SOURCE_FALLBACK"],
  };
}
