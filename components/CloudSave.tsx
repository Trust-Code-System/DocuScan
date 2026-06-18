"use client";

/**
 * Save a (public) share link to cloud storage.
 *
 *  - **Dropbox**: fully functional with just NEXT_PUBLIC_DROPBOX_APP_KEY via the
 *    Dropbox "Saver" drop-in (no server OAuth needed) — it saves the public URL
 *    straight to the user's Dropbox.
 *  - **Google Drive**: Drive has no equivalent keyless drop-in saver, so this is
 *    an env-gated seam (NEXT_PUBLIC_GOOGLE_CLIENT_ID). Wiring the OAuth + Drive
 *    upload flow is the remaining work; until then the button explains itself.
 *
 * Only shown for public links (Dropbox Saver requires a publicly-fetchable URL).
 */

import { useEffect, useState } from "react";

const DROPBOX_KEY = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY;
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    Dropbox?: {
      save: (
        url: string,
        filename: string,
        opts?: { success?: () => void; error?: (e: unknown) => void },
      ) => void;
    };
  }
}

export default function CloudSave({ url, fileName }: { url: string; fileName: string }) {
  const [dropboxReady, setDropboxReady] = useState(false);

  useEffect(() => {
    if (!DROPBOX_KEY || window.Dropbox) {
      setDropboxReady(!!window.Dropbox);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://www.dropbox.com/static/api/2/dropins.js";
    s.id = "dropboxjs";
    s.dataset.appKey = DROPBOX_KEY;
    s.onload = () => setDropboxReady(true);
    document.body.appendChild(s);
  }, []);

  if (!DROPBOX_KEY && !GOOGLE_CLIENT_ID) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {DROPBOX_KEY && (
        <button
          type="button"
          disabled={!dropboxReady}
          onClick={() => window.Dropbox?.save(url, fileName)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50"
        >
          Save to Dropbox
        </button>
      )}
      {GOOGLE_CLIENT_ID && (
        <button
          type="button"
          onClick={() =>
            alert(
              "Google Drive save needs the OAuth + Drive upload flow wired up (seam ready). For now, download the file and upload it to Drive.",
            )
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50"
        >
          Save to Google Drive
        </button>
      )}
    </div>
  );
}
