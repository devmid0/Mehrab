/* ==========================================
   PWA SERVICE WORKER - Mehrab-مِحراب
   Enhanced Quran API Caching
   ========================================== */

const CACHE_NAME = 'mehrab-v1.0.0';
const STATIC_CACHE = 'mehrab-static-v1';
const DYNAMIC_CACHE = 'mehrab-dynamic-v1';
const FONT_CACHE = 'mehrab-fonts-v1';
const PRAYER_API_CACHE = 'mehrab-prayer-v1';
const QURAN_CACHE = 'mehrab-quran-v1';

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

// Quran API URLs
const QURAN_API_BASE = 'https://api.alquran.cloud/v1';

// Surah list URL for pre-caching
const SURAH_LIST_URL = `${QURAN_API_BASE}/surah`;

// Install event - cache static assets and Quran surah list
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
      }),
      // Pre-cache Quran surah list
      preCacheSurahList(),
      // Start full Quran cache in background (don't block install)
      preCacheAllSurahs(true).catch(err => {
        console.log('[SW] Background Quran cache error:', err);
      })
    ]).then(() => {
      console.log('[SW] Skip waiting');
      return self.skipWaiting();
    })
  );
});

// Pre-cache the surah list for offline access
async function preCacheSurahList() {
  try {
    console.log('[SW] Pre-caching Quran surah list...');
    const cache = await caches.open(QURAN_CACHE);
    
    // Check if already cached
    const existing = await cache.match(SURAH_LIST_URL);
    if (existing) {
      console.log('[SW] Surah list already cached');
      return true;
    }
    
    const response = await fetch(SURAH_LIST_URL);
    if (response.ok) {
      await cache.put(SURAH_LIST_URL, response.clone());
      console.log('[SW] Surah list cached successfully');
      return true;
    }
  } catch (error) {
    console.log('[SW] Could not pre-cache surah list:', error);
  }
  return false;
}

// Retry surah list caching (can be called when coming online)
async function retrySurahListCaching() {
  console.log('[SW] Retrying Quran surah list caching...');
  const result = await preCacheSurahList();
  if (result) {
    // Notify all clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SURAHLIST_CACHED' });
    });
  }
  return result;
}

// Check if surah list is cached
async function isSurahListCached() {
  try {
    const cache = await caches.open(QURAN_CACHE);
    const response = await cache.match(SURAH_LIST_URL);
    return !!response;
  } catch (error) {
    return false;
  }
}

// Pre-cache ALL 114 surahs for full offline access
async function preCacheAllSurahs(skipExisting = true) {
  console.log('[SW] Starting full Quran cache...');
  const cache = await caches.open(QURAN_CACHE);
  const totalSurahs = 114;
  let cached = 0;
  let failed = 0;
  let skipped = 0;
  
  // Notify clients that caching started
  notifyClients({ type: 'QURAN_CACHE_STARTED', total: totalSurahs });
  
  for (let i = 1; i <= totalSurahs; i++) {
    const url = `${QURAN_API_BASE}/surah/${i}/quran-uthmani`;
    
    try {
      // Check if already cached
      if (skipExisting) {
        const existing = await cache.match(url);
        if (existing) {
          skipped++;
          // Notify progress every 10 surahs
          if (i % 10 === 0) {
            notifyClients({
              type: 'QURAN_CACHE_PROGRESS',
              current: i,
              total: totalSurahs,
              cached,
              skipped,
              failed
            });
          }
          continue;
        }
      }
      
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response.clone());
        cached++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`[SW] Failed to cache surah ${i}:`, error);
      failed++;
    }
    
    // Notify progress every 5 surahs to keep user informed
    if (i % 5 === 0 || i === totalSurahs) {
      notifyClients({
        type: 'QURAN_CACHE_PROGRESS',
        current: i,
        total: totalSurahs,
        cached,
        skipped,
        failed,
        percent: Math.round((i / totalSurahs) * 100)
      });
    }
  }
  
  // Mark as fully cached
  await cache.put(
    `${QURAN_API_BASE}/_all_cached`,
    new Response(JSON.stringify({
      cached: cached,
      skipped: skipped,
      failed: failed,
      timestamp: Date.now(),
      version: '1.0'
    }))
  );
  
  console.log(`[SW] Full Quran cache complete: ${cached} cached, ${skipped} skipped, ${failed} failed`);
  
  // Notify completion
  notifyClients({
    type: 'QURAN_CACHE_COMPLETE',
    cached,
    skipped,
    failed,
    success: failed === 0
  });
  
  return { cached, skipped, failed };
}

// Check if all surahs are cached
async function isFullQuranCached() {
  try {
    const cache = await caches.open(QURAN_CACHE);
    const status = await cache.match(`${QURAN_API_BASE}/_all_cached`);
    if (status) {
      const data = await status.json();
      return data.cached + data.skipped >= 114;
    }
  } catch (error) {
    return false;
  }
  return false;
}

// Get Quran cache status
async function getQuranCacheStatus() {
  try {
    const cache = await caches.open(QURAN_CACHE);
    const status = await cache.match(`${QURAN_API_BASE}/_all_cached`);
    if (status) {
      return await status.json();
    }
  } catch (error) {
    console.log('[SW] Could not get cache status:', error);
  }
  return null;
}

// Notify all clients
async function notifyClients(message) {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage(message);
    });
  } catch (error) {
    // Ignore errors
  }
}

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  const validCaches = [STATIC_CACHE, DYNAMIC_CACHE, FONT_CACHE, PRAYER_API_CACHE, QURAN_CACHE];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!validCaches.includes(cacheName)) {
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
  else if (isQuranSurahListRequest(url)) {
    // Surah list: Cache First (permanent, rarely changes)
    event.respondWith(quranSurahListStrategy(request));
  }
  else if (isQuranSurahRequest(url)) {
    // Individual surah: Cache First with background refresh
    event.respondWith(quranSurahStrategy(request));
  }
  else if (isPrayerAPIRequest(url)) {
    // Prayer times API: Network First with cache fallback
    event.respondWith(networkFirst(request, PRAYER_API_CACHE));
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

// ==========================================
// QURAN-SPECIFIC CACHING STRATEGIES
// ==========================================

// Detect surah list request
function isQuranSurahListRequest(url) {
  return url.hostname === 'api.alquran.cloud' && 
         url.pathname === '/v1/surah';
}

// Detect individual surah request
function isQuranSurahRequest(url) {
  return url.hostname === 'api.alquran.cloud' && 
         /^\/v1\/surah\/\d+(\/quran-uthmani)?$/.test(url.pathname);
}

// Surah List Strategy: Cache First (always available offline once cached)
async function quranSurahListStrategy(request) {
  const cache = await caches.open(QURAN_CACHE);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // Return cached, but refresh in background
    refreshCacheInBackground(request, cache);
    return cachedResponse;
  }
  
  // No cache - fetch from network
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Surah list fetch failed:', error);
  }
  
  // Return offline error with helpful message
  return createQuranOfflineResponse('قائمة السور غير متاحة حالياً. يرجى الاتصال بالإنترنت لتحميلها.');
}

// Individual Surah Strategy: Cache First with background refresh
async function quranSurahStrategy(request) {
  const cache = await caches.open(QURAN_CACHE);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  
  // If cached, return immediately and refresh in background
  if (cachedResponse) {
    refreshCacheInBackground(request, cache);
    return cachedResponse;
  }
  
  // Not in cache - fetch from network
  let isNetworkError = false;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Surah fetch failed:', error);
    isNetworkError = true;
  }
  
  // Return offline error with clear messaging
  // isNetworkError = true means we tried but failed (connection issue)
  // isNetworkError = false means the surah was never cached
  return createQuranOfflineResponse(
    isNetworkError 
      ? 'تعذر الاتصال. يرجى التحقق من اتصالك بالإنترنت.'
      : 'هذه السورة غير محملة. قم بتحميلها أثناء الاتصال بالإنترنت أولاً.',
    !isNetworkError // isNotCached = true if not network error (surah was never cached)
  );
}

// Refresh cache in background without blocking
function refreshCacheInBackground(request, cache) {
  fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
        console.log('[SW] Quran cache refreshed:', request.url);
      }
    })
    .catch(() => {
      // Silently fail - we already have cached version
    });
}

// Create Quran-specific offline response
function createQuranOfflineResponse(message, isNotCached = true) {
  const offlineMessage = isNotCached 
    ? 'هذه السورة غير محملة بعد. قم بتحميلها أثناء الاتصال بالإنترنت.'
    : 'تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.';
  
  return new Response(
    JSON.stringify({
      status: 'offline',
      error: true,
      code: 503,
      message: message || offlineMessage,
      cached: false,
      notCached: isNotCached,
      suggestion: isNotCached 
        ? 'اختر سورة أخرى قمت بتحميلها سابقاً، أو اتصل بالإنترنت لتحميل هذه السورة.'
        : 'قم بتحميل السورة أثناء الاتصال بالإنترنت لتتمكن من قراءتها لاحقاً.',
      action: isNotCached
        ? 'LOAD_ONLINE'
        : 'CHECK_CONNECTION'
    }),
    {
      status: 200, // Return 200 so app can handle the response
      statusText: 'OK',
      headers: new Headers({
        'Content-Type': 'application/json',
        'X-Quran-Cache': 'offline',
        'X-Quran-Not-Cached': isNotCached ? 'true' : 'false'
      })
    }
  );
}

// ==========================================
// GENERIC CACHE STRATEGIES
// ==========================================

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

// ==========================================
// HELPER FUNCTIONS
// ==========================================

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

function isPrayerAPIRequest(url) {
  return url.hostname.includes('api.aladhan.com') ||
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

// ==========================================
// MESSAGE HANDLING
// ==========================================

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
    const cacheName = url.includes('alquran.cloud') ? QURAN_CACHE : PRAYER_API_CACHE;
    
    event.waitUntil(
      caches.open(cacheName).then((cache) => {
        return fetch(url).then((response) => {
          if (response.ok) {
            return cache.put(url, response);
          }
        });
      })
    );
  }
  
  // Pre-cache a specific surah
  if (event.data && event.data.type === 'CACHE_SURAH') {
    const { surahNumber } = event.data;
    const url = `${QURAN_API_BASE}/surah/${surahNumber}/quran-uthmani`;
    
    event.waitUntil(
      caches.open(QURAN_CACHE).then((cache) => {
        return fetch(url).then((response) => {
          if (response.ok) {
            cache.put(url, response.clone());
            console.log('[SW] Surah', surahNumber, 'cached');
            // Notify client
            return self.clients.matchAll().then((clients) => {
              clients.forEach((client) => {
                client.postMessage({ 
                  type: 'SURAH_CACHED', 
                  surah: surahNumber 
                });
              });
            });
          }
        }).catch((error) => {
          console.log('[SW] Could not cache surah:', error);
        });
      })
    );
  }
  
  // Pre-cache all surahs (for power users)
  if (event.data && event.data.type === 'CACHE_ALL_SURAHS') {
    event.waitUntil(
      preCacheAllSurahs(false) // Force re-cache all
    );
  }
  
  // Get Quran cache status
  if (event.data && event.data.type === 'GET_QURAN_CACHE_STATUS') {
    event.waitUntil(
      getQuranCacheStatus().then(status => {
        event.ports?.[0]?.postMessage({
          type: 'QURAN_CACHE_STATUS',
          status: status
        });
      })
    );
  }
  
  // Check if full Quran is cached
  if (event.data && event.data.type === 'CHECK_FULL_QURAN_CACHED') {
    event.waitUntil(
      isFullQuranCached().then(cached => {
        event.ports?.[0]?.postMessage({
          type: 'FULL_QURAN_CACHED',
          cached: cached
        });
      })
    );
  }
  
  // Retry caching surah list
  if (event.data && event.data.type === 'CACHE_SURAHLIST') {
    event.waitUntil(
      retrySurahListCaching().then(result => {
        const clients = self.clients.matchAll();
        clients.then(allClients => {
          allClients.forEach(client => {
            client.postMessage({ 
              type: 'SURAHLIST_CACHED', 
              success: result 
            });
          });
        });
      })
    );
  }
  
  // Check if surah list is cached
  if (event.data && event.data.type === 'CHECK_SURAHLIST_CACHED') {
    event.waitUntil(
      isSurahListCached().then(cached => {
        event.ports?.[0]?.postMessage({ 
          type: 'SURAHLIST_CACHED_STATUS', 
          cached: cached 
        });
      })
    );
  }
});

// Background sync for failed requests (if supported)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
});

console.log('[SW] Service Worker loaded with Quran caching');
