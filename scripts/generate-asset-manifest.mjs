import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";

const publicDir = new URL("../public/", import.meta.url);
const dataDir = new URL("../public/data/", import.meta.url);
const catalogSource = new URL("../public/data/patterns-v1.json", import.meta.url);
const serviceWorkerSource = new URL("../public/sw.js", import.meta.url);
const digest = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(path));
    else output.push(path);
  }
  return output;
}

const sourceFiles = [
  ...await filesBelow(new URL("../app/", import.meta.url).pathname),
  ...await filesBelow(new URL("../worker/", import.meta.url).pathname),
  new URL("../next.config.ts", import.meta.url).pathname,
  new URL("../package.json", import.meta.url).pathname,
  new URL("../package-lock.json", import.meta.url).pathname,
  new URL("../postcss.config.mjs", import.meta.url).pathname,
  new URL("../tsconfig.json", import.meta.url).pathname,
  new URL("../vite.config.ts", import.meta.url).pathname,
].sort();
const sourceRevision = digest(Buffer.from((await Promise.all(sourceFiles.map(async (path) =>
  `${relative(new URL("../", import.meta.url).pathname, path)}:${digest(await readFile(path))}`,
))).join("\n")));
const serviceWorker = await readFile(serviceWorkerSource, "utf8");
if (!/^const SOURCE_REVISION = "[a-f0-9]{64}";$/m.test(serviceWorker)) {
  throw new Error("Service Worker enthält keine gültige SOURCE_REVISION");
}
await writeFile(serviceWorkerSource, serviceWorker.replace(
  /^const SOURCE_REVISION = "[a-f0-9]{64}";$/m,
  `const SOURCE_REVISION = "${sourceRevision}";`,
));

await mkdir(dataDir, { recursive: true });
const catalog = await readFile(catalogSource);
const catalogRevision = digest(catalog);
const catalogName = `patterns-v2.${catalogRevision.slice(0, 12)}.json`;
await copyFile(catalogSource, new URL(catalogName, dataDir));

const staticFiles = (await filesBelow(publicDir.pathname)).filter((path) => {
  const name = basename(path);
  return name !== ".DS_Store" && name !== "asset-manifest.json" && !/^patterns-v2\.[a-f0-9]+\.json$/.test(name);
});
const assets = [];
for (const path of staticFiles) {
  const contents = await readFile(path);
  const url = `/${relative(publicDir.pathname, path).split(sep).join("/")}`;
  const kitMatch = /^\/audio\/drums\/([^/]+)\//.exec(url);
  assets.push({
    path: url,
    revision: digest(contents),
    size: (await stat(path)).size,
    scope: kitMatch ? "audio" : url.startsWith("/data/") ? "catalog" : "app",
    ...(kitMatch ? { kit: kitMatch[1] } : {}),
  });
}
assets.push({ path: `/data/${catalogName}`, revision: catalogRevision, size: catalog.byteLength, scope: "catalog" });
assets.push({ path: "/", revision: sourceRevision, size: 0, scope: "app" });
const buildRevision = digest(Buffer.from([
  `source:${sourceRevision}`,
  ...assets.map((asset) => `${asset.path}:${asset.revision}`),
].join("\n"))).slice(0, 16);
const manifest = {
  version: 2,
  buildRevision,
  sourceRevision,
  catalogPath: `/data/${catalogName}`,
  catalogRevision,
  assets,
};
await writeFile(new URL("asset-manifest.json", publicDir), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`asset-manifest ${buildRevision}: ${assets.length} Dateien, ${(assets.reduce((sum, asset) => sum + asset.size, 0) / 1024 / 1024).toFixed(2)} MB`);
