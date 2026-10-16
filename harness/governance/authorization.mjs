import { digest } from "../state/files.mjs";
import { validateCard } from "./contracts.mjs";
export function scopeDigest(card) {
  validateCard(card);
  const { status, ...scope } = card;
  return digest(scope);
}
export const unavailableVerifier = {
  verify: async () => ({
    status: "UNAVAILABLE",
    reason: "Live human authorization verifier is not configured",
  }),
};
export async function preflight(
  card,
  approval,
  verifier = unavailableVerifier,
  { resume = false, completion = false } = {},
) {
  const reasons = [];
  let hash = null;
  try {
    hash = scopeDigest(card);
    if (
      card.status !== "READY" &&
      !(
        resume &&
        (completion
          ? ["IN PROGRESS", "VALIDATING", "REVIEW", "VERIFIED", "DONE"]
          : ["IN PROGRESS", "VALIDATING", "REVIEW"]
        ).includes(card.status)
      )
    )
      reasons.push("CARD_NOT_READY");
    if (card.dependencies.some((d) => d.status !== "DONE"))
      reasons.push("DEPENDENCIES_NOT_DONE");
    if (
      !approval ||
      approval.revoked ||
      approval.cardId !== card.id ||
      approval.scopeDigest !== hash ||
      !approval.approverId ||
      !Number.isFinite(Date.parse(approval.approvedAt)) ||
      !/^https:\/\//.test(approval.evidenceUrl) ||
      !Array.isArray(approval.riskExceptions)
    )
      reasons.push("APPROVAL_INVALID");
    if (!reasons.length) {
      const result = await verifier.verify(approval, card);
      if (result.status !== "VALID" || result.human !== true)
        reasons.push(result.reason ?? "HUMAN_AUTHORIZATION_UNVERIFIED");
    }
  } catch (e) {
    reasons.push(e.message);
  }
  return {
    status: reasons.length ? "BLOCKED" : "PASS",
    reasons,
    scopeDigest: hash,
  };
}
