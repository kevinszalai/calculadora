// Subí la versión (v1 -> v2 -> v3...) cada vez que redeployes,
// así los usuarios no se quedan con una versión vieja cacheada.
const CACHE_NAME = 'calculadora-v24';

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) => cache.add(url).catch(() => {}))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Los pedidos a otros orígenes (como la cotización del dólar en
// dolarapi.com) se dejan pasar directo a la red: esa información
// tiene que ser siempre en vivo, no cacheada.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Red primero para el documento principal (HTML) y el manifest: así,
  // apenas subís un cambio, la próxima vez que se abre la app ya se ve
  // (no hace falta abrirla dos veces). Si no hay conexión, cae a la
  // copia guardada para que siga funcionando offline.
  const isDocument = event.request.mode === 'navigate' || requestUrl.pathname.endsWith('.html') || requestUrl.pathname.endsWith('.json');
  if (isDocument){
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200){
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first para el resto (íconos): rara vez cambian, priorizamos
  // velocidad.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
