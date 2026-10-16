import { immutableJson, readJson, identifier } from "../state/files.mjs";
import { readEvents } from "../state/journal.mjs";
export async function saveCheckpoint(root, checkpoint) {
  for (const k of ["id", "cardId", "runId", "worktreeId"])
    identifier(checkpoint[k]);
  for (const k of [
    "scopeDigest",
    "headCommit",
    "patchHash",
    "stage",
    "lastObservedAt",
  ])
    if (typeof checkpoint[k] !== "string" || !checkpoint[k])
      throw Error("Incomplete checkpoint");
  await immutableJson(
    root,
    "checkpoints/" + checkpoint.id + ".json",
    checkpoint,
  );
}
export async function loadCheckpoint(root, cardId) {
  identifier(cardId);
  const card = await readJson(root, "cards/" + cardId + ".json");
  const events = await readEvents(root, card.runId);
  const id = events.at(-1)?.checkpointId;
  if (!id) throw Error("Missing checkpoint reference");
  const cp = await readJson(root, "checkpoints/" + id + ".json");
  if (
    cp.cardId !== cardId ||
    cp.runId !== card.runId ||
    cp.scopeDigest !== events.at(-1).scopeDigest
  )
    throw Error("Checkpoint binding mismatch");
  return cp;
}
