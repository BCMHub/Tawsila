import { immutableJson, identifier } from "../state/files.mjs";
export async function recordInvocation(root, record) {
  identifier(record.invocationId);
  if (
    !record.cardId ||
    !record.model ||
    !Number.isSafeInteger(record.estimatedInputTokens) ||
    record.estimatedInputTokens < 0
  )
    throw Error("Invalid invocation telemetry");
  const { envelope, prompt, selected, ...summary } = record;
  await immutableJson(
    root,
    "telemetry/" + record.invocationId + ".json",
    summary,
  );
}
