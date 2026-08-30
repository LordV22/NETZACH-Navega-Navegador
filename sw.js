/**
 * NETZACH Navega — Service Worker
 * App 100% estático e OFFLINE-FIRST.
 * Cacheia todos os arquivos do app; o motor criptográfico roda aqui.
 */

const CACHE = 'netzach-v1';
const APP_SHELL = [
    '/',
    '/index.html',
    '/manifest.json',
    '/js/app.js',
    '/js/vault.js',
    '/js/crypto-worker.js',
    '/js/i18n.js',
    '/icons/icon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-512-maskable.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
        caches.match(e.request).then(cached =>
            cached || fetch(e.request).then(res => {
                const copy = res.clone();
                if (res.ok) caches.open(CACHE).then(c => c.put(e.request, copy));
                return res;
            })
        ).catch(() => caches.match('/index.html'))
    );
});

self.addEventListener('message', (e) => {
    const { type, payload } = e.data;
    if (type === 'SKIP_WAITING') self.skipWaiting();
});
