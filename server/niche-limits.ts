export type NicheLimits = { windowMs: number; perClient: number; perInstance: number; concurrent: number };
export const DEMO_NICHE_LIMITS: NicheLimits = { windowMs: 600_000, perClient: 12, perInstance: 60, concurrent: 3 };

// A bounded demo guard per warm server instance. This is not a distributed billing cap.
export function createNicheLimiter(limits: NicheLimits, now = Date.now) {
  let windowStart = now();
  let count = 0;
  let active = 0;
  const clients = new Map<string, number>();
  return (client: string): { release: () => void } | { retryAfter: number } => {
    const time = now();
    if (time - windowStart >= limits.windowMs) { windowStart = time; count = 0; clients.clear(); }
    if (active >= limits.concurrent) return { retryAfter: 5 };
    if (count >= limits.perInstance || (clients.get(client) ?? 0) >= limits.perClient) {
      return { retryAfter: Math.max(1, Math.ceil((windowStart + limits.windowMs - time) / 1000)) };
    }
    clients.set(client, (clients.get(client) ?? 0) + 1);
    count++; active++;
    let released = false;
    return { release: () => { if (!released) { active--; released = true; } } };
  };
}
