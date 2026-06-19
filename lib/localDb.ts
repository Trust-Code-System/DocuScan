"use client";

const DB_NAME = "docuscan";
const DB_VERSION = 4;

export const STORES = {
  shared: "shared",
  workingDoc: "working-doc",
  recentDocs: "recent-docs",
  batchSession: "batch-session",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

function ensureStore(db: IDBDatabase, name: StoreName) {
  if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
}

export function openLocalDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      ensureStore(db, STORES.shared);
      ensureStore(db, STORES.workingDoc);
      ensureStore(db, STORES.recentDocs);
      ensureStore(db, STORES.batchSession);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function runLocalDb<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openLocalDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const req = fn(tx.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => db.close();
      }),
  );
}
