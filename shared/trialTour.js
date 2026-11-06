// ⭐ D129 (owner 11-01) · THE GUIDED TOUR — its steps, the interactions it counts and the sections the survey rates.
// 11-01 (the owner's bug report): the card step is three (the match · the facts · the actions) and the modes and
// Auto settings are two. Shared by the client's GuidedTour and the server's analytics, so a step is named once (A93: built once). Order is the
// path: pick a résumé → the deck → Draft House (example) → the Atlas → pick 2 → Draft House live → The
// Table → the survey.

export const TOUR_STEPS = Object.freeze([
  { id: "pick_resume",  section: null,          title: "Pick a résumé" },
  { id: "deck",         section: "picks",       title: "Your 10 picks" },
  { id: "deck_match",   section: "picks",       title: "The match" },
  { id: "deck_facts",   section: "picks",       title: "The facts" },
  { id: "deck_actions", section: "picks",       title: "Pass, Save or Draft" },
  { id: "draft_house",  section: "draft_house", title: "Home" },
  { id: "modes",        section: "draft_house", title: "Ask me first or Apply for me" },
  { id: "auto_settings",section: "draft_house", title: "Auto settings" },
  { id: "atlas_map",    section: "map",         title: "Your map" },
  { id: "atlas_learn",  section: "learn",       title: "Learn" },
  { id: "pick_two",     section: "picks",       title: "Your turn: pick 2" },
  { id: "live_run",     section: "draft_house", title: "Watch them run" },
  { id: "table",        section: "table",       title: "The Table" },
  { id: "survey",       section: null,          title: "Tell us what you think" },
]);
export const TOUR_STEP_IDS = Object.freeze(TOUR_STEPS.map(s => s.id));

/** What the tour counts as the user trying a feature (names only, never content). */
export const TOUR_INTERACTIONS = Object.freeze(["filter_tried", "card_opened", "branch_opened", "mode_switched",
  "auto_settings_set", "map_family_opened", "learn_zoomed", "card_picked", "faster_on", "faster_off"]);

/** The sections the survey rates 1–5, and asks which ONE the tester would use first. */
export const TOUR_SECTIONS = Object.freeze(["picks", "filters", "draft_house", "map", "learn", "table"]);

export const TOUR_PHASES = Object.freeze(["reached", "completed", "abandoned"]);

/**
 * Owner 11-01: after the survey the tester may EXPLORE the real site, view-only. Every action that would act or save opens
 * one "Coming soon" pop-up, and the press is counted by feature — the most-pressed locked features are what people want
 * first. The client maps what was pressed to one of these names (components/ExploreLock.jsx).
 */
export const LOCKED_FEATURES = Object.freeze(["draft", "save", "pass", "apply", "approve", "send", "upload", "settings", "auto_mode",
  "profile", "claim", "learn_progress", "resume", "other"]);
export const TOUR_DEVICES = Object.freeze(["phone", "laptop"]);
export const TOUR_SPEEDS = Object.freeze(["normal", "faster"]);

/** D129: the whole path aims at ≤ 8 minutes to the survey. */
export const TOUR_TARGET_MS = 8 * 60 * 1000;
/** D129 (1): the deck auto-scrolls one card every 0.5 s to the top. */
export const DECK_SCROLL_MS = 500;
