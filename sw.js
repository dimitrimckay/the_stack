/* 朱 Stack Log — service worker
   The REV string below is what triggers the update prompt. It has to change
   every release or nobody's phone finds out there was one. It matches the
   REV constant in index.html. */
const REV = "r15";
const CACHE = "stack-log-" + REV;

const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

/* Install: pull the shell down, then sit in waiting until the app offers
   the reload toast. No skipWaiting here — the person decides when to swap,
   because a swap mid-session throws away whatever sheet is open. */
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u =>
      c.add(new Request(u, { cache: "reload" })).catch(() => {})
    ));
  })());
});

/* Activate: drop every older build and take over the open pages, which is
   what fires controllerchange and reloads them. */
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (_) {}
    }
    await self.clients.claim();
  })());
});

/* The reload button in the toast sends this. */
self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

/* Same-origin GETs only. Everything else, including the font request, goes
   straight to the network and is allowed to fail quietly offline. */
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* Page loads: serve the cached shell immediately so the app opens with no
     network at all, and refresh the copy in the background for next time. */
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cached = await caches.match("./index.html");
      const fresh = fetch(req).then(async res => {
        if (res && res.ok) (await caches.open(CACHE)).put("./index.html", res.clone());
        return res;
      }).catch(() => null);
      return cached || (await fresh) || new Response(
        "<h1>Offline</h1><p>The app hasn't finished caching yet. Reconnect once and it will work offline after that.</p>",
        { headers: { "Content-Type": "text/html" }, status: 503 }
      );
    })());
    return;
  }

  /* Icons and the manifest: cache first, fall back to the network. */
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === "basic") {
        (await caches.open(CACHE)).put(req, res.clone());
      }
      return res;
    } catch (_) {
      return new Response("", { status: 504 });
    }
  })());
});
