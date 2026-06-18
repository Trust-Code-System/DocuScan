/**
 * Usage metering for usage-based API billing.
 *
 * Records billable units per API key per calendar month. Pluggable + async:
 * in-memory by default, Redis when Upstash env vars are present. This is the
 * metering seam — turning meters into invoices needs the payments provider +
 * DB (Phase 4), but the counts are captured correctly from day one.
 *
 * Production seam: aggregate these into a `usage_records` table and feed your
 * billing provider (Stripe metered prices / Paystack). Keep meter()/getUsage()
 * stable so callers don't change.
 */

export type Operation = "share" | "compress" | "ocr" | "extract";

/** Billable weight per operation (relative cost units). */
export const UNIT_COST: Record<Operation, number> = {
  share: 1,
  compress: 2,
  ocr: 5,
  extract: 5,
};

export type UsageSummary = { period: string; total: number; byOp: Record<string, number> };

interface BillingBackend {
  add(keyId: string, period: string, op: Operation, units: number): Promise<void>;
  get(keyId: string, period: string): Promise<UsageSummary>;
}

function period(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)
}

// ---- In-memory backend (default) ------------------------------------------
function memoryBackend(): BillingBackend {
  // keyId -> period -> { total, byOp }
  const store = new Map<string, Map<string, UsageSummary>>();
  return {
    async add(keyId, p, op, units) {
      const byPeriod = store.get(keyId) ?? new Map();
      const sum = byPeriod.get(p) ?? { period: p, total: 0, byOp: {} };
      sum.total += units;
      sum.byOp[op] = (sum.byOp[op] ?? 0) + units;
      byPeriod.set(p, sum);
      store.set(keyId, byPeriod);
    },
    async get(keyId, p) {
      return store.get(keyId)?.get(p) ?? { period: p, total: 0, byOp: {} };
    },
  };
}

// ---- Redis backend (production) -------------------------------------------
// NOTE: wired but not tested against live Redis (no creds in dev).
function redisBackend(): BillingBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  const redis = Redis.fromEnv();
  const hk = (keyId: string, p: string) => `usage:${keyId}:${p}`;
  return {
    async add(keyId, p, op, units) {
      await redis.hincrby(hk(keyId, p), "total", units);
      await redis.hincrby(hk(keyId, p), `op:${op}`, units);
    },
    async get(keyId, p) {
      const h = (await redis.hgetall<Record<string, number>>(hk(keyId, p))) ?? {};
      const byOp: Record<string, number> = {};
      for (const [k, v] of Object.entries(h)) {
        if (k.startsWith("op:")) byOp[k.slice(3)] = Number(v);
      }
      return { period: p, total: Number(h.total ?? 0), byOp };
    },
  };
}

const useRedis =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
const backend: BillingBackend = useRedis ? redisBackend() : memoryBackend();

/** Record a billable operation against an API key (current month). */
export async function meter(keyId: string, op: Operation): Promise<void> {
  await backend.add(keyId, period(), op, UNIT_COST[op]);
}

/** Read this month's metered usage for a key. */
export async function getUsage(keyId: string): Promise<UsageSummary> {
  return backend.get(keyId, period());
}
