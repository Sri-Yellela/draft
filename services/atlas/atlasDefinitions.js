// services/atlas/atlasDefinitions.js — ⭐ D105 P11 (owner 10-31, "yes to all three") · DRAFTED DEFINITIONS, REVIEWED.
//
// The Admin → Enrichment pattern, so draft itself makes NO model call (D17 holds): Admin → Atlas → "Draft definitions"
// EXPORTS up to 30 nodes without a definition (name, kind, posting count, its top 5 co-occurring skills) with the
// instructions below; the owner pastes them into a Claude chat and pastes the JSON answer back (IMPORT). An imported
// definition lands in atlas_nodes.definition_draft with definition_by = 'drafted' — NOT in `definition`, so nothing
// public shows it and the auto-publish bar (atlasPublish.js HAS_DEFINITION reads `definition`) does not count it.
// The owner then Accepts (as is, or edited), Rejects, or Accepts all after reading; accepted = `definition`,
// definition_by = 'owner', and the bar is re-checked at once.
// ⭐ OWNER 11-10 (APPROVALS (3)): THE ACCEPT LOOP IS REMOVED. A definition that passes the import rules PUBLISHES at once
// (definition, definition_by = 'auto'); Admin → Atlas keeps a "Recently published" list (newest first) with one-click
// Unpublish, and a weekly spot-check sample of 10. ⛔ The one exception: an entry naming a `source` the register (D176) holds
// as to-verify / link-only / gated, or AI-restricted, or unknown — that stays a DRAFT for the owner, as before.
// ⛔ The import is ALL OR NOTHING: one bad row (an unknown slug, a node that already has a definition, too long,
// more than two sentences, a link, a duplicate) refuses the file and names every problem.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { autoPublish } from "./atlasPublish.js";
import { loadRegistry, mayAdapt, aiRestricted } from "./sourceRegistry.js";

export const AUTO_BY = "auto";
export const UNPUBLISHED_BY = "unpublished";
export const SPOT_CHECK_SIZE = 10;

/** Why an entry's source keeps it a draft, or null (no source named = the definition is draft's own words). */
export function sourceHold(sourceId, reg = null) {
  if (sourceId == null || String(sourceId).trim() === "") return null;
  let r = reg;
  try { r = r || loadRegistry(); } catch { return "the source register could not be read"; }
  const src = (r.sources || []).find(x => x.id === String(sourceId));
  if (!src) return "source not in the register";
  if (aiRestricted(src)) return "source restricts AI use";
  if (!mayAdapt(src)) return `source is ${src.licenceClass}`;
  return null;
}

/** Publish one definition now (only on a node that has none). true when written. */
function publishNow(db, slug, def) {
  return db.prepare(`UPDATE atlas_nodes SET definition = ?, definition_by = '${AUTO_BY}', definition_draft = NULL, updated_at = unixepoch()
    WHERE slug = ? AND TRIM(COALESCE(definition, '')) = ''`).run(def, slug).changes > 0;
}

export const DEFINITION_EXPORT_MAX = 30;
export const DEFINITION_MAX_CHARS = 400;
export const DEFINITION_MIN_CHARS = 20;

export const DEFINITION_INSTRUCTIONS = [
  "For each item below, write a definition of the term as it is used at work, in the jobs whose postings ask for it (software, business, finance, marketing, sales, legal, engineering or science).",
  "Rules:",
  "- One or two plain sentences: what it is, and what it is used for at work.",
  "- No marketing, no claims about popularity or adoption, no opinions.",
  "- Do not copy text from Wikipedia or any other source; write it in your own words.",
  "- No links, no URLs, no markdown.",
  `- At most ${DEFINITION_MAX_CHARS} characters each.`,
  "Answer with JSON only, exactly this shape, one entry per item, slugs unchanged:",
  '{ "definitions": [ { "slug": "<slug>", "definition": "<one or two sentences>" } ] }',
].join("\n");

const sentences = (s) => (String(s).match(/[.!?](?=\s|$)/g) || []).length;
const LINK = /https?:\/\/|www\.|\]\(|<a\s/i;

/** The next nodes to draft: no definition and no draft waiting, most-asked first. */
export function exportForDrafting(db, { limit = DEFINITION_EXPORT_MAX } = {}) {
  const n = Math.max(1, Math.min(Number(limit) || DEFINITION_EXPORT_MAX, DEFINITION_EXPORT_MAX));
  const rows = db.prepare(`SELECT n.slug, n.name, n.kind, COALESCE(s.postings, 0) AS postings, COALESCE(s.top_skills_json, '[]') AS top
    FROM atlas_nodes n LEFT JOIN atlas_node_stats s ON s.node_id = n.id
    WHERE TRIM(COALESCE(n.definition, '')) = '' AND n.definition_draft IS NULL AND n.kind != 'stack'
    ORDER BY postings DESC, n.name COLLATE NOCASE LIMIT ?`).all(n);
  const nodes = rows.map(r => {
    let top = []; try { top = JSON.parse(r.top); } catch { top = []; }
    return { slug: r.slug, name: r.name, kind: r.kind, postings: r.postings,
      seenWith: (Array.isArray(top) ? top : []).slice(0, 5).map(t => t?.name).filter(Boolean) };
  });
  const text = `${DEFINITION_INSTRUCTIONS}\n\nItems:\n${JSON.stringify(nodes.map(({ slug, name, kind, seenWith }) => ({ slug, name, kind, seenWith })), null, 1)}`;
  return { instructions: DEFINITION_INSTRUCTIONS, nodes, text };
}

/**
 * Read the pasted answer. All or nothing.
 * @returns {{ ok: true, drafted: number } | { ok: false, errors: { slug: string|null, reason: string }[] }}
 */
export function importDrafted(db, pasted) {
  let json = pasted;
  if (typeof pasted === "string") {
    const s = pasted.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    try { json = JSON.parse(s); } catch { return { ok: false, errors: [{ slug: null, reason: "not JSON" }] }; }
  }
  const list = Array.isArray(json) ? json : json?.definitions;
  if (!Array.isArray(list) || !list.length) return { ok: false, errors: [{ slug: null, reason: 'expected { "definitions": [ … ] }' }] };
  if (list.length > DEFINITION_EXPORT_MAX) return { ok: false, errors: [{ slug: null, reason: `more than ${DEFINITION_EXPORT_MAX} definitions` }] };
  const node = db.prepare(`SELECT id, definition, definition_draft FROM atlas_nodes WHERE slug = ?`);
  const errors = [], seen = new Set(), ok = [];
  for (const e of list) {
    const slug = typeof e?.slug === "string" ? e.slug.trim() : null;
    const def = typeof e?.definition === "string" ? e.definition.replace(/\s+/g, " ").trim() : "";
    const source = typeof e?.source === "string" ? e.source.trim() : null;
    const why = !slug ? "no slug"
      : seen.has(slug) ? "duplicate slug"
      : !node.get(slug) ? "unknown slug"
      : String(node.get(slug).definition ?? "").trim() ? "already has a definition"
      : textRefusal(def);
    if (slug) seen.add(slug);
    if (why) errors.push({ slug, reason: why }); else ok.push({ slug, def, hold: sourceHold(source) });
  }
  if (errors.length) return { ok: false, errors };
  const put = db.prepare(`UPDATE atlas_nodes SET definition_draft = ?, definition_by = 'drafted', updated_at = unixepoch() WHERE slug = ?`);
  const published = [], held = [];
  db.transaction(() => {
    for (const r of ok) {
      if (r.hold) { put.run(r.def, r.slug); held.push({ slug: r.slug, reason: r.hold }); }
      else if (publishNow(db, r.slug, r.def)) published.push(r.slug);
    }
  })();
  const pages = published.length ? autoPublish(db).published : [];
  return { ok: true, published: published.length, held, drafted: held.length, pagesPublished: pages };
}

// ⭐ A112/Atlas (11-03) · THE DRAFTED-DEFINITIONS FILE. content/atlas/definitions-drafted.json holds definitions the
// agent wrote in batches for the non-computing families (their skill maps were near empty: no Wikipedia match, so
// nothing met the publish bar). They take the SAME road as a chat import — definition_draft, 'drafted', the owner
// Accepts or Rejects in Admin → Atlas — never `definition`. Each slug is offered ONCE: the slugs already offered are kept
// in app_settings (DRAFTED_SEEDED_KEY), so a draft the owner rejected is not offered again on the next boot.
export const DRAFTED_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content/atlas/definitions-drafted.json");
export const DRAFTED_SEEDED_KEY = "atlas_drafted_definitions_offered";

/** The file's { slug → definition }, flattened from its families. A slug listed twice is refused (the file is wrong). */
export function readDraftedFile(file = DRAFTED_FILE) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const out = new Map();
  for (const [family, defs] of Object.entries(raw.definitions || {})) {
    for (const [slug, def] of Object.entries(defs)) {
      if (out.has(slug)) throw new Error(`definitions-drafted.json lists "${slug}" twice (${family})`);
      out.set(slug, String(def).replace(/\s+/g, " ").trim());
    }
  }
  return out;
}

/** Why the import rules refuse a definition's TEXT, or null (the chat import's rules: length, sentences, links). */
export function textRefusal(def) {
  return def.length < DEFINITION_MIN_CHARS ? "too short"
    : def.length > DEFINITION_MAX_CHARS ? `longer than ${DEFINITION_MAX_CHARS} characters`
    : sentences(def) > 2 ? "more than two sentences"
    : LINK.test(def) ? "contains a link"
    : null;
}

/**
 * Offer the file's definitions as drafts: a node with no definition, no draft waiting, never offered before.
 * @returns {{ drafted: string[], missing: string[], refused: { slug, reason }[] }}
 */
export function seedDraftedDefinitions(db, mapping = readDraftedFile()) {
  const offered = new Set(JSON.parse(db.prepare(`SELECT value FROM app_settings WHERE key = ?`).pluck().get(DRAFTED_SEEDED_KEY) || "[]"));
  const node = db.prepare(`SELECT id, definition, definition_draft FROM atlas_nodes WHERE slug = ?`);
  const put = db.prepare(`UPDATE atlas_nodes SET definition = ?, definition_by = '${AUTO_BY}', updated_at = unixepoch()
    WHERE id = ? AND TRIM(COALESCE(definition, '')) = '' AND definition_draft IS NULL`);
  const drafted = [], missing = [], refused = [];
  db.transaction(() => {
    for (const [slug, def] of mapping) {
      if (offered.has(slug)) continue;
      const n = node.get(slug);
      if (!n) { missing.push(slug); continue; }
      const why = textRefusal(def);
      if (why) { refused.push({ slug, reason: why }); continue; }
      offered.add(slug);                        // a node that already has its own words is offered nothing, ever
      if (put.run(def, n.id).changes) drafted.push(slug);
    }
    db.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, unixepoch())
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(DRAFTED_SEEDED_KEY, JSON.stringify([...offered].sort()));
  })();
  return { published: drafted, missing, refused };
}

/**
 * OWNER 11-10: drafts that were waiting for an Accept when the loop was removed publish now (once, at boot) — except a
 * draft a source keeps (none of today's carry a source; the import holds them with definition_by = 'drafted' + a source).
 */
export function publishWaitingDrafts(db) {
  const rows = db.prepare(`SELECT slug, definition_draft AS def FROM atlas_nodes WHERE definition_draft IS NOT NULL AND definition_by = 'drafted'
    AND TRIM(COALESCE(definition, '')) = ''`).all();
  const published = [];
  db.transaction(() => { for (const r of rows) if (!textRefusal(String(r.def)) && publishNow(db, r.slug, String(r.def))) published.push(r.slug); })();
  return { published, pagesPublished: published.length ? autoPublish(db).published : [] };
}

/** Admin → Atlas → Recently published: the auto-published definitions, newest first. */
export function recentlyPublished(db, { limit = 50 } = {}) {
  const n = Math.max(1, Math.min(Number(limit) || 50, 500));
  return db.prepare(`SELECT n.slug, n.name, n.kind, n.definition, n.updated_at AS at, COALESCE(s.postings, 0) AS postings
    FROM atlas_nodes n LEFT JOIN atlas_node_stats s ON s.node_id = n.id
    WHERE n.definition_by = '${AUTO_BY}' AND TRIM(COALESCE(n.definition, '')) != '' ORDER BY n.updated_at DESC, n.id DESC LIMIT ?`).all(n);
}

/** One click: the definition comes off the public page and is never auto-offered again (seed's offered list + this mark). */
export function unpublishDefinition(db, slug) {
  return db.prepare(`UPDATE atlas_nodes SET definition = NULL, definition_by = '${UNPUBLISHED_BY}', updated_at = unixepoch()
    WHERE slug = ? AND definition_by = '${AUTO_BY}'`).run(String(slug)).changes > 0;
}

/** The weekly spot-check: 10 auto-published definitions, the same 10 all week (seeded by the ISO week), newest first. */
export function weeklySpotCheck(db, { nowMs = Date.now(), size = SPOT_CHECK_SIZE } = {}) {
  const d = new Date(nowMs);
  const week = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000 + 3) / 7);
  const all = recentlyPublished(db, { limit: 500 });
  const hash = (s) => { let h = week >>> 0; for (const c of s) h = (Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0); return h; };
  return { week, items: [...all].sort((a, b) => hash(a.slug) - hash(b.slug)).slice(0, size) };
}

/** The review list. */
export function draftedDefinitions(db) {
  return db.prepare(`SELECT n.slug, n.name, n.kind, n.definition_draft AS draft, COALESCE(s.postings, 0) AS postings
    FROM atlas_nodes n LEFT JOIN atlas_node_stats s ON s.node_id = n.id
    WHERE n.definition_draft IS NOT NULL ORDER BY postings DESC, n.name COLLATE NOCASE`).all();
}

/** Accept one (as drafted, or as the owner edited it). Re-checks the publish bar. */
export function acceptDraft(db, slug, { definition } = {}, by = "owner") {
  const n = db.prepare(`SELECT definition_draft FROM atlas_nodes WHERE slug = ?`).get(slug);
  if (!n || n.definition_draft == null) return null;
  const text = String(definition ?? n.definition_draft).replace(/\s+/g, " ").trim().slice(0, 4000);
  if (!text) return null;
  db.prepare(`UPDATE atlas_nodes SET definition = ?, definition_by = 'owner', definition_draft = NULL, updated_at = unixepoch() WHERE slug = ?`).run(text, slug);
  return { slug, definition: text, by, published: autoPublish(db).published };
}

export function rejectDraft(db, slug) {
  return db.prepare(`UPDATE atlas_nodes SET definition_draft = NULL, definition_by = NULL WHERE slug = ? AND definition_draft IS NOT NULL`).run(slug).changes > 0;
}

/** Accept every listed draft as written (the owner read them first). */
export function acceptAllDrafts(db, slugs, by = "owner") {
  if (!Array.isArray(slugs) || !slugs.length) return { accepted: 0, published: [] };
  const done = db.transaction(() => slugs.map(s => acceptDraft(db, String(s), {}, by)).filter(Boolean))();
  return { accepted: done.length, published: [...new Set(done.flatMap(d => d.published))] };
}
