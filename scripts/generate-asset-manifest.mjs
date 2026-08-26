import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";

const publicDir = new URL("../public/", import.meta.url);
const dataDir = new URL("../public/data/", import.meta.url);
const catalogSource = new URL("../public/data/patterns-v1.json", import.meta.url);
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

await mkdir(dataDir, { recursive: true });
const catalog = await readFile(catalogSource);
const catalogRevision = digest(catalog);
const catalogName = `patterns-v2.${catalogRevision.slice(0, 12)}.json`;
await copyFile(catalogSource, new URL(catalogName, dataDir));

const staticFiles = (await filesBelow(publicDir.pathname)).filter((path) => {
  const name = basename(path);
  return name !== "asset-manifest.json" && !/^patterns-v2\.[a-f0-9]+\.json$/.test(name);
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
assets.push({ path: "/", revision: catalogRevision.slice(0, 16), size: 0, scope: "app" });
const buildRevision = digest(Buffer.from(assets.map((asset) => `${asset.path}:${asset.revision}`).join("\n"))).slice(0, 16);
const manifest = {
  version: 1,
  buildRevision,
  generatedAt: new Date().toISOString(),
  catalogPath: `/data/${catalogName}`,
  catalogRevision,
  assets,
};
await writeFile(new URL("asset-manifest.json", publicDir), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`asset-manifest ${buildRevision}: ${assets.length} Dateien, ${(assets.reduce((sum, asset) => sum + asset.size, 0) / 1024 / 1024).toFixed(2)} MB`);
