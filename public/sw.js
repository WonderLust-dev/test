// SSC CGL Exam Platform - Service Worker
// Version: 2.0.0

const CACHE_VERSION = 'sscp-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Files to cache immediately on install (app shell)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './404.html',
  './icons/icon.svg',
];

// Maximum number of dynamic cache entries (non-critical files)
const MAX_DYNAMIC_CACHE = 80;

// Install event - safely cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v2...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async (cache) => {
        console.log('[SW] Caching app shell assets');
        for (const asset of STATIC_ASSETS) {
          try {
            await cache.add(asset);
          } catch (err) {
            console.warn('[SW] Could not precache:', asset, err);
          }
        }
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v2...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('sscp-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete - clients claimed');
        return self.clients.claim(); // Take control of all clients
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip chrome-extension or other non-http schemes
  if (!url.protocol.startsWith('http')) return;

  // Let Supabase API requests pass through to network (database.ts handles offline fallback)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Handle SPA navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Handle static assets (JS, CSS, images, icons, fonts)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // For other same-origin requests, use network-first with cache fallback
  event.respondWith(networkFirst(request));
});

// Navigation handler: tries network first, but reliably returns cached SPA shell (index.html) when offline
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
      return response;
    }
  } catch (error) {
    // Offline or network error - fall through to cached app shell
  }

  const cachedMatch = await caches.match(request);
  if (cachedMatch) return cachedMatch;

  // Find cached index.html under any relative path
  const fallback =
    (await caches.match('./index.html')) ||
    (await caches.match('./')) ||
    (await caches.match('/index.html')) ||
    (await caches.match('index.html'));

  if (fallback) return fallback;

  return new Response('Offline - SSC CGL Prep', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain' },
  });
}

// Cache-first strategy for static assets: Return from cache immediately, fetch & cache if missing
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
      trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE);
    }
    return response;
  } catch (error) {
    // Try ignoreSearch fallback
    const fallback = await caches.match(request, { ignoreSearch: true });
    if (fallback) return fallback;
    return new Response('Asset Offline', { status: 503, statusText: 'Offline' });
  }
}

// Network-first strategy: Try network, fallback to cache
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
      trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    if (request.mode === 'navigate') {
      const fallback =
        (await caches.match('./index.html')) ||
        (await caches.match('./')) ||
        (await caches.match('/index.html'));
      if (fallback) return fallback;
    }

    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Check if request is for a static asset
function isStaticAsset(pathname) {
  const lower = pathname.toLowerCase();
  return (
    lower.endsWith('.js') ||
    lower.endsWith('.css') ||
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.ico') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.woff') ||
    lower.endsWith('.woff2') ||
    lower.endsWith('.ttf') ||
    lower.includes('/assets/') ||
    lower.startsWith('/assets/')
  );
}

// Trim cache to maximum size, but never delete critical JS or CSS bundles
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      // Find a non-critical asset to delete
      const candidate = keys.find(k => {
        const u = k.url.toLowerCase();
        return !u.endsWith('.js') && !u.endsWith('.css') && !u.includes('index-');
      }) || keys[0];
      await cache.delete(candidate);
    }
  } catch {}
}

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

// Background sync for failed operations (optional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attempts') {
    event.waitUntil(syncAttempts());
  }
});

async function syncAttempts() {
  // Placeholder for background sync logic
  console.log('[SW] Syncing attempts...');
}

// Push notification handling (optional)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'SSC CGL Prep';
  const options = {
    body: data.body || 'Time to study!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'study', title: 'Start Studying' },
      { action: 'dismiss', title: 'Later' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'study') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
});

console.log('[SW] Service Worker loaded');
