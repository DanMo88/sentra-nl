// Sentra NL service worker v3 · HTML network-first · css/js stale-while-revalidate · audio/fonts/images cache-on-demand
const V = 'snl-v3', MEDIA = 'snl-media-v3';  // own prefix: Sentra (/sentra/) shares this origin and clears its own 'sentra-*' caches
const SHELL = ['./', 'index.html', 'css/styles.css?v=3', 'js/app.js?v=3', 'js/data.js?v=3', 'js/audio.js?v=3', 'js/install.js?v=3', 'manifest.webmanifest',
  'fonts/Vazirmatn-Regular.woff2', 'fonts/Vazirmatn-Bold.woff2', 'fonts/Vazirmatn-Black.woff2', 'fonts/Fredoka-Bold.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'images/shir-o-khorshid.svg', 'images/nl.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k.startsWith('snl-') && k !== V && k !== MEDIA).map(k => caches.delete(k))))
  .then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/(audio|images|fonts|icons)\//.test(url.pathname)) {
    e.respondWith(media(req, url));
  } else if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(req).then(hit => { const net = fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); } return r; }).catch(() => hit); return hit || net; }));
  }
});
async function media(req, url) {
  const key = url.origin + url.pathname;
  const range = req.headers.get('range');
  if (range) {
    const hit = await caches.match(key);
    if (hit) {
      const buf = await hit.arrayBuffer();
      const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
      const start = m[1] ? +m[1] : 0;
      const end = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
      if (start > end || start >= buf.byteLength) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + buf.byteLength } });
      const slice = buf.slice(start, end + 1);
      return new Response(slice, { status: 206, headers: {
        'Content-Type': hit.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Length': String(slice.byteLength),
        'Content-Range': 'bytes ' + start + '-' + end + '/' + buf.byteLength,
        'Accept-Ranges': 'bytes'
      } });
    }
    return fetch(req);
  }
  const hit = await caches.match(key);
  if (hit) return hit;
  const r = await fetch(key, { credentials: 'same-origin' });
  if (r.ok && r.status === 200) { const cp = r.clone(); caches.open(MEDIA).then(c => c.put(key, cp)); }
  return r;
}
