// NAPCO System - the part of the app that runs in the background (update 29).
// It opens the app even with a weak connection (the page itself; the data always comes fresh from the server),
// and shows the notifications the server sends. It never stores any data or session.
const CACHE = 'napco-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;   // the data, fonts and translation go straight to the network, never stored here
  if (r.mode === 'navigate') {
    // the newest page from the server; the last one only when there is no connection
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put('/', cp)); } return res; })
      .catch(() => caches.match('/')));
    return;
  }
  if (/\.(png|webmanifest)$/.test(u.pathname)) e.respondWith(caches.match(r).then(x => x || fetch(r)));
});

// a notification from the server
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'NAPCO System', {
    body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', dir: 'auto',
    tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || '/' },
  }));
});

// tapping it opens the app (or brings it to the front and refreshes its lists)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if (w.url.startsWith(self.location.origin)) { w.postMessage('napco-refresh'); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
