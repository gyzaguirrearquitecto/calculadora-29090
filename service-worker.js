const CACHE = "cvu-hon-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./assets/styles.css",
  "./assets/utils.js",
  "./assets/app.js",
  "./data/cvu_lima_callao_2025_12.json",
  "./data/honorarios_por_area.json",
  "./data/fases_cobro.json",
  "./data/tipos_obra.json",
  "./data/cimentacion_defaults.json",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if(cached) return cached;
    try{
      const fresh = await fetch(e.request);
      return fresh;
    }catch(err){
      return cached || new Response("Sin conexión.", { status: 503 });
    }
  })());
});
