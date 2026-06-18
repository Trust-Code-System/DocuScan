"use client";

/**
 * Tiny IndexedDB stash for a file received via the PWA share target (C1).
 *
 * The service worker catches the OS share POST, parks the file in a Cache, and
 * redirects to /share-target. That landing page pulls the file out and stores it
 * here so a tool route (e.g. /edit?shared=1) can pick it up after navigation
 * (a Blob can't ride in a query string or sessionStorage).
 */

import { STORES, openLocalDb } from "@/lib/localDb";

const STORE = STORES.shared;
const KEY = "file";

type Stashed = { blob: Blob; name: string };

export async function putSharedFile(blob: Blob, name: string): Promise<void> {
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ blob, name } satisfies Stashed, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Read and clear the stashed file (one-shot handoff). */
export async function takeSharedFile(): Promise<File | null> {
  const db = await openLocalDb();
  const data = await new Promise<Stashed | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const get = tx.objectStore(STORE).get(KEY);
    get.onsuccess = () => {
      tx.objectStore(STORE).delete(KEY);
      resolve(get.result as Stashed | undefined);
    };
    get.onerror = () => reject(get.error);
  });
  db.close();
  if (!data) return null;
  return new File([data.blob], data.name || "shared.pdf", {
    type: data.blob.type || "application/pdf",
  });
}
