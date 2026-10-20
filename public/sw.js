/* ==========================================================================
   PetTracker Escolar · service worker
   Estrategia:
   - Navegación: red primero, con respaldo en caché / index.html.
   - Archivos propios: caché primero con actualización en segundo plano.
   - CDN y fuentes: stale-while-revalidate.
   ========================================================================== */
'use strict';

const VERSION = 'pettracker-escolar-v1.4.1';
const SHELL_CACHE = VERSION + '-shell';
const RUNTIME_CACHE = VERSION + '-runtime';

const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js',
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap'
];

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/styles.css',
  './assets/js/store.js',
  './assets/js/ui.js',
  './assets/js/realtime.js',
  './assets/js/app.js',
  './assets/js/views/dashboard.js',
  './assets/js/views/bitacora.js',
  './assets/js/views/salud.js',
  './assets/js/views/turnos.js',
  './assets/js/views/admin.js',
  './assets/icons/favicon.svg',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

function precacheExternal() {
  return caches.open(RUNTIME_CACHE).then(function (cache) {
    return Promise.allSettled(EXTERNAL_ASSETS.map(function (url) {
      return fetch(new Request(url, { mode: 'cors' }))
        .then(function (response) {
          if (!response.ok) throw new Error('Respuesta no válida');
          return cache.put(url, response);
        })
        .catch(function () {
          /* Algunos CDN no permiten CORS; se guardan como respuesta opaca. */
          return fetch(new Request(url, { mode: 'no-cors' }))
            .then(function (response) { return cache.put(url, response); })
            .catch(function () { /* si el CDN falla, la app sigue funcionando */ });
        });
    }));
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function (cache) {
        return cache.addAll(APP_SHELL).catch(function (error) {
          console.warn('PetTracker SW: no se pudo precachear todo el shell', error);
          return Promise.all(APP_SHELL.map(function (url) {
            return cache.add(url).catch(function () { /* recurso opcional */ });
          }));
        });
      })
      .then(precacheExternal)
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== SHELL_CACHE && key !== RUNTIME_CACHE) {
          return caches.delete(key);
        }
        return Promise.resolve();
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isCacheableRequest(request) {
  if (!request || request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
  return true;
}

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (!isCacheableRequest(request)) return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  /* Navegación: red primero para tener siempre la última versión. */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then(function (cache) {
              cache.put('./index.html', copy).catch(function () { /* noop */ });
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (cached) {
            return cached || caches.match('./index.html').then(function (shell) {
              return shell || caches.match('./');
            });
          });
        })
    );
    return;
  }

  /* Archivos propios y externos: caché primero + revalidación en segundo plano. */
  const cachedPromise = caches.match(request);
  const networkPromise = fetch(request)
    .then(function (response) {
      if (response && (response.ok || response.type === 'opaque')) {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then(function (cache) {
          cache.put(request, copy).catch(function () { /* cuota llena */ });
        });
      }
      return response;
    })
    .catch(function () {
      return cachedPromise;
    });

  event.waitUntil(networkPromise.then(function () { /* noop */ }).catch(function () { /* noop */ }));

  event.respondWith(
    cachedPromise.then(function (cached) {
      if (cached) return cached;
      if (isSameOrigin && request.destination === 'document') {
        return caches.match('./index.html').then(function (shell) {
          return shell || networkPromise;
        });
      }
      return networkPromise;
    })
  );
});
