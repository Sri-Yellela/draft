// ── D102 P4 · AUTO SETTINGS — the user's standing instruction for FULL AUTO ───────────────────
//
// A drawer from Draft House's run bar (owner 10-30; pattern from Tsenta's Manual settings). With the
// mode (users.send_mode, D100) these settings ARE the user's submit in FULL AUTO (D36 amended), so every
// value is validated here — on the server before it is stored, and in the drawer before it is sent.
//
//   dailyCap                 1–150, default 10 — the 11th job on a cap of 10 waits for tomorrow
//   runTimes                 up to 4 "HH:MM" a day, in timeZone; each run takes jobs posted since the last
//   timeZone                 an IANA zone, default America/New_York
//   perCompanyLimit30d       null (off, the default) or 1–20 applications per company in 30 days
//   pauseCompanyAfterReply   default ON — a company with an interview / offer in 60 days is skipped
//   filters                  the board's own query parameters ("Start from my board filters")
//   profileId                which job profile runs (null = the active one)
//   staleReposts             D107 P3: skip a posting reposted this many times (null = off), default 3
//   staleOpenDays            D107 P3: skip a posting open longer than this many days (null = off), default 90
import { SALARY_DEFAULTS, normaliseSalarySettings } from "./salaryAnswer.js";
export const AUTO_DEFAULTS = Object.freeze({
  dailyCap: 10,
  runTimes: ["09:00"],
  timeZone: "America/New_York",
  perCompanyLimit30d: null,
  pauseCompanyAfterReply: true,
  filters: {},
  profileId: null,
  // ⭐ 10-30 (owner): "let the users decide" — tick a portal's terms / privacy / consent box for me. OFF by default; off,
  // such a box stops the application at Needs you (SEMI's own click). Never a signature, an attestation or an opt-in.
  agreeToTerms: false,
  // ⭐ D107 P3: FULL AUTO and Approve all leave out a posting that looks like it is never filled — shown, never hidden.
  staleReposts: 3,
  staleOpenDays: 90,
  // ⭐ D113 (owner 10-31) · "Ask me first": in SEMI, the run times send the user ONE picks message per run (email + Web
  // Push) and a tap on Apply sends that one application. OFF by default — a SEMI user who never turned it on gets no
  // picks. In FULL AUTO ("Apply for me") the picks go straight to the run and this switch is not read.
  picks: false,
  // ⭐ D113 answer (1) · "Show me the form before sending" — OFF by default: a tap on Apply (or Apply for me) SENDS.
  // On, the run fills the form and stops at Ready for your review, as a Draft from the board does.
  showFormBeforeSending: false,
  // ⭐ D121 P3 · "Only companies with a sponsorship record" — OFF by default. On, picks leave out a posting whose signal is
  // not "Sponsors often / sometimes" (an unknown employer is left out too — the switch asks for a RECORD).
  onlySponsorRecord: false,
  // ⭐ D136 P2 · "This week's best bets" — how many the shortlist shows (3–20); picks draw from the shortlist first.
  bestBets: 5,
  // ⭐ 46a (owner 11-10) · the salary answer: the Profile's number (default, as before), a fixed amount, a point on the
  // posting's range (slider), or a named point on it (lower limit … upper limit) — shared/salaryAnswer.js.
  salary: SALARY_DEFAULTS,
});
export const CAP_MIN = 1;
export const CAP_MAX = 150;
export const MAX_RUN_TIMES = 4;
export const PAUSE_DAYS = 60;
export const COMPANY_WINDOW_DAYS = 30;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function validZone(tz) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/**
 * Validate and normalise a settings object. Returns { ok: true, value } or { ok: false, error, message }.
 * Missing keys take the defaults; a key that is present and wrong is refused, never coerced.
 */
export function normaliseAutoSettings(input = {}) {
  const fail = (error, message) => ({ ok: false, error, message });
  if (input == null || typeof input !== "object" || Array.isArray(input)) return fail("bad_settings", "Settings are an object.");
  const v = { ...AUTO_DEFAULTS, filters: {} };

  if ("dailyCap" in input) {
    if (!Number.isInteger(input.dailyCap) || input.dailyCap < CAP_MIN || input.dailyCap > CAP_MAX)
      return fail("bad_daily_cap", `The daily cap is a whole number from ${CAP_MIN} to ${CAP_MAX}.`);
    v.dailyCap = input.dailyCap;
  }
  if ("runTimes" in input) {
    const t = input.runTimes;
    if (!Array.isArray(t) || t.length < 1 || t.length > MAX_RUN_TIMES || !t.every(x => typeof x === "string" && HHMM.test(x)))
      return fail("bad_run_times", `Run times are 1 to ${MAX_RUN_TIMES} times of day, written HH:MM.`);
    v.runTimes = [...new Set(t)].sort();
  }
  if ("timeZone" in input) {
    if (typeof input.timeZone !== "string" || !validZone(input.timeZone))
      return fail("bad_time_zone", "The time zone is an IANA name, such as America/New_York.");
    v.timeZone = input.timeZone;
  }
  if ("perCompanyLimit30d" in input) {
    const n = input.perCompanyLimit30d;
    if (!(n === null || (Number.isInteger(n) && n >= 1 && n <= 20)))
      return fail("bad_company_limit", "The per-company limit is off, or 1 to 20 in 30 days.");
    v.perCompanyLimit30d = n;
  }
  if ("pauseCompanyAfterReply" in input) {
    if (typeof input.pauseCompanyAfterReply !== "boolean") return fail("bad_pause", "Pause after an interview or offer is on or off.");
    v.pauseCompanyAfterReply = input.pauseCompanyAfterReply;
  }
  if ("filters" in input) {
    const f = input.filters;
    if (f == null || typeof f !== "object" || Array.isArray(f)) return fail("bad_filters", "Filters are the board's query parameters.");
    const out = {};
    for (const [k, val] of Object.entries(f)) {
      // The board's own parameters: short names, string values (a list is comma-joined, as the board sends it).
      if (!/^[A-Za-z_]{1,40}$/.test(k)) return fail("bad_filters", `Unknown filter name ${String(k).slice(0, 40)}.`);
      if (["cursor", "page", "pageSize"].includes(k)) continue;
      const s = Array.isArray(val) ? val.map(String).join(",") : String(val ?? "");
      if (s.length > 500) return fail("bad_filters", `The filter ${k} is too long.`);
      if (s) out[k] = s;
    }
    v.filters = out;
  }
  if ("agreeToTerms" in input) {
    if (typeof input.agreeToTerms !== "boolean") return fail("bad_agree_to_terms", "Agreeing to terms for you is on or off.");
    v.agreeToTerms = input.agreeToTerms;
  }
  if ("staleReposts" in input) {
    const n = input.staleReposts;
    if (!(n === null || (Number.isInteger(n) && n >= 1 && n <= 20)))
      return fail("bad_stale_reposts", "Skip reposted postings: off, or 1 to 20 reposts.");
    v.staleReposts = n;
  }
  if ("staleOpenDays" in input) {
    const n = input.staleOpenDays;
    if (!(n === null || (Number.isInteger(n) && n >= 14 && n <= 365)))
      return fail("bad_stale_open_days", "Skip long-open postings: off, or 14 to 365 days.");
    v.staleOpenDays = n;
  }
  if ("picks" in input) {
    if (typeof input.picks !== "boolean") return fail("bad_picks", "Picks by message are on or off.");
    v.picks = input.picks;
  }
  if ("onlySponsorRecord" in input) {
    if (typeof input.onlySponsorRecord !== "boolean") return fail("bad_only_sponsor_record", "Only companies with a sponsorship record is on or off.");
    v.onlySponsorRecord = input.onlySponsorRecord;
  }
  if ("showFormBeforeSending" in input) {
    if (typeof input.showFormBeforeSending !== "boolean") return fail("bad_show_form", "Show me the form before sending is on or off.");
    v.showFormBeforeSending = input.showFormBeforeSending;
  }
  if ("bestBets" in input) {
    const n = input.bestBets;
    if (!(Number.isInteger(n) && n >= 3 && n <= 20)) return fail("bad_best_bets", "This week's best bets shows 3 to 20 postings.");
    v.bestBets = n;
  }
  if ("profileId" in input) {
    if (!(input.profileId === null || Number.isInteger(input.profileId))) return fail("bad_profile", "The job profile is an id, or none for the active one.");
    v.profileId = input.profileId;
  }
  // ⭐ 46a (owner 11-10): how an application answers the salary question (shared/salaryAnswer.js).
  if ("salary" in input) {
    const r = normaliseSalarySettings(input.salary);
    if (!r.ok) return r;
    v.salary = r.value;
  }
  return { ok: true, value: v };
}

/** Stored JSON → settings; anything unreadable reads as the defaults. */
export function readAutoSettings(json) {
  if (!json) return { ...AUTO_DEFAULTS, filters: {} };
  try {
    const r = normaliseAutoSettings(JSON.parse(json));
    return r.ok ? r.value : { ...AUTO_DEFAULTS, filters: {} };
  } catch { return { ...AUTO_DEFAULTS, filters: {} }; }
}
