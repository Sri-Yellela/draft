// ⭐ D119 (owner 10-31) · THUMBNAILS — one resolver (services/thumbs/resourceThumbs.js), stored not hot-linked (migration
// 204), one tile (client/src/components/ResourceTile.jsx). Synthetic URLs and pictures; the network is an injected fetch
// that answers from a table, so nothing here leaves the machine. No model.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  thumbPlan, youtubeId, resolveThumb, refreshThumbs, pinVideo, hideThumb, thumbIndex, storedThumb, shareImageOf, robotsAllows,
  urlHash, THUMB_UA, THUMBS,
} from "../services/thumbs/resourceThumbs.js";
import { createThumbsRouter, createThumbsAdminRouter, learnItems } from "../routes/thumbs.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 7)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 3)]);
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, ua: opts.headers?.["user-agent"] });
    const r = routes[url];
    if (r === undefined) return { ok: false, status: 404, url, arrayBuffer: async () => new ArrayBuffer(0) };
    const buf = Buffer.isBuffer(r) ? r : Buffer.from(typeof r === "string" ? r : JSON.stringify(r));
    return { ok: true, status: 200, url, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) };
  };
  fn.calls = calls;
  return fn;
}
const db0 = () => { const db = new Database(":memory:"); for (const m of MIGRATIONS) db.exec(m.sql); return db; };
const WATCH = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const SEARCH = "https://www.youtube.com/results?search_query=Crash%20Course%20Computer%20Science%20episode%201";

test("D119 P1 · thumbPlan — a watch URL, a search URL, a book, a site", () => {
  assert.equal(youtubeId(WATCH), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId(SEARCH), null);
  assert.equal(thumbPlan({ k: "Video", u: WATCH }).image, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.deepEqual(thumbPlan({ k: "Video", u: SEARCH }), { kind: "youtube_search", query: "Crash Course Computer Science episode 1" });
  const b = thumbPlan({ k: "Book", u: "https://openlibrary.org/search?q=x", t: "Code: The Hidden Language", s: "Charles Petzold" });
  assert.equal(b.kind, "book");
  assert.match(b.api, /^https:\/\/openlibrary\.org\/search\.json\?limit=1&fields=cover_i,title,author_name&title=Code&author=Charles%20Petzold$/);
  assert.equal(thumbPlan({ k: "Article", u: "https://example.org/a" }).kind, "site");
});

test("D119 · d119WatchUrlThumbnail — YouTube's own thumbnail for that id, stored, with its title and channel from oEmbed", async () => {
  const db = db0();
  const f = fakeFetch({ "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg": JPG,
    [thumbPlan({ u: WATCH }).oembed]: { title: "A synthetic lecture", author_name: "Synthetic Channel" } });
  const t = await resolveThumb(db, { k: "Video", u: WATCH, t: "Lecture" }, { fetchImpl: f });
  assert.equal(t.kind, "youtube");
  assert.equal(t.src, `/api/thumbs/${urlHash(WATCH)}`);
  assert.equal(t.title, "A synthetic lecture");
  assert.equal(t.attribution, "YouTube · Synthetic Channel");
  assert.ok(f.calls.every(c => c.ua === THUMB_UA), "a descriptive User-Agent on every request");
  assert.deepEqual(storedThumb(db, urlHash(WATCH)).mime, "image/jpeg");
});

test("D119 · d119SearchLinkNoInventedThumb — a YouTube SEARCH link fetches nothing and invents no picture", async () => {
  const db = db0();
  const f = fakeFetch({});
  const t = await resolveThumb(db, { k: "Video", u: SEARCH }, { fetchImpl: f });
  assert.deepEqual([t.kind, t.src, t.note], ["youtube_search", null, "search: Crash Course Computer Science episode 1"]);
  assert.equal(f.calls.length, 0, "no request for a search link");
  // the tracker as it stands: every one of its YouTube links is a search link (measured 11-01: 115 of 115)
  const tracker = JSON.parse(fs.readFileSync("content/learn/silicon-to-software.json", "utf8"));
  const urls = []; const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (o.u && o.k) urls.push(o.u); Object.values(o).forEach(walk); } }; walk(tracker);
  const yt = urls.filter(u => /youtube\.com|youtu\.be/.test(u));
  assert.ok(yt.length > 100 && yt.every(u => thumbPlan({ u }).kind === "youtube_search"));
});

test("D119 · d119PinAVideo — an admin pins a watch URL to a search link → the real thumbnail; a non-watch URL is refused", async () => {
  const db = db0();
  const f = fakeFetch({ "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg": JPG });
  assert.equal((await pinVideo(db, SEARCH, "https://example.org/not-youtube", { fetchImpl: f })).ok, false);
  const r = await pinVideo(db, SEARCH, WATCH, { by: "curator@example.test", fetchImpl: f });
  assert.equal(r.ok, true);
  assert.equal(r.thumb.kind, "youtube");
  assert.equal(r.thumb.src, `/api/thumbs/${urlHash(SEARCH)}`, "stored under the item's own URL");
  assert.equal(r.thumb.pinned, true);
  // a later refresh keeps the pin
  const again = await resolveThumb(db, { k: "Video", u: SEARCH }, { fetchImpl: f });
  assert.equal(again.kind, "youtube");
});

test("D119 · d119OpenLibraryCover — a book's cover from Open Library, said as such; no match → the typographic tile", async () => {
  const db = db0();
  const item = { k: "Book", u: "https://openlibrary.org/search?q=Code", t: "Code: The Hidden Language", s: "Charles Petzold" };
  const f = fakeFetch({ [thumbPlan(item).api]: { docs: [{ cover_i: 12345 }] }, "https://covers.openlibrary.org/b/id/12345-M.jpg": JPG });
  const t = await resolveThumb(db, item, { fetchImpl: f });
  assert.deepEqual([t.kind, !!t.src, t.attribution], ["book", true, "Cover: Open Library"]);
  const none = { ...item, u: "https://openlibrary.org/search?q=Nothing", t: "No Such Book", s: "Nobody" };
  const t2 = await resolveThumb(db, none, { fetchImpl: fakeFetch({ [thumbPlan(none).api]: { docs: [] } }) });
  assert.deepEqual([t2.kind, t2.src], ["book", null]);
});

test("D119 · d119OgImageStoredNotHotlinked — the page's share image is fetched once and served from draft; robots.txt and the size cap are honoured", async () => {
  assert.equal(shareImageOf(`<head><meta property="og:image" content="/img/card.png"></head>`, "https://site.example/a"), "https://site.example/img/card.png");
  assert.equal(shareImageOf(`<meta name='twitter:image' content='https://cdn.example/t.jpg'>`, "https://x.example/"), "https://cdn.example/t.jpg");
  assert.equal(robotsAllows("User-agent: *\nDisallow: /private", "https://s.example/private/a"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /private\nAllow: /private/ok", "https://s.example/private/ok"), true);
  assert.equal(robotsAllows("", "https://s.example/a"), true);
  const db = db0();
  const page = "https://site.example/article";
  const f = fakeFetch({ [page]: `<html><head><meta property="og:image" content="https://site.example/card.png"></head></html>`, "https://site.example/card.png": PNG });
  const t = await resolveThumb(db, { k: "Article", u: page }, { fetchImpl: f });
  assert.equal(t.src, `/api/thumbs/${urlHash(page)}`, "the src is draft's copy");
  assert.ok(!JSON.stringify(t).includes("card.png"), "the original picture URL is never handed to the page");
  assert.equal(t.attribution, "site.example");
  const blocked = "https://closed.example/a";
  const t2 = await resolveThumb(db, { k: "Article", u: blocked }, { fetchImpl: fakeFetch({ "https://closed.example/robots.txt": "User-agent: *\nDisallow: /", [blocked]: "<meta property='og:image' content='/x.png'>" }) });
  assert.equal(t2.src, null);
  const big = "https://big.example/a";
  const t3 = await resolveThumb(db, { k: "Article", u: big }, { fetchImpl: fakeFetch({ [big]: `<meta property="og:image" content="https://big.example/huge.png">`, "https://big.example/huge.png": Buffer.concat([PNG, Buffer.alloc(THUMBS.MAX_BYTES)]) }) });
  assert.equal(t3.src, null, "over 2 MB is not stored");
  assert.equal(db.prepare(`SELECT status FROM resource_thumbs WHERE url_hash = ?`).pluck().get(urlHash(big)), "failed");
});

test("D119 · refresh: monthly, capped, hidden skipped; GET /api/thumbs serves the stored bytes, and /learn the index", async () => {
  const db = db0();
  const page = "https://site.example/a";
  const f = fakeFetch({ [page]: `<meta property="og:image" content="https://site.example/c.png">`, "https://site.example/c.png": PNG });
  const items = [{ k: "Article", u: page }, { k: "Video", u: SEARCH }];
  const r1 = await refreshThumbs(db, items, { fetchImpl: f, pauseMs: 0 });
  assert.equal(r1.checked, 2);
  assert.equal((await refreshThumbs(db, items, { fetchImpl: f, pauseMs: 0 })).checked, 0, "not again within the month");
  assert.equal((await refreshThumbs(db, items, { fetchImpl: f, pauseMs: 0, now: Math.floor(Date.now() / 1000) + 31 * 86400 })).checked, 2);
  const app = express();
  app.use(express.json());
  app.use("/api/thumbs", createThumbsRouter(db));
  app.use("/api/admin/thumbs", createThumbsAdminRouter(db, { fetchImpl: f }));
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const img = await fetch(`${base}/api/thumbs/${urlHash(page)}`);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get("content-type"), "image/png");
    assert.equal(img.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await fetch(`${base}/api/thumbs/${"0".repeat(64)}`)).status, 404);
    assert.equal((await fetch(`${base}/api/thumbs/not-a-hash`)).status, 404);
    const idx = await (await fetch(`${base}/api/thumbs/learn`)).json();
    assert.ok(idx.thumbs && typeof idx.thumbs === "object");
    const admin = await (await fetch(`${base}/api/admin/thumbs/learn`)).json();
    assert.ok(Array.isArray(admin.rows));
    assert.ok("youtubeSearch" in admin.counts && "youtubeWatch" in admin.counts);
  } finally { server.close(); }
});

test("D119 · d119AdminHide — one press hides a picture (never served, the tile falls back); it can be shown again", async () => {
  const db = db0();
  const page = "https://site.example/a";
  await resolveThumb(db, { k: "Article", u: page }, { fetchImpl: fakeFetch({ [page]: `<meta property="og:image" content="https://site.example/c.png">`, "https://site.example/c.png": PNG }) });
  assert.ok(storedThumb(db, urlHash(page)));
  assert.equal(hideThumb(db, page, { by: "curator@example.test" }).ok, true);
  assert.equal(storedThumb(db, urlHash(page)), null);
  assert.equal(thumbIndex(db, [page])[page].src, null);
  assert.equal(thumbIndex(db, [page])[page].hidden, true);
  const r = await refreshThumbs(db, [{ k: "Article", u: page }], { fetchImpl: fakeFetch({}), pauseMs: 0, now: Math.floor(Date.now() / 1000) + 40 * 86400 });
  assert.equal(r.checked, 0, "a hidden picture is not fetched again");
  hideThumb(db, page, { hidden: false });
  assert.ok(storedThumb(db, urlHash(page)));
});

test("D119 · d119NeverInDocuments — no résumé, PDF or cover-letter path reaches the thumbnails", () => {
  const prod = [...fs.readdirSync("services", { recursive: true }).map(String).map(f => `services/${f.replace(/\\/g, "/")}`),
    ...fs.readdirSync("routes").map(f => `routes/${f}`), "server.js"].filter(f => /\.(m?js)$/.test(f) && fs.statSync(f).isFile());
  const importers = prod.filter(f => /resourceThumbs\.js|routes\/thumbs\.js/.test(read(f)) && !f.endsWith("resourceThumbs.js"));
  assert.deepEqual(importers.sort(), ["routes/thumbs.js", "server.js"].sort(), "only the thumbnails' own route and the mount");
  const client = fs.readdirSync("client/src", { recursive: true }).map(String).map(f => `client/src/${f.replace(/\\/g, "/")}`).filter(f => /\.jsx?$/.test(f));
  const tileUsers = client.filter(f => /ResourceTile\.jsx/.test(read(f)) && !f.endsWith("ResourceTile.jsx"));
  for (const f of tileUsers) assert.doesNotMatch(f, /resume|Resume|pdf|Pdf|Cover|Sandbox|DocToolbar/, f);
});

test("D119 · d119FallbackTile · d119TileRecordsOpened · d119OneTileComponent — the tile, as drawn", async () => {
  const CLIENT = path.resolve("client");
  const esbuild = createRequire(path.join(CLIENT, "package.json"))("esbuild");
  const abs = JSON.stringify(path.join(CLIENT, "src", "components/ResourceTile.jsx").split(path.sep).join("/"));
  const out = await esbuild.build({ stdin: { contents: `import { createElement as h } from "react"; import { renderToStaticMarkup } from "react-dom/server.browser";
      import ResourceTile from ${abs}; export const tile = (p) => renderToStaticMarkup(h(ResourceTile, p));`, resolveDir: CLIENT, loader: "jsx" },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic", loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' } });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d119-")), file = path.join(dir, "t.mjs");
  fs.writeFileSync(file, out.outputFiles[0].text);
  const { tile } = await import(pathToFileURL(file).href);
  fs.rmSync(dir, { recursive: true, force: true });
  const search = tile({ item: { id: "v1", k: "Video", u: SEARCH, t: "Episode 1" } });
  assert.match(search, /data-thumb="search"[\s\S]*YouTube · search: Crash Course Computer Science episode 1/);
  assert.doesNotMatch(search, /<img/, "no picture invented for a search");
  assert.match(tile({ item: { id: "b1", k: "Book", u: "https://openlibrary.org/x", t: "Code", s: "Charles Petzold" } }), /rt__fb--book"><b>Code<\/b><span>Charles Petzold<\/span>/);
  assert.match(tile({ item: { id: "a1", k: "Article", u: "https://site.example/a", t: "A" } }), /rt__fb--site"><b aria-hidden="true">S<\/b><span>site\.example<\/span>/);
  const pic = tile({ item: { id: "a2", k: "Article", u: "https://site.example/a", t: "An article" }, thumb: { kind: "site", src: "/api/thumbs/abc", attribution: "site.example" }, opened: true });
  assert.match(pic, /<img src="\/api\/thumbs\/abc" alt="An article" loading="lazy"/);
  assert.match(pic, /<a class="rt" href="https:\/\/site\.example\/a" target="_blank" rel="noopener noreferrer" data-resource-tile="a2" data-learn-open="a2">/, "the whole tile is the link");
  assert.match(pic, /data-learn-opened="a2">opened</, "its C8 state: opened, never done");
  assert.doesNotMatch(pic, /\bdone\b|checkbox/);
  const css = read("client/src/components/ResourceTile.css");
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|999px|border-radius:\s*50%/i);
  assert.match(css, /repeat\(auto-fill, minmax\(min\(100%, 200px\), 1fr\)\)/, "a grid that wraps, no fixed widths");
  // one tile: Learn draws ResourceTile and no picture of its own
  const learn = read("client/src/pages/atlas/LearnCircle.jsx");
  assert.match(learn, /<ResourceTile item=\{it\}/);
  assert.doesNotMatch(learn, /<img\b/);
});

test("D119 · Admin → Atlas → Learn: the thumbnails panel — the counts, Pin a video per search link, Hide / Show again per stored picture", () => {
  const src = read("client/src/panels/adminLearnCircle.jsx");
  assert.match(src, /export function LearnThumbnails\(\)/);
  assert.match(src, /act\("\/api\/admin\/thumbs\/pin", "POST", \{ url: r\.u, watchUrl: watch\.trim\(\) \}\)/);
  assert.match(src, /act\("\/api\/admin\/thumbs\/hide", "POST", \{ url: r\.u, hidden: !r\.thumb\.hidden \}\)/);
  assert.match(read("client/src/panels/adminAtlas.jsx"), /<LearnThumbnails \/>/);
});
