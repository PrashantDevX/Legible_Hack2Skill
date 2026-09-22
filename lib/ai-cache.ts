import { createHash } from "node:crypto";

/**
 * Deterministic cache for identical AI requests. The key is a SHA-256 of the
 * operation name plus its exact input, so a repeated action — re-clicking the
 * same suggested scenario, re-analyzing identical text, asking the same
 * question twice — is served without a second model call.
 *
 * Deliberate properties:
 * - Only successful results are stored; a failure stays retryable.
 * - Concurrent identical requests share one in-flight promise, so a
 *   double-click cannot become two billed calls.
 * - Bounded by entry count (LRU) and TTL, so it cannot grow without limit.
 *
 * Privacy: entries hold model output (which can quote the document) in this
 * process's memory for at most AI_CACHE_TTL_MS. Keys are hashes, never the
 * text itself, and nothing is persisted — but this is a wider window than
 * request-scoped memory, so it is documented in the README.
 *
 * ponytail: per-process, in-memory. Across instances a hit saves a call and a
 * miss is just the call that would have happened anyway. Swap in a shared
 * store only if cross-instance hit rate ever matters.
 */

export const AI_CACHE_TTL_MS = 10 * 60_000;
export const AI_CACHE_MAX_ENTRIES = 100;

type Entry = { value: unknown; expires: number };

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

/** Stable key for an operation + its exact input. */
export function cacheKey(kind: string, input: string): string {
  return createHash("sha256").update(kind).update("\u0000").update(input).digest("hex");
}

function store(key: string, entry: Entry): void {
  // Re-insert so Map iteration order stays least-recently-used first.
  entries.delete(key);
  entries.set(key, entry);
  while (entries.size > AI_CACHE_MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

/** Resolve `produce()` through the cache. `now` is injectable for testing. */
export async function cached<T>(
  key: string,
  produce: () => Promise<T>,
  now: number = Date.now(),
): Promise<T> {
  const hit = entries.get(key);
  if (hit && hit.expires > now) {
    store(key, hit); // refresh recency
    return hit.value as T;
  }

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = produce()
    .then((value) => {
      store(key, { value, expires: now + AI_CACHE_TTL_MS });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

/** Test hook: entry count, so the bound is assertable. */
export function aiCacheSize(): number {
  return entries.size;
}

/** Test hook: drop everything. */
export function clearAiCache(): void {
  entries.clear();
  inflight.clear();
}
