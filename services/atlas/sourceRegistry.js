// services/atlas/sourceRegistry.js — ⛔ D176 [T3] · THE LEARNING-CENTRE SOURCE REGISTER (content/sources/registry.json).
//
// One row per source Atlas may draw on: publisher · the centre's URL · content types · the licence and its CLASS
// (what draft may do with it) · pathways and topics · vendor-neutral or not · when it was last verified. This module
// reads it, checks it, summarises it for Admin → Atlas → Sources, and runs the monthly link check.
//
// ⛔ The class decides what may be done with the text (registry.licenceClasses):
//   open-reuse   adapt with attribution, a link to the licence and a note of changes
//   share-alike  adapt only into items published under the same licence; otherwise summarise and link
//   link-only    our own summary + a link; never copied
//   gated        link only
//   to-verify    NOT YET CHECKED — treated exactly as link-only until the licence is read and recorded
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSetting, setSetting } from "../appSettings.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REGISTRY_PATH = path.join(HERE, "..", "..", "content", "sources", "registry.json");
export const LICENCE_CLASSES = Object.freeze(["open-reuse", "share-alike", "link-only", "gated", "to-verify"]);
export const LINK_CHECK_EVERY_DAYS = 30;

export function loadRegistry(file = REGISTRY_PATH) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** What draft may do with a source's text: to-verify is link-only until checked. */
export function effectiveClass(source) {
  return source?.licenceClass === "to-verify" ? "link-only" : source?.licenceClass ?? "link-only";
}
/** True only when the text itself may be adapted into a lesson (with attribution). */
export function mayAdapt(source) {
  return ["open-reuse", "share-alike"].includes(effectiveClass(source));
}

/** { ok, problems: [string] } — every rule the register's rows must keep. */
export function validateRegistry(reg) {
  const problems = [];
  if (!reg || !Array.isArray(reg.sources)) return { ok: false, problems: ["no sources array"] };
  for (const k of LICENCE_CLASSES) if (!reg.licenceClasses?.[k]) problems.push(`licenceClasses lacks "${k}"`);
  const seen = new Set();
  for (const s of reg.sources) {
    const id = s?.id || "(no id)";
    if (!s?.id || !/^[a-z0-9][a-z0-9-]*$/.test(s.id)) problems.push(`${id}: id must be lower-case words joined by -`);
    if (seen.has(s?.id)) problems.push(`${id}: duplicate id`);
    seen.add(s?.id);
    if (!s?.publisher || !s?.name) problems.push(`${id}: publisher and name are required`);
    let u = null;
    try { u = new URL(s?.url); } catch { /* reported below */ }
    if (!u || u.protocol !== "https:") problems.push(`${id}: url must be https`);
    if (!LICENCE_CLASSES.includes(s?.licenceClass)) problems.push(`${id}: unknown licenceClass "${s?.licenceClass}"`);
    if (s?.licenceClass !== "to-verify" && !/^\d{4}-\d{2}-\d{2}$/.test(String(s?.verified || ""))) {
      problems.push(`${id}: a checked licence records the date it was verified`);
    }
    if (!Array.isArray(s?.pathways) || !s.pathways.length) problems.push(`${id}: at least one pathway`);
    if (typeof s?.vendorNeutral !== "boolean") problems.push(`${id}: vendorNeutral must be true or false`);
  }
  return { ok: problems.length === 0, problems };
}

/** Admin's view: counts per class, sources per pathway (and how many are neutral), what still needs its licence read. */
export function registrySummary(reg) {
  const byClass = Object.fromEntries(LICENCE_CLASSES.map(c => [c, 0]));
  const byPathway = {};
  for (const s of reg.sources || []) {
    byClass[s.licenceClass] = (byClass[s.licenceClass] || 0) + 1;
    for (const p of s.pathways || []) {
      const b = (byPathway[p] ||= { sources: 0, neutral: 0, adaptable: 0 });
      b.sources++;
      if (s.vendorNeutral) b.neutral++;
      if (mayAdapt(s)) b.adaptable++;
    }
  }
  return {
    version: reg.version ?? null, updated: reg.updated ?? null, total: (reg.sources || []).length, byClass, byPathway,
    toVerify: (reg.sources || []).filter(s => s.licenceClass === "to-verify").map(s => s.id),
    // ⛔ D176-5: never sent to a model call
    aiRestricted: (reg.sources || []).filter(s => aiRestricted(s)).map(s => s.id),
    // ⛔ "No lesson draws on a single vendor": a pathway with no neutral source cannot be taught yet.
    noNeutralSource: Object.entries(byPathway).filter(([, b]) => b.neutral === 0).map(([p]) => p),
    validation: validateRegistry(reg),
  };
}

/**
 * ⛔ The monthly link check. HEAD each source URL (GET when HEAD is refused); a 2xx / 3xx is alive. A dead source is
 * reported so Admin can hide its items. Never throws; `fetchImpl` is injectable for the tests.
 * @returns [{ id, url, ok, status, error? }]
 */
export async function checkLinks(reg, { fetchImpl = globalThis.fetch, timeoutMs = 10_000, concurrency = 4 } = {}) {
  const sources = (reg.sources || []).filter(s => s?.url);
  const out = new Array(sources.length);
  let next = 0;
  async function one(s) {
    const tryOnce = async (method) => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      try { return await fetchImpl(s.url, { method, redirect: "follow", signal: ctl.signal, headers: { "user-agent": "draft-link-check/1" } }); }
      finally { clearTimeout(t); }
    };
    try {
      let res = await tryOnce("HEAD");
      if (res.status === 405 || res.status === 403 || res.status === 501) res = await tryOnce("GET");
      return { id: s.id, url: s.url, ok: res.status < 400, status: res.status };
    } catch (e) {
      return { id: s.id, url: s.url, ok: false, status: null, error: e?.name === "AbortError" ? "timed out" : String(e?.message || e) };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, async () => {
    while (next < sources.length) { const i = next++; out[i] = await one(sources[i]); }
  }));
  return out;
}

const CHECK_KEY = "source_register_link_check";

/** The last link check: { at, results: [{ id, ok, status, error? }] } or null. */
export function lastLinkCheck(db) {
  try { return JSON.parse(getSetting(db, CHECK_KEY) || "null"); } catch { return null; }
}

/**
 * The monthly run (server.js's 05:30 cron calls it nightly; it runs once LINK_CHECK_EVERY_DAYS has passed, or when
 * `force` — Admin's "Check sources now"). Stores the results; returns { ran, checked, dead: [ids] }.
 */
export async function runRegisterLinkCheck(db, { reg = loadRegistry(), fetchImpl, nowSec = Math.floor(Date.now() / 1000), force = false } = {}) {
  const last = lastLinkCheck(db);
  if (!force && last?.at && nowSec - last.at < LINK_CHECK_EVERY_DAYS * 86400) return { ran: false, checked: 0, dead: [] };
  const results = await checkLinks(reg, fetchImpl ? { fetchImpl } : {});
  setSetting(db, CHECK_KEY, JSON.stringify({ at: nowSec, results: results.map(({ id, ok, status, error }) => ({ id, ok, status, ...(error ? { error } : {}) })) }));
  return { ran: true, checked: results.length, dead: results.filter(r => !r.ok).map(r => r.id) };
}

// ── ⛔ D176-5 · THE AI-USE GUARD ─────────────────────────────────────────────────────────────────────────────────────
// A source's `aiUse` records its AI terms. OpenStax: its books "may not be used in the training of large language models
// or otherwise be ingested into large language models or generative AI offerings without OpenStax's permission". Text
// from a restricted source is never sent to a model call — the model gateway (services/modelGateway.js, its `sources` option) refuses it.

/** True when the source's terms forbid sending its text to a model. */
export function aiRestricted(source) {
  return /^restricted\b/i.test(String(source?.aiUse || ""));
}

let _cached = null;
function cachedRegistry() {
  if (!_cached) _cached = loadRegistry();
  return _cached;
}

/**
 * The source ids a model call may NOT carry: restricted ones, and ids the register does not know (an unknown source's
 * terms are unknown). Returns [{ id, why }] — empty when the call may go.
 */
export function blockedForModel(sourceIds, reg = cachedRegistry()) {
  const byId = new Map((reg.sources || []).map(s => [s.id, s]));
  const out = [];
  for (const id of [...new Set((sourceIds || []).map(String))]) {
    const s = byId.get(id);
    if (!s) out.push({ id, why: "not in the source register — its AI terms are unknown" });
    else if (aiRestricted(s)) out.push({ id, why: s.aiUse });
  }
  return out;
}
