/* DocuScan service worker.
 * Strategy:
 *  - Never touch non-GET or /api/* (uploads, usage, share must hit network).
 *  - Static build assets (/_next/static, icons): cache-first (immutable).
 *  - Navigations: network-first, fall back to cached shell when offline.
 * Bump CACHE on changes to invalidate old entries.
 */
const CACHE = "docuscan-v4";
const SHARE_CACHE = "docuscan-share";
const SHELL = [
  "/",
  "/image-to-pdf",
  "/recents",
  "/merge-pdf",
  "/compress-pdf",
  "/split-pdf",
  "/edit",
  "/share-target",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
        caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // PWA share target: stash the shared file, then redirect to the landing page,
  // which hands it off to /edit. Must run before the non-GET guard below.
  if (request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        try {
          const form = await request.formData();
          const file = form.get("file");
          if (file && typeof file !== "string" && file.size) {
            const cache = await caches.open(SHARE_CACHE);
            await cache.put(
              "/__shared-file",
              new Response(file, {
                headers: {
                  "Content-Type": file.type || "application/pdf",
                  "X-Filename": encodeURIComponent(file.name || "shared.pdf"),
                },
              }),
            );
          }
        } catch {
          /* fall through to the landing page, which will show an error */
        }
        return Response.redirect("/share-target", 303);
      })(),
    );
    return;
  }

  // Serve the stashed shared file to the landing page.
  if (request.method === "GET" && url.pathname === "/__shared-file") {
    event.respondWith(
      caches
        .open(SHARE_CACHE)
        .then((c) => c.match("/__shared-file"))
        .then((hit) => hit || new Response("", { status: 404 })),
    );
    return;
  }

  if (request.method !== "GET") return;

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Local development must always hit the dev server. A previously installed
  // worker can otherwise serve stale Webpack chunks and trigger runtime errors.
  if (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]"
  ) {
    return;
  }

  // Cache-first for immutable static assets.
  if (url.pathname.startsWith("/_next/static") || url.pathname === "/icon.svg") {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Network-first for navigations, fall back to cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("/"))),
    );
  }
});
