"use client";

import { STORES, runLocalDb } from "@/lib/localDb";

const STORE = STORES.recentDocs;
const MAX_ITEMS = 12;

export type RecentDoc = {
  id: string;
  name: string;
  type: string;
  size: number;
  bytes: ArrayBuffer;
  createdAt: number;
};

export type RecentDocSummary = Omit<RecentDoc, "bytes">;

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function allDocs(): Promise<RecentDoc[]> {
  try {
    return (await runLocalDb<RecentDoc[]>(STORE, "readonly", (s) => s.getAll())) ?? [];
  } catch {
    return [];
  }
}

export async function addRecentDoc(input: {
  name: string;
  type: string;
  bytes: Uint8Array;
}): Promise<void> {
  try {
    const doc: RecentDoc = {
      id: uid(),
      name: input.name,
      type: input.type,
      size: input.bytes.byteLength,
      bytes: input.bytes.buffer.slice(
        input.bytes.byteOffset,
        input.bytes.byteOffset + input.bytes.byteLength,
      ) as ArrayBuffer,
      createdAt: Date.now(),
    };

    await runLocalDb(STORE, "readwrite", (s) => s.put(doc, doc.id));

    const stale = (await allDocs())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(MAX_ITEMS)
      .map((d) => d.id);
    if (stale.length) {
      await Promise.all(stale.map((id) => runLocalDb(STORE, "readwrite", (s) => s.delete(id))));
    }
  } catch {
    /* best-effort local cache */
  }
}

export async function listRecentDocs(): Promise<RecentDocSummary[]> {
  const docs = await allDocs();
  return docs
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ bytes: _bytes, ...summary }) => summary);
}

export async function getRecentDoc(id: string): Promise<RecentDoc | null> {
  try {
    return (await runLocalDb<RecentDoc | undefined>(STORE, "readonly", (s) => s.get(id))) ?? null;
  } catch {
    return null;
  }
}

export async function deleteRecentDoc(id: string): Promise<void> {
  try {
    await runLocalDb(STORE, "readwrite", (s) => s.delete(id));
  } catch {
    /* best-effort */
  }
}

export async function clearRecentDocs(): Promise<void> {
  try {
    await runLocalDb(STORE, "readwrite", (s) => s.clear());
  } catch {
    /* best-effort */
  }
}
