/**
 * Per-client rate limiting for API endpoints.
 *
 * Backend is pluggable and async, mirroring lib/usage.ts: in-memory by default
 * (fixed-window counters, single instance — fine for dev / one small box), and
 * Redis when Upstash env vars are present (shared across instances).
 *
 * Usage in a route handler:
 *
 *   import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";
 *   const rl = await rateLimit(`share:${clientIp(req)}`, { limit: 20, windowSec: 60 });
 *   if (!rl.allowed) return tooManyRequests(rl);
 *
 * Limits are intentionally generous (these are anti-abuse / anti-runaway caps,
 * not the product's daily quota — that lives in lib/usage.ts).
 */

import { NextRequest, NextResponse } from "next/server";

export type RateLimitOptions = {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
};

interface RateLimitBackend {
  /**
   * Atomically increment the counter for `key` within a window of `windowSec`,
   * returning the new count and the window's reset time (epoch ms).
   */
  hit(key: string, windowSec: number): Promise<{ count: number; resetAt: number }>;
}

// ---- In-memory backend (default) ------------------------------------------
function memoryBackend(): RateLimitBackend {
  const store = new Map<string, { count: number; resetAt: number }>();
  return {
    async hit(key, windowSec) {
      const now = Date.now();
      const existing = store.get(key);
      if (!existing || existing.resetAt <= now) {
        const entry = { count: 1, resetAt: now + windowSec * 1000 };
        store.set(key, entry);
        // Opportunistic cleanup so the map can't grow unbounded.
        if (store.size > 5000) {
          for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
        }
        return entry;
      }
      existing.count += 1;
      return existing;
    },
  };
}

// ---- Redis backend (production) -------------------------------------------
// Activated automatically when Upstash env vars are present. Counters live
// under `rl:<key>` with a per-window TTL so they self-expire.
// NOTE: wired but not yet tested against a live Redis (no creds in dev).
function redisBackend(): RateLimitBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  const redis = Redis.fromEnv();
  return {
    async hit(key, windowSec) {
      const k = `rl:${key}`;
      const count = await redis.incr(k);
      if (count === 1) await redis.expire(k, windowSec);
      // Best-effort reset time; precise enough for Retry-After hints.
      const ttl = await redis.ttl(k);
      const resetAt = Date.now() + (ttl > 0 ? ttl : windowSec) * 1000;
      return { count, resetAt };
    },
  };
}

const useRedis =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const backend: RateLimitBackend = useRedis ? redisBackend() : memoryBackend();

/** Best-effort client IP from proxy headers (first hop of X-Forwarded-For). */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "anon";
}

/** Count one request against `key`; returns whether it's allowed. */
export async function rateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const { count, resetAt } = await backend.hit(key, opts.windowSec);
  return {
    allowed: count <= opts.limit,
    limit: opts.limit,
    remaining: Math.max(0, opts.limit - count),
    resetAt,
  };
}

/** Standard 429 response with rate-limit headers. */
export function tooManyRequests(r: RateLimitResult): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(r.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(r.resetAt / 1000)),
      },
    },
  );
}
