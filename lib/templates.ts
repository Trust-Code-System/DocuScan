/**
 * Saved Text Templates — reusable document text (signature blocks, letter
 * templates, invoice notes, message snippets) with `{variable}` placeholders.
 *
 * Storage is device-local (localStorage), consistent with the app's no-account
 * model. The pure helpers (variable parsing/filling) are DOM-free and
 * Node-tested (scripts/test-templates.mjs); the CRUD layer is a thin wrapper so
 * the backend can later be swapped for an authenticated API without touching
 * the UI (same seam as lib/usage.ts).
 */

const KEY = "ds-templates";
export const TEMPLATES_EVENT = "ds-templates-change";

export interface TextTemplate {
  id: string;
  title: string;
  body: string;
  tags: string[];
  updatedAt: number;
}

// ---- pure helpers (Node-tested) -------------------------------------------

/** Variable names referenced in a body as `{name}`, de-duplicated, in order. */
export function extractVariables(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.matchAll(/\{([a-zA-Z0-9_ -]{1,40})\}/g)) {
    const name = m[1].trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** Replace `{name}` with the supplied value; unknown vars are left untouched. */
export function fillTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{([a-zA-Z0-9_ -]{1,40})\}/g, (full, raw) => {
    const key = String(raw).trim();
    const v = values[key];
    return v !== undefined && v !== "" ? v : full;
  });
}

/** Free-text search across title, body and tags. */
export function matchesQuery(t: TextTemplate, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    t.title.toLowerCase().includes(q) ||
    t.body.toLowerCase().includes(q) ||
    t.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

export function normalizeTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

// ---- storage layer ---------------------------------------------------------

function read(): TextTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TextTemplate[]) : [];
  } catch {
    return [];
  }
}

function write(list: TextTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(TEMPLATES_EVENT));
  } catch {
    /* quota / private mode — best effort */
  }
}

export function listTemplates(): TextTemplate[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveTemplate(
  input: { id?: string; title: string; body: string; tags: string[] },
): TextTemplate {
  const list = read();
  const now = Date.now();
  if (input.id) {
    const idx = list.findIndex((t) => t.id === input.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], title: input.title, body: input.body, tags: input.tags, updatedAt: now };
      write(list);
      return list[idx];
    }
  }
  const created: TextTemplate = {
    id: (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) || String(now),
    title: input.title,
    body: input.body,
    tags: input.tags,
    updatedAt: now,
  };
  write([created, ...list]);
  return created;
}

export function deleteTemplate(id: string): void {
  write(read().filter((t) => t.id !== id));
}
