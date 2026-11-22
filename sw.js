// Sentra NL service worker v4 · HTML network-first · css/js stale-while-revalidate · audio: bypass SW for media/Range (Safari), cache full fetch()
const V = 'snl-v4', MEDIA = 'snl-media-v4';  // own prefix: Sentra (/sentra/) shares this origin and clears its own 'sentra-*' caches
const SHELL = ['./', 'index.html', 'css/styles.css?v=4', 'js/app.js?v=4', 'js/data.js?v=4', 'js/audio.js?v=4', 'js/install.js?v=4', 'manifest.webmanifest',
  'fonts/Vazirmatn-Regular.woff2', 'fonts/Vazirmatn-Bold.woff2', 'fonts/Vazirmatn-Black.woff2', 'fonts/Fredoka-Bold.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'images/shir-o-khorshid.svg', 'images/nl.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k.startsWith('snl-') && k !== V && k !== MEDIA).map(k => caches.delete(k))))
  .then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/audio\//.test(url.pathname)) {
    /* Safari <audio> sends Range (often bytes=0-1). Serving a cached 200/bad 206 is silent on iOS — let the network handle it. */
    if (req.destination === 'audio' || req.destination === 'video' || req.headers.has('range')) return;
    e.respondWith(cacheFull(req, url));
    return;
  }
  if (/\/(images|fonts|icons)\//.test(url.pathname)) {
    e.respondWith(cacheFull(req, url));
  } else if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(req).then(hit => { const net = fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); } return r; }).catch(() => hit); return hit || net; }));
  }
});
async function cacheFull(req, url) {
  const key = url.origin + url.pathname;
  const hit = await caches.match(key);
  if (hit) return hit;
  const r = await fetch(key, { credentials: 'same-origin' });
  if (r.ok && r.status === 200) { const cp = r.clone(); caches.open(MEDIA).then(c => c.put(key, cp)); }
  return r;
}
