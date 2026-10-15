// SSC CGL Exam Platform - Service Worker
// Version: 3.0.0

const CACHE_VERSION = 'sscp-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Files to cache immediately on install (app shell)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './404.html',
  './icons/icon.svg',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/icon-maskable-512x512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32x32.png',
];

// Maximum number of dynamic cache entries (non-critical files)
const MAX_DYNAMIC_CACHE = 100;

// Install event - safely cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v3...');
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
  console.log('[SW] Activating v3...');
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

  // 1. Try exact match in all caches (with ignoreSearch)
  const cachedMatch = await caches.match(request, { ignoreSearch: true });
  if (cachedMatch) return cachedMatch;

  // 2. Search in all caches for any cached index.html or root
  for (const cacheName of [STATIC_CACHE, DYNAMIC_CACHE]) {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      for (const req of keys) {
        const u = req.url.toLowerCase();
        if (u.endsWith('/index.html') || u.endsWith('/') || u.includes('index.html')) {
          const match = await cache.match(req);
          if (match) return match;
        }
      }
    } catch {}
  }

  // 3. Fallback search with common URL patterns
  const fallback =
    (await caches.match('./index.html', { ignoreSearch: true })) ||
    (await caches.match('./', { ignoreSearch: true })) ||
    (await caches.match('index.html', { ignoreSearch: true })) ||
    (await caches.match('/index.html', { ignoreSearch: true }));

  if (fallback) return fallback;

  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Offline - SSC CGL Prep</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#F4F5F7;color:#111827;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;box-sizing:border-box;text-align:center}.card{background:#fff;border-radius:24px;padding:32px;max-width:400px;box-shadow:0 10px 25px rgba(0,0,0,0.05);border:1px solid #E5E7EB}h1{font-size:20px;margin-bottom:8px}p{font-size:13px;color:#6B7280;line-height:1.5;margin-bottom:20px}button{background:#111827;color:#fff;border:none;padding:10px 24px;border-radius:12px;font-weight:700;font-size:13px;cursor:pointer}</style></head><body><div class="card"><h1>Offline Mode Active</h1><p>The app shell is ready. Connect to the internet once to load new question papers, or tap reload to retry.</p><button onclick="window.location.reload()">Reload Application</button></div></body></html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

// Cache-first strategy for static assets: Return from cache immediately, fetch & cache if missing
async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
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
    // If it's a JS or CSS asset and exact match missed, search in caches for any matching asset filename
    const url = new URL(request.url);
    const filename = url.pathname.split('/').pop();
    if (filename) {
      for (const cacheName of [STATIC_CACHE, DYNAMIC_CACHE]) {
        try {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          const found = keys.find(k => k.url.endsWith(filename));
          if (found) {
            const res = await cache.match(found);
            if (res) return res;
          }
        } catch {}
      }
    }
    return new Response('', { status: 404, statusText: 'Offline Asset Not Found' });
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
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) {
      return cached;
    }

    if (request.mode === 'navigate') {
      return handleNavigation(request);
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
  // Client requests immediate caching of runtime scripts and stylesheets
  if (event.data && event.data.type === 'CACHE_ASSETS' && Array.isArray(event.data.urls)) {
    caches.open(STATIC_CACHE).then(async (cache) => {
      for (const url of event.data.urls) {
        try {
          const existing = await cache.match(url);
          if (!existing) {
            const res = await fetch(url);
            if (res && res.ok) {
              await cache.put(url, res);
              console.log('[SW] Pre-cached runtime bundle:', url);
            }
          }
        } catch {}
      }
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
  console.log('[SW] Syncing attempts...');
}

// Push notification handling (optional)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'SSC CGL Prep';
  const options = {
    body: data.body || 'Time to study!',
    icon: './icons/icon-192x192.png',
    badge: './icons/favicon-32x32.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || './' },
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

console.log('[SW] Service Worker v3 loaded');
