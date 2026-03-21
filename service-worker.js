/* ==========================================
   PWA SERVICE WORKER - Mehrab-مِحراب
   ========================================== */

const CACHE_NAME = 'mehrab-v1.0.0';
const STATIC_CACHE = 'mehrab-static-v1';
const DYNAMIC_CACHE = 'mehrab-dynamic-v1';
const FONT_CACHE = 'mehrab-fonts-v1';
const API_CACHE = 'mehrab-api-v1';

// Static assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg'
];

// External resources to cache
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700;800&family=Scheherazade+New:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache external fonts
      caches.open(FONT_CACHE).then((cache) => {
        console.log('[SW] Caching external fonts');
        return Promise.all(
          EXTERNAL_ASSETS.map(url =>
            fetch(url, { mode: 'cors' })
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
              })
              .catch(err => console.log('[SW] Failed to cache:', url, err))
          )
        );
      })
    ]).then(() => {
      console.log('[SW] Skip waiting');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old version caches
          if (cacheName.startsWith('mehrab-') && 
              cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE && 
              cacheName !== FONT_CACHE && 
              cacheName !== API_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle different request types
  if (isStaticAsset(url)) {
    // Static assets: Cache First strategy
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } 
  else if (isFontRequest(url)) {
    // Fonts: Cache First with network fallback
    event.respondWith(cacheFirst(request, FONT_CACHE));
  }
  else if (isAPIRequest(url)) {
    // API requests: Network First with cache fallback
    event.respondWith(networkFirst(request, API_CACHE));
  }
  else if (isExternalResource(url)) {
    // External resources: Stale While Revalidate
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
  }
  else {
    // Default: Network First
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  }
});

// Cache strategies
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache First fetch failed:', error);
    return createOfflineResponse();
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network First falling back to cache:', request.url);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return createOfflineResponse();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);
  
  return cachedResponse || fetchPromise || createOfflineResponse();
}

// Helper functions
function isStaticAsset(url) {
  const staticExtensions = ['.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp'];
  const staticPaths = ['/', '/index.html', '/styles.css', '/script.js', '/manifest.json'];
  
  return staticPaths.includes(url.pathname) ||
         staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
         url.pathname.startsWith('/icons/');
}

function isFontRequest(url) {
  return url.hostname.includes('fonts.googleapis.com') ||
         url.hostname.includes('fonts.gstatic.com');
}

function isAPIRequest(url) {
  return url.hostname.includes('api.alquran.cloud') ||
         url.hostname.includes('api.aladhan.com') ||
         url.hostname.includes('nominatim.openstreetmap.org');
}

function isExternalResource(url) {
  return url.hostname.includes('cdnjs.cloudflare.com') ||
         url.hostname.includes('fontawesome.com');
}

function createOfflineResponse() {
  return new Response(
    JSON.stringify({
      error: 'offline',
      message: 'أنت الآن في وضع عدم الاتصال. يرجى التحقق من اتصالك بالإنترنت.'
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'application/json',
        'X-PWA-Offline': 'true'
      })
    }
  );
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        return self.clients.matchAll();
      }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'CACHE_CLEARED' });
        });
      })
    );
  }
  
  if (event.data && event.data.type === 'CACHE_API') {
    const { url } = event.data;
    event.waitUntil(
      caches.open(API_CACHE).then((cache) => {
        return fetch(url).then((response) => {
          if (response.ok) {
            return cache.put(url, response);
          }
        });
      })
    );
  }
});

// Background sync for failed requests (if supported)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-azkar') {
    // Handle azkar sync if needed
  }
});

console.log('[SW] Service Worker loaded');
