/**
 * Referral tracking.
 *
 * Pluggable + async (in-memory default, Redis when Upstash env vars are set).
 * A referral code is captured from `?ref=CODE`, and visits/conversions are
 * counted per code. Codes are anonymous today; once accounts exist, mint one
 * code per user and attribute reward credits on signup — keep these signatures
 * stable and swap the store for a `referrals` table.
 */

import { randomBytes } from "crypto";

export type ReferralStats = { code: string; visits: number; conversions: number };

interface ReferralBackend {
  bump(code: string, field: "visits" | "conversions"): Promise<void>;
  get(code: string): Promise<ReferralStats>;
}

function memoryBackend(): ReferralBackend {
  const store = new Map<string, ReferralStats>();
  return {
    async bump(code, field) {
      const s = store.get(code) ?? { code, visits: 0, conversions: 0 };
      s[field] += 1;
      store.set(code, s);
    },
    async get(code) {
      return store.get(code) ?? { code, visits: 0, conversions: 0 };
    },
  };
}

// NOTE: wired but not tested against live Redis (no creds in dev).
function redisBackend(): ReferralBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  const redis = Redis.fromEnv();
  const k = (code: string) => `ref:${code}`;
  return {
    async bump(code, field) {
      await redis.hincrby(k(code), field, 1);
    },
    async get(code) {
      const h = (await redis.hgetall<Record<string, number>>(k(code))) ?? {};
      return { code, visits: Number(h.visits ?? 0), conversions: Number(h.conversions ?? 0) };
    },
  };
}

const useRedis =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
const backend: ReferralBackend = useRedis ? redisBackend() : memoryBackend();

/** Generate a short shareable referral code. */
export function newReferralCode(): string {
  return randomBytes(5).toString("base64url");
}

function clean(code: string): string {
  return code.replace(/[^\w-]/g, "").slice(0, 32);
}

export async function recordVisit(code: string): Promise<void> {
  if (code) await backend.bump(clean(code), "visits");
}

export async function recordConversion(code: string): Promise<void> {
  if (code) await backend.bump(clean(code), "conversions");
}

export async function referralStats(code: string): Promise<ReferralStats> {
  return backend.get(clean(code));
}
