/**
 * NETZACH Navega — Service Worker
 * App 100% estático e OFFLINE-FIRST.
 * Cacheia todos os arquivos do app; o motor criptográfico roda aqui.
 */

const CACHE = 'netzach-v6';
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
        Promise.all([
            caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))),
            self.clients.claim()
        ])
    );
});

/* Estratégia: NETWORK-FIRST para navegação e app shell.
   Garante que o app instalado/cliente obsoleto sempre receba a versão mais
   recente quando está online (evita servir HTML/JS antigos por cache-first). */
self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const isShell = url.origin === self.location.origin &&
        APP_SHELL.some(p => {
            const pu = new URL(p, self.location.origin);
            return url.pathname === pu.pathname || (p === '/' && url.pathname === '/');
        });
    const isNavigation = req.mode === 'navigate';

    if (isShell || isNavigation) {
        e.respondWith(
            fetch(req).then(res => {
                const copy = res.clone();
                caches.open(CACHE).then(c => c.put(req, copy));
                return res;
            }).catch(() => caches.match(req).then(c => c || caches.match('/index.html')))
        );
        return;
    }

    e.respondWith(
        caches.match(req).then(cached =>
            cached || fetch(req).then(res => {
                const copy = res.clone();
                if (res.ok) caches.open(CACHE).then(c => c.put(req, copy));
                return res;
            })
        ).catch(() => caches.match('/index.html'))
    );
});

self.addEventListener('message', (e) => {
    const { type, payload } = e.data;
    if (type === 'SKIP_WAITING') self.skipWaiting();
});
