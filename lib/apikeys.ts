/**
 * Developer API keys.
 *
 * Pluggable + async like the rest of lib/*: in-memory by default, Redis when
 * Upstash env vars are present (so keys survive restarts / span instances).
 * Keys look like `ds_live_<24 hex>`; only a SHA-256 hash is stored, never the
 * raw key (so a store leak can't be used to call the API).
 *
 * Production seam: once auth + Postgres exist, back this with an `api_keys`
 * table (owner, label, hashed_key, created_at, last_used, per-key limits) and
 * keep issue()/validate()/list() stable.
 */

import { createHash, randomBytes } from "crypto";

export type ApiKeyRecord = {
  id: string; // public id (prefix shown to the user)
  label: string;
  hash: string; // sha256(rawKey)
  createdAt: number;
  /** Per-key rate limit (requests per minute). */
  rpm: number;
};

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

interface ApiKeyBackend {
  put(rec: ApiKeyRecord): Promise<void>;
  getByHash(hash: string): Promise<ApiKeyRecord | null>;
  list(): Promise<ApiKeyRecord[]>;
}

// ---- In-memory backend (default) ------------------------------------------
function memoryBackend(): ApiKeyBackend {
  const byHash = new Map<string, ApiKeyRecord>();
  return {
    async put(rec) {
      byHash.set(rec.hash, rec);
    },
    async getByHash(hash) {
      return byHash.get(hash) ?? null;
    },
    async list() {
      return [...byHash.values()];
    },
  };
}

// ---- Redis backend (production) -------------------------------------------
// NOTE: wired but not tested against live Redis (no creds in dev).
function redisBackend(): ApiKeyBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  const redis = Redis.fromEnv();
  const SET = "apikeys:hashes";
  const k = (hash: string) => `apikey:${hash}`;
  return {
    async put(rec) {
      await redis.set(k(rec.hash), rec);
      await redis.sadd(SET, rec.hash);
    },
    async getByHash(hash) {
      return (await redis.get<ApiKeyRecord>(k(hash))) ?? null;
    },
    async list() {
      const hashes = await redis.smembers(SET);
      const recs = await Promise.all(hashes.map((h) => redis.get<ApiKeyRecord>(k(h))));
      return recs.filter((r): r is ApiKeyRecord => !!r);
    },
  };
}

const useRedis =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
const backend: ApiKeyBackend = useRedis ? redisBackend() : memoryBackend();

/** Issue a new key. Returns the raw key ONCE (never recoverable after). */
export async function issueKey(label: string, rpm = 60): Promise<{ key: string; id: string }> {
  const secret = randomBytes(24).toString("hex");
  const key = `ds_live_${secret}`;
  const id = `ds_live_${secret.slice(0, 6)}…`;
  await backend.put({ id, label: label.slice(0, 80), hash: hashKey(key), createdAt: Date.now(), rpm });
  return { key, id };
}

/** Validate a raw key from a request; returns the record or null. */
export async function validateKey(raw: string | null | undefined): Promise<ApiKeyRecord | null> {
  if (!raw) return null;
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw.trim();
  if (!token.startsWith("ds_live_")) return null;
  return backend.getByHash(hashKey(token));
}

/** List issued keys (metadata only — no raw keys). For an admin view. */
export async function listKeys(): Promise<ApiKeyRecord[]> {
  return backend.list();
}
