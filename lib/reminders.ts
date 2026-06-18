/**
 * Document Reminders — due dates / renewals attached to documents.
 *
 * Device-local (localStorage) reminders with optional browser notifications.
 * Pure date helpers (dueStatus / daysUntil) are DOM-free and Node-tested.
 * Notifications use the Notification API and fire at most once per reminder
 * (the `notified` flag prevents duplicates), comparing dates in the user's
 * local timezone.
 */

const KEY = "ds-reminders";
export const REMINDERS_EVENT = "ds-reminders-change";

export type ReminderType =
  | "renewal"
  | "expiry"
  | "signature"
  | "invoice"
  | "submission"
  | "other";

export interface Reminder {
  id: string;
  title: string;
  documentName: string;
  type: ReminderType;
  dueDate: string; // YYYY-MM-DD
  notified: boolean;
  createdAt: number;
}

export type DueStatus = "overdue" | "today" | "soon" | "upcoming";

export const REMINDER_TYPES: { value: ReminderType; label: string }[] = [
  { value: "renewal", label: "Renewal" },
  { value: "expiry", label: "Expiry" },
  { value: "signature", label: "Signature" },
  { value: "invoice", label: "Invoice follow-up" },
  { value: "submission", label: "Submission" },
  { value: "other", label: "Other" },
];

// ---- pure date helpers (Node-tested) --------------------------------------

/** Whole days from `now` until `dueDate` (local midnight to local midnight). */
export function daysUntil(dueDate: string, now: Date = new Date()): number {
  const [y, m, d] = dueDate.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  const due = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((due - today) / 86_400_000);
}

export function dueStatus(dueDate: string, now: Date = new Date()): DueStatus {
  const days = daysUntil(dueDate, now);
  if (Number.isNaN(days)) return "upcoming";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "upcoming";
}

// ---- storage ---------------------------------------------------------------

function makeId(): string {
  return (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
}

function read(): Reminder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Reminder[]) : [];
  } catch {
    return [];
  }
}

function write(list: Reminder[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(REMINDERS_EVENT));
  } catch {
    /* best effort */
  }
}

/** Sorted soonest-due first. */
export function listReminders(): Reminder[] {
  return read().sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function addReminder(
  input: Pick<Reminder, "title" | "documentName" | "type" | "dueDate">,
): Reminder {
  const created: Reminder = { ...input, id: makeId(), notified: false, createdAt: Date.now() };
  write([...read(), created]);
  return created;
}

export function deleteReminder(id: string): void {
  write(read().filter((r) => r.id !== id));
}

// ---- notifications ---------------------------------------------------------

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

/**
 * Fire a notification for every due (today/overdue) reminder that hasn't been
 * notified yet, then mark them notified so they never fire twice. Returns the
 * number of notifications shown.
 */
export function checkDueReminders(now: Date = new Date()): number {
  if (typeof window === "undefined" || !("Notification" in window)) return 0;
  if (Notification.permission !== "granted") return 0;
  const list = read();
  let shown = 0;
  let changed = false;
  for (const r of list) {
    const status = dueStatus(r.dueDate, now);
    if (!r.notified && (status === "today" || status === "overdue")) {
      try {
        new Notification("DocuScan reminder", {
          body: `${r.title}${r.documentName ? ` · ${r.documentName}` : ""}`,
        });
        r.notified = true;
        changed = true;
        shown++;
      } catch {
        /* ignore notification failures */
      }
    }
  }
  if (changed) write(list);
  return shown;
}
