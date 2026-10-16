export function graphHealth(view, snapshot, capabilities) {
  if (!view) return "UNAVAILABLE";
  if (
    view.providerVersion !== capabilities.version ||
    view.schemaVersion !== capabilities.schemaVersion ||
    view.contentFingerprint !== snapshot.contentFingerprint ||
    view.configFingerprint !== snapshot.configFingerprint ||
    view.headCommit !== snapshot.headCommit
  )
    return "STALE";
  return view.coverage?.complete === true ? "OK" : "PARTIAL";
}
