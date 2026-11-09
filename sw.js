/**
 * LiftLogic Service Worker
 * Enables offline functionality and caching
 */

const CACHE_NAME = 'liftlogic-v22';
const OFFLINE_URL = './index.html';

// Files to cache for offline use
const STATIC_ASSETS = [
    './',
    './index.html',
    './tracker.html',
    './dashboard.html',
    './schedule.html',
    './exercises.html',
    './css/theme.css',
    './css/modal.css',
    './css/leaderboard.css',
    './css/rides.css',
    './css/glass.css',
    './assets/bg/forest-bg-desktop.webp',
    './assets/bg/forest-bg-mobile.webp',
    './js/schedule-data.js',
    './js/rides-data.js',
    './js/ride-log.js',
    './js/utils/dates.js',
    './js/nav.js',
    './js/data/store.js',
    './js/data/backup.js',
    './js/data/exercises.js',
    './js/data/exercise-progress.js',
    './js/firebase/config.js',
    './js/firebase/auth.js',
    './js/firebase/leaderboard.js',
    './js/firebase/leaderboard-ui.js',
    './js/data/records.js',
    './js/firebase/sync.js',
    './manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                // Bypass the browser's HTTP cache so a fresh install never captures a stale page.
                return cache.addAll(STATIC_ASSETS.map((url) => new Request(url, { cache: 'reload' })));
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip external requests (CDN scripts, fonts)
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Pages, styles and scripts: network first, so a deploy shows up on the next load;
    // the cache is the offline fallback. Images and fonts: cache first.
    const url = new URL(event.request.url);
    const networkFirst = event.request.mode === 'navigate' || /\.(html|css|js|json)$/.test(url.pathname) || url.pathname.endsWith('/');

    const putInCache = (response) => {
        if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
    };

    if (networkFirst) {
        event.respondWith(
            fetch(event.request)
                .then(putInCache)
                .catch(() => caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    if (event.request.mode === 'navigate') return caches.match(OFFLINE_URL);
                }))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => cachedResponse || fetch(event.request).then(putInCache))
    );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

