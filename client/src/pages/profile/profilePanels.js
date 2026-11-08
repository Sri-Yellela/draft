// ⭐ D167 (owner 11-06, docs/sketches/Profile.html — PROFILE APPROVED) · Profile's own navigation: the panels, their
// groups and their addresses. Pure — App.jsx reads it to route, ProfilePage.jsx to draw the nav, the dock's quick peek
// (lane d167-dock) to link into it, and the tests to hold it.
//
// ADDRESSES: /app/profile/<id> (the canonical one — what every link here writes). /profile/<id> (no /app) forwards to it
// for a signed-in reader, and /app/profile#<id> is read too, so a hash link lands on the panel. An unknown id lands on
// About you.
//
// ⛔ EVERY OLD SETTINGS PAGE KEEPS A HOME (the owner's rule for Atlas, applied here): the routes that were their own pages
// before D167 forward to the panel that now holds them, their query kept (an OAuth return's ?oauthStatus=…, a Gmail
// return's ?gmail=…). /app/job-profiles stays its own page — the full job-profile manager, opened from Your résumés.

export const PROFILE_BASE = "/app/profile";

/** The nav, in the sketch's order: three groups, nine panels. `id` is the address; the labels are the sketch's. */
export const PROFILE_GROUPS = Object.freeze([
  { label: "You", items: [
    { id: "about", label: "About you" },   // ⭐ A140 (owner 11-08): About you + Your résumés, one panel
    { id: "answers", label: "Saved answers" },
  ] },
  { label: "Applying", items: [
    { id: "autoapply", label: "Auto-apply" },
    { id: "connections", label: "Connections" },
  ] },
  { label: "You and draft", items: [
    { id: "appearance", label: "Appearance" },
    { id: "notifications", label: "Notifications" },
    { id: "privacy", label: "Privacy and your data" },
    { id: "account", label: "Account" },
  ] },
]);

export const PROFILE_PANEL_IDS = Object.freeze(PROFILE_GROUPS.flatMap(g => g.items.map(i => i.id)));
export const PROFILE_DEFAULT = "about";

/** The pages that were their own routes before D167 → the panel that holds them now. */
export const LEGACY_PROFILE_ROUTES = Object.freeze({
  profile: "about",
  customise: "appearance",
  "saved-answers": "answers",
  integrations: "connections",
  account: "account",
});

export const profilePath = (id) => `${PROFILE_BASE}/${PROFILE_PANEL_IDS.includes(id) ? id : PROFILE_DEFAULT}`;

/**
 * The panel a route key (the path after /app/) and hash name — "profile/answers" → "answers"; "profile" + "#privacy" →
 * "privacy"; "profile/nope" → null (App sends it to About you). Not a profile route → undefined.
 */
export function profilePanelFor(routeKey, hash = "") {
  const m = /^profile(?:\/([^/]+))?\/?$/.exec(String(routeKey || ""));
  if (!m) return undefined;
  if (m[1] === "resumes") return "about";   // ⭐ A140: Your résumés merged into About you — old links land there
  if (m[1]) return PROFILE_PANEL_IDS.includes(m[1]) ? m[1] : null;
  const h = String(hash || "").replace(/^#/, "");
  return PROFILE_PANEL_IDS.includes(h) ? h : PROFILE_DEFAULT;
}
