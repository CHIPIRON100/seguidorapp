const SHELL = 'shell-v1';
const TILES = 'tiles-v1';
const FILES = ['./', 'index.html', 'manifest.json', 'icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL)
    .then(c => Promise.all(FILES.map(u => c.add(u).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== TILES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trim(c) {
  const ks = await c.keys();
  if (ks.length > 1500) await Promise.all(ks.slice(0, 100).map(k => c.delete(k)));
}

async function tile(r) {
  const fresh = /capabilities/i.test(r.url);
  if (!fresh) {
    const hit = await caches.match(r, { cacheName: TILES });
    if (hit) return hit;
  }
  try {
    const res = await fetch(r);
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(TILES).then(c => c.put(r, copy).then(() => trim(c)));
    }
    return res;
  } catch (err) {
    const hit = await caches.match(r, { cacheName: TILES });
    return hit || Response.error();
  }
}

async function shell(r, sameOrigin) {
  if (sameOrigin) {
    try {
      const res = await fetch(r);
      if (res.ok) caches.open(SHELL).then(c => c.put(r, res.clone()));
      return res;
    } catch (err) {
      const hit = await caches.match(r, { cacheName: SHELL }) || (r.mode === 'navigate' ? await caches.match('./', { cacheName: SHELL }) : null);
      return hit || Response.error();
    }
  }
  const hit = await caches.match(r, { cacheName: SHELL });
  if (hit) return hit;
  const res = await fetch(r);
  if (res.ok) caches.open(SHELL).then(c => c.put(r, res.clone()));
  return res;
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname === 'sigpac-hubcloud.es') return;
  if (u.hostname.endsWith('ign.es') || u.hostname === 'wms.mapa.gob.es') { e.respondWith(tile(r)); return; }
  if (u.origin === self.location.origin) { e.respondWith(shell(r, true)); return; }
  if (u.hostname === 'unpkg.com') e.respondWith(shell(r, false));
});
