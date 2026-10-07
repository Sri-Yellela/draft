// ── D55 · THE TABLE IN AND OUT AS CSV — export its rows, import past applications ─────────────────────
//
// docs/AUTOFILL_TARGET.md §8.1 row 12, §8.5 (i). Pure and shared: the panel EXPORTS the rows it is
// showing (no second query, so the file is exactly The Table), and the server and the panel both read
// an import file with the same parser and the same column guesses.
//
// ⛔ WHAT AN IMPORT IS. A past application the user sent somewhere else. It lands as a SENT
// job_applications row (services/applicationImport.js) with its date and its outcome — never as a
// Draft, never as a pending record, and ⛔ never with an ATS score: there is no résumé of ours behind
// it, so the score column is NULL. A guessed score would poison the only dataset that can validate
// the scorer (AK1).
//
// ⛔ DUPLICATES are decided by the D54 COMPANY KEY + the title — never the display name. "Stripe, Inc."
// and "STRIPE" are one company; two same-named companies with different websites are two.
import { RESPONSE_LABELS, normaliseOutcome } from "./applicationResponse.js";
import { HISTORY_CHIPS } from "./applicationHistory.js";

export const IMPORT_LIMITS = Object.freeze({
  maxBytes: 1_000_000,   // ~1 MB of text — thousands of applications; a bigger file is not a history
  maxRows: 2000,
  maxCell: 300,          // company, title, location, URL …
  maxNotes: 2000,
});

/** The fields an import can fill. `required` ones must be mapped to a column. */
export const IMPORT_FIELDS = Object.freeze([
  { id: "company",  label: "Company",      required: true,  guesses: ["company", "company name", "employer", "organization", "organisation"] },
  { id: "title",    label: "Title",        required: true,  guesses: ["title", "job title", "role", "position", "job"] },
  { id: "applied",  label: "Applied on",   required: true,  guesses: ["applied", "applied on", "date applied", "applied date", "application date", "date"] },
  { id: "outcome",  label: "Outcome",      required: false, guesses: ["outcome", "status", "stage", "result", "response"] },
  { id: "replied",  label: "First reply",  required: false, guesses: ["first reply", "replied", "replied on", "response date", "reply date"] },
  { id: "url",      label: "Posting URL",  required: false, guesses: ["url", "posting url", "job url", "link", "job link", "posting"] },
  { id: "location", label: "Location",     required: false, guesses: ["location", "city"] },
  { id: "notes",    label: "Notes",        required: false, guesses: ["notes", "note", "comments"] },
  { id: "website",  label: "Company website", required: false, guesses: ["website", "company website", "domain", "company domain"] },
]);

/**
 * Words an outcome column may carry that mean "sent, nothing back recorded" — SpeedyApply's
 * "applied", The Table's own Stage labels. They import as no outcome (NULL), which is what a sent
 * application with nothing recorded IS. Anything not here and not an outcome is refused per row.
 */
const NEUTRAL = new Set(["applied", "sent", "submitted", "waiting", "sent_·_waiting", "did_they_reply?", "pending", "in_play"]);

// ── CSV ───────────────────────────────────────────────────────────────────────────────────────────

/** One cell. A leading = + - @ is a formula to a spreadsheet: prefix it so opening the file runs nothing. */
export function csvCell(v) {
  const s = String(v ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Undo csvCell's formula guard on the way back in, so an export round-trips. */
const unguard = (s) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

/** RFC 4180-ish: quoted cells, doubled quotes, CRLF or LF, a UTF-8 BOM dropped. Rows of strings. */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  const s = String(text ?? "").replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== "")).map(r => r.map(unguard));
}

// ── Export ────────────────────────────────────────────────────────────────────────────────────────

const iso = (sec) => (sec == null ? "" : new Date(sec * 1000).toISOString().slice(0, 10));
const stageLabel = Object.fromEntries(HISTORY_CHIPS.map(c => [c.id, c.label]));

/** The export's columns, in order. `Outcome` is the STORED value, so a re-import reads it exactly. */
export const EXPORT_COLUMNS = Object.freeze(["Company", "Title", "Stage", "Outcome", "Applied on", "First reply", "Posting URL"]);

/** The Table's rows (as shown — after search, dates and chip) → CSV text. */
export function historyToCsv(rows = []) {
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push([
      r.companyName ?? r.company ?? "", r.title ?? "", stageLabel[r.stage] ?? r.label ?? "",
      r.responseOutcome ?? "", iso(r.sentAt), iso(r.firstResponseAt), r.applyUrl ?? "",
    ].map(csvCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

// ── Import: mapping and validation (pure) ─────────────────────────────────────────────────────────

const norm = (h) => String(h ?? "").trim().toLowerCase().replace(/[_\s]+/g, " ");

/** Header → the field each column most likely is. { fieldId: headerText }; a header is used once. */
export function guessMapping(headers = []) {
  const out = {}, used = new Set();
  for (const f of IMPORT_FIELDS) {
    for (const g of f.guesses) {
      const h = headers.find(x => norm(x) === g && !used.has(x));
      if (h != null) { out[f.id] = h; used.add(h); break; }
    }
  }
  return out;
}

/** A date cell → seconds at 12:00 UTC of that calendar day (so no time zone moves it), or null. */
export function parseDay(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let y, m, d, x;
  if ((x = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(s))) [y, m, d] = [+x[1], +x[2], +x[3]];
  else if ((x = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) [m, d, y] = [+x[1], +x[2], +x[3]];   // US M/D/YYYY
  else {
    const t = Date.parse(s);
    if (!Number.isFinite(t)) return null;
    const dt = new Date(t);
    [y, m, d] = [dt.getFullYear(), dt.getMonth() + 1, dt.getDate()];
  }
  const t = Date.UTC(y, m - 1, d, 12);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return Math.floor(t / 1000);
}

/** A title, compared: case, punctuation and spacing do not make two roles. */
export const titleKey = (t) => String(t ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const httpUrl = (u) => { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
const domainOf = (w) => {
  const s = String(w ?? "").trim();
  if (!s) return null;
  try { return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).hostname.toLowerCase().replace(/^www\./, "") || null; }
  catch { return null; }
};

/**
 * Validate the file. Returns { error } for a file-level refusal, else
 * { candidates: [{ row, company, title, appliedAt, outcome, repliedAt, url, location, notes, domain }],
 *   invalid: [{ row, reason, company?, title? }] }. `row` is the 1-based line in the file (header = 1).
 */
export function readImport(text, mapping = {}, { now = Math.floor(Date.now() / 1000) } = {}) {
  const bytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(String(text ?? "")).length : String(text ?? "").length;
  if (bytes > IMPORT_LIMITS.maxBytes) return { error: "too_large", detail: `The file is over ${IMPORT_LIMITS.maxBytes / 1_000_000} MB.` };
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "empty", detail: "The file has no rows under its header." };
  if (rows.length - 1 > IMPORT_LIMITS.maxRows) return { error: "too_many_rows", detail: `At most ${IMPORT_LIMITS.maxRows} applications per file.` };
  const header = rows[0].map(h => h.trim());
  const col = {};
  for (const f of IMPORT_FIELDS) {
    const h = mapping[f.id];
    if (h == null || h === "") { if (f.required) return { error: "mapping_incomplete", detail: `Choose the column for ${f.label}.` }; continue; }
    const i = header.indexOf(String(h).trim());
    if (i < 0) return { error: "mapping_unknown_column", detail: `There is no column "${h}".` };
    col[f.id] = i;
  }
  const candidates = [], invalid = [];
  rows.slice(1).forEach((r, n) => {
    const row = n + 2;
    const get = (id) => (col[id] == null ? "" : String(r[col[id]] ?? "").trim());
    const company = get("company"), title = get("title");
    const bad = (reason) => invalid.push({ row, reason, company: company || null, title: title || null });
    if (!company) return bad("company_missing");
    if (!title) return bad("title_missing");
    for (const id of ["company", "title", "location", "url", "website"]) if (get(id).length > IMPORT_LIMITS.maxCell) return bad(`${id}_too_long`);
    if (get("notes").length > IMPORT_LIMITS.maxNotes) return bad("notes_too_long");
    const appliedAt = parseDay(get("applied"));
    if (appliedAt == null) return bad(get("applied") ? "applied_date_unreadable" : "applied_date_missing");
    if (appliedAt > now + 86400) return bad("applied_date_in_future");
    if (appliedAt < Date.UTC(2000, 0, 1) / 1000) return bad("applied_date_before_2000");
    const rawOutcome = get("outcome");
    let outcome = null;
    if (rawOutcome) {
      const k = rawOutcome.toLowerCase().replace(/[\s-]+/g, "_");
      if (NEUTRAL.has(k)) outcome = null;
      else if (k === "closed" || k === "did_not_apply") return bad("not_sent");
      else if (k === "in_play" || k === "drafted") return bad("not_sent");
      else {
        // The Table's own Stage labels ("Interviewing", "No reply") and the stored values both read.
        outcome = normaliseOutcome(rawOutcome);
        if (outcome === undefined) {
          const byLabel = Object.entries(RESPONSE_LABELS).find(([, v]) => v.label.toLowerCase() === rawOutcome.toLowerCase());
          outcome = byLabel ? byLabel[0] : undefined;
        }
        if (outcome === undefined) return bad("outcome_unknown");
      }
    }
    let repliedAt = null;
    if (get("replied")) {
      repliedAt = parseDay(get("replied"));
      if (repliedAt == null) return bad("reply_date_unreadable");
      if (repliedAt < appliedAt) return bad("reply_before_applied");
      if (repliedAt > now + 86400) return bad("reply_date_in_future");
    }
    const url = get("url") ? httpUrl(get("url")) : null;
    if (get("url") && !url) return bad("url_not_a_web_address");
    candidates.push({
      row, company, title, appliedAt, outcome, repliedAt, url,
      location: get("location") || null, notes: get("notes") || null, domain: domainOf(get("website")),
    });
  });
  return { header, candidates, invalid };
}

/** What each per-row refusal says, for the import preview. */
export const IMPORT_REASONS = Object.freeze({
  company_missing: "no company",
  title_missing: "no title",
  applied_date_missing: "no applied date",
  applied_date_unreadable: "the applied date could not be read (use YYYY-MM-DD)",
  applied_date_in_future: "the applied date is in the future",
  applied_date_before_2000: "the applied date is before 2000",
  outcome_unknown: "the outcome is not one of screen, interviewing, offer, rejected, no response, withdrawn",
  not_sent: "it was never sent — only sent applications import",
  reply_date_unreadable: "the first-reply date could not be read",
  reply_before_applied: "the first reply is before the applied date",
  reply_date_in_future: "the first-reply date is in the future",
  url_not_a_web_address: "the posting URL is not a web address",
  company_too_long: "the company is too long",
  title_too_long: "the title is too long",
  location_too_long: "the location is too long",
  url_too_long: "the URL is too long",
  website_too_long: "the website is too long",
  notes_too_long: "the notes are too long",
  duplicate_existing: "already in The Table — same company and title",
  duplicate_in_file: "repeats an earlier row — same company and title",
});
