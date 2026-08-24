const CACHE_PREFIX = "klangmass-";
const CACHE = `${CACHE_PREFIX}v10`;
const CORE = ["/", "/manifest.webmanifest", "/data/patterns-v1.json", "/icon-192.png", "/icon-512.png"];

async function putIfUsable(cache, request, response) {
  if (response && response.ok && new URL(request.url || request, self.location.origin).origin === self.location.origin) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
    return;
  }
  if (event.data?.type !== "PRECACHE_URLS" || !Array.isArray(event.data.urls)) return;
  const urls = [...new Set(event.data.urls)].flatMap((value) => {
    try {
      const url = new URL(value, self.location.origin);
      return url.origin === self.location.origin ? [url.href] : [];
    } catch { return []; }
  });
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(urls.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        await putIfUsable(cache, url, response);
      } catch { /* A single optional asset must not block offline readiness. */ }
    }));
    event.source?.postMessage({ type: "OFFLINE_READY" });
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/signin-") || url.pathname.startsWith("/signout-")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        event.waitUntil(putIfUsable(cache, request, response));
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match("/")) || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  if (["script", "style", "font", "image", "audio"].includes(request.destination) || url.pathname.startsWith("/data/") || url.pathname.startsWith("/audio/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        event.waitUntil(putIfUsable(cache, request, response));
        return response;
      } catch {
        return new Response("Offline asset unavailable", { status: 503 });
      }
    })());
  }
});
