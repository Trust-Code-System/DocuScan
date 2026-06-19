"use client";

import type { CompressLevel } from "@/lib/compress";
import { STORES, runLocalDb } from "@/lib/localDb";

const STORE = STORES.batchSession;
const KEY = "current";

export type StoredBatchItem = {
  name: string;
  type: string;
  bytes: ArrayBuffer;
  status: "queued" | "done" | "error";
  outSize?: number;
};

export type StoredBatchSession = {
  items: StoredBatchItem[];
  level: CompressLevel;
  zip?: {
    name: string;
    type: string;
    bytes: ArrayBuffer;
  };
  ts: number;
};

export async function saveBatchSession(
  session: Omit<StoredBatchSession, "ts">,
): Promise<void> {
  try {
    await runLocalDb(STORE, "readwrite", (s) =>
      s.put({ ...session, ts: Date.now() } satisfies StoredBatchSession, KEY),
    );
  } catch {
    /* best-effort local recovery */
  }
}

export async function loadBatchSession(): Promise<StoredBatchSession | null> {
  try {
    return (
      (await runLocalDb<StoredBatchSession | undefined>(STORE, "readonly", (s) =>
        s.get(KEY),
      )) ?? null
    );
  } catch {
    return null;
  }
}

export async function clearBatchSession(): Promise<void> {
  try {
    await runLocalDb(STORE, "readwrite", (s) => s.delete(KEY));
  } catch {
    /* best-effort */
  }
}

export function storedItemToFile(item: StoredBatchItem): File {
  return new File([item.bytes.slice(0)], item.name, {
    type: item.type || "application/pdf",
  });
}

export async function fileToStoredBatchItem(
  file: File,
  status: StoredBatchItem["status"],
  outSize?: number,
): Promise<StoredBatchItem> {
  return {
    name: file.name,
    type: file.type || "application/pdf",
    bytes: await file.arrayBuffer(),
    status,
    outSize,
  };
}
