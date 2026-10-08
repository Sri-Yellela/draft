// shared/enrichmentChunks.js — SPLIT an enrichment export into model-sized pieces, CHECK each filled piece the moment
// it comes back, and JOIN the filled pieces into the import file the importer will accept.
//
// The manual round trip (routes/enrichment.js; no model runs inside draft): export → fill each line's `enrichment`
// object OUTSIDE the product → import, dry run first. A 500-row export is ~2.5 MB of posting text — too much for one
// model conversation — so it is cut into pieces of ~30, each filled separately in an ordinary chat, and the results
// joined. The join is where a model's mistakes are caught, BEFORE the upload: the importer is all-or-nothing, so one
// bad row anywhere refuses the whole file.
//
// ⛔ ONE SOURCE OF RULES (D83 BUILD 1c). This file is used by BOTH the Admin Enrichment page (in the browser) and
// scripts/enrichmentChunks.mjs (the CLI, kept for the agent and developers). The same input therefore yields the same
// merged file from both — a test holds them to it. The column rules are the importer's own (shared/enrichmentRules.js),
// never a second copy that could drift.
//   · `content_hash` is RESTORED from the export, whatever the model returned: it is the export's own value
//     (the staleness interlock compares it with the board's CURRENT text at import), so a model that dropped
//     or mangled it must not turn a good row into a rejected one — or a stale one into an accepted one.
//   · Only `job_id`, `content_hash` and `enrichment` go into the import file; `source` is dropped.
//   · A row whose every value is null is DROPPED (it would write nothing) and reported.
//   · Rejected and missing rows are written back in EXPORT format (`redo`), so they can be split again.
//   · ⛔ "Clean the text" changes the PIECE's copy only — the stored posting is never touched (the importer ignores
//     `source`). It removes HTML and recognised boilerplate paragraphs; it NEVER truncates, because a cut at a
//     character count hides requirements that follow a long company introduction (owner, 10-09).
// ⛔ Pure: no Node built-ins, no database, no network. It never calls a model.
import { ENRICHMENT_COLUMNS, ALLOWED_VALUES, TEXT_CAPS, IMPORT_ROW_CAP, validateColumn, parseJsonl } from "./enrichmentRules.js";
import { LEVEL_RULES } from "./levelMapping.js";

export const DEFAULT_CHUNK_ROWS = 30;
export const DEFAULT_IMPORT_ROWS = IMPORT_ROW_CAP;

/** The instructions to give the model with each piece — the importer's rules, in words, every allowed value included. */
export function enrichmentPrompt() {
  return [
    "You will receive JSON lines, one job posting per line. For EACH line, output exactly one JSON line:",
    '{"job_id": <copied unchanged>, "content_hash": <copied unchanged>, "enrichment": { ... }}',
    "Do NOT output the `source` block. Output JSONL only — no commentary, no code fences, no blank lines.",
    "",
    "Fill `enrichment` from the posting's OWN text (source.title + source.description) only. Use null when the text",
    "does not say. Allowed keys — no others:",
    "  skills_json: array of {\"skill\": \"<name>\", \"type\": \"hard\" | \"soft\"} — hard = a named tool, language, framework,",
    "    platform or technique the posting asks for (checkable on a résumé); soft = a way of working. 5–25 entries.",
    `  experience_level: one of ${ALLOWED_VALUES.experience_level.join(" | ")} | null — by this mapping (the same one draft uses):`,
    ...LEVEL_RULES.map((r) => `    ${r}`),
    `  workplace_type: one of ${ALLOWED_VALUES.workplace_type.join(" | ")} | null`,
    "  salary_min_usd, salary_max_usd: whole numbers in US dollars (not strings), only when the posting states pay;",
    "    otherwise null. Never estimate.",
    `  salary_period: ${ALLOWED_VALUES.salary_period.join(" | ")} | null`,
    "  is_h1b_sponsor, requires_work_auth, is_clearance_required: 1 or 0 ONLY when the posting explicitly says so;",
    "    otherwise null. Never infer eligibility.",
    `  summary: one plain sentence, at most ${TEXT_CAPS.summary} characters.`,
    `  normalized_title: the role's plain title without level or team, at most ${TEXT_CAPS.normalized_title} characters.`,
    `  org_unit_raw: the team or organisation named in the posting, at most ${TEXT_CAPS.org_unit_raw} characters, or null.`,
    "",
    "A line with \"truncated\": true carries a posting whose text was cut at the end: fill only what you can see.",
    "",
    "AFTER all the JSON lines, you may add notes — one per line, nothing else on the line:",
    `  #NOTE <job_id> <CODE> <at most 20 words>     CODE is one of: ${NOTE_CODES.join(" · ")}`,
    "  TRUNCATED the text ends abruptly · PAY-FORMAT pay is stated in a form you could not turn into numbers ·",
    "  PLACEHOLDER the text is a template or empty · NOT-CS not a computer-science role · NON-US not in the US ·",
    "  DUPLICATE the same text as another line · ODD anything else worth a human look.",
  ].join("\n");
}

// ── Clean the text ────────────────────────────────────────────────────────────────────────────────────────────────

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", hellip: "…", bull: "•", middot: "·", trade: "™", reg: "®", copy: "©" };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
const HAS_TAG = /<\/?[a-z][a-z0-9]*(\s[^<>]*)?\/?>/i;
function stripTags(s) {
  return s
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|section|article|header|footer|blockquote)>/gi, "\n\n")
    .replace(/<(p|div|ul|ol|h[1-6]|tr|section|article|header|footer|blockquote)\b[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");
}

// A paragraph that says anything the enrichment columns are filled FROM is never removed, whatever else it says:
// pay (salary columns), eligibility (the three flags), where the work happens (workplace_type) — and (D84 F1) the
// role itself: requirements, qualifications, responsibilities, the tech stack, the location.
const PROTECTED = /\$\s?\d|\b\d{2,3}(,\d{3})+\b|\b\d{2,3}k\b|salary|compensation|pay range|base pay|hourly rate|per hour|equity|work authori[sz]ation|authori[sz]ed to work|legally authori[sz]ed|sponsor|\bvisa\b|h-?1b|green card|clearance|u\.?s\.? citizen|remote|hybrid|on-?site|in[- ]office|relocat|requirement|qualification|responsibilit|what you('|’)ll do|what you will do|you will|tech(nology)? stack|\blocation\b|years of experience/i;
// What a requirement or responsibility sounds like — an "about us" paragraph that says any of this is kept.
const ROLE_WORDS = /\b(experience|requirement|qualif|you will|you'll|you have|you bring|must|degree|proficien|skills?|years|responsib|build|design|develop|own|lead)\b/i;
const BOILERPLATE = [
  // equal opportunity / legal notices
  /equal (employment )?opportunit|without regard to|regardless of (race|age|sex|gender|religion|color)|protected veteran|reasonable accommodation|e-verify|affirmative action|pay transparency|know your rights|applicant privacy|privacy (notice|policy)|recruit(ment|ing) fraud|unsolicited (resumes|applications)|agency (submissions|resumes)/i,
  // benefits and perks
  /\b401\s?\(?k\)?|health,? dental|dental,? (and )?vision|paid time off|parental leave|wellness (stipend|program)|commuter benefits|unlimited (pto|vacation)|employee stock purchase|life insurance|fertility benefits|gym (membership|stipend)|^(benefits|perks)( and (benefits|perks))?\s*:?$/i,
  // D84 F1: legal and privacy notices, recruitment-scam warnings, automated-decision (AEDT) notices
  /privacy (notice|policy|statement)|personal (data|information) (we collect|will be processed)|gdpr|ccpa|recruit(ment|ing)? scam|fraudulent (job )?offers|never ask (you )?(for|to pay)|automated employment decision|\baedt\b|local law 144|bias audit|e-?verify|arbitration agreement|at-will employment/i,
];
const ABOUT_US = /^(about (us|the company|the team\b(?! you)|[A-Z][\w&.'-]*( [A-Z][\w&.'-]*){0,3})\s*[:\n-]|who we are\b|our (mission|story|values)\b|at [A-Z][\w&.'-]*,? we\b)/;

/**
 * Removes HTML and recognised boilerplate paragraphs (equal opportunity, benefits, about-us). ⛔ No truncation, and a
 * paragraph that mentions pay, eligibility or where the work happens is always kept.
 * @returns {{ text: string, removedParagraphs: number, removed: string[] }} — `removed` lists what was left out, for audit
 */
export function cleanPostingText(raw) {
  let s = String(raw ?? "");
  // Feeds store HTML either raw or entity-escaped (Greenhouse sends `&lt;p&gt;`); decode until no tag remains.
  for (let i = 0; i < 3; i++) {
    const decoded = decodeEntities(s);
    if (HAS_TAG.test(s)) s = decodeEntities(stripTags(s));
    else if (HAS_TAG.test(decoded)) s = decoded;
    else { s = decoded; break; }
  }
  const paras = s.replace(/\r\n?/g, "\n").replace(/[ \t ]+/g, " ").split(/\n\s*\n|\n(?=\s*[-•*] )/)
    .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean).join("\n")).filter(Boolean);
  const kept = [], removed = [];
  for (const p of paras) {
    const boiler = !PROTECTED.test(p) && (
      BOILERPLATE.some((re) => re.test(p)) ||
      (ABOUT_US.test(p) && !ROLE_WORDS.test(p)));
    (boiler ? removed : kept).push(p);
  }
  return { text: kept.join("\n\n"), removedParagraphs: removed.length, removed };
}

// ── The export's text (D84 F1) ────────────────────────────────────────────────────────────────────────────────────

/** The most text one exported posting carries. Above it, whole paragraphs leave from the END — never the middle. */
export const EXPORT_TEXT_CAP = 12000;
export const ELISION_MARK = "[…]";

/**
 * The text an export row carries: the full posting, cleaned of boilerplate, capped at EXPORT_TEXT_CAP by dropping
 * whole trailing paragraphs (one sentence-bounded slice only if a single paragraph is longer than the cap).
 * ⛔ `[…]` can never appear: a text still carrying the old cap's marker is refused (null) — the row waits for full text.
 * @returns {{ text, truncated, chars_sent, chars_total, removed_paragraphs } | null}
 */
export function exportPostingText(full) {
  const raw = String(full ?? "");
  if (!raw.trim() || raw.includes(ELISION_MARK)) return null;
  const { text: cleaned, removedParagraphs } = cleanPostingText(raw);
  let text = cleaned;
  if (text.length > EXPORT_TEXT_CAP) {
    const paras = text.split("\n\n");
    while (paras.length > 1 && paras.join("\n\n").length > EXPORT_TEXT_CAP) paras.pop();
    text = paras.join("\n\n");
    if (text.length > EXPORT_TEXT_CAP) {
      const cut = text.slice(0, EXPORT_TEXT_CAP);
      const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
      text = end > EXPORT_TEXT_CAP / 2 ? cut.slice(0, end + 1) : cut;
    }
  }
  return { text, truncated: text.length < cleaned.length, chars_sent: text.length, chars_total: cleaned.length,
           removed_paragraphs: removedParagraphs };
}

// ── Split ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Split an export's JSONL into chunks of `size` posting lines (the _meta header is dropped). Optionally cleaned. */
export function splitExport(exportText, { size = DEFAULT_CHUNK_ROWS, clean = false } = {}) {
  if (!(Number.isInteger(size) && size > 0)) throw new Error("size must be a positive integer");
  const { rows, meta, errors } = parseJsonl(exportText);
  if (errors.length) throw new Error(`the export has ${errors.length} unparseable line(s), first at line ${errors[0].line}`);
  let removedParagraphs = 0;
  const lines = rows.map((r) => {
    // ⛔ D84: a piece carries only what the model needs — the export header (`_meta`, dropped by parseJsonl),
    // `stored_content_hash` and the character counts stay out; `truncated` travels only when true.
    const { stored_content_hash, chars_sent, chars_total, truncated, ...obj } = r.obj ?? {};
    if (truncated === true) obj.truncated = true;
    if (!clean || !obj.source || typeof obj.source.description !== "string") return JSON.stringify(obj);
    const c = cleanPostingText(obj.source.description);
    removedParagraphs += c.removedParagraphs;
    // job_id and content_hash are kept exactly: the hash is the EXPORT's, of the STORED text, and the stored text is
    // what the importer compares it with. The cleaned copy is context for the model and nothing else.
    return JSON.stringify({ ...obj, source: { ...obj.source, description: c.text } });
  });
  const chunks = [];
  for (let i = 0; i < lines.length; i += size) chunks.push(lines.slice(i, i + size));
  return { meta, rows: lines.length, chunks, removedParagraphs };
}

/** The pieces the Admin page tracks: each piece's file text, its job ids and its size. */
export function buildPieces(exportText, { size = DEFAULT_CHUNK_ROWS, clean = false } = {}) {
  const { chunks, rows, removedParagraphs, meta } = splitExport(exportText, { size, clean });
  const pieces = chunks.map((lines, i) => {
    const text = lines.join("\n") + "\n";
    return { n: i + 1, of: chunks.length, rows: lines.length, text, bytes: utf8Bytes(text),
             jobIds: lines.map((l) => String(JSON.parse(l).job_id)) };
  });
  // D84 F1: the export's header (held-back count, the text cap) and how many rows travel cut.
  const truncatedRows = chunks.flat().filter((l) => JSON.parse(l).truncated === true).length;
  return { rows, pieces, removedParagraphs, meta: meta ?? null, truncatedRows };
}
function utf8Bytes(s) {
  let n = 0;
  for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
  return n;
}

// ── Merge ─────────────────────────────────────────────────────────────────────────────────────────────────────────

// A model's output: strip code fences and stray prose lines; keep what parses as an object with a job_id.
// ⛔ D84 F13 · THE NOTES CHANNEL. The model may add `#NOTE <job_id> <CODE> <≤ 20 words>` lines after the JSONL; they
// are COLLECTED (and shown on the page under "Things the model flagged"), never rejected as unreadable lines.
export const NOTE_CODES = ["TRUNCATED", "PAY-FORMAT", "PLACEHOLDER", "NOT-CS", "NON-US", "DUPLICATE", "ODD"];
const NOTE_LINE = /^#\s*NOTE\s+(\S+)\s+(\S+)\s*(.*)$/i;
export function parseNote(line) {
  const m = String(line ?? "").trim().match(NOTE_LINE);
  if (!m) return null;
  const code = m[2].toUpperCase();
  return { jobId: m[1], code: NOTE_CODES.includes(code) ? code : "ODD", givenCode: code,
           text: m[3].split(/\s+/).filter(Boolean).slice(0, 20).join(" ") };
}

function parseFilled(text) {
  const out = [], junk = [], notes = [];
  String(text ?? "").split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("```")) return;
    const note = parseNote(line);
    if (note) { notes.push({ line: i + 1, ...note }); return; }
    const start = line.indexOf("{");
    if (start < 0) { junk.push({ line: i + 1, text: line.slice(0, 80) }); return; }
    try { out.push({ line: i + 1, obj: JSON.parse(line.slice(start)) }); }
    catch { junk.push({ line: i + 1, text: line.slice(0, 80) }); }
  });
  return { out, junk, notes };
}

/**
 * Merge filled chunks against the export they came from.
 * @param exportText the ORIGINAL export JSONL (or one piece of it)
 * @param filled     [{ name, text }] — each filled chunk; a later reply for a row that an earlier one got WRONG
 *                   replaces it (a second try), while a second reply for a row already accepted is a duplicate
 * @returns {{ files: string[], redo: string, report: object }}
 */
export function mergeFilled(exportText, filled = [], { max = DEFAULT_IMPORT_ROWS } = {}) {
  const exp = parseJsonl(exportText);
  const byId = new Map(exp.rows.map((r) => [String(r.obj.job_id), r.obj]));
  const accepted = new Map();
  let rejected = [], duplicates = [], emptyDropped = [];
  const junk = [], notes = [];
  for (const { name, text } of filled) {
    const p = parseFilled(text);
    junk.push(...p.junk.map((j) => ({ file: name, ...j })));
    notes.push(...p.notes.map((n) => ({ file: name, ...n })));
    for (const { line, obj } of p.out) {
      const at = { file: name, line };
      const jobId = obj?.job_id == null ? null : String(obj.job_id);
      if (!jobId) { rejected.push({ ...at, jobId: null, error: "no job_id" }); continue; }
      const orig = byId.get(jobId);
      if (!orig) { rejected.push({ ...at, jobId, error: "job_id is not in the export" }); continue; }
      if (accepted.has(jobId)) { duplicates.push({ ...at, jobId }); continue; }
      const e = obj.enrichment;
      if (!e || typeof e !== "object" || Array.isArray(e)) { rejected.push({ ...at, jobId, error: "no enrichment object" }); continue; }
      const unknown = Object.keys(e).filter((k) => !ENRICHMENT_COLUMNS.includes(k));
      if (unknown.length) { rejected.push({ ...at, jobId, error: `unknown column(s): ${unknown.join(", ")}` }); continue; }
      const clean = {};
      let bad = null;
      for (const [k, v] of Object.entries(e)) {
        const r = validateColumn(k, v);
        if (!r.ok) { bad = `${k}: ${r.error}`; break; }
        if (r.value !== undefined) clean[k] = v;                 // the raw value: the importer re-validates it identically
      }
      if (bad) { rejected.push({ ...at, jobId, error: bad }); continue; }
      if (!Object.keys(clean).length) { emptyDropped.push({ ...at, jobId }); continue; }
      // hash RESTORED from the export; D84 F1: so is `truncated` — the importer marks such a row partial
      accepted.set(jobId, { job_id: orig.job_id, content_hash: orig.content_hash, ...(orig.truncated === true ? { truncated: true } : {}), enrichment: clean });
    }
  }
  // A row that a later reply got right is no longer a problem: drop its earlier rejections and empties.
  rejected = rejected.filter((r) => !r.jobId || !accepted.has(r.jobId));
  emptyDropped = emptyDropped.filter((r) => !accepted.has(r.jobId));
  // Keep export order, so the merged file does not depend on which reply arrived first.
  const rows = [...byId.keys()].filter((id) => accepted.has(id)).map((id) => accepted.get(id));
  const files = [];
  for (let i = 0; i < rows.length; i += max) files.push(rows.slice(i, i + max).map((r) => JSON.stringify(r)).join("\n") + "\n");
  const done = new Set(accepted.keys());
  const missing = [...byId.keys()].filter((id) => !done.has(id) && !rejected.some((r) => r.jobId === id) && !emptyDropped.some((r) => r.jobId === id));
  const redoIds = new Set([...rejected.map((r) => r.jobId).filter(Boolean), ...missing, ...emptyDropped.map((r) => r.jobId)]);
  const redo = [...byId.values()].filter((o) => redoIds.has(String(o.job_id))).map((o) => JSON.stringify(o)).join("\n");
  const perColumn = Object.fromEntries(ENRICHMENT_COLUMNS.map((c) => [c, rows.filter((r) => c in r.enrichment).length]));
  return {
    files, redo: redo ? redo + "\n" : "",
    report: { exported: byId.size, accepted: rows.length, rejected, duplicates, emptyDropped, missing, junk, notes, perColumn, importFiles: files.length },
  };
}

/**
 * Check ONE piece's replies the instant they are uploaded. `Checked` means every posting in the piece came back with
 * valid values — nothing rejected, nothing missing. A bad row is LISTED, never silently dropped; the piece keeps its
 * earlier replies, so a second reply carrying only the fixed rows completes it.
 */
export function checkPiece(pieceText, replies = []) {
  const { report } = mergeFilled(pieceText, replies, { max: Number.MAX_SAFE_INTEGER });
  const problems = [
    ...report.rejected.map((r) => ({ jobId: r.jobId, line: r.line, file: r.file, why: r.error })),
    ...report.missing.map((id) => ({ jobId: id, why: "did not come back in the reply" })),
  ];
  return {
    checked: replies.length > 0 && problems.length === 0,
    total: report.exported, valid: report.accepted,
    empty: report.emptyDropped.length,          // every value null: nothing to write, not an error
    problems, junkLines: report.junk.length, notes: report.notes,
  };
}

/** The piece's rows that still need a reply, as a smaller piece (export format) for a second try. */
export function redoPiece(pieceText, replies = []) {
  return mergeFilled(pieceText, replies, { max: Number.MAX_SAFE_INTEGER }).redo;
}

// ── The dry run, read for the page ────────────────────────────────────────────────────────────────────────────────

/**
 * ⛔ Apply unlocks only for the EXACT file a clean dry run was computed from — the moment a byte differs (a new file,
 * a re-join) it locks again. `dry` is `{ forText, plan }`.
 */
export function applyGate(dry, text) {
  if (!text) return { unlocked: false, why: "Join the pieces (or choose a file) first." };
  if (!dry || dry.forText !== text) return { unlocked: false, why: "Run the rehearsal on this file first — Apply unlocks only after a clean dry run of this exact file." };
  if (!dry.plan?.valid) return { unlocked: false, why: "The rehearsal refused some rows. Take them out (they go to the redo file) and rehearse again." };
  if (!(dry.plan.wouldWrite > 0)) return { unlocked: false, why: "Nothing to write — the board already has these values." };
  return { unlocked: true, why: "Unlocked because the dry run of this exact file was clean." };
}

/** Every refusal reason the importer can give, in plain words — counted, so the table says why each row was refused. */
export const REFUSAL_WORDS = {
  stale: "the posting changed since you exported",
  invalid_value: "a value that isn't allowed",
  unknown_column: "a field draft doesn't take",
  unknown_job_id: "not a posting on the board",
  duplicate: "the same posting twice in the file",
  no_content_hash: "the row lost its fingerprint",
  no_enrichment: "no filled values",
  no_job_id: "a line with no posting id",
  parse: "a line draft can't read",
};
export function refusalCounts(rejected = []) {
  const counts = new Map();
  for (const r of rejected) counts.set(r.kind, (counts.get(r.kind) || 0) + 1);
  return [...counts].map(([kind, count]) => ({ kind, count, words: REFUSAL_WORDS[kind] ?? kind }));
}

/** The file without the refused lines (to rehearse again), and those rows for the redo file. */
export function withoutRefused(text, rejected = []) {
  const bad = new Set(rejected.map((r) => r.line));
  const keep = [], out = [];
  String(text ?? "").split(/\r?\n/).forEach((l, i) => { if (!l.trim()) return; (bad.has(i + 1) ? out : keep).push(l); });
  return { text: keep.length ? keep.join("\n") + "\n" : "", refused: out.length ? out.join("\n") + "\n" : "" };
}

// ── D84 F14 · one batch, one download, one upload ─────────────────────────────────────────────────────────────────

/** The piece sizes the page offers. The size governs ONLY the chat step — the import takes the whole batch at once. */
export const PIECE_SIZES = [20, 50, 100];
export const DEFAULT_PIECE_SIZE = 20;      // full text: 30 postings ≈ 100k tokens (D84's batch process)

/** A piece's file name — the number a reply is matched back by. */
export function pieceFileName(n, of) {
  const w = Math.max(2, String(of).length);
  return `piece-${String(n).padStart(w, "0")}-of-${String(of).padStart(w, "0")}.jsonl`;
}

/**
 * Match uploaded replies to pieces BY FILE NAME ("piece-07…" → piece 7). ⛔ Never guessed: a name with no piece number,
 * or a number that is no piece, is UNMATCHED; two replies for one piece are both reported and neither is used.
 * @param pieceNumbers the pieces' n values
 * @param files [{ name, text }]
 */
export function matchReplies(pieceNumbers, files) {
  const want = new Set(pieceNumbers);
  const byPiece = new Map(), unmatched = [];
  for (const f of files) {
    const m = String(f.name).match(/piece[-_ ]?0*(\d+)/i);
    const n = m ? Number(m[1]) : null;
    if (n == null || !want.has(n)) { unmatched.push(f.name); continue; }
    byPiece.set(n, [...(byPiece.get(n) ?? []), f]);
  }
  const assigned = new Map(), duplicates = [];
  for (const [n, fs] of byPiece) {
    if (fs.length > 1) duplicates.push({ piece: n, names: fs.map((f) => f.name) });
    else assigned.set(n, fs[0]);
  }
  return { assigned, unmatched, duplicates };
}

/** "Things the model flagged" as CSV: job id, code, note, file. */
export function notesCsv(notes = []) {
  const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  return ["job_id,code,note,file", ...notes.map((n) => [n.jobId, n.code, n.text, n.file].map(q).join(","))].join("\n") + "\n";
}

// A store-only ZIP (no compression) — enough to hand over many small text files as one download, with no dependency.
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
/** @param files [{ name, text }] @returns {Uint8Array} a valid .zip */
export function zipStore(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4],
     [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]]
      .forEach(([o, v, s]) => (s === 4 ? local.setUint32(o, v, true) : local.setUint16(o, v, true)));
    const cen = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4],
     [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2],
     [38, 0, 4], [42, offset, 4]]
      .forEach(([o, v, s]) => (s === 4 ? cen.setUint32(o, v, true) : cen.setUint16(o, v, true)));
    parts.push(new Uint8Array(local.buffer), name, data);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cenSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [8, files.length, 2], [10, files.length, 2], [12, cenSize, 4], [16, offset, 4]]
    .forEach(([o, v, s]) => (s === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true)));
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let at = 0; for (const p of all) { out.set(p, at); at += p.length; }
  return out;
}
