/**
 * Guest usage limiting.
 *
 * Backend is pluggable and async so production can swap the in-memory map for
 * Redis without touching callers (the API routes). Selection is env-driven:
 *
 *   - If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, wire the
 *     Redis backend in `redisBackend()` (INCR + EXPIRE at end of day).
 *   - Otherwise fall back to the in-memory map (single instance, resets on
 *     restart — fine for local dev / a single small box, NOT for scale).
 */

export const GUEST_DAILY_TASK_LIMIT = 5;

export type UsageResult = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
};

interface UsageBackend {
  /** Current count for key on the given day (no mutation). */
  get(key: string, day: string): Promise<number>;
  /** Atomically increment and return the new count. */
  incr(key: string, day: string): Promise<number>;
}

// ---- In-memory backend (default) ------------------------------------------
function memoryBackend(): UsageBackend {
  const store = new Map<string, { day: string; count: number }>();
  return {
    async get(key, day) {
      const b = store.get(key);
      return b && b.day === day ? b.count : 0;
    },
    async incr(key, day) {
      const b = store.get(key);
      const count = (b && b.day === day ? b.count : 0) + 1;
      store.set(key, { day, count });
      return count;
    },
  };
}

// ---- Redis backend (production) -------------------------------------------
// Activated automatically when Upstash env vars are present. Counts live under
// `usage:<day>:<key>` and expire after ~36h so old days self-clean.
// NOTE: wired but not yet tested against a live Redis (no creds in dev).
function redisBackend(): UsageBackend {
  // Lazy require so the SDK isn't pulled into builds that don't use it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  const redis = Redis.fromEnv();
  const TTL_SECONDS = 36 * 60 * 60;
  const k = (day: string, key: string) => `usage:${day}:${key}`;

  return {
    async get(key, day) {
      const v = await redis.get<number>(k(day, key));
      return v ?? 0;
    },
    async incr(key, day) {
      const count = await redis.incr(k(day, key));
      if (count === 1) await redis.expire(k(day, key), TTL_SECONDS);
      return count;
    },
  };
}

const useRedis =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const backend: UsageBackend = useRedis ? redisBackend() : memoryBackend();

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function toResult(used: number): UsageResult {
  return {
    allowed: used <= GUEST_DAILY_TASK_LIMIT,
    used,
    limit: GUEST_DAILY_TASK_LIMIT,
    remaining: Math.max(0, GUEST_DAILY_TASK_LIMIT - used),
  };
}

/** Read current usage without consuming a task. */
export async function peek(key: string): Promise<UsageResult> {
  const used = await backend.get(key, today());
  return toResult(used);
}

/** Consume one task if the guest is under the daily limit. */
export async function checkAndConsume(key: string): Promise<UsageResult> {
  const day = today();
  const current = await backend.get(key, day);
  if (current >= GUEST_DAILY_TASK_LIMIT) {
    return { allowed: false, used: current, limit: GUEST_DAILY_TASK_LIMIT, remaining: 0 };
  }
  const used = await backend.incr(key, day);
  return toResult(used);
}
