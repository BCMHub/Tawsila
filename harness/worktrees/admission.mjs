import { readdir, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  relativePath,
  readJson,
  immutableJson,
  safePath,
} from "../state/files.mjs";
import { acquireLock } from "../state/lock.mjs";
function overlaps(a, b) {
  a = a.replace(/\/$/, "");
  b = b.replace(/\/$/, "");
  relativePath(a);
  relativePath(b);
  if (/[?*\[\]{}]/.test(a + b)) return true;
  return a === b || a.startsWith(b + "/") || b.startsWith(a + "/");
}
export function admitParallel(
  candidate,
  activeRecords,
  dependencyGraph = {},
  reservations = [],
  semanticEvidence = { level: "UNKNOWN" },
  policy = { parallel_enabled: false, max_active_cards: 1 },
) {
  const active = activeRecords
    .map((r) => r.card ?? r)
    .filter((c) => c.id !== candidate.id);
  const reasons = [];
  if (candidate.dependencies?.some((d) => d.status !== "DONE"))
    reasons.push("UNMET_DEPENDENCY");
  if (active.length) {
    if (
      !policy.parallel_enabled ||
      active.length >= policy.max_active_cards ||
      !candidate.executionPolicy?.parallelEligible
    )
      reasons.push("PARALLEL_DISABLED_OR_LIMIT");
    if (semanticEvidence.level !== "LOW")
      reasons.push("SEMANTIC_" + semanticEvidence.level);
    for (const other of active) {
      if (!other.executionPolicy?.parallelEligible)
        reasons.push("ACTIVE_NOT_PARALLEL_ELIGIBLE");
      if (
        candidate.allowedPaths.some((a) =>
          other.allowedPaths.some((b) => overlaps(a, b)),
        )
      )
        reasons.push("PATH_CONFLICT");
      if (
        candidate.executionPolicy.conflictGroups.some((g) =>
          other.executionPolicy.conflictGroups.includes(g),
        )
      )
        reasons.push("ARCHITECTURE_CONFLICT");
      if (
        (candidate.dependencies ?? []).some((d) => d.id === other.id) ||
        (other.dependencies ?? []).some((d) => d.id === candidate.id)
      )
        reasons.push("CARD_DEPENDENCY");
    }
  }
  return { status: reasons.length ? "BLOCKED" : "PASS", reasons };
}
export async function reserveCard(card, root, policy, semanticEvidence) {
  const lock = await acquireLock(root, "repo-admin", { runId: card.id });
  try {
    let names = [];
    try {
      names = await readdir(await safePath(root, "reservations"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const active = [];
    for (const n of names)
      active.push(await readJson(root, "reservations/" + n));
    if (active.some((a) => a.card.id === card.id))
      throw Error("Card already reserved");
    const decision = admitParallel(
      card,
      active,
      {},
      [],
      semanticEvidence,
      policy,
    );
    if (decision.status !== "PASS") throw Error(decision.reasons.join(","));
    const token = randomUUID();
    await immutableJson(root, "reservations/" + card.id + ".json", {
      card,
      token,
    });
    return {
      async release() {
        const l = await acquireLock(root, "repo-admin", { runId: card.id });
        try {
          const rec = await readJson(root, "reservations/" + card.id + ".json");
          if (rec.token !== token) throw Error("Reservation ownership changed");
          await unlink(
            await safePath(root, "reservations/" + card.id + ".json"),
          );
        } finally {
          await l.release();
        }
      },
    };
  } finally {
    await lock.release();
  }
}
