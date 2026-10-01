// ── "Sign up to keep it" (queue 30) ──────────────────────────────────────────────────────────
//
// The signup page offers the free ATS check first: a résumé PDF and a posting, scored by the same
// deterministic engine as the board, no account, no model call. "Keep it" has to be literal, so the
// résumé the visitor scored is CARRIED into the account they then create — here, in memory, for the
// rest of this page session. Job Profiles offers it as the first profile's base résumé.
//
// ⛔ Memory only: never localStorage/sessionStorage. A résumé is personal data, and a copy that
// outlived the tab would sit on a shared computer after the visitor walked away. A reload drops it,
// which is the safe failure.
let carried = null;

/** Hold the scored résumé (a File) and what it was scored against. */
export function carryResume(file, { jobTitle = "", band = null } = {}) {
  carried = file ? { file, jobTitle, band, at: Date.now() } : null;
}

/** What the visitor scored before signing up, or null. */
export const carriedResume = () => carried;

/** Called once the résumé has been used (or declined): it is not offered twice. */
export function dropCarriedResume() { carried = null; }
