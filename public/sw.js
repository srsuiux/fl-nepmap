// Offline support: the app shell, the last data, and map tiles you have looked at stay available on weak or no signal.
const V = "nfw-v1";
const SHELL = `${V}-shell`, TILES = `${V}-tiles`, DATA = `${V}-data`;
const MAX_TILES = 600;

self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/", "/manifest.webmanifest", "/geo/nepal.json"]).catch(() => {}))); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => !k.startsWith(V)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(name, max) {
  const c = await caches.open(name), keys = await c.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => c.delete(k)));
}
const networkFirst = async (req, cacheName, key) => {
  const c = await caches.open(cacheName);
  try { const r = await fetch(req); if (r.ok) c.put(key ?? req, r.clone()); return r; }
  catch { const hit = await c.match(key ?? req); if (hit) return hit; throw new Error("offline"); }
};
const cacheFirst = async (req, cacheName) => {
  const c = await caches.open(cacheName), hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r;
};
const staleWhileRevalidate = async (req, cacheName, max) => {
  const c = await caches.open(cacheName), hit = await c.match(req);
  const net = fetch(req).then((r) => { if (r.ok) { c.put(req, r.clone()); if (max) trim(cacheName, max); } return r; }).catch(() => hit);
  return hit || net;
};

self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === "navigate") { e.respondWith(networkFirst(req, SHELL, "/").catch(() => caches.match("/"))); return; } // any link opens the app shell offline
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/maplibre/")) { e.respondWith(cacheFirst(req, SHELL)); return; }
    if (url.pathname.startsWith("/geo/")) { e.respondWith(staleWhileRevalidate(req, SHELL)); return; }
    if (url.pathname.startsWith("/api/")) { e.respondWith(networkFirst(req, DATA)); return; }
    return;
  }
  if (url.hostname === "tiles.openfreemap.org") { e.respondWith(staleWhileRevalidate(req, TILES, MAX_TILES)); return; }
});
