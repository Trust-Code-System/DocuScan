/**
 * Secure share links.
 *
 * Backend is pluggable and async. Default keeps PDF bytes in memory with a
 * TTL (matches the privacy promise that guest files auto-delete). Each link
 * carries metadata — optional password, an optional download limit + counter,
 * and a revoke flag — alongside the bytes. A per-link `manageToken` (returned
 * once at creation) is the only credential that can revoke or inspect a link,
 * so management works without user accounts.
 *
 * Production seam: `objectStoreBackend()` PUTs bytes into private object
 * storage (Cloudflare R2 / S3) under `id` with the metadata attached; the API
 * route still proxies the download so the bucket stays fully private. The
 * create/download/revoke signatures stay stable so callers never change.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const TTL_MS = 60 * 60 * 1000; // 1 hour (default, temporary links)
export const PUBLIC_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (public links)

/** Per-link metadata (everything except the PDF bytes). */
export type ShareMeta = {
  fileName: string;
  createdAt: number;
  expiresAt: number;
  /** Secret returned once at creation; required to revoke / inspect the link. */
  manageToken: string;
  /** scrypt salt + hash, present only on password-protected links. */
  passwordSalt?: string;
  passwordHash?: string;
  /** Undefined = unlimited downloads. */
  maxDownloads?: number;
  downloads: number;
  revoked?: boolean;
};

export type ShareEntry = ShareMeta & { bytes: Buffer };

/** Owner-facing status (no secrets, no bytes). */
export type ShareStatus = {
  id: string;
  fileName: string;
  createdAt: number;
  expiresAt: number;
  downloads: number;
  maxDownloads: number | null;
  revoked: boolean;
  passwordProtected: boolean;
};

export type DownloadResult =
  | { ok: true; bytes: Buffer; fileName: string; remaining: number | null }
  | {
      ok: false;
      reason:
        | "not-found"
        | "revoked"
        | "limit-reached"
        | "password-required"
        | "bad-password";
    };

interface ShareBackend {
  put(id: string, entry: ShareEntry): Promise<void>;
  /** Full entry (metadata + bytes), or null if missing/expired. */
  get(id: string): Promise<ShareEntry | null>;
  /** Metadata only (cheap — avoids transferring bytes), or null. */
  head(id: string): Promise<ShareMeta | null>;
  /** Read-modify-write the metadata atomically; returns the new metadata. */
  update(
    id: string,
    mutate: (m: ShareMeta) => ShareMeta,
  ): Promise<ShareMeta | null>;
  /** Delete all expired entries; returns how many were removed. */
  purgeExpired(): Promise<number>;
}

// ---- Password + token helpers ---------------------------------------------
function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex");
}

function verifyPassword(password: string, meta: ShareMeta): boolean {
  if (!meta.passwordHash || !meta.passwordSalt) return false;
  const candidate = scryptSync(password, meta.passwordSalt, 32);
  const stored = Buffer.from(meta.passwordHash, "hex");
  return (
    candidate.length === stored.length && timingSafeEqual(candidate, stored)
  );
}

/** Constant-time string compare for the manage token. */
function tokenMatches(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// ---- In-memory backend (default) ------------------------------------------
function memoryBackend(): ShareBackend {
  const store = new Map<string, ShareEntry>();
  const sweep = () => {
    const now = Date.now();
    for (const [id, e] of store) if (e.expiresAt <= now) store.delete(id);
  };
  // Live read: sweeps, drops the entry if expired, returns it or null.
  const live = (id: string): ShareEntry | null => {
    sweep();
    const e = store.get(id);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) {
      store.delete(id);
      return null;
    }
    return e;
  };
  return {
    async put(id, entry) {
      sweep();
      store.set(id, entry);
    },
    async get(id) {
      return live(id);
    },
    async head(id) {
      const e = live(id);
      if (!e) return null;
      const { bytes: _bytes, ...meta } = e;
      return meta;
    },
    // Atomic for the in-memory backend: no await between read and write, so
    // the JS event loop can't interleave two downloads of the same link.
    async update(id, mutate) {
      const e = live(id);
      if (!e) return null;
      const { bytes, ...meta } = e;
      const next = mutate(meta);
      store.set(id, { ...next, bytes });
      return next;
    },
    async purgeExpired() {
      const before = store.size;
      sweep();
      return before - store.size;
    },
  };
}

// ---- Object-storage backend (production: Cloudflare R2 / S3) --------------
// Activated automatically when S3 env vars are present. Stores bytes under
// `shares/<id>.pdf` with the metadata JSON base64-packed into a single user
// metadata field (`meta`). Metadata-only mutations (the download counter, the
// revoke flag) use CopyObject with MetadataDirective=REPLACE, so bumping a
// counter never re-uploads the PDF bytes.
//
// NOTE: wired but not yet tested against live storage (no creds in dev). The
// read-modify-write in `update` is NOT atomic across concurrent requests —
// two simultaneous downloads could both pass a maxDownloads check (a small
// over-count, never an under-count). For strict limits, front this with a
// transactional metadata store (the `share_links` row described above). A
// bucket lifecycle rule (hard-delete after ~1 day) should remain the primary
// storage-reclaim mechanism; `purgeExpired` is a belt-and-braces backup.
function objectStoreBackend(): ShareBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const s3mod = require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");
  const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
  } = s3mod;

  const Bucket = process.env.S3_BUCKET!;
  const client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  const keyFor = (id: string) => `shares/${id}.pdf`;
  const encodeMeta = (m: ShareMeta) =>
    Buffer.from(JSON.stringify(m)).toString("base64");
  const decodeMeta = (raw: string | undefined): ShareMeta | null => {
    if (!raw) return null;
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    } catch {
      return null;
    }
  };
  const notExpired = (m: ShareMeta | null): ShareMeta | null =>
    m && m.expiresAt > Date.now() ? m : null;

  async function head(id: string): Promise<ShareMeta | null> {
    try {
      const res = await client.send(
        new HeadObjectCommand({ Bucket, Key: keyFor(id) }),
      );
      return notExpired(decodeMeta(res.Metadata?.meta));
    } catch {
      return null;
    }
  }

  return {
    async put(id, entry) {
      const { bytes, ...meta } = entry;
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: keyFor(id),
          Body: bytes,
          ContentType: "application/pdf",
          Metadata: { meta: encodeMeta(meta) },
        }),
      );
    },
    async get(id) {
      try {
        const res = await client.send(
          new GetObjectCommand({ Bucket, Key: keyFor(id) }),
        );
        const meta = notExpired(decodeMeta(res.Metadata?.meta));
        if (!meta) return null;
        const bytes = Buffer.from(await res.Body!.transformToByteArray());
        return { ...meta, bytes };
      } catch {
        return null; // NoSuchKey / expired / unreachable
      }
    },
    head,
    async update(id, mutate) {
      const meta = await head(id);
      if (!meta) return null;
      const next = mutate(meta);
      const key = keyFor(id);
      await client.send(
        new CopyObjectCommand({
          Bucket,
          Key: key,
          CopySource: `${Bucket}/${key}`,
          MetadataDirective: "REPLACE",
          ContentType: "application/pdf",
          Metadata: { meta: encodeMeta(next) },
        }),
      );
      return next;
    },
    async purgeExpired() {
      const now = Date.now();
      let removed = 0;
      let ContinuationToken: string | undefined;
      do {
        const list = await client.send(
          new ListObjectsV2Command({ Bucket, Prefix: "shares/", ContinuationToken }),
        );
        for (const obj of list.Contents ?? []) {
          if (!obj.Key) continue;
          const headRes = await client.send(
            new HeadObjectCommand({ Bucket, Key: obj.Key }),
          );
          const meta = decodeMeta(headRes.Metadata?.meta);
          if (meta && meta.expiresAt <= now) {
            await client.send(new DeleteObjectCommand({ Bucket, Key: obj.Key }));
            removed++;
          }
        }
        ContinuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
      } while (ContinuationToken);
      return removed;
    },
  };
}

// ---- Redis backend (Upstash) ----------------------------------------------
// Activated when Upstash env vars are present and S3 is NOT (S3/R2 takes
// precedence for large files). Unlike the in-memory backend, Redis survives
// serverless cold starts and is shared across instances — the minimum needed
// for share links to work reliably on a platform like Vercel. Each link's
// metadata and bytes are stored under a per-link key with a PX TTL equal to
// the link's lifetime, so Redis auto-reclaims them (no cron needed).
//
// SIZE NOTE: the Upstash REST API caps request size (≈1 MB free / ≈10 MB paid).
// That comfortably covers typical scanned documents, but for larger PDFs near
// the 20 MB guest cap, configure S3/R2 (which takes precedence) — a big blob
// belongs in object storage, not Redis. The read-modify-write in `update` is
// last-write-wins (not transactional); the download counter can therefore
// over-count by one under truly simultaneous requests, never under-count.
function redisBackend(): ShareBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  const redis = Redis.fromEnv();
  const metaKey = (id: string) => `share:${id}`;
  const bytesKey = (id: string) => `share:${id}:b`;
  const pxFor = (m: ShareMeta) => Math.max(1, m.expiresAt - Date.now());

  async function head(id: string): Promise<ShareMeta | null> {
    const meta = await redis.get<ShareMeta>(metaKey(id));
    if (!meta) return null;
    return meta.expiresAt > Date.now() ? meta : null;
  }

  return {
    async put(id, entry) {
      const { bytes, ...meta } = entry;
      const px = pxFor(meta);
      await redis.set(metaKey(id), meta, { px });
      await redis.set(bytesKey(id), bytes.toString("base64"), { px });
    },
    async get(id) {
      const meta = await head(id);
      if (!meta) return null;
      const b64 = await redis.get<string>(bytesKey(id));
      if (!b64) return null;
      return { ...meta, bytes: Buffer.from(b64, "base64") };
    },
    head,
    async update(id, mutate) {
      const meta = await head(id);
      if (!meta) return null;
      const next = mutate(meta);
      await redis.set(metaKey(id), next, { px: pxFor(next) });
      return next;
    },
    // TTLs reclaim expired links automatically; nothing to sweep.
    async purgeExpired() {
      return 0;
    },
  };
}

const useObjectStore =
  !!process.env.S3_BUCKET &&
  !!process.env.S3_ACCESS_KEY_ID &&
  !!process.env.S3_SECRET_ACCESS_KEY;

const useRedis =
  !useObjectStore &&
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const backend: ShareBackend = useObjectStore
  ? objectStoreBackend()
  : useRedis
    ? redisBackend()
    : memoryBackend();

export type CreateOptions = {
  ttlMs?: number;
  /** Optional viewing password (hashed with scrypt; never stored in clear). */
  password?: string;
  /** Optional cap on how many times the link can be downloaded. */
  maxDownloads?: number;
};

export async function create(
  bytes: Buffer,
  fileName: string,
  opts: CreateOptions = {},
): Promise<{ id: string; expiresAt: number; manageToken: string }> {
  const id = randomBytes(9).toString("base64url");
  const manageToken = randomBytes(18).toString("base64url");
  const now = Date.now();
  const expiresAt = now + (opts.ttlMs ?? TTL_MS);
  const meta: ShareMeta = {
    fileName,
    createdAt: now,
    expiresAt,
    manageToken,
    downloads: 0,
  };
  if (opts.password) {
    const salt = randomBytes(16).toString("hex");
    meta.passwordSalt = salt;
    meta.passwordHash = hashPassword(opts.password, salt);
  }
  if (opts.maxDownloads != null) meta.maxDownloads = opts.maxDownloads;
  await backend.put(id, { ...meta, bytes });
  return { id, expiresAt, manageToken };
}

/**
 * Attempt a download. Enforces revoke, password and the download limit, and
 * (on success) atomically increments the counter before returning the bytes.
 */
export async function download(
  id: string,
  password?: string,
): Promise<DownloadResult> {
  const meta = await backend.head(id);
  if (!meta) return { ok: false, reason: "not-found" };
  if (meta.revoked) return { ok: false, reason: "revoked" };
  if (meta.passwordHash) {
    if (!password) return { ok: false, reason: "password-required" };
    if (!verifyPassword(password, meta)) return { ok: false, reason: "bad-password" };
  }
  if (meta.maxDownloads != null && meta.downloads >= meta.maxDownloads)
    return { ok: false, reason: "limit-reached" };

  // Reserve a download slot. The mutator re-checks under the (memory-backend)
  // atomic update so a limit can't be exceeded by interleaved requests.
  let reserved = false;
  await backend.update(id, (m) => {
    if (m.revoked) return m;
    if (m.maxDownloads != null && m.downloads >= m.maxDownloads) return m;
    reserved = true;
    return { ...m, downloads: m.downloads + 1 };
  });
  if (!reserved) {
    const after = await backend.head(id);
    if (after?.revoked) return { ok: false, reason: "revoked" };
    return { ok: false, reason: "limit-reached" };
  }

  const entry = await backend.get(id);
  if (!entry) return { ok: false, reason: "not-found" };
  const remaining =
    entry.maxDownloads != null
      ? Math.max(0, entry.maxDownloads - entry.downloads)
      : null;
  return { ok: true, bytes: entry.bytes, fileName: entry.fileName, remaining };
}

/** Revoke a link. Requires the manage token returned at creation. */
export async function revoke(
  id: string,
  manageToken: string,
): Promise<{ ok: boolean; reason?: "not-found" | "forbidden" }> {
  const meta = await backend.head(id);
  if (!meta) return { ok: false, reason: "not-found" };
  if (!manageToken || !tokenMatches(meta.manageToken, manageToken))
    return { ok: false, reason: "forbidden" };
  await backend.update(id, (m) => ({ ...m, revoked: true }));
  return { ok: true };
}

/** Owner-facing link status. Returns null if missing or token mismatch. */
export async function getStatus(
  id: string,
  manageToken: string,
): Promise<ShareStatus | null> {
  const meta = await backend.head(id);
  if (!meta) return null;
  if (!manageToken || !tokenMatches(meta.manageToken, manageToken)) return null;
  return {
    id,
    fileName: meta.fileName,
    createdAt: meta.createdAt,
    expiresAt: meta.expiresAt,
    downloads: meta.downloads,
    maxDownloads: meta.maxDownloads ?? null,
    revoked: !!meta.revoked,
    passwordProtected: !!meta.passwordHash,
  };
}

/**
 * Read metadata + bytes without enforcing password/limit or incrementing the
 * counter. Retained for the simple callers (and tests) that only need bytes.
 */
export async function get(id: string): Promise<ShareEntry | null> {
  return backend.get(id);
}

/** Delete all expired share entries. Returns the count removed. */
export async function purgeExpired(): Promise<number> {
  return backend.purgeExpired();
}
