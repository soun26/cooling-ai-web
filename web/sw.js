/* Cache only the public shell. No chat, API responses, models or research data. */
const VERSION = 'cooling-user-0.2.14';
const ROOT = '/user/';
const SHELL = [ROOT, ROOT+'app.css', ROOT+'app.js','chat-stream.js', ROOT+'garage.js', ROOT+'result-interaction.js', ROOT+'manifest.webmanifest',
  ROOT+'icon.svg', ROOT+'icon-192.png', ROOT+'icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL))));
// Deliberately no automatic skipWaiting: updating must not interrupt a request/form.
self.addEventListener('message', event => {if(event.data === 'APPLY_UPDATE') self.skipWaiting();});
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('cooling-user-') && key !== VERSION).map(key => caches.delete(key))))
    .then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if(event.request.mode === 'navigate' && url.pathname.startsWith(ROOT)) {
    // Keep HTML and scripts from one release until the user applies its update.
    // Network-first HTML paired with old cached scripts breaks removed controls.
    event.respondWith(caches.open(VERSION).then(cache => cache.match(ROOT)).then(cached => cached || fetch(event.request)));
  } else if(SHELL.includes(url.pathname)) {
    event.respondWith(caches.open(VERSION).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
  }
});
