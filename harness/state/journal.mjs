import { readdir } from "node:fs/promises";
import {
  identifier,
  immutableJson,
  readJson,
  digest,
  safePath,
} from "./files.mjs";
import { acquireLock } from "./lock.mjs";
const transitions = {
  NONE: ["CLAIMED"],
  CLAIMED: ["WORKTREE_READY", "BLOCKED", "CANCELLED"],
  WORKTREE_READY: ["CONTEXT_READY", "BLOCKED"],
  CONTEXT_READY: ["DISPATCHING", "BLOCKED"],
  DISPATCHING: ["IMPLEMENTING", "BLOCKED"],
  IMPLEMENTING: ["VALIDATING", "BLOCKED"],
  VALIDATING: ["REPAIR_PENDING", "REVIEW", "BLOCKED"],
  REPAIR_PENDING: ["WORKTREE_READY", "BLOCKED"],
  REVIEW: ["REVIEW", "COMMITTING", "VERIFIED", "REPAIR_PENDING", "BLOCKED"],
  COMMITTING: ["COMMITTED", "BLOCKED"],
  COMMITTED: ["COMMITTED", "VERIFIED", "SYNC_PENDING", "BLOCKED"],
  VERIFIED: ["INTEGRATION_PENDING", "SYNC_PENDING"],
  SYNC_PENDING: ["SYNC_PENDING", "VERIFIED", "BLOCKED"],
  INTEGRATION_PENDING: ["INTEGRATION_VALIDATING", "BLOCKED"],
  INTEGRATION_VALIDATING: ["INTEGRATED", "BLOCKED"],
  INTEGRATED: ["CLEANUP_PENDING", "BLOCKED"],
  CLEANUP_PENDING: ["CLEANED", "RETAINED"],
  RETAINED: ["CLEANUP_PENDING"],
  BLOCKED: ["WORKTREE_READY", "CANCELLED"],
  CANCELLED: [],
  CLEANED: [],
};
function validateEvent(e, previous) {
  const fields = [
    "schemaVersion",
    "sequence",
    "runId",
    "cardId",
    "operationId",
    "previousState",
    "newState",
    "timestamp",
    "scopeDigest",
    "usage",
    "artifacts",
    "worktreeId",
    "invocationId",
    "checkpointId",
    "policyDigest",
    "graphContextId",
  ];
  if (
    !e ||
    fields.some((k) => !(k in e)) ||
    Object.keys(e).some((k) => !fields.includes(k))
  )
    throw Error("Incomplete event");
  for (const k of ["runId", "operationId", "cardId"]) identifier(e[k]);
  for (const k of ["scopeDigest", "policyDigest"])
    if (typeof e[k] !== "string" || !e[k]) throw Error("Missing digest");
  if (!Number.isFinite(Date.parse(e.timestamp)))
    throw Error("Invalid event timestamp");
  if (!Array.isArray(e.artifacts)) throw Error("Invalid artifacts");
  for (const p of e.artifacts) {
    if (
      typeof p !== "string" ||
      !p ||
      p.startsWith("/") ||
      p.split("/").includes("..") ||
      p.includes("\\")
    )
      throw Error("Unsafe artifact reference");
  }
  for (const k of [
    "worktreeId",
    "invocationId",
    "checkpointId",
    "graphContextId",
  ])
    if (e[k] !== null) identifier(e[k]);
  const keys = [
    "attempts",
    "repairs",
    "connectorRetries",
    "tokens",
    "costMicrounits",
    "elapsedMs",
  ];
  if (
    !e.usage ||
    Object.keys(e.usage).length !== keys.length ||
    keys.some((k) => !Number.isSafeInteger(e.usage[k]) || e.usage[k] < 0)
  )
    throw Error("Invalid usage evidence");
  if (
    previous &&
    (e.cardId !== previous.cardId ||
      e.scopeDigest !== previous.scopeDigest ||
      Date.parse(e.timestamp) < Date.parse(previous.timestamp))
  )
    throw Error("Run binding or time changed");
}
export async function readEvents(root, runId) {
  identifier(runId);
  const path = await safePath(root, "runs/" + runId);
  let files;
  try {
    files = await readdir(path);
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  files = files.filter((x) => x.endsWith(".json")).sort();
  const records = [];
  for (const file of files) {
    if (!/^\d{8}\.json$/.test(file)) throw Error("Unknown journal file");
    const stored = await readJson(root, "runs/" + runId + "/" + file);
    const { recordHash, ...event } = stored;
    validateEvent(event, records.at(-1));
    if (
      recordHash !== digest(event) ||
      event.schemaVersion !== 3 ||
      event.sequence !== records.length + 1 ||
      event.runId !== runId ||
      event.previousState !== (records.at(-1)?.newState ?? null) ||
      !(transitions[event.previousState ?? "NONE"] ?? []).includes(
        event.newState,
      )
    )
      throw Error("Corrupt journal or invalid transition");
    if (records.some((x) => x.operationId === event.operationId))
      throw Error("Duplicate operation");
    records.push(event);
  }
  return records;
}
export async function appendEvent(root, event) {
  identifier(event.runId);
  const lock = await acquireLock(root, "journal:" + event.runId);
  try {
    const events = await readEvents(root, event.runId);
    validateEvent(event, events.at(-1));
    const existing = events.find((x) => x.operationId === event.operationId);
    if (existing) {
      if (digest(existing) !== digest(event))
        throw Error("Conflicting idempotency operation");
      return;
    }
    if (
      event.schemaVersion !== 3 ||
      event.sequence !== events.length + 1 ||
      event.previousState !== (events.at(-1)?.newState ?? null) ||
      !(transitions[event.previousState ?? "NONE"] ?? []).includes(
        event.newState,
      ) ||
      !Number.isFinite(Date.parse(event.timestamp))
    )
      throw Error("Invalid journal event");
    await immutableJson(
      root,
      "runs/" +
        event.runId +
        "/" +
        String(event.sequence).padStart(8, "0") +
        ".json",
      { ...event, recordHash: digest(event) },
    );
  } finally {
    await lock.release();
  }
}
