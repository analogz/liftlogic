/**
 * LiftLogic Service Worker
 * Enables offline functionality and caching
 */

const CACHE_NAME = 'liftlogic-v4';
const OFFLINE_URL = './index.html';

// Files to cache for offline use
const STATIC_ASSETS = [
    './',
    './index.html',
    './tracker.html',
    './dashboard.html',
    './schedule.html',
    './css/theme.css',
    './css/modal.css',
    './css/leaderboard.css',
    './js/schedule-data.js',
    './js/nav.js',
    './js/data/store.js',
    './js/data/backup.js',
    './js/firebase/config.js',
    './js/firebase/auth.js',
    './js/firebase/leaderboard.js',
    './js/firebase/leaderboard-ui.js',
    './js/firebase/sync.js',
    './manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
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

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version
                    return cachedResponse;
                }

                // Try network
                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone and cache the response
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Offline fallback for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match(OFFLINE_URL);
                        }
                    });
            })
    );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

