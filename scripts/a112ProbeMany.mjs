#!/usr/bin/env node
// A112 · THE CRAWLER BOOST — probe thousands of candidate boards (scripts/a112DiscoverBoards.mjs) through the ONE
// hiring-evidence probe (services/companyProbe.js probeBoard: dead / empty / no_descriptions / live → US → age limit →
// a white-collar family → in the board's scope). READ-ONLY: no database.
//
//   node scripts/a112ProbeMany.mjs <candidates.json>... --out <probe.json> [--per-host 4] [--skip-configured <list.json>]
// Each ATS is its own host, so boards run `--per-host` at a time PER ATS (polite to each, parallel across them).
// Resumable: rows already in --out are skipped; the file is rewritten every 25 boards.
// --skip-configured: [{ ats_type, ats_slug }] already on the crawl list (production's company_ats_list).
import fs from "node:fs";
import { probeBoard } from "../services/companyProbe.js";
import { boardName, prettySlug } from "./a112BoardName.mjs";

const argv = process.argv.slice(2);
const flag = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const files = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const out = flag("out");
if (!files.length || !out) { console.error("usage: <candidates.json>... --out <probe.json> [--per-host 4] [--skip-configured list.json]"); process.exit(2); }
const PER_HOST = Number(flag("per-host", 4));
const key = (t, s) => `${t}:${String(s).toLowerCase()}`;

const configured = new Set((flag("skip-configured") ? JSON.parse(fs.readFileSync(flag("skip-configured"), "utf8")) : [])
  .map((r) => key(r.ats_type ?? r.atsType, r.ats_slug ?? r.slug)));
const done = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : [];
const have = new Set(done.map((r) => key(r.atsType, r.slug)));
const todo = files.flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8")))
  .filter((c) => !have.has(key(c.atsType, c.slug)) && !configured.has(key(c.atsType, c.slug)));
const now = Math.floor(Date.now() / 1000);
let since = 0;
const save = () => fs.writeFileSync(out, JSON.stringify(done));

async function one(c) {
  try {
    const p = await probeBoard({ atsType: c.atsType, slug: c.slug, company: c.company || "" }, { now });
    const { ok, state, fetched, us, fresh, classified, cs, csOpen, cs30, pct30, pct120, medianAge, usPct } = p;
    const company = c.company || (state === "live" && cs > 0 ? await boardName(c.atsType, c.slug) : null) || prettySlug(c.atsType, c.slug);
    done.push({ atsType: c.atsType, slug: c.slug, company, ok, state, fetched, us, fresh, classified, cs, csOpen, cs30, pct30, pct120, medianAge, usPct });
  } catch (e) {
    done.push({ atsType: c.atsType, slug: c.slug, company: c.company || c.slug, ok: false, state: "error", error: String(e.message || e).slice(0, 120) });
  }
  if (++since % 25 === 0) save();
}

const byAts = new Map();
for (const c of todo) (byAts.get(c.atsType) ?? byAts.set(c.atsType, []).get(c.atsType)).push(c);
console.log(`[a112] probing ${todo.length} boards (${[...byAts].map(([a, l]) => `${a} ${l.length}`).join(", ")}), ${PER_HOST} per host`);
const t0 = Date.now();
const tick = setInterval(() => {
  const live = done.filter((r) => r.state === "live" && r.cs > 0).length;
  process.stderr.write(`\r[a112] ${done.length - have.size}/${todo.length} probed, ${live} live with in-scope postings, ${Math.round((Date.now() - t0) / 1000)}s   `);
}, 10000);
await Promise.all([...byAts.values()].flatMap((list) => {
  let i = 0;
  return Array.from({ length: PER_HOST }, async () => { while (i < list.length) await one(list[i++]); });
}));
clearInterval(tick);
save();
const live = done.filter((r) => r.state === "live" && r.cs > 0);
console.log(`\n[a112] done: ${done.length} rows, ${live.length} live with in-scope postings, ${live.reduce((n, r) => n + r.cs, 0)} in-scope postings`);
