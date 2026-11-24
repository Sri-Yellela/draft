// services/learn/roadmapPage.js — ⭐ D193-5 (owner 11-23: "GO AHEAD") · THE DATA-ENGINEERING ROADMAP, a public page.
//
// /learn/data-engineering-roadmap, titled "Data engineering roadmap 2027" (D185-6's SEO shape: server-rendered, canonical,
// an ItemList JSON-LD of the decks, in /sitemap.xml). The stations are the roadmap in docs/D193_DATA_ENGINEERING_ROADMAP.md,
// in order; each links only the APPROVED decks that teach it (approvedDecks() — a deck not served is never linked, so a
// station with none reads as text). Databricks is folded into Spark as "on a managed platform" (the register's rule: a
// vendor is a "Try it on" beside others, never a station of its own). No figure on the page that isn't counted from the
// served decks. The same stations are the guided route `data-engineering` (migration 281) inside the course.
//
// ⭐ D194 P4 (the landing-page embed): the page's preview plays the first deck's first three points one at a time — CSS only
// (no script, no sound: nothing here can speak), instant under prefers-reduced-motion — then "Sign up to keep learning".
import { STYLE, esc } from "../jobs/publicJobPage.js";
import { ogUrl, ogImageMeta } from "../ogImage.js";
import { approvedDecks } from "./learnDecks.js";

export const ROADMAP_PATH = "/learn/data-engineering-roadmap";
export const ROADMAP_TITLE = "Data engineering roadmap 2027";

/** The stations, in order: what to learn, in plain words, and the decks that teach it. */
export const STATIONS = Object.freeze([
  { n: 1, name: "SQL", line: "Ask a database questions: joins, groups and window functions.", decks: ["da-f-01", "da-iv-01"] },
  { n: 2, name: "Python", line: "Load, clean and reshape data in code.", decks: ["da-f-03"] },
  { n: 3, name: "Git and Linux", line: "Version your work and find your way around a server.", decks: [], course: true },
  { n: 4, name: "Data modelling", line: "Choose the grain, then shape facts and dimensions.", decks: ["da-f-02", "da-p-03"] },
  { n: 5, name: "Warehousing", line: "Where analytical data lives, and one definition per metric.", decks: ["da-b-03", "da-p-05"] },
  { n: 6, name: "ETL and ELT", line: "Move and transform data you can re-run and trust.", decks: ["da-b-04", "da-p-01", "da-f-05", "da-b-05"] },
  { n: 7, name: "Spark", line: "Process data too big for one machine — and run it on a managed platform such as Databricks.", decks: ["da-b-07"] },   // 47c: drafted in decks-v27; linked once approved
  { n: 8, name: "Cloud", line: "Compute, storage and identity: the building blocks every pipeline runs on.", decks: ["cl-b-05"] },
  { n: 9, name: "Orchestration (Airflow)", line: "Run each step in order, on time, and retry what fails.", decks: ["da-b-02"] },
  { n: 10, name: "Streaming (Kafka)", line: "Events as they happen, and what to do with the late ones.", decks: ["da-b-06", "da-b-01", "da-p-02"] },
  { n: 11, name: "End-to-end projects", line: "Put it together: a pipeline someone depends on.", decks: ["da-c-01", "da-c-02"] },
]);

const textOf = (p) => (typeof p === "string" ? p : String(p?.text || ""));

/** The stations with their served decks ({ id, title }), and the preview's three points. Pure over the deck list. */
export function roadmapData(decks = approvedDecks()) {
  const byId = new Map(decks.map(d => [d.id, d]));
  const stations = STATIONS.map(s => ({ ...s, decks: s.decks.map(id => byId.get(id)).filter(Boolean).map(d => ({ id: d.id, title: d.title })) }));
  const first = stations.flatMap(s => s.decks)[0];
  const deck = first ? byId.get(first.id) : null;
  const preview = deck ? { id: deck.id, title: deck.title, points: (deck.slides || []).flatMap(sl => (sl.points || []).map(textOf)).filter(Boolean).slice(0, 3) } : null;
  return { stations, preview, deckCount: stations.reduce((n, s) => n + s.decks.length, 0) };
}

const PREVIEW_STYLE = `
.station{display:grid;grid-template-columns:2.2em 1fr;gap:4px 10px;padding:10px 0;border-top:1px solid var(--line)}
.station:first-child{border-top:0}
.station .n{font-weight:800;color:var(--muted)}
.station h3{margin:0;font-size:17px}
.station p{margin:2px 0 0}
.preview{position:relative;min-height:7.5em}
.preview .pt{margin:0 0 8px;opacity:0;animation:rmIn .4s ease-out forwards}
.preview .pt:nth-child(1){animation-delay:.3s}.preview .pt:nth-child(2){animation-delay:2.8s}.preview .pt:nth-child(3){animation-delay:5.3s}
.preview .after{opacity:0;animation:rmIn .4s ease-out 7.8s forwards}
@keyframes rmIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.preview .pt,.preview .after{animation:none;opacity:1}}`;

/** { status, html } — the public page. */
export function renderRoadmapPage({ base, decks } = {}) {
  const { stations, preview, deckCount } = roadmapData(decks);
  const canonical = `${base}${ROADMAP_PATH}`;
  const desc = `${stations.length} stations from SQL to end-to-end projects, in the order to learn them — each with a short lesson to start from.`;
  const items = stations.flatMap(s => s.decks.map(d => ({ ...d, station: s.name })));
  const itemList = { "@context": "https://schema.org", "@type": "ItemList", name: ROADMAP_TITLE, numberOfItems: items.length,
    itemListElement: items.map((d, i) => ({ "@type": "ListItem", position: i + 1, url: `${base}/atlas/library/${d.id}`, name: `${d.title} (${d.station})` })) };
  const deckLinks = (s) => s.decks.length
    ? `<p class="small">${s.decks.map(d => `<a href="/atlas/library/${esc(d.id)}">${esc(d.title)}</a>`).join(" · ")}</p>`
    : s.course ? `<p class="small"><a href="/atlas/library/silicon-to-software">In the course: the programmer's toolkit and Linux</a></p>` : "";
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ROADMAP_TITLE)} | draft</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(ROADMAP_TITLE)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="article">
${ogImageMeta(ogUrl(new URL(canonical).origin, { eyebrow: "Learn", title: ROADMAP_TITLE, line: `${stations.length} stations · ${deckCount} lessons` }), ROADMAP_TITLE)}
<style>${STYLE}${PREVIEW_STYLE}</style>
<script type="application/ld+json">${JSON.stringify(itemList).replace(/</g, "\\u003c")}</script>
</head><body><div class="wrap">
<header class="site"><a class="brand" href="/" aria-label="draft — home">/draft</a><a href="/login">Sign in</a></header>
<main data-roadmap="data-engineering">
<h1>${esc(ROADMAP_TITLE)}</h1>
<p class="facts">${esc(stations.length)} stations, in the order to learn them · ${esc(deckCount)} short lessons</p>
${preview ? `<section class="card" data-roadmap-preview="${esc(preview.id)}" aria-label="A preview of the first lesson">
<h2>Start here: ${esc(preview.title)}</h2>
<div class="preview">${preview.points.map(p => `<p class="pt">${esc(p)}</p>`).join("")}
<p class="after"><a class="cta" href="/login">Sign up to keep learning</a></p></div>
</section>` : ""}
<section class="card" aria-label="The stations"><h2>The route</h2>
<ol style="list-style:none;padding:0;margin:0">${stations.map(s => `<li class="station" data-station="${esc(s.n)}"><span class="n">${esc(s.n)}</span><div><h3>${esc(s.name)}</h3><p>${esc(s.line)}</p>${deckLinks(s)}</div></li>`).join("\n")}</ol>
</section>
<p><a class="cta" href="/login">Follow this route in draft</a></p>
</main></div></body></html>`;
  return { status: 200, html };
}
