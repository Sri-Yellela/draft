#!/usr/bin/env node
// A112 · THE CRAWLER BOOST — discovery. Every public ATS board the open web has linked, read from the Common Crawl
// URL index, turned into (atsType, slug) candidates for scripts/a112ProbeMany.mjs.
//
// Why Common Crawl: no ATS publishes a cross-customer feed (COMPANY_LIST_STRATEGY.md), and SerpApi's free plan is
// 250 searches a month (D20). A crawl index lists every boards.greenhouse.io/<slug>, jobs.lever.co/<slug>,
// jobs.ashbyhq.com/<slug> … page it fetched, so one pass names thousands of employers we have never seen.
// ⛔ A URL proves a page existed, not that a board is worth crawling — everything found here is a CANDIDATE; the
// probe (live, US, within the age limit, in scope) and D80's admission rule decide.
//
// HOW: not the CDX server (index.commoncrawl.org answers 504 most of the time) but the files it reads, from the CDN:
// `cluster.idx` (≈ 100 MB per crawl: the first SURT key of every 3,000-line block, with its file / offset / length),
// then byte ranges of `cdx-000NN.gz` for just the blocks under each host's SURT prefix. Each block is its own gzip
// member, so a range gunzips alone.
//
//   node scripts/a112DiscoverBoards.mjs --out <dir> [--crawl CC-MAIN-2026-39,CC-MAIN-2026-34] [--ats greenhouse,lever,…]
// Writes <dir>/discovered-<ats>.json ([{ atsType, slug, company: "" }]). cluster.idx and the blocks are cached in
// <dir>/cc/ (a re-run reads nothing twice).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { excludedCompany } from "../services/companyList.js";

const NOT_SLUG = new Set(["embed", "api", "v1", "v0", "jobs", "job", "careers", "static", "assets", "favicon.ico", "robots.txt",
  "sitemap.xml", "search", "privacy", "legal", "en", "en-us", "login", "signup", "404", "500", "error", "widget", "oauth", "j"]);
const first = (u) => { try { return decodeURIComponent(u.pathname.split("/").filter(Boolean)[0] || ""); } catch { return ""; } };

// SURT prefix → how a URL names its board.
export const HOSTS = {
  greenhouse: [
    { surt: "io,greenhouse,boards)/", slug: (u) => u.searchParams.get("for") || first(u) },
    { surt: "io,greenhouse,job-boards)/", slug: (u) => u.searchParams.get("for") || first(u) },
  ],
  lever: [{ surt: "co,lever,jobs)/", slug: first }],
  ashby: [{ surt: "com,ashbyhq,jobs)/", slug: first }],
  smartrecruiters: [{ surt: "com,smartrecruiters,jobs)/", slug: first }, { surt: "com,smartrecruiters,careers)/", slug: first }],
  workable: [{ surt: "com,workable,apply)/", slug: first }],
  recruitee: [{ surt: "com,recruitee,", slug: (u) => u.hostname.split(".")[0] }],
  bamboohr: [{ surt: "com,bamboohr,", slug: (u) => (/^[a-z0-9-]+\.bamboohr\.com$/i.test(u.hostname) && !/^(www|api|help|partners|marketplace)\./i.test(u.hostname) ? u.hostname.split(".")[0] : "") }],
  gem: [{ surt: "com,gem,jobs)/", slug: first }],
  // https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced → "5|adobe|external_experienced"
  workday: [{ surt: "com,myworkdayjobs,", slug: (u) => {
    const m = u.hostname.match(/^([a-z0-9-]+)\.wd(\d+)\.myworkdayjobs\.com$/i);
    if (!m) return "";
    const parts = u.pathname.split("/").filter(Boolean).filter((p) => !/^[a-z]{2}(-[A-Za-z]{2})?$/.test(p));
    const site = parts[0] || "";
    if (!site || /^(wday|job|details|login|apply|recruiting|robots.txt|sitemap.xml|favicon.ico)$/i.test(site)) return "";
    return `${m[2]}|${m[1].toLowerCase()}|${site}`;
  } }],
};

/** One URL → a cleaned slug, or "". */
export function slugOf(atsType, rule, rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return ""; }
  let s = String(rule.slug(u) || "").trim();
  if (atsType !== "workday") s = s.replace(/[^A-Za-z0-9._-].*$/, "");
  if (!s || NOT_SLUG.has(s.toLowerCase()) || !/^[A-Za-z0-9][A-Za-z0-9._|-]{0,119}$/.test(s)) return "";
  if (excludedCompany({ slug: s })) return "";
  return s;
}

/** The cluster.idx lines whose blocks can hold keys under `prefix` (sorted index: the block before the first match too). */
export function blocksFor(lines, prefix) {
  let lo = 0, hi = lines.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (lines[mid].key < prefix) lo = mid + 1; else hi = mid; }
  const out = [];
  for (let i = Math.max(0, lo - 1); i < lines.length; i++) {
    if (i >= lo && !lines[i].key.startsWith(prefix)) break;
    out.push(lines[i]);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchBuf(url, range, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "draft-board-discovery/1.0 (+https://jobsviadraft.com)", ...(range ? { range } : {}) },
        signal: AbortSignal.timeout(600000) });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch { /* retry */ }
    await sleep(3000 * (i + 1));
  }
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
  const outDir = flag("out");
  if (!outDir) { console.error("usage: --out <dir> [--crawl CC-MAIN-2026-39,…] [--ats greenhouse,lever,ashby,workday,smartrecruiters,workable,recruitee]"); process.exit(2); }
  const crawls = flag("crawl", "CC-MAIN-2026-39").split(",");
  const wanted = flag("ats", Object.keys(HOSTS).join(",")).split(",");
  const cache = path.join(outDir, "cc");
  fs.mkdirSync(cache, { recursive: true });
  const found = Object.fromEntries(wanted.map((a) => [a, new Map()]));

  for (const crawl of crawls) {
    const base = `https://data.commoncrawl.org/cc-index/collections/${crawl}/indexes/`;
    const idxFile = path.join(cache, `${crawl}-cluster.idx`);
    if (!fs.existsSync(idxFile)) {
      console.log(`[a112] ${crawl}: downloading cluster.idx`);
      const b = await fetchBuf(base + "cluster.idx");
      if (!b) { console.warn(`[a112] ${crawl}: cluster.idx unavailable, skipped`); continue; }
      fs.writeFileSync(idxFile, b);
    }
    const lines = fs.readFileSync(idxFile, "utf8").split("\n").filter(Boolean).map((l) => {
      const [k, file, offset, length] = l.split("\t");
      return { key: k.split(" ")[0], file, offset: Number(offset), length: Number(length) };
    });
    for (const atsType of wanted) {
      for (const rule of HOSTS[atsType]) {
        const blocks = blocksFor(lines, rule.surt);
        let n = 0;
        for (const b of blocks) {
          const f = path.join(cache, `${crawl}-${b.file}-${b.offset}.txt`);
          let text = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
          if (text == null) {
            const buf = await fetchBuf(base + b.file, `bytes=${b.offset}-${b.offset + b.length - 1}`);
            if (!buf) { console.warn(`\n[a112] ${crawl} ${b.file}@${b.offset}: failed`); continue; }
            text = zlib.gunzipSync(buf).toString("utf8");
            fs.writeFileSync(f, text);
          }
          for (const line of text.split("\n")) {
            if (!line.startsWith(rule.surt)) continue;
            const j = line.indexOf("{");
            if (j < 0) continue;
            let url; try { url = JSON.parse(line.slice(j)).url; } catch { continue; }
            const slug = slugOf(atsType, rule, url);
            if (slug) found[atsType].set(slug.toLowerCase(), slug);
          }
          process.stderr.write(`\r[a112] ${crawl} ${rule.surt} block ${++n}/${blocks.length}: ${found[atsType].size} ${atsType} slugs   `);
        }
      }
    }
  }
  for (const atsType of wanted) {
    const rows = [...found[atsType].values()].sort().map((slug) => ({ atsType, slug, company: "" }));
    fs.writeFileSync(path.join(outDir, `discovered-${atsType}.json`), JSON.stringify(rows, null, 1));
    console.log(`\n[a112] ${atsType}: ${rows.length} candidate boards`);
  }
}

if (process.argv[1]?.endsWith("a112DiscoverBoards.mjs")) await main();
