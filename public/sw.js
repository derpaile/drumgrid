const PREFIX = "drumgrid-";
const LEGACY_PREFIXES = ["klangmass-"];
const META_CACHE = `${PREFIX}meta`;
let activeManifestPromise = null;

const cacheNames = (revision) => ({
  app: `${PREFIX}app-${revision}`,
  catalog: `${PREFIX}catalog-${revision}`,
  audio: `${PREFIX}audio-${revision}`,
});

async function fetchManifest() {
  const response = await fetch("/asset-manifest.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Asset-Manifest nicht erreichbar");
  return response.json();
}

async function storedManifest() {
  if (!activeManifestPromise) activeManifestPromise = caches.open(META_CACHE).then(async (cache) => {
    const response = await cache.match("/active-manifest");
    return response ? response.json() : fetchManifest();
  });
  return activeManifestPromise;
}

async function verifiedResponse(asset) {
  const response = await fetch(asset.path, { cache: "reload" });
  if (!response.ok) throw new Error(`${asset.path}: ${response.status}`);
  if (!asset.revision || asset.size === 0 || !self.crypto?.subtle) return response;
  const bytes = await response.clone().arrayBuffer();
  if (bytes.byteLength !== asset.size) throw new Error(`${asset.path}: Größe stimmt nicht`);
  const hash = [...new Uint8Array(await self.crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join("");
  if (hash !== asset.revision) throw new Error(`${asset.path}: Revision stimmt nicht`);
  return response;
}

async function cacheAssets(manifest, scope, selected = () => true) {
  const names = cacheNames(manifest.buildRevision);
  const cache = await caches.open(names[scope]);
  const assets = manifest.assets.filter((asset) => asset.scope === scope && selected(asset));
  for (const asset of assets) await cache.put(asset.path, await verifiedResponse(asset));
  return assets.length;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const manifest = await fetchManifest();
    await cacheAssets(manifest, "app");
    await cacheAssets(manifest, "catalog", (asset) => asset.path === manifest.catalogPath);
    const meta = await caches.open(META_CACHE);
    await meta.put("/pending-manifest", new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/json" } }));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const meta = await caches.open(META_CACHE);
    const pending = await meta.match("/pending-manifest");
    if (!pending) throw new Error("Kein validiertes Update vorhanden");
    const manifest = await pending.json();
    await meta.put("/active-manifest", new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/json" } }));
    await meta.delete("/pending-manifest");
    const keep = new Set([META_CACHE, ...Object.values(cacheNames(manifest.buildRevision))]);
    await Promise.all((await caches.keys()).filter((key) => (key.startsWith(PREFIX) || LEGACY_PREFIXES.some((prefix) => key.startsWith(prefix))) && !keep.has(key)).map((key) => caches.delete(key)));
    activeManifestPromise = Promise.resolve(manifest);
    await self.clients.claim();
  })());
});

async function offlineStatus(manifest) {
  const names = cacheNames(manifest.buildRevision);
  const app = await caches.open(names.app);
  const catalog = await caches.open(names.catalog);
  const audio = await caches.open(names.audio);
  const meta = await caches.open(META_CACHE);
  const requiredApp = manifest.assets.filter((asset) => asset.scope === "app");
  const catalogAsset = manifest.assets.find((asset) => asset.path === manifest.catalogPath);
  const kits = [...new Set(manifest.assets.flatMap((asset) => asset.kit || []))];
  const availableKits = [];
  for (const kit of kits) {
    const paths = manifest.assets.filter((asset) => asset.kit === kit).map((asset) => asset.path);
    if ((await Promise.all(paths.map((path) => audio.match(path)))).every(Boolean)) availableKits.push(kit);
  }
  const runtimeResponse = await meta.match("/runtime-paths");
  const runtimePaths = runtimeResponse ? await runtimeResponse.json() : [];
  const runtimeReady = runtimePaths.length > 1 && (await Promise.all(runtimePaths.map((path) => app.match(path)))).every(Boolean);
  const appReady = runtimeReady && (await Promise.all(requiredApp.map((asset) => app.match(asset.path)))).every(Boolean) && Boolean(catalogAsset && await catalog.match(catalogAsset.path));
  return {
    type: "OFFLINE_STATUS",
    buildRevision: manifest.buildRevision,
    appReady,
    availableKits: availableKits.length + 1,
    totalKits: kits.length + 1,
    totalAudioBytes: manifest.assets.filter((asset) => asset.scope === "audio").reduce((sum, asset) => sum + asset.size, 0),
  };
}

self.addEventListener("message", (event) => {
  event.waitUntil((async () => {
    if (event.data?.type === "SKIP_WAITING") return self.skipWaiting();
    const manifest = await storedManifest();
    if (event.data?.type === "CACHE_ALL_KITS") await cacheAssets(manifest, "audio");
    if (event.data?.type === "CACHE_KIT" && Array.isArray(event.data.paths)) {
      const wanted = new Set(event.data.paths);
      await cacheAssets(manifest, "audio", (asset) => wanted.has(asset.path));
    }
    if (event.data?.type === "CACHE_RUNTIME" && Array.isArray(event.data.paths)) {
      const paths = [...new Set(event.data.paths)].flatMap((value) => {
        try { const url = new URL(value, self.location.origin); return url.origin === self.location.origin ? [url.pathname + url.search] : []; } catch { return []; }
      });
      const app = await caches.open(cacheNames(manifest.buildRevision).app);
      for (const path of paths) {
        const response = await fetch(path, { cache: "reload" });
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
        await app.put(path, response);
      }
      const meta = await caches.open(META_CACHE);
      await meta.put("/runtime-paths", new Response(JSON.stringify(paths), { headers: { "Content-Type": "application/json" } }));
    }
    if (["CACHE_ALL_KITS", "CACHE_KIT", "CACHE_RUNTIME", "GET_OFFLINE_STATUS"].includes(event.data?.type)) {
      event.source?.postMessage(await offlineStatus(manifest));
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/signin-") || url.pathname.startsWith("/signout-")) return;
  event.respondWith((async () => {
    const manifest = await storedManifest();
    const names = cacheNames(manifest.buildRevision);
    if (url.pathname === "/asset-manifest.json") {
      try { return await fetch(request, { cache: "no-store" }); } catch { return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/json" } }); }
    }
    if (url.pathname.startsWith("/data/")) {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response.ok) await (await caches.open(names.catalog)).put(request, response.clone());
        return response;
      } catch { return (await caches.open(names.catalog)).match(request) || new Response("Katalog offline nicht verfügbar", { status: 503 }); }
    }
    const scope = url.pathname.startsWith("/audio/") ? "audio" : "app";
    const cache = await caches.open(names[scope]);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) event.waitUntil(cache.put(request, response.clone()));
      return response;
    } catch {
      if (request.mode === "navigate") return (await cache.match("/")) || new Response("Offline", { status: 503 });
      return new Response("Offline asset unavailable", { status: 503 });
    }
  })());
});
