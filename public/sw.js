// Scalevo ERP - Service Worker
// Handles: caching, offline support, push notifications, background sync

const CACHE_NAME = 'scalevo-v2';
const STATIC_CACHE = 'scalevo-static-v2';
const API_CACHE = 'scalevo-api-v2';

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/login',
  '/dashboard',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// API routes to cache with network-first strategy
const API_ROUTES = [
  '/api/dashboard',
  '/api/students',
  '/api/courses',
  '/api/batches',
];

// ─── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Scalevo Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache failed for some assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Scalevo Service Worker...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.origin !== self.location.origin) return;

  // API routes: Network-first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Next.js internal routes: network only
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Pages & static assets: Cache-first, fallback to network
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ─── Cache Strategies ──────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline fallback page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/');
      return offlinePage || new Response('<h1>Offline</h1><p>Please check your internet connection.</p>', {
        headers: { 'Content-Type': 'text/html' },
      });
    }
    throw new Error('Network request failed and no cache available');
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── Push Notifications ───────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Scalevo', body: event.data.text() };
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    image: data.image || undefined,
    vibrate: [100, 50, 100],
    tag: data.tag || 'scalevo-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || '/dashboard',
      dateOfArrival: Date.now(),
    },
    actions: data.actions || [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Scalevo', options)
  );
});

// ─── Notification Click ───────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── Background Sync ──────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance') {
    event.waitUntil(syncAttendance());
  }
  if (event.tag === 'sync-fees') {
    event.waitUntil(syncFees());
  }
});

async function syncAttendance() {
  // Placeholder for background attendance sync
  console.log('[SW] Background sync: attendance');
}

async function syncFees() {
  // Placeholder for background fees sync
  console.log('[SW] Background sync: fees');
}

// ─── Message Handler ──────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});
