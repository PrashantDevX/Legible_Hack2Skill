/**
 * Per-IP in-memory rate limiting for the public AI endpoints. In-memory is
 * deliberate: no database, no Redis — a single-instance hackathon deployment
 * only needs a sliding window so one visitor cannot burn the API quota.
 * ponytail: per-instance only — swap for a shared store if this ever runs
 * multi-instance.
 */

const hits = new Map<string, number[]>();

/** Sliding-window check. Returns true when the request is allowed. `now` is
 *  injectable so the window logic is deterministically testable. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 1000) {
    // Prune idle keys so the map cannot grow without bound.
    for (const [k, ts] of hits) {
      if (ts.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true;
}

/** The AI budget per IP per minute, shared by /api/analyze, /api/ask and
 *  /api/case — they all draw on the same provider quota. A complete case
 *  journey is ~5-7 calls, so this allows a full demo while stopping a script. */
export const AI_RATE_LIMIT = 15;
export const AI_RATE_WINDOW_MS = 60_000;

/** Extract the caller IP for rate limiting (best-effort; "local" in dev). */
export function clientIp(request: { headers: { get(name: string): string | null } }): string {
  return (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}
