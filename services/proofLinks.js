// ── D109 · PROOF — every claim on the résumé can carry its evidence (owner 10-30) ────────────────────────
//
// P1 · each experience BULLET and each PROJECT on the Profile (D101) can link evidence: a repository, a live demo, a
//      paper, a write-up — an https address, a kind, a short label. Stored in `profile_evidence` (migration 184), keyed
//      by the bullet's normalised text or the project's normalised name (evidenceKey), so reordering a role or
//      re-importing the same résumé keeps the links. An EDITED bullet keeps its links too: saveSection re-keys them by
//      their place in the role (rekeyEvidence, called from services/structuredProfile.js).
// P2 · the claim guard marks each bullet backed or unbacked (services/resumeClaimGuard.js markBacking); tailoring
//      prefers backed bullets when it chooses (chooseBullets). Draft's own tailoring path — the user's model through the
//      connector (D86) — reads the mark on every brief bullet; the tools service's Generate receives the same marks once
//      its contract declares them (services/toolsServiceRequests.js RESUME_MASTER_ACCEPTS_EVIDENCE).
// P3 · an optional public page /p/<handle> (routes/proofPage.js) listing projects with their links. OFF by default;
//      nothing private — no email, phone or address.
//
// ⛔ DRAFT CERTIFIES NOTHING. A link is what the candidate supplied; draft does not open it, check it or vouch for it.
//    The marks say "Evidence linked" / "No evidence linked" — never a word that claims draft checked anything
//    (d109NoCertifyWording).
import { scrubContact } from "./byom/resumePatch.js";

export const EVIDENCE_KINDS = Object.freeze([
  { kind: "repository", label: "Repository" },
  { kind: "demo", label: "Live demo" },
  { kind: "paper", label: "Paper" },
  { kind: "writeup", label: "Write-up" },
]);
const KIND_LABEL = new Map(EVIDENCE_KINDS.map(k => [k.kind, k.label]));
export const EVIDENCE_LIMITS = Object.freeze({ perClaim: 5, label: 60, url: 500 });
export const TARGETS = Object.freeze(["bullet", "project"]);

/** The key a claim's evidence hangs on: lower case, whitespace collapsed, leading bullet glyphs dropped. */
export function evidenceKey(text) {
  return String(text ?? "").replace(/^[\s•\-–—*·]+/, "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 600);
}

const bad = (m) => Object.assign(new Error(m), { status: 400, code: "bad_evidence" });

/**
 * One evidence link, validated. https ONLY (a plain-http or javascript: address is refused), a host with a dot, no
 * user:password@ in it, at most 500 characters. The label is short (60); an empty one becomes the kind's own word.
 */
export function checkEvidence(x, n = 1) {
  const kind = String(x?.kind ?? "").trim().toLowerCase();
  if (!KIND_LABEL.has(kind)) throw bad(`Evidence ${n}: the kind is one of ${EVIDENCE_KINDS.map(k => k.label.toLowerCase()).join(", ")}.`);
  const raw = String(x?.url ?? "").trim();
  if (!raw || raw.length > EVIDENCE_LIMITS.url) throw bad(`Evidence ${n}: a full https:// address of up to ${EVIDENCE_LIMITS.url} characters.`);
  let u;
  try { u = new URL(raw); } catch { throw bad(`Evidence ${n}: a full https:// address.`); }
  if (u.protocol !== "https:") throw bad(`Evidence ${n}: only https:// addresses can be linked.`);
  if (u.username || u.password) throw bad(`Evidence ${n}: the address cannot carry a user name or password.`);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) throw bad(`Evidence ${n}: the address needs a real host name.`);
  const label = String(x?.label ?? "").replace(/\s+/g, " ").trim();
  if (label.length > EVIDENCE_LIMITS.label) throw bad(`Evidence ${n}: the label is at most ${EVIDENCE_LIMITS.label} characters.`);
  return { kind, label: label || KIND_LABEL.get(kind), url: u.href };
}

/** Every evidence row of the user, as Map(`${target}:${key}` → [{ id, kind, label, url }]). Empty before 184. */
export function evidenceMap(db, userId) {
  const out = new Map();
  let rows = [];
  try { rows = db.prepare(`SELECT id, target, target_key, kind, label, url FROM profile_evidence WHERE user_id = ? ORDER BY position, id`).all(userId); }
  catch { return out; }
  for (const r of rows) {
    const k = `${r.target}:${r.target_key}`;
    if (!out.has(k)) out.set(k, []);
    out.get(k).push({ id: r.id, kind: r.kind, label: r.label, url: r.url });
  }
  return out;
}

/** Does the user have a bullet / project with this key? Evidence is only ever linked to a claim that exists. */
function claimExists(db, userId, target, key) {
  if (target === "project") {
    return db.prepare(`SELECT name FROM profile_projects WHERE user_id = ?`).pluck().all(userId).some(n => evidenceKey(n) === key);
  }
  for (const j of db.prepare(`SELECT bullets_json FROM profile_experience WHERE user_id = ?`).pluck().all(userId)) {
    let bullets = [];
    try { bullets = JSON.parse(j || "[]"); } catch { bullets = []; }
    if (bullets.some(b => evidenceKey(b) === key)) return true;
  }
  return false;
}

/**
 * Replace ONE claim's evidence (PUT /api/profile/evidence). `claim` is the bullet's text or the project's name, as the
 * page shows it. Validated whole; nothing half-stored. An empty list removes the claim's evidence.
 */
export function setEvidence(db, userId, { target, claim, items } = {}) {
  if (!TARGETS.includes(target)) throw bad("Evidence goes on a bullet or a project.");
  const key = evidenceKey(claim);
  if (!key) throw bad("Say which bullet or project the evidence is for.");
  if (!Array.isArray(items) || items.length > EVIDENCE_LIMITS.perClaim) throw bad(`Up to ${EVIDENCE_LIMITS.perClaim} links on one ${target}.`);
  const clean = items.map((x, i) => checkEvidence(x, i + 1));
  if (!claimExists(db, userId, target, key)) {
    throw Object.assign(new Error(`That ${target} is not on your profile — save it first.`), { status: 404, code: "no_such_claim" });
  }
  db.transaction(() => {
    db.prepare(`DELETE FROM profile_evidence WHERE user_id = ? AND target = ? AND target_key = ?`).run(userId, target, key);
    clean.forEach((x, i) => db.prepare(`INSERT INTO profile_evidence (user_id, target, target_key, kind, label, url, position) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(userId, target, key, x.kind, x.label, x.url, i));
  })();
  return clean;
}

/**
 * Keep an EDITED claim's evidence. Called inside saveSection's transaction with the claims before and after, each
 * { slot, text } — the slot is WHERE the claim sits (a bullet: its role's company and its index in that role; a project:
 * its index). When the claim in a slot changed text, the old text is gone from the new list, the new text is new (not a
 * bullet that merely moved), the old key carries evidence and the new key has none — the evidence moves to the new key.
 * Evidence of a claim that was REMOVED is deleted with it.
 */
export function rekeyEvidence(db, userId, target, before, after) {
  let has;
  try { has = db.prepare(`SELECT 1 FROM profile_evidence WHERE user_id = ? AND target = ? AND target_key = ? LIMIT 1`); }
  catch { return; }
  const afterKeys = new Set(after.map(c => evidenceKey(c.text)).filter(Boolean));
  const beforeKeys = new Set(before.map(c => evidenceKey(c.text)).filter(Boolean));
  const afterAt = new Map(after.map(c => [c.slot, evidenceKey(c.text)]));
  const move = db.prepare(`UPDATE profile_evidence SET target_key = ? WHERE user_id = ? AND target = ? AND target_key = ?`);
  for (const c of before) {
    const o = evidenceKey(c.text), n = afterAt.get(c.slot);
    if (!o || !n || o === n || afterKeys.has(o) || beforeKeys.has(n) || !has.get(userId, target, o) || has.get(userId, target, n)) continue;
    move.run(n, userId, target, o);
  }
  const keep = afterKeys;
  for (const k of db.prepare(`SELECT DISTINCT target_key FROM profile_evidence WHERE user_id = ? AND target = ?`).pluck().all(userId, target)) {
    if (!keep.has(k)) db.prepare(`DELETE FROM profile_evidence WHERE user_id = ? AND target = ? AND target_key = ?`).run(userId, target, k);
  }
}

/** The set of bullet keys that carry at least one link — what a brief's bullets are marked against. */
export function backedBulletKeys(db, userId) {
  try { return new Set(db.prepare(`SELECT DISTINCT target_key FROM profile_evidence WHERE user_id = ? AND target = 'bullet'`).pluck().all(userId)); }
  catch { return new Set(); }
}

/**
 * ⭐ P2 · THE CHOOSING RULE. Given a role's bullets ({ text, backed }) and how many fit, keep the backed ones first,
 * then the unbacked, each group in the candidate's own order — and return the kept ones in their ORIGINAL order (the
 * résumé reads as the candidate wrote it; only which bullets survive changes). No limit → every bullet, unchanged.
 */
export function chooseBullets(bullets, limit = Infinity) {
  const list = (bullets || []).map((b, i) => ({ ...(typeof b === "string" ? { text: b, backed: false } : b), i }));
  if (!(limit < list.length)) return list.map(({ i, ...b }) => b);
  const ranked = [...list.filter(b => b.backed), ...list.filter(b => !b.backed)].slice(0, Math.max(0, limit));
  return ranked.sort((a, b) => a.i - b.i).map(({ i, ...b }) => b);
}

/**
 * The marks the tools service's Generate is sent (once its contract declares them): every Profile bullet, role by role,
 * with backed true / false. Null when the user has no Profile bullets (nothing to prefer).
 */
export function evidenceForRequest(db, userId) {
  let rows = [];
  try { rows = db.prepare(`SELECT company, bullets_json FROM profile_experience WHERE user_id = ? ORDER BY position, id`).all(userId); }
  catch { return null; }
  const backed = backedBulletKeys(db, userId);
  const roles = rows.map(r => {
    let bullets = [];
    try { bullets = JSON.parse(r.bullets_json || "[]"); } catch { bullets = []; }
    return { company: r.company, bullets: bullets.map(t => ({ text: String(t), backed: backed.has(evidenceKey(t)) })) };
  }).filter(r => r.bullets.length);
  return roles.length ? { roles } : null;
}

// ── P3 · the public proof page ───────────────────────────────────────────────────────────────────────
export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
const RESERVED = new Set(["admin", "api", "app", "draft", "help", "login", "logout", "new", "p", "privacy", "proof", "root",
  "settings", "signup", "support", "terms", "www"]);

/** The user's page setting: { enabled, handle } — no row is { enabled: false, handle: null } (OFF by default). */
export function readProofPage(db, userId) {
  try {
    const r = db.prepare(`SELECT handle, enabled FROM proof_pages WHERE user_id = ?`).get(userId);
    return { enabled: !!r?.enabled, handle: r?.handle ?? null };
  } catch { return { enabled: false, handle: null }; }
}

/** Turn the page on / off and set its handle. A handle is 3–30 of a–z, 0–9 and inner hyphens; taken or reserved → refused. */
export function setProofPage(db, userId, { enabled, handle } = {}) {
  const cur = readProofPage(db, userId);
  const h = handle == null ? cur.handle : String(handle).trim().toLowerCase();
  const on = enabled === true;
  if (on && !h) throw Object.assign(new Error("Choose an address for the page first."), { status: 400, code: "bad_handle" });
  if (h != null) {
    if (!HANDLE_RE.test(h)) throw Object.assign(new Error("The address is 3–30 letters, digits or hyphens."), { status: 400, code: "bad_handle" });
    if (RESERVED.has(h)) throw Object.assign(new Error("That address is reserved."), { status: 409, code: "handle_taken" });
    const owner = db.prepare(`SELECT user_id FROM proof_pages WHERE handle = ?`).pluck().get(h);
    if (owner != null && owner !== userId) throw Object.assign(new Error("That address is taken."), { status: 409, code: "handle_taken" });
    db.prepare(`INSERT INTO proof_pages (user_id, handle, enabled, updated_at) VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET handle = excluded.handle, enabled = excluded.enabled, updated_at = excluded.updated_at`)
      .run(userId, h, on ? 1 : 0);
  }
  return readProofPage(db, userId);
}

/**
 * What the public page shows for a handle — null when there is no such page or it is OFF (the same answer either way,
 * so the page cannot be used to learn who has turned it off). ⛔ Nothing private: the display name and the projects
 * with their links. No email, phone, address, location, experience or anything from Application defaults; a project's
 * description is scrubbed of anything shaped like an email address, phone number or link.
 */
export function proofPageFor(db, handle) {
  const h = String(handle ?? "").trim().toLowerCase();
  if (!HANDLE_RE.test(h)) return null;
  let page;
  try { page = db.prepare(`SELECT user_id, handle FROM proof_pages WHERE handle = ? AND enabled = 1`).get(h); } catch { return null; }
  if (!page) return null;
  const p = db.prepare(`SELECT full_name, first_name, last_name FROM user_profile WHERE user_id = ?`).get(page.user_id) || {};
  const name = String(p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "").trim();
  const ev = evidenceMap(db, page.user_id);
  const projects = db.prepare(`SELECT name, description FROM profile_projects WHERE user_id = ? ORDER BY position, id`).all(page.user_id)
    .map(r => ({ name: scrubContact(r.name), description: r.description ? scrubContact(r.description) : null,
      links: (ev.get(`project:${evidenceKey(r.name)}`) || []).map(x => ({ kind: x.kind, kindLabel: KIND_LABEL.get(x.kind) || x.kind, label: x.label, url: x.url })) }));
  return { handle: page.handle, name: scrubContact(name) || null, projects };
}

export const PROOF_PAGE_NOTE = "Links supplied by the candidate. draft does not open, check or vouch for them.";
