import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Klangmaß metronome product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Klangmaß — Präzises Metronom/);
  assert.match(html, /KLANGMASS/);
  assert.match(html, /TAP TEMPO/);
  assert.match(html, /Beat-Bibliothek/);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships a versioned library with 100 complete patterns", async () => {
  const library = JSON.parse(await readFile(new URL("../public/data/patterns-v1.json", import.meta.url), "utf8"));
  assert.equal(library.version, 1);
  assert.equal(library.count, 100);
  assert.equal(library.patterns.length, 100);
  for (const pattern of library.patterns) {
    for (const field of ["name", "category", "bpmMin", "bpmMax", "meter", "subdivision", "pattern", "difficulty", "instruction"]) {
      assert.ok(pattern[field] !== undefined, `${pattern.id} lacks ${field}`);
    }
    assert.ok(pattern.pattern.length > 0);
  }
});

test("includes complete PWA assets", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 2);
  assert.match(serviceWorker, /patterns-v1\.json/);
  assert.match(serviceWorker, /caches\.open/);
});
