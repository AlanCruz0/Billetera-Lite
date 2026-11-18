// Service Worker de Mi Billetera Lite.
// IMPORTANTE: cada vez que cambies un archivo del App Shell, sube CACHE_VERSION
// para que los usuarios reciban la nueva versión y se borre la caché anterior.

const CACHE_VERSION = 'v2';
const CACHE_PREFIX = 'billetera-lite-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// Archivos estáticos necesarios para renderizar la interfaz (App Shell).
// El HTML se guarda solo como './': algunos servidores redirigen '/index.html'
// y Chrome no acepta respuestas redirigidas al responder una navegación.
const APP_SHELL = [
  './',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

// install: precachear el App Shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// activate: eliminar cachés de versiones anteriores.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves
          .filter((clave) => clave.startsWith(CACHE_PREFIX) && clave !== CACHE_NAME)
          .map((clave) => caches.delete(clave))
      ))
      .then(() => self.clients.claim())
  );
});

// fetch: Cache First, Network Fallback.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  const esNavegacion = request.mode === 'navigate';

  event.respondWith(
    caches.match(request, { ignoreSearch: esNavegacion }).then((enCache) => {
      if (enCache) return enCache;

      return fetch(request)
        .then((respuesta) => {
          // Guarda en caché los recursos propios que no estaban precacheados.
          if (respuesta.ok && respuesta.type === 'basic') {
            const copia = respuesta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          }
          return respuesta;
        })
        .catch(() => {
          // Sin red y sin caché: cualquier navegación muestra la app.
          if (esNavegacion) return caches.match('./');
          return new Response('', { status: 503, statusText: 'Sin conexión' });
        });
    })
  );
});
