/**
 * Node test for lib/share.ts secure share-link logic (memory backend, no DOM).
 * Run: node --experimental-strip-types scripts/test-share.mjs
 *
 * Exercises: create + manage token, plain download + counter, password gate,
 * download limit enforcement, revoke (auth + effect), expiry, owner status.
 */
import assert from "node:assert";
import {
  create,
  download,
  revoke,
  getStatus,
  get,
} from "../lib/share.ts";

let passed = 0;
const ok = (name) => {
  passed++;
  console.log("  ✓ " + name);
};

const PDF = Buffer.from("%PDF-1.4 fake test bytes");

// --- basic create + download + counter ---
{
  const { id, manageToken, expiresAt } = await create(PDF, "doc.pdf");
  assert.ok(id && typeof id === "string", "returns an id");
  assert.ok(manageToken && manageToken.length >= 16, "returns a manage token");
  assert.ok(expiresAt > Date.now(), "expiresAt in the future");

  const r1 = await download(id);
  assert.ok(r1.ok, "first download succeeds");
  assert.strictEqual(r1.fileName, "doc.pdf");
  assert.ok(Buffer.from(r1.bytes).equals(PDF), "returns the original bytes");
  assert.strictEqual(r1.remaining, null, "unlimited link has null remaining");

  const status = await getStatus(id, manageToken);
  assert.strictEqual(status.downloads, 1, "counter incremented to 1");
  assert.strictEqual(status.maxDownloads, null);
  assert.strictEqual(status.revoked, false);
  assert.strictEqual(status.passwordProtected, false);
  ok("create → download serves bytes and increments the counter");
}

// --- password protection ---
{
  const { id } = await create(PDF, "secret.pdf", { password: "hunter2" });

  const noPw = await download(id);
  assert.deepStrictEqual(noPw, { ok: false, reason: "password-required" });

  const wrong = await download(id, "nope");
  assert.deepStrictEqual(wrong, { ok: false, reason: "bad-password" });

  const right = await download(id, "hunter2");
  assert.ok(right.ok, "correct password unlocks");

  // A wrong password must not have consumed a download slot.
  ok("password gate: requires, rejects wrong, accepts correct");
}

// --- download limit + counter ---
{
  const { id, manageToken } = await create(PDF, "limited.pdf", { maxDownloads: 2 });

  const a = await download(id);
  assert.ok(a.ok && a.remaining === 1, "1 remaining after first");
  const b = await download(id);
  assert.ok(b.ok && b.remaining === 0, "0 remaining after second");
  const c = await download(id);
  assert.deepStrictEqual(c, { ok: false, reason: "limit-reached" });

  const status = await getStatus(id, manageToken);
  assert.strictEqual(status.downloads, 2, "counter capped at the limit");
  ok("download limit enforced and counter stops at the cap");
}

// --- password failures do not consume the limit ---
{
  const { id } = await create(PDF, "both.pdf", {
    password: "pw",
    maxDownloads: 1,
  });
  await download(id, "wrong"); // bad-password, must not count
  await download(id); // password-required, must not count
  const good = await download(id, "pw");
  assert.ok(good.ok && good.remaining === 0, "the one real download still available");
  const after = await download(id, "pw");
  assert.deepStrictEqual(after, { ok: false, reason: "limit-reached" });
  ok("failed/locked attempts never decrement the download limit");
}

// --- revoke (auth + effect) ---
{
  const { id, manageToken } = await create(PDF, "revoke.pdf");

  const badToken = await revoke(id, "not-the-token");
  assert.deepStrictEqual(badToken, { ok: false, reason: "forbidden" });

  const missing = await revoke("nonexistent-id", manageToken);
  assert.deepStrictEqual(missing, { ok: false, reason: "not-found" });

  const good = await revoke(id, manageToken);
  assert.deepStrictEqual(good, { ok: true });

  const after = await download(id);
  assert.deepStrictEqual(after, { ok: false, reason: "revoked" });

  const status = await getStatus(id, manageToken);
  assert.strictEqual(status.revoked, true, "status reflects revocation");
  ok("revoke requires the manage token and disables the link");
}

// --- expiry ---
{
  const { id } = await create(PDF, "expired.pdf", { ttlMs: -1000 });
  const r = await download(id);
  assert.deepStrictEqual(r, { ok: false, reason: "not-found" });
  const raw = await get(id);
  assert.strictEqual(raw, null, "expired entry not retrievable");
  ok("expired link reads as not-found");
}

// --- getStatus auth ---
{
  const { id, manageToken } = await create(PDF, "status.pdf");
  assert.strictEqual(await getStatus(id, "wrong"), null, "wrong token → null");
  assert.strictEqual(await getStatus("missing", manageToken), null, "missing → null");
  assert.ok(await getStatus(id, manageToken), "right token → status");
  ok("getStatus is gated by the manage token");
}

console.log(`\n${passed} share tests passed.`);
