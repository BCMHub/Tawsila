const maxAgeMs = 30 * 60 * 1000;

let pending: { code: string; arrivedAt: number } | null = null;

export function storePendingSharedRide(code: string, arrivedAt = new Date()): void {
  pending = { code, arrivedAt: arrivedAt.getTime() };
}

export function takePendingSharedRide(now = new Date()): string | null {
  const link = pending;
  clearPendingSharedRide();
  if (!link || now.getTime() - link.arrivedAt >= maxAgeMs) return null;
  return link.code;
}

export function clearPendingSharedRide(): void {
  pending = null;
}
