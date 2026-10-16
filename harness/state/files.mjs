import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import { resolve, relative, sep, dirname, join } from "node:path";
export const digest = (v) =>
  createHash("sha256")
    .update(typeof v === "string" || v instanceof Uint8Array ? v : canonical(v))
    .digest("hex");
export function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(v)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
      .join(",") +
    "}"
  );
}
export function identifier(v) {
  if (typeof v !== "string" || !v.match(/^[A-Za-z0-9_-]+$/))
    throw Error("Unsafe identifier");
  return v;
}
export function relativePath(v) {
  if (
    typeof v !== "string" ||
    !v ||
    v.includes("\\") ||
    v.startsWith("/") ||
    v.split("/").some((x) => x === ".." || x === "." || x === "") ||
    v.includes("\0")
  )
    throw Error("Unsafe path");
  return v;
}
export async function safePath(root, part = "", create = false) {
  root = resolve(root);
  if ((await fs.lstat(root)).isSymbolicLink())
    throw Error("Symlink state root rejected");
  root = await fs.realpath(root);
  const target = resolve(root, part);
  const rel = relative(root, target);
  if (rel.startsWith(".." + sep) || rel === "..")
    throw Error("Path escapes root");
  let cur = sep;
  for (const component of target.split(sep).filter(Boolean)) {
    cur = join(cur, component);
    try {
      if ((await fs.lstat(cur)).isSymbolicLink())
        throw Error("Symlink path rejected");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  if (create) await fs.mkdir(dirname(target), { recursive: true });
  return target;
}
export async function immutableJson(root, part, data) {
  const target = await safePath(root, part, true);
  const temp = target + "." + randomUUID() + ".tmp";
  const f = await fs.open(temp, "wx", 0o600);
  try {
    await f.writeFile(canonical(data) + "\n");
    await f.sync();
  } finally {
    await f.close();
  }
  try {
    await fs.link(temp, target);
    const dir = await fs.open(dirname(target), "r");
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  } finally {
    await fs.unlink(temp);
  }
}
export async function readJson(root, part) {
  return JSON.parse(await fs.readFile(await safePath(root, part), "utf8"));
}

// Caller holds the corresponding metadata lock; evidence continues to use immutableJson.
export async function atomicJson(root, part, data) {
  const target = await safePath(root, part, true);
  const temp = target + "." + randomUUID() + ".tmp";
  const f = await fs.open(temp, "wx", 0o600);
  try {
    await f.writeFile(canonical(data) + "\n");
    await f.sync();
  } finally {
    await f.close();
  }
  try {
    await fs.rename(temp, target);
    const d = await fs.open(dirname(target), "r");
    try {
      await d.sync();
    } finally {
      await d.close();
    }
  } catch (e) {
    await fs.unlink(temp).catch(() => {});
    throw e;
  }
}
