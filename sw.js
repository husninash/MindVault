// MindVault service worker: lets the installed app open and work without internet.
// Bump CACHE_VERSION when the list of shell files changes.
const CACHE_VERSION = 'mindvault-v7';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const CDN_CACHE = `${CACHE_VERSION}-cdn`;

const SHELL_FILES = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/i18n.js',
  '/js/data.js',
  '/js/supabaseClient.js',
  '/js/geminiClient.js',
  '/js/graph.js',
  '/js/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-64.png'
];

const CDN_FILES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
  // Must match the @import at the top of css/styles.css
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap'
];

// Libraries, icon fonts and web fonts: safe to serve from cache
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL_FILES.map(url => new Request(url, { cache: 'reload' })));
    const cdn = await caches.open(CDN_CACHE);
    await Promise.all(CDN_FILES.map(url => cdn.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Online: always fetch fresh files (and refresh the cache). Offline or slow: use the cached copy.
async function networkFirst(request, timeoutMs = 4000) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    // cache: 'no-cache' revalidates with the server (cheap 304 when unchanged) instead of trusting
    // the browser's HTTP cache, which could otherwise hand back an old index.html after a deploy
    const fresh = request.mode === 'navigate'
      ? fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
      : fetch(request, { cache: 'no-cache' });
    const response = await Promise.race([
      fresh,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    ]);
    if (response && response.ok) {
      // Store under the path without ?v=… so any version can be served offline
      const url = new URL(request.url);
      const key = request.mode === 'navigate' ? '/index.html' : url.pathname;
      cache.put(key, response.clone());
    }
    return response;
  } catch (err) {
    const url = new URL(request.url);
    const cached = request.mode === 'navigate'
      ? await cache.match('/index.html')
      : (await cache.match(url.pathname)) || (await cache.match(request, { ignoreSearch: true }));
    if (cached) return cached;
    throw err;
  }
}

// Cached copy first; refresh in the background. With nothing cached, never wait forever:
// a stylesheet or font that hangs would keep the whole page blank.
async function staleWhileRevalidate(request, timeoutMs = 4000) {
  const cache = await caches.open(CDN_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(response => {
      if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached || new Response('', { status: 504, statusText: 'Offline' }));
  if (cached) return cached;
  const timeout = new Promise(resolve => setTimeout(() => resolve(new Response('', { status: 504, statusText: 'Timeout' })), timeoutMs));
  return Promise.race([refresh, timeout]);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache Supabase (auth/data) or Gemini API calls
  if (url.hostname.endsWith('supabase.co') || url.hostname === 'generativelanguage.googleapis.com') return;

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
