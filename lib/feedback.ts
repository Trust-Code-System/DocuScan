/**
 * Feedback collection ("What PDF feature do you need most?").
 *
 * Backend is pluggable and async, matching the rest of lib/*: in-memory by
 * default (kept for the life of the process — fine for dev / quick read-back),
 * Redis when Upstash env vars are present (durable, survives restarts).
 *
 * Production seam: when you add Postgres, implement a `dbBackend()` that inserts
 * into a `feedback` table and keep the save/recent signatures stable.
 */

export type FeedbackEntry = {
  /** Chosen option (from the popup) or free text. */
  message: string;
  /** Optional contact the user volunteered. */
  email?: string;
  /** Where in the app it was submitted from. */
  source?: string;
  createdAt: number;
};

const MAX_MESSAGE = 1000;
const MAX_KEEP = 1000; // cap retained entries per backend

interface FeedbackBackend {
  save(entry: FeedbackEntry): Promise<void>;
  recent(limit: number): Promise<FeedbackEntry[]>;
}

// ---- In-memory backend (default) ------------------------------------------
function memoryBackend(): FeedbackBackend {
  const items: FeedbackEntry[] = [];
  return {
    async save(entry) {
      items.unshift(entry);
      if (items.length > MAX_KEEP) items.length = MAX_KEEP;
    },
    async recent(limit) {
      return items.slice(0, limit);
    },
  };
}

// ---- Redis backend (production) -------------------------------------------
// Activated automatically when Upstash env vars are present. Entries are pushed
// onto a capped list `feedback:entries` (newest first).
// NOTE: wired but not yet tested against a live Redis (no creds in dev).
function redisBackend(): FeedbackBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  const redis = Redis.fromEnv();
  const KEY = "feedback:entries";
  return {
    async save(entry) {
      await redis.lpush(KEY, JSON.stringify(entry));
      await redis.ltrim(KEY, 0, MAX_KEEP - 1);
    },
    async recent(limit) {
      const raw = await redis.lrange<string>(KEY, 0, limit - 1);
      return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r));
    },
  };
}

const useRedis =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const backend: FeedbackBackend = useRedis ? redisBackend() : memoryBackend();

/** Validate + persist one feedback submission. Throws on invalid input. */
export async function saveFeedback(input: {
  message: unknown;
  email?: unknown;
  source?: unknown;
}): Promise<void> {
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) throw new Error("Message is required.");
  if (message.length > MAX_MESSAGE) throw new Error("Message is too long.");

  const email =
    typeof input.email === "string" && input.email.trim()
      ? input.email.trim().slice(0, 200)
      : undefined;
  const source =
    typeof input.source === "string" ? input.source.trim().slice(0, 100) : undefined;

  await backend.save({ message, email, source, createdAt: Date.now() });
}

/** Read recent submissions (for a future admin view). */
export async function recentFeedback(limit = 100): Promise<FeedbackEntry[]> {
  return backend.recent(limit);
}
