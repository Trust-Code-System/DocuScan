"use client";

/**
 * /reminders — Document Reminders.
 *
 * Attach due dates to documents (renewals, expiries, signatures, invoice
 * follow-ups) with optional browser notifications. Everything is stored on the
 * device (lib/reminders.ts); notifications fire at most once per reminder.
 */

import { useEffect, useRef, useState } from "react";
import Select from "@/components/Select";
import { ACCEPT_ANY_DOC } from "@/lib/limits";
import {
  addReminder,
  deleteReminder,
  listReminders,
  dueStatus,
  daysUntil,
  checkDueReminders,
  requestNotificationPermission,
  REMINDER_TYPES,
  REMINDERS_EVENT,
  type Reminder,
  type ReminderType,
  type DueStatus,
} from "@/lib/reminders";

const STATUS_STYLE: Record<DueStatus, string> = {
  overdue: "bg-red-100 text-red-700",
  today: "bg-amber-100 text-amber-800",
  soon: "bg-yellow-100 text-yellow-800",
  upcoming: "bg-slate-100 text-slate-600",
};

function statusLabel(r: Reminder): string {
  const d = daysUntil(r.dueDate);
  if (Number.isNaN(d)) return "No date";
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `In ${d} days`;
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [title, setTitle] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [type, setType] = useState<ReminderType>("renewal");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notifyOn, setNotifyOn] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => setReminders(listReminders());
    refresh();
    window.addEventListener(REMINDERS_EVENT, refresh);
    if (typeof Notification !== "undefined") setNotifyOn(Notification.permission === "granted");
    checkDueReminders();
    return () => window.removeEventListener(REMINDERS_EVENT, refresh);
  }, []);

  function add() {
    setError(null);
    if (!title.trim()) {
      setError("Describe what to be reminded about.");
      return;
    }
    if (!dueDate) {
      setError("Pick a due date.");
      return;
    }
    addReminder({ title: title.trim(), documentName: documentName.trim(), type, dueDate });
    setTitle("");
    setDocumentName("");
    setDueDate("");
  }

  async function enableNotifications() {
    const ok = await requestNotificationPermission();
    setNotifyOn(ok);
    if (ok) checkDueReminders();
    else setError("Notifications were blocked. You can enable them in your browser settings.");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Document Reminders</h1>
      <p className="mt-1 text-muted">
        Never miss a renewal, expiry, signature or invoice follow-up. Reminders are saved on this
        device.
      </p>

      <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-ink">Reminder</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Renew business insurance"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Document (optional)</span>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_ANY_DOC}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setDocumentName(f.name);
              e.target.value = ""; // allow re-picking the same file
            }}
          />
          {documentName ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <span className="material-symbols-outlined text-[18px] text-brand-600" aria-hidden>
                description
              </span>
              <span className="min-w-0 flex-1 truncate text-ink">{documentName}</span>
              <button
                type="button"
                onClick={() => setDocumentName("")}
                aria-label="Remove document"
                className="shrink-0 text-slate-400 hover:text-red-600"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  close
                </span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="press flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-brand-500 hover:text-brand-600"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                upload_file
              </span>
              Choose document
            </button>
          )}
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Type</span>
          <Select
            ariaLabel="Reminder type"
            value={type}
            onChange={(v) => setType(v as ReminderType)}
            options={REMINDER_TYPES}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Due date</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </label>
        <div className="flex items-end">
          <button
            onClick={add}
            className="press w-full rounded-xl bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 sm:w-auto"
          >
            Add reminder
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!notifyOn && (
        <button
          onClick={enableNotifications}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 underline"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            notifications
          </span>
          Enable browser notifications
        </button>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink">Upcoming</h2>
        {reminders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-muted">
            No reminders yet. Add one above.
          </div>
        ) : (
          <ul className="space-y-2">
            {reminders.map((r) => {
              const status = dueStatus(r.dueDate);
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{r.title}</p>
                    <p className="truncate text-xs text-muted">
                      {REMINDER_TYPES.find((t) => t.value === r.type)?.label}
                      {r.documentName ? ` · ${r.documentName}` : ""} · {r.dueDate}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}>
                      {statusLabel(r)}
                    </span>
                    <button
                      onClick={() => deleteReminder(r.id)}
                      aria-label="Delete reminder"
                      className="text-slate-400 hover:text-red-600"
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden>
                        delete
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
