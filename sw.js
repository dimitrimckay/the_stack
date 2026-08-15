/* The Stack — service worker. Bump REV together with index.html on every release. */
const REV = "r7";
const CACHE = "stack-" + REV;
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("stack-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  const isShell = url.origin === self.location.origin;
  if (!isFont && !isShell) return;

  if (req.mode === "navigate" || isShell) {
    /* app shell: cache first, refresh in the background */
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(cached => {
        const net = fetch(req).then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }
  /* fonts: cache forever once seen */
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => cached))
  );
});
