/**
 * Local-only persistence for the document you're actively working on, so a
 * page reload doesn't throw your work away. Everything is stored in the
 * browser's IndexedDB and never leaves the device — consistent with the app's
 * privacy-first model. The file bytes and the (small) edit state are stored
 * under separate keys so frequent edit-autosaves don't rewrite the whole file.
 */

import { STORES, runLocalDb } from "@/lib/localDb";

const STORE = STORES.workingDoc;
const KEY_DOC = "doc";
const KEY_STATE = "state";

export interface StoredDoc {
  name: string;
  type: string;
  bytes: ArrayBuffer;
  ts: number;
}

export interface StoredState {
  models: unknown; // serialized per-page edit model (PageModel[])
  pageIndex: number;
  ts: number;
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return runLocalDb(STORE, mode, fn);
}

/** Persist the file bytes + metadata. Called once when a document is opened. */
export async function saveWorkingDoc(doc: Omit<StoredDoc, "ts">): Promise<void> {
  try {
    await run("readwrite", (s) => s.put({ ...doc, ts: Date.now() }, KEY_DOC));
  } catch {
    /* best-effort — storage may be unavailable (private mode, quota, etc.) */
  }
}

/** Persist the lightweight edit state. Called (debounced) as edits change. */
export async function saveWorkingState(state: Omit<StoredState, "ts">): Promise<void> {
  try {
    await run("readwrite", (s) => s.put({ ...state, ts: Date.now() }, KEY_STATE));
  } catch {
    /* best-effort */
  }
}

export async function loadWorkingDoc(): Promise<StoredDoc | null> {
  try {
    return (await run<StoredDoc | undefined>("readonly", (s) => s.get(KEY_DOC))) ?? null;
  } catch {
    return null;
  }
}

export async function loadWorkingState(): Promise<StoredState | null> {
  try {
    return (await run<StoredState | undefined>("readonly", (s) => s.get(KEY_STATE))) ?? null;
  } catch {
    return null;
  }
}

/** Forget the stored document (e.g. when the user explicitly clears it). */
export async function clearWorkingDoc(): Promise<void> {
  try {
    await run("readwrite", (s) => {
      s.delete(KEY_DOC);
      return s.delete(KEY_STATE);
    });
  } catch {
    /* best-effort */
  }
}
