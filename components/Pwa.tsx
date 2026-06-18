"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ds-install-dismissed";

export default function Pwa() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  // Register the service worker (production only — avoids dev caching headaches).
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => {});
      if ("caches" in window) {
        caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter((key) => key.startsWith("docuscan-"))
                .map((key) => caches.delete(key)),
            ),
          )
          .catch(() => {});
      }
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // Capture the install prompt so we can trigger it from our own button.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferred) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDeferred(null);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg sm:left-auto sm:right-4">
      <div className="flex-1 text-sm">
        <p className="font-semibold text-ink">Install DocuScan</p>
        <p className="text-muted">Add it to your home screen for quick scanning.</p>
      </div>
      <button
        onClick={dismiss}
        className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:bg-slate-100"
      >
        Not now
      </button>
      <button
        onClick={install}
        className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600"
      >
        Install
      </button>
    </div>
  );
}
