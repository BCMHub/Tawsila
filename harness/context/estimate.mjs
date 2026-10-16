export const conservativeByteEstimator = {
  id: "bytes-v1",
  version: "1",
  async estimate(envelope) {
    if (envelope.attachments?.length)
      throw Error("Unbounded attachment encoding");
    const bytes = Buffer.byteLength(JSON.stringify(envelope), "utf8");
    return {
      tokens: bytes + 128,
      upperBound: bytes + 128,
      method: "utf8-byte-upper-bound-plus-framing",
      version: "1",
      confidence: "conservative",
    };
  },
};
export async function estimateInput(envelope, estimator) {
  if (!estimator?.estimate) throw Error("CONTEXT_ESTIMATOR_UNAVAILABLE");
  const result = await estimator.estimate(envelope);
  if (
    !Number.isSafeInteger(result.upperBound) ||
    result.upperBound < 0 ||
    !result.method ||
    !result.version
  )
    throw Error("Invalid context estimate");
  return result;
}
