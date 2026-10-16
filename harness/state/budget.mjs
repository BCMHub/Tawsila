const keys = [
  "attempts",
  "repairs",
  "connectorRetries",
  "tokens",
  "costMicrounits",
  "elapsedMs",
];
export function recordUsage(previous = {}, delta = {}) {
  const result = {};
  for (const data of [previous, delta])
    if (!data || Object.keys(data).some((k) => !keys.includes(k)))
      throw Error("Unknown usage field");
  for (const key of keys) {
    const a = Object.hasOwn(previous, key) ? previous[key] : 0,
      b = Object.hasOwn(delta, key) ? delta[key] : 0;
    if (
      !Number.isSafeInteger(a) ||
      !Number.isSafeInteger(b) ||
      a < 0 ||
      b < 0 ||
      !Number.isSafeInteger(a + b)
    )
      throw Error("Invalid or unknown usage " + key);
    result[key] = a + b;
  }
  return result;
}
export function checkBudget(limits, events, now, action = "implementation") {
  const reasons = [];
  const actions = ["implementation", "repair", "connector", "validation"];
  if (!actions.includes(action)) reasons.push("UNKNOWN_ACTION");
  for (const key of [
    "attempts",
    "repairs",
    "connectorRetries",
    "durationMs",
    "maxTokens",
    "maxCostMicrounits",
  ])
    if (!Number.isSafeInteger(limits[key]) || limits[key] < 0)
      reasons.push("INVALID_LIMIT_" + key);
  const times = [
    now,
    limits.startedAt,
    limits.deadline,
    ...events.map((e) => e.timestamp),
  ].map(Date.parse);
  const [time, start, deadline, ...history] = times;
  if (
    !times.every(Number.isFinite) ||
    deadline <= start ||
    !limits.durationMs ||
    deadline - start > limits.durationMs ||
    time < Math.max(start, ...history) ||
    time >= deadline
  )
    reasons.push("TIME_BUDGET");
  let used = {};
  try {
    for (const e of events) used = recordUsage(used, e.usage);
  } catch (e) {
    reasons.push(e.message);
  }
  const checks = {
    tokens: "maxTokens",
    costMicrounits: "maxCostMicrounits",
    elapsedMs: "durationMs",
  };
  if (action === "implementation") checks.attempts = "attempts";
  if (action === "repair") {
    checks.attempts = "attempts";
    checks.repairs = "repairs";
  }
  if (action === "connector") checks.connectorRetries = "connectorRetries";
  for (const [key, limit] of Object.entries(checks))
    if ((used[key] ?? 0) >= limits[limit]) reasons.push("EXHAUSTED_" + key);
  return { status: reasons.length ? "BLOCKED" : "PASS", reasons, used };
}
