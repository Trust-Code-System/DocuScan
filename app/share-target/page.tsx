"use client";

/**
 * /share-target — landing page for the PWA share target (C1).
 *
 * The service worker has already stashed the shared file in a Cache and
 * redirected here. We pull it out, move it into IndexedDB (so it survives the
 * next navigation), and hand off to /edit. Needs an installed PWA + HTTPS +
 * service worker — flag for real-device QA.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { putSharedFile } from "@/lib/sharedFile";

export default function ShareTargetPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/__shared-file");
        if (!res.ok) {
          setError("No shared file was received. Try sharing again, or open a tool directly.");
          return;
        }
        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get("X-Filename") || "shared.pdf");
        await putSharedFile(blob, name);
        router.replace("/edit?shared=1");
      } catch {
        setError("Couldn't read the shared file.");
      }
    })();
  }, [router]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-bold">Receiving your file…</h1>
      {error ? (
        <>
          <p className="mt-3 text-sm text-red-600">{error}</p>
          <a href="/" className="mt-4 inline-block text-sm font-medium text-brand-600 underline">
            Go to DocuScan
          </a>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">Opening it in the editor…</p>
      )}
    </div>
  );
}
