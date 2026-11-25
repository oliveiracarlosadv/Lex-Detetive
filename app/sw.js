/* Lex Detetive — modo offline. Guarda as telas do app para abrir sem internet.
   Os dados ficam no banco do navegador (IndexedDB); as consultas às fontes precisam de internet. */
// A versão é trocada a cada publicação (scripts/build-pages.sh): o navegador percebe a mudança e atualiza.
const VERSION = '20261124225458';
const CACHE = `lex-detetive-${VERSION}`;
const BASE = new URL('./', self.location).pathname;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([BASE, BASE + 'manifest.webmanifest', BASE + 'icons/icon-192.png']).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // fontes externas: sempre pela internet
  // Arquivos com versão no nome (_next/static): do cache primeiro.
  if (url.pathname.includes('/_next/static/') || url.pathname.includes('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  // Páginas: internet primeiro (pega atualizações); sem internet, a última cópia guardada.
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match(BASE))));
});
