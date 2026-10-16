export function usableCapacity(profile) {
  if (
    !profile ||
    !profile.capacity_source ||
    !profile.estimator_id ||
    !profile.estimator_version ||
    !profile.supported_efforts?.includes(profile.effort)
  )
    throw Error("Unverified model capacity/effort");
  for (const k of [
    "context_window_tokens",
    "reserved_output_tokens",
    "provider_overhead_tokens",
  ])
    if (!Number.isSafeInteger(profile[k]) || profile[k] < 0)
      throw Error("Invalid capacity");
  const usable =
    profile.context_window_tokens -
    profile.reserved_output_tokens -
    profile.provider_overhead_tokens;
  if (usable <= 0 || profile.reserved_output_tokens === 0)
    throw Error("No context headroom");
  return usable;
}
export function contextZone(tokens, usable) {
  if (
    !Number.isSafeInteger(tokens) ||
    tokens < 0 ||
    !Number.isSafeInteger(usable) ||
    usable <= 0
  )
    throw Error("Invalid context estimate");
  const ratio = tokens / usable;
  return {
    ratio,
    zone: ratio <= 0.3 ? "green" : ratio <= 0.4 ? "amber" : "red",
  };
}
