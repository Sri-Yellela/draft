// ⭐ D105 P4 · THE ATLAS PAGES — the page's model, no React. The search's alias resolution, the related lists, the
// neighbourhood graph's FIRST RING and its layout, and the small formatters the page reads. Kept here (plain JS)
// so test/d105AtlasPages.test.js can hold each rule without rendering anything.
//
// The data is routes/atlas.js's: GET /api/atlas/search?q= → { q, results: [{ slug, kind, name, via }] } and
// GET /api/atlas/node/:slug → { slug, kind, name, aliases, definition, onTheBoard, related, resources, wikipedia,
// you? }. Public reads see PUBLISHED pages only; `you` arrives only for a signed-in reader (d105YouOnlyWhenSignedIn).
import { api } from "../../lib/api.js";

export const KIND_LABEL = Object.freeze({ role: "Role", skill: "Skill", tool: "Tool or tech", stack: "Stack", concept: "Concept", pattern: "Pattern" });   // concept · pattern: D115

// The typed edges, read from THIS page's side. `dir` is the API's: "out" — this node is the edge's from; "in" — its to.
// A symmetric type (used_with, alternative_to) reads the same both ways.
export const EDGE_ORDER = Object.freeze(["requires", "part_of", "used_with", "alternative_to", "leads_to"]);
const EDGE_LABEL = Object.freeze({
  requires:       { out: "Asks for",     in: "Asked for by" },
  part_of:        { out: "Part of",      in: "Includes" },
  used_with:      { out: "Used with",    in: "Used with" },
  alternative_to: { out: "Alternatives", in: "Alternatives" },
  leads_to:       { out: "Leads to",     in: "Reached from" },
});
export const edgeLabel = (type, dir) => EDGE_LABEL[type]?.[dir === "in" ? "in" : "out"] || type;

/** The related links as titled lists — one per (type, side), in EDGE_ORDER, a node once per list. */
export function relatedGroups(related = []) {
  const groups = new Map();
  for (const r of related) {
    if (!r?.slug) continue;
    const title = edgeLabel(r.type, r.dir);
    const key = `${EDGE_ORDER.indexOf(r.type)}:${title}`;
    if (!groups.has(key)) groups.set(key, { title, type: r.type, items: [] });
    const g = groups.get(key);
    if (!g.items.some(i => i.slug === r.slug)) g.items.push({ slug: r.slug, name: r.name, kind: r.kind });
  }
  return [...groups.entries()].sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10)).map(([, g]) => g);
}

/**
 * ⛔ THE FIRST RING ONLY — the node's direct neighbours, each once, never itself. The API returns one hop and the
 * graph draws one hop; a second ring is a walk (click a neighbour), not a bigger picture.
 */
export function firstRing(node, max = 12) {
  const seen = new Map();
  const rel = [...(node?.related || [])].sort((a, b) => EDGE_ORDER.indexOf(a.type) - EDGE_ORDER.indexOf(b.type));
  for (const r of rel) {
    if (!r?.slug || r.slug === node.slug || seen.has(r.slug)) continue;
    seen.set(r.slug, { slug: r.slug, name: r.name, kind: r.kind, type: r.type, dir: r.dir });
  }
  const all = [...seen.values()];
  return { ring: all.slice(0, max), more: Math.max(0, all.length - max) };
}

const round = (n) => Math.round(n * 10) / 10;

/** The ring laid out on an ellipse around the node, each label set outward from its dot. */
export function ringLayout(node, { max = 12, w = 440, h = 300 } = {}) {
  const { ring, more } = firstRing(node, max);
  const cx = w / 2, cy = h / 2, rx = w / 2 - 112, ry = h / 2 - 42;
  return {
    w, h, more,
    centre: { slug: node.slug, name: node.name, kind: node.kind, x: cx, y: cy },
    ring: ring.map((n, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / ring.length;
      const c = Math.cos(a), s = Math.sin(a);
      const anchor = c > 0.25 ? "start" : c < -0.25 ? "end" : "middle";
      return { ...n, x: round(cx + rx * c), y: round(cy + ry * s),
        lx: round(cx + rx * c + (anchor === "start" ? 11 : anchor === "end" ? -11 : 0)),
        ly: round(cy + ry * s + (anchor === "middle" ? (s < 0 ? -12 : 20) : 4)), anchor };
    }),
  };
}

export const shortLabel = (s, n = 18) => (String(s ?? "").length > n ? `${String(s).slice(0, n - 1)}…` : String(s ?? ""));

/**
 * The search box. "k8s" lands on Kubernetes: an exact name or a confirmed alias (skill_synonyms, the one
 * thesaurus — resolved by the server) is a place to GO; a single partial match is too. Anything else is a list.
 * @returns {{ q, results, go: string|null, via: string|null }}
 */
export async function resolveSearch(q, get = api) {
  const term = String(q ?? "").trim().slice(0, 80);
  if (!term) return { q: term, results: [], go: null, via: null };
  const r = await get(`/api/atlas/search?q=${encodeURIComponent(term)}`);
  const results = Array.isArray(r?.results) ? r.results : [];
  const exact = results.find(x => x.via === "name") || results.find(x => x.via === "alias") || (results.length === 1 ? results[0] : null);
  return { q: term, results, go: exact ? exact.slug : null, via: exact ? exact.via : null };
}

/** One node's page data, or null when there is no PUBLISHED page by that slug. */
export async function loadNode(slug, get = api) {
  try { return await get(`/api/atlas/node/${encodeURIComponent(slug)}`); }
  catch (e) { if (e?.status === 404) return null; throw e; }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** A unix-seconds stamp as "30 Oct 2026" (UTC, so the page and its tests agree). */
export function formatDay(sec) {
  if (!Number.isFinite(Number(sec)) || !sec) return null;
  const d = new Date(Number(sec) * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const k = (n) => `$${Math.round(n / 1000)}k`;
/** "$120k – $180k, median $150k" — or null when no posting stated pay. Computed by the server, never typed. */
export function payLine(pay) {
  if (!pay || !pay.n) return null;
  const range = pay.minUsd === pay.maxUsd ? k(pay.minUsd) : `${k(pay.minUsd)} – ${k(pay.maxUsd)}`;
  return `${range}, median ${k(pay.medianUsd)}`;
}

/** "computed from 42 active postings on 30 Oct 2026" — the provenance line every board number carries. */
export function computedLine(stats) {
  if (!stats) return null;
  const n = Number(stats.postings) || 0;
  const day = formatDay(stats.computedAt);
  return `counted from ${n} open job${n === 1 ? "" : "s"}${day ? ` on ${day}` : ""}`;
}

// ⭐ D105 P8 (amended 10-31): Wikidata's official site and docs first, then the Wikipedia article, then the curated ones.
const SOURCE_RANK = { wikidata: 0, wikipedia: 1 };
const rankOf = (r) => SOURCE_RANK[r?.source] ?? 2;
/** Resources: Wikidata's, Wikipedia's, then free first (the server orders them so too — kept here so the page cannot reorder them by accident). */
export function orderedResources(list = []) {
  return list.map((r, i) => [r, i]).sort(([a, i], [b, j]) => (rankOf(a) - rankOf(b)) || ((b.cost === "free") - (a.cost === "free")) || i - j).map(([r]) => r);
}

/** ⭐ D105 P7: the line a published page shows when its board count fell under the auto-publish bar. */
export const FEW_POSTINGS_LINE = "Few open jobs right now. This page stays up; the numbers above are today's.";

/** level · format · hours · cost · last checked — the parts a resource has, in that order. */
export function resourceMeta(r) {
  const parts = [];
  if (r.level) parts.push(r.level);
  if (r.format) parts.push(r.format);
  if (r.hours != null && r.hours !== "") parts.push(`${r.hours} h`);
  if (r.cost) parts.push(r.cost === "free" ? "Free" : r.cost);
  if (r.source === "wikidata") parts.push("from Wikidata");
  parts.push(r.checkedAt ? `checked ${formatDay(r.checkedAt)}` : "not checked yet");
  return parts;
}

// ⛔ Wikipedia's text is CC BY-SA: it is shown as WIKIPEDIA'S — its own block, this line, the article link and the
// licence link — and never merged into draft's definition. The server sends the licence with the block
// (services/atlas/atlasStore.js WIKI_LICENCE); this is the same line, so the block never renders without it.
export const WIKI_LICENCE = Object.freeze({ line: "From Wikipedia, CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" });

export const YOU_LABEL = Object.freeze({ have: "You: have", partial: "You: partial", missing: "You: missing" });
export const YOU_MARK = Object.freeze({ have: "mark--ok", partial: "mark--warn", missing: "mark--no" });

// ⭐ D105 P12 · A ROLE PAGE IS THE BOARD'S OWN DATA (GET /api/atlas/node/:slug → roleBoard, services/atlas/atlasRolePage.js):
// top skills with their shares, levels (D106's real level), pay, companies hiring, and D116's "to reach the next level".
export const LEVEL_READ_LABEL = Object.freeze({ entry: "Entry", early: "Early career", mid: "Mid", senior: "Senior" });

/** "61 % of postings" — a share the server computed, never re-derived here. */
export const shareText = (share) => `${Math.round(Number(share) || 0)} % of jobs`;

/** "Early-career → mid" — one step of the next-level list. */
export function stepTitle(step) {
  const from = String(step?.from ?? ""), to = String(step?.to ?? "");
  return `${from.charAt(0).toUpperCase()}${from.slice(1)} → ${to}`;
}

/** Why a step lists nothing: too few postings read at one of its two levels, or no skill rose enough. */
export function stepEmptyLine(step) {
  if (step?.reason === "too_few_postings") {
    const p = step.postings || {};
    return `Not enough jobs read at both levels to measure yet (${p.from ?? 0} ${step.from} · ${p.to ?? 0} ${step.to}).`;
  }
  return `No skill is asked for clearly more often at ${step?.to} than at ${step?.from}.`;
}

/** Which board sections a role page has data for — a section with nothing in it is not drawn. */
export function roleBoardParts(rb) {
  if (!rb) return { skills: false, levels: false, pay: false, companies: false, nextLevel: false };
  return {
    skills: (rb.topSkills?.length ?? 0) > 0,
    levels: (rb.levels?.read ?? []).some(l => l.postings > 0),
    pay: !!rb.pay?.n,
    companies: (rb.companies?.items?.length ?? 0) > 0,
    nextLevel: Array.isArray(rb.nextLevel) && rb.nextLevel.length > 0,
  };
}

// ⭐ D172 (owner APPROVED 11-06, docs/sketches/atlas-redesign-sketch.html) · A SKILL OR ROLE PAGE IS ONE CARD: the name, the
// definition, one number from the board, your standing and the two actions — then each of the old sections on demand,
// one at a time. Nothing is dropped (D147's rule): every section D105–D116 drew is a pane here, offered only when it has
// something to show. Unknowns are left out (D152 7): no trend line until the board keeps one.
export const NODE_PANE_LABEL = Object.freeze({
  board: "On the board", map: "Role map", next: "To reach the next level", sponsors: "Companies that sponsor",
  roles: "Roles that ask for it", related: "Related skills", pay: "Pay range", resources: "Resources", wikipedia: "From Wikipedia",
});

/** The panes a node has, in the card's order: [{ id, label }]. Pure. */
export function nodePanes(node = {}) {
  const stats = node.onTheBoard || null;
  const rb = node.kind === "role" ? node.roleBoard || null : null;
  const out = [];
  const add = (id, ok) => { if (ok) out.push({ id, label: NODE_PANE_LABEL[id] }); };
  if (node.kind === "role") {
    add("board", !!rb || !!stats);
    add("map", true);
    add("next", !!(rb && roleBoardParts(rb).nextLevel));
    add("sponsors", (node.sponsors?.length ?? 0) > 0);
  } else {
    add("roles", (stats?.topRoles?.length ?? 0) > 0);
    add("pay", !!payLine(stats?.pay));
  }
  add("related", relatedGroups(node.related).length > 0 || (node.kind !== "role" && (stats?.topSkills?.length ?? 0) > 0));
  add("resources", orderedResources(node.resources || []).length > 0 || !!node.learn);
  add("wikipedia", !!node.wikipedia?.extract);
  return out;
}

/** The card's one number: "1,240 open postings ask for it" / "… for this role"; null before the board is computed. */
export function nodeHeadline(node = {}) {
  const n = node.onTheBoard?.postings;
  if (!Number.isFinite(n)) return null;
  return { value: n.toLocaleString("en-US"), words: `open job${n === 1 ? "" : "s"} ${node.kind === "role" ? "for this role" : "ask for it"}` };
}
