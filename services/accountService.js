// ── Account management: the data layer ────────────────────────────────────────────────────────
//
// Owner, 09-30: account management "wired properly" — sessions, profile and picture, password,
// email, sign-in methods, delete, export, and MERGING two accounts (their Google sign-in created a
// second, empty account). Every function here takes `db` and is tested on a real SQLite schema built
// from the migrations (test/accountService.test.js). routes/accountManagement.js is the HTTP layer.
import crypto from "crypto";

export const PROVIDERS = Object.freeze({ google: "google_auth_id", linkedin: "linkedin_auth_id", github: "github_auth_id" });
export const MIN_PASSWORD = 8;
export const CODE_TTL_S = 15 * 60;
export const CODE_ATTEMPTS = 5;
export const RECENT_AUTH_MS = 15 * 60 * 1000;

export class AccountError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new AccountError(status, code, message); };

// ── sessions (a registry beside the sealed store, so a user's sessions can be listed) ──────────
export function recordSession(db, { sid, userId, userAgent = null, ipHint = null, now = Math.floor(Date.now() / 1000) }) {
  if (!sid || !userId) return;
  db.prepare(`INSERT INTO user_sessions (sid, user_id, created_at, last_seen_at, user_agent, ip_hint)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(sid) DO UPDATE SET last_seen_at = excluded.last_seen_at, user_id = excluded.user_id`)
    .run(sid, userId, now, now, userAgent ? String(userAgent).slice(0, 300) : null, ipHint);
}

export function listSessions(db, userId, currentSid) {
  return db.prepare("SELECT sid, created_at, last_seen_at, user_agent, ip_hint FROM user_sessions WHERE user_id = ? ORDER BY last_seen_at DESC")
    .all(userId).map(r => ({ id: sessionPublicId(r.sid), current: r.sid === currentSid, createdAt: r.created_at,
      lastSeenAt: r.last_seen_at, device: describeUserAgent(r.user_agent), ipHint: r.ip_hint }));
}

/** A session's public id: a hash, so the sid itself (the bearer of the session) never leaves the server. */
export function sessionPublicId(sid) { return crypto.createHash("sha256").update(String(sid)).digest("hex").slice(0, 16); }

export function sidsToRevoke(db, userId, { publicId = null, exceptSid = null } = {}) {
  return db.prepare("SELECT sid FROM user_sessions WHERE user_id = ?").all(userId).map(r => r.sid)
    .filter(sid => sid !== exceptSid && (publicId == null || sessionPublicId(sid) === publicId));
}

export function forgetSessions(db, sids) {
  const del = db.prepare("DELETE FROM user_sessions WHERE sid = ?");
  db.transaction(() => sids.forEach(s => del.run(s)))();
}

/** Signed-in apps (the extension, mobile): auth-context tokens, revocable one by one. */
export function listAppTokens(db, userId) {
  return db.prepare(`SELECT id, created_at, last_seen_at, user_agent FROM auth_contexts
                     WHERE user_id = ? AND revoked_at IS NULL AND session_sid IS NULL AND expires_at > unixepoch() ORDER BY last_seen_at DESC`)
    .all(userId).map(r => ({ id: r.id, createdAt: r.created_at, lastSeenAt: r.last_seen_at, app: describeApp(r.user_agent) }));
}
export function revokeAppToken(db, userId, id) {
  const r = db.prepare("UPDATE auth_contexts SET revoked_at = unixepoch() WHERE id = ? AND user_id = ? AND revoked_at IS NULL").run(id, userId);
  if (!r.changes) fail(404, "not_found", "That sign-in was not found.");
}

export function describeUserAgent(ua) {
  const s = String(ua || "");
  const browser = /Edg\//.test(s) ? "Edge" : /Chrome\//.test(s) ? "Chrome" : /Firefox\//.test(s) ? "Firefox" : /Safari\//.test(s) ? "Safari" : /okhttp|Android/i.test(s) ? "Android app" : "A browser";
  const os = /Windows/.test(s) ? "Windows" : /Mac OS X|Macintosh/.test(s) ? "macOS" : /Android/.test(s) ? "Android" : /iPhone|iPad/.test(s) ? "iOS" : /Linux/.test(s) ? "Linux" : null;
  return os ? `${browser} on ${os}` : browser;
}
function describeApp(ua) {
  const s = String(ua || "");
  if (/extension/i.test(s)) return "Browser extension";
  if (/android|okhttp/i.test(s)) return "Android app";
  if (/ios|iphone/i.test(s)) return "iOS app";
  return describeUserAgent(s);
}

// ── re-authentication: sensitive changes need a recent sign-in ──────────────────────────────────
export function requireRecentAuth(session, now = Date.now()) {
  if (!session?.authAt || now - session.authAt > RECENT_AUTH_MS) {
    fail(403, "reauth_required", "For your security, sign in again (or confirm your password) to do this.");
  }
}

// ── password ───────────────────────────────────────────────────────────────────────────────────
export function changePassword(db, userId, { current, next }, { verify, hash, session }) {
  const u = db.prepare("SELECT id, password_hash, password_set FROM users WHERE id = ?").get(userId);
  if (!u) fail(404, "not_found", "Account not found.");
  if (typeof next !== "string" || next.length < MIN_PASSWORD) fail(400, "weak_password", `Use at least ${MIN_PASSWORD} characters.`);
  if (u.password_set) {
    if (!verify(String(current || ""), u.password_hash)) fail(403, "wrong_password", "Your current password is not right.");
  } else {
    // An account made by Google/LinkedIn/GitHub has a random password nobody knows: SETTING one is
    // allowed, but only right after a fresh sign-in, so a stolen session cannot plant a password.
    requireRecentAuth(session);
  }
  db.prepare("UPDATE users SET password_hash = ?, password_set = 1 WHERE id = ?").run(hash(next), userId);
}

// ── email (codes) ──────────────────────────────────────────────────────────────────────────────
const codeHash = (code, pepper) => crypto.createHmac("sha256", pepper).update(String(code)).digest("hex");
export function issueEmailCode(db, userId, { purpose, email, pepper, now = Math.floor(Date.now() / 1000) }) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  db.prepare("UPDATE email_codes SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL").run(now, userId, purpose);
  db.prepare("INSERT INTO email_codes (user_id, purpose, email, code_hash, expires_at) VALUES (?, ?, ?, ?, ?)")
    .run(userId, purpose, email, codeHash(code, pepper), now + CODE_TTL_S);
  return code;
}
export function consumeEmailCode(db, userId, { purpose, code, pepper, now = Math.floor(Date.now() / 1000) }) {
  const row = db.prepare(`SELECT id, email, code_hash, expires_at, attempts FROM email_codes
                          WHERE user_id = ? AND purpose = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1`).get(userId, purpose);
  if (!row || row.expires_at < now) fail(400, "code_expired", "That code has expired. Ask for a new one.");
  if (row.attempts >= CODE_ATTEMPTS) fail(429, "code_locked", "Too many wrong codes. Ask for a new one.");
  const ok = crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(codeHash(String(code || "").trim(), pepper)));
  if (!ok) {
    db.prepare("UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    fail(400, "wrong_code", "That code is not right.");
  }
  db.prepare("UPDATE email_codes SET used_at = ? WHERE id = ?").run(now, row.id);
  return row.email;
}
export const validEmail = (e) => typeof e === "string" && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export function setVerifiedEmail(db, userId, email) {
  const taken = db.prepare("SELECT user_id FROM user_profile WHERE LOWER(email) = LOWER(?) AND user_id != ?").get(email, userId);
  if (taken) fail(409, "email_taken", "That email belongs to another Draft account. Merge it instead.");
  db.prepare("INSERT INTO user_profile (user_id, email) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET email = excluded.email").run(userId, email);
  db.prepare("UPDATE users SET email_verified_at = unixepoch() WHERE id = ?").run(userId);
}

// ── profile and picture ──────────────────────────────────────────────────────────────────────
export function accountSummary(db, userId) {
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!u) fail(404, "not_found", "Account not found.");
  const p = db.prepare("SELECT full_name, first_name, last_name, email FROM user_profile WHERE user_id = ?").get(userId) || {};
  const pic = db.prepare("SELECT metadata_json FROM user_integrations WHERE user_id = ? AND provider = 'google'").get(userId);
  let providerPicture = null;
  try { providerPicture = JSON.parse(pic?.metadata_json || "{}").picture || null; } catch {}
  return {
    id: u.id, username: u.username, displayName: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
    email: p.email || null, emailVerified: !!u.email_verified_at, createdAt: u.created_at,
    hasAvatar: !!u.avatar_path, providerPicture,
    signInMethods: signInMethods(u),
  };
}
export function setDisplayName(db, userId, name) {
  const n = String(name || "").trim().replace(/\s+/g, " ");
  if (!n || n.length > 120) fail(400, "bad_name", "Use a name between 1 and 120 characters.");
  const parts = n.split(" ");
  db.prepare(`INSERT INTO user_profile (user_id, full_name, first_name, last_name) VALUES (?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET full_name = excluded.full_name, first_name = excluded.first_name, last_name = excluded.last_name`)
    .run(userId, n, parts[0], parts.length > 1 ? parts.slice(1).join(" ") : null);
}

const IMAGE_SIGNATURES = [
  { type: "image/png",  ext: "png",  test: (b) => b.length > 8 && b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG" },
  { type: "image/jpeg", ext: "jpg",  test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/webp", ext: "webp", test: (b) => b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP" },
];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
/** The image's real type, from its BYTES — never the filename or the client's claimed type. */
export function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) fail(400, "no_image", "Choose an image.");
  if (buf.length > AVATAR_MAX_BYTES) fail(413, "too_large", "Use an image under 2 MB.");
  const t = IMAGE_SIGNATURES.find(s => s.test(buf));
  if (!t) fail(415, "bad_type", "Use a PNG, JPEG or WebP image.");
  return t;
}

// ── sign-in methods ────────────────────────────────────────────────────────────────────────────
export function signInMethods(u) {
  return { password: !!u.password_set, google: !!u.google_auth_id, linkedin: !!u.linkedin_auth_id, github: !!u.github_auth_id };
}
export function unlinkProvider(db, userId, provider) {
  const col = PROVIDERS[provider];
  if (!col) fail(400, "bad_provider", "Unknown sign-in method.");
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  const m = signInMethods(u);
  if (!m[provider]) fail(400, "not_linked", "That sign-in method is not linked.");
  if (Object.values(m).filter(Boolean).length <= 1) {
    fail(409, "last_method", "This is your only way to sign in. Set a password or link another account first.");
  }
  db.transaction(() => {
    db.prepare(`UPDATE users SET ${col} = NULL WHERE id = ?`).run(userId);
    db.prepare("DELETE FROM user_integrations WHERE user_id = ? AND provider = ?").run(userId, provider);
  })();
}

// ── export ─────────────────────────────────────────────────────────────────────────────────────
const SECRET_COLUMNS = new Set(["password_hash", "apify_token", "secret_enc", "iv", "auth_tag", "token_hash", "code_hash", "cookies_enc",
  // D112 item 8 (183): a browser's push endpoint is a capability URL and its two keys encrypt to it — never exported.
  "endpoint", "key_p256dh", "key_auth"]);
// Tables whose rows are the user's own data, exported whole (minus secret columns). Log-like tables
// (usage, scrape, cache events) are summarised, not dumped.
const EXPORT_TABLES = ["user_profile", "domain_profiles", "profile_base_resumes", "base_resume", "resumes", "resume_versions",
  "job_applications", "user_jobs", "imported_jobs", "user_job_searches", "apply_runs", "apply_run_jobs", "notifications",
  "simple_apply_profiles", "profile_simple_apply_profiles", "dock_preferences", "daily_drafts", "user_integrations",
  "form_reports", "apply_origin_sightings", "saved_answers", "answer_history",
  // D112: the Gmail connection — the address, when, how many read; its sealed token is a secret column and never exported.
  "gmail_connections",
  // D112 item 8 (183): the notification switches, and which browsers get pushes (their endpoint and keys scrubbed above).
  "notification_prefs", "push_subscriptions",
  // D109 (184): the Profile's projects, the evidence links the person supplied, and their proof page setting.
  "profile_projects", "profile_evidence", "proof_pages",
  // D110 (186): interview mode — the dates the user typed, their story bank, their debriefs and their own question bank.
  "interview_prep", "interview_stories", "interview_debriefs", "interview_questions",
  // D113 (188): the picks runs (what each run looked at, picked and left out, by reason) and the picks themselves.
  "picks_runs", "picks", "picks_left_out"];
export function exportAccount(db, userId) {
  const scrub = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !SECRET_COLUMNS.has(k)));
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!u) fail(404, "not_found", "Account not found.");
  const out = { exportedAt: new Date().toISOString(), account: scrub(u), data: {} };
  for (const t of EXPORT_TABLES) {
    try { out.data[t] = db.prepare(`SELECT * FROM ${t} WHERE user_id = ?`).all(userId).map(scrub); } catch { /* table absent in this schema */ }
  }
  out.data.usage_summary = db.prepare("SELECT purpose, COUNT(*) n FROM usage_events WHERE user_id = ? GROUP BY purpose").all(userId);
  return out;
}

// ── delete ─────────────────────────────────────────────────────────────────────────────────────
/**
 * Delete the account and everything that hangs off it. users(id) is referenced ON DELETE CASCADE by
 * every user table but one (usage_tracking_failures, no FK) — cleared here explicitly. Returns the
 * files the caller must remove (screenshots, the avatar) and the sessions to destroy.
 */
export function deleteAccount(db, userId) {
  const u = db.prepare("SELECT id, is_admin, avatar_path FROM users WHERE id = ?").get(userId);
  if (!u) fail(404, "not_found", "Account not found.");
  // id 0 is the `system` account (migration 075): every background usage_events row cascades from
  // it, and 075 never re-creates it. Refused here as well as in the admin route (A58).
  if (u.id === 0) fail(409, "system_account", "The system account cannot be deleted.");
  if (u.is_admin) fail(409, "admin_account", "An admin account cannot be deleted from here.");
  const files = [
    ...db.prepare("SELECT screenshot_path p FROM apply_run_jobs WHERE user_id = ? AND screenshot_path IS NOT NULL").all(userId).map(r => r.p),
    ...db.prepare("SELECT screenshot_path p FROM job_applications WHERE user_id = ? AND screenshot_path IS NOT NULL").all(userId).map(r => r.p),
    ...(u.avatar_path ? [u.avatar_path] : []),
  ];
  const sids = db.prepare("SELECT sid FROM user_sessions WHERE user_id = ?").all(userId).map(r => r.sid);
  db.transaction(() => {
    try { db.prepare("DELETE FROM usage_tracking_failures WHERE user_id = ?").run(userId); } catch {}
    // D88 (39d): migration 155's tables carry no foreign key — cleared here; tickets cascade (156).
    try { db.prepare("DELETE FROM user_entitlement_overrides WHERE user_id = ?").run(userId); } catch {}
    try { db.prepare("DELETE FROM user_notes WHERE user_id = ?").run(userId); } catch {}
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  })();
  return { files, sids };
}

// ── merge ──────────────────────────────────────────────────────────────────────────────────────
// How each user table merges FROM → INTO. "move": every row changes owner. "keepInto": a row keyed
// to the user (or to user+thing) — INTO's row wins on a clash, FROM's fills what INTO lacks.
// "fill": one row per user, INTO's non-empty columns kept, its empty ones filled from FROM.
// "drop": FROM's rows are credentials or caches that must not survive (tokens, codes, sessions).
// "ifIntoEmpty": a person's LIST (their experience, schools …) — FROM's rows move only when INTO has none; two
// résumés' lists are never interleaved into one.
export const MERGE_PLAN = Object.freeze({
  apply_gate_packets: "move", apply_job_logs: "move", apply_run_jobs: "move", apply_runs: "move",
  cache_events: "move", domain_profile_requests: "move", notifications: "move",
  profile_base_resumes: "move", profile_resume_enhancements: "move", profile_signal_suggestions: "move",
  profile_simple_apply_profiles: "move", resume_versions: "move", scrape_events: "move", usage_events: "move",
  usage_tracking_failures: "move", draft_slot_uses: "move", job_captures: "move", form_reports: "move",
  domain_profiles: "profiles",
  application_records: "keepInto", ats_only_reports: "keepInto", daily_drafts: "keepInto", imported_jobs: "keepInto", job_applications: "keepInto",
  resumes: "keepInto", user_integrations: "keepInto", user_job_searches: "keepInto", user_job_views: "keepInto",
  user_jobs: "userJobs", base_resume: "keepInto", dock_preferences: "keepInto", plan_upgrade_requests: "keepInto",
  simple_apply_profiles: "keepInto", user_limits: "keepInto", user_linkedin_sessions: "keepInto",
  // D67 (2): one sighting per (pair, user) — a merged person is one person, so a clash keeps one row.
  apply_origin_sightings: "keepInto",
  // D86: the per-call audit is history and moves; a merged-away account's connections and open briefs are
  // its grants, not its data — they go (its tokens then match no connection, so they stop at once).
  mcp_audit: "move", oauth_connections: "drop", byom_briefs: "drop",
  // D88 (39d): an admin's notes are about the person and move; the merged-away account's overrides are ITS grants and go.
  user_notes: "move", user_entitlement_overrides: "drop",
  // D88 P3: a person's support requests are their history and move with them.
  tickets: "move",
  // Item 3 (10-12): an internal / test / beta tag is an admin's label for THAT account — the merged-away one's go.
  user_tags: "drop",
  // D90: every base the person uploaded is their history and moves with them.
  base_resume_uploads: "move",
  // D96 §4 (164): a person's remembered answers — INTO's answer to a question wins on a clash; the history moves.
  saved_answers: "keepInto", answer_history: "move",
  // D98 (165–166): an on-page generation is a request log and goes (its résumé is a resume_versions row, which moves);
  // the PDF the person attached is their file and moves (its generation link is cleared with the request).
  extension_resume_generations: "drop", resume_pdf_artifacts: "move",
  // D100 (171–172): a sealed portal session and a portal-account credential are CREDENTIALS — they go with FROM (the
  // worker's keys for them become unreachable); the apply worker's run history moves.
  portal_sessions: "drop", portal_accounts: "drop", apply_remote_runs: "move",
  // D101 (173): the profile in sections — INTO's summary and its set defaults win; FROM's lists fill an empty INTO.
  profile_sections: "keepInto", application_defaults: "keepInto",
  profile_experience: "ifIntoEmpty", profile_education: "ifIntoEmpty", profile_skills: "ifIntoEmpty", profile_links: "ifIntoEmpty",
  // D103 (174): the person's forwarding address keeps working (its mail now files under INTO), their mail and the
  // code-read log move; INTO's per-portal code consent wins on a clash.
  inbox_addresses: "move", inbox_messages: "move", inbox_code_uses: "move", inbox_code_optins: "keepInto",
  // D112 (181): a merged person is one person — their Gmail connection keeps reading, for INTO; INTO's own connection
  // wins on a clash (one row per user), and FROM's then goes with FROM.
  gmail_connections: "keepInto",
  // D112 item 8 (183): the merged person's browsers keep getting pushes, now for INTO; INTO's own switch for an event wins.
  push_subscriptions: "move", notification_prefs: "keepInto",
  // D109 (184): projects and evidence are a person's LISTS, like D101's — FROM's fill an empty INTO, never interleaved;
  // the proof page is one row per user — INTO's wins on a clash, and FROM's (with its address) fills an INTO that has none.
  profile_projects: "ifIntoEmpty", profile_evidence: "ifIntoEmpty", proof_pages: "keepInto",
  // D110 (186): a merged person keeps their stories, debriefs and question bank; INTO's typed date for an application wins,
  // and a story seeded from the same bullet in both accounts is kept once (INTO's).
  interview_prep: "keepInto", interview_stories: "keepInto", interview_debriefs: "move", interview_questions: "move",
  // D113 (188): a merged person keeps their picks history; one run per (user, run time), so INTO's run wins on a clash and
  // FROM's (with its picks and left-out ids, by cascade) goes with FROM. A moved pick's old links stop working — they are
  // bound to the merged-away user, and they expire at the next run anyway.
  picks_runs: "keepInto", picks: "move", picks_left_out: "move",
  // D115 P3 (195): learning progress, one row per (user, mark) — INTO's mark wins on a clash, FROM's fill the rest.
  learn_progress: "keepInto",
  // D117 C8 (202): earned progress — one row per (user, item / checkpoint / piece); INTO's own wins on a clash (its first
  // opening, its own words, its build link), FROM's fill the rest.
  learn_opened: "keepInto", learn_explanations: "keepInto", learn_builds: "keepInto",
  trial_surveys: "keepInto", trial_feedback: "move", practice_submissions: "move", trial_events: "move",
  // D123 (212): gists keyed (user, résumé hash) — INTO's own (perhaps edited) gists win on a clash, FROM's fill the rest.
  resume_gists: "keepInto",
  // D136 P3 (214): the signals each application had when sent — one row per (user, posting); INTO's own wins on a clash.
  application_signals: "keepInto",
  user_profile: "fill",
  auth_contexts: "drop", password_reset_tokens: "drop", email_codes: "drop", user_sessions: "drop", apply_idempotency: "drop",
});

/** What merging FROM into INTO would move, per table — the preview the user confirms. */
export function mergePreview(db, intoId, fromId) {
  checkMergeable(db, intoId, fromId);
  const counts = {};
  for (const t of Object.keys(MERGE_PLAN)) {
    try { const n = db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE user_id = ?`).get(fromId).n; if (n) counts[t] = n; } catch {}
  }
  const from = db.prepare("SELECT id, username, created_at FROM users WHERE id = ?").get(fromId);
  return { from: { id: from.id, username: from.username, createdAt: from.created_at, signInMethods: signInMethods(db.prepare("SELECT * FROM users WHERE id=?").get(fromId)) }, counts };
}

function checkMergeable(db, intoId, fromId) {
  if (!intoId || !fromId || intoId === fromId) fail(400, "same_account", "Those are the same account.");
  const a = db.prepare("SELECT * FROM users WHERE id = ?").get(intoId), b = db.prepare("SELECT * FROM users WHERE id = ?").get(fromId);
  if (!a || !b) fail(404, "not_found", "One of the accounts no longer exists.");
  if (a.is_admin || b.is_admin) fail(409, "admin_account", "Admin accounts cannot be merged.");
  for (const [p, col] of Object.entries(PROVIDERS)) {
    if (a[col] && b[col] && a[col] !== b[col]) fail(409, "provider_conflict", `Both accounts have a different ${p} sign-in. Unlink one first.`);
  }
  return { a, b };
}

/** Merge FROM into INTO, in one transaction, then delete FROM. Unknown user tables refuse the merge. */
export function mergeAccounts(db, intoId, fromId, { now = Math.floor(Date.now() / 1000) } = {}) {
  const { b } = checkMergeable(db, intoId, fromId);
  const userTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
    .filter(t => t !== "users" && db.prepare(`PRAGMA table_info(${t})`).all().some(c => c.name === "user_id"));
  const unplanned = userTables.filter(t => !(t in MERGE_PLAN));
  // ⛔ A table this plan has never heard of would be silently CASCADE-deleted with FROM. Refuse instead.
  if (unplanned.length) fail(500, "merge_plan_incomplete", `Merge does not know how to move: ${unplanned.join(", ")}.`);
  const moved = {};
  const sids = db.prepare("SELECT sid FROM user_sessions WHERE user_id = ?").all(fromId).map(r => r.sid);
  const files = b.avatar_path ? [b.avatar_path] : [];
  db.transaction(() => {
    for (const t of userTables) {
      const how = MERGE_PLAN[t];
      const before = db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE user_id = ?`).get(fromId).n;
      if (!before) continue;
      if (how === "move") db.prepare(`UPDATE ${t} SET user_id = ? WHERE user_id = ?`).run(intoId, fromId);
      else if (how === "keepInto") db.prepare(`UPDATE OR IGNORE ${t} SET user_id = ? WHERE user_id = ?`).run(intoId, fromId);
      else if (how === "ifIntoEmpty") {
        if (!db.prepare(`SELECT 1 FROM ${t} WHERE user_id = ?`).get(intoId)) db.prepare(`UPDATE ${t} SET user_id = ? WHERE user_id = ?`).run(intoId, fromId);
        else db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(fromId);
      }
      else if (how === "userJobs") {
        // A job both accounts touched: keep INTO's row, but carry FROM's star/apply/pass onto it.
        db.prepare(`UPDATE user_jobs SET starred = MAX(starred, COALESCE((SELECT f.starred FROM user_jobs f WHERE f.user_id = ? AND f.job_id = user_jobs.job_id), 0)),
                    applied = MAX(COALESCE(applied,0), COALESCE((SELECT f.applied FROM user_jobs f WHERE f.user_id = ? AND f.job_id = user_jobs.job_id), 0))
                    WHERE user_id = ? AND job_id IN (SELECT job_id FROM user_jobs WHERE user_id = ?)`).run(fromId, fromId, intoId, fromId);
        db.prepare("UPDATE OR IGNORE user_jobs SET user_id = ? WHERE user_id = ?").run(intoId, fromId);
      } else if (how === "profiles") {
        // FROM's profiles join INTO's. Only one profile may be ACTIVE per user: keep INTO's.
        const intoHasActive = db.prepare("SELECT 1 FROM domain_profiles WHERE user_id = ? AND is_active = 1").get(intoId);
        if (intoHasActive) db.prepare("UPDATE domain_profiles SET is_active = 0 WHERE user_id = ?").run(fromId);
        db.prepare("UPDATE domain_profiles SET user_id = ? WHERE user_id = ?").run(intoId, fromId);
      } else if (how === "fill") {
        const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name).filter(c => !["id", "user_id"].includes(c));
        const into = db.prepare(`SELECT * FROM ${t} WHERE user_id = ?`).get(intoId);
        if (!into) db.prepare(`UPDATE ${t} SET user_id = ? WHERE user_id = ?`).run(intoId, fromId);
        else {
          const set = cols.map(c => `${c} = COALESCE(NULLIF(${t}.${c}, ''), (SELECT f.${c} FROM ${t} f WHERE f.user_id = ?))`).join(", ");
          db.prepare(`UPDATE ${t} SET ${set} WHERE user_id = ?`).run(...cols.map(() => fromId), intoId);
        }
      }
      // whatever is still FROM's ("drop", or a keepInto clash) goes with FROM's row, by cascade
      moved[t] = before - db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE user_id = ?`).get(fromId).n;
    }
    // sign-in identities move to INTO (a conflict was refused above)
    for (const col of Object.values(PROVIDERS)) {
      if (b[col]) {
        db.prepare(`UPDATE users SET ${col} = NULL WHERE id = ?`).run(fromId);   // release the UNIQUE value first
        db.prepare(`UPDATE users SET ${col} = COALESCE(${col}, ?) WHERE id = ?`).run(b[col], intoId);
      }
    }
    db.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?").run(b.email_verified_at ?? null, intoId);
    db.prepare("INSERT INTO account_merges (into_user_id, from_user_id, summary_json, merged_at) VALUES (?, ?, ?, ?)")
      .run(intoId, fromId, JSON.stringify(moved), now);
    db.prepare("DELETE FROM users WHERE id = ?").run(fromId);
  })();
  return { moved, sids, files };
}
