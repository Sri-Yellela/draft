// ⭐ D129 (owner 11-01) · THE GUIDED TOUR'S STEPS — the vocabulary of the trial's stored tour events (trial_events).
// 11-07 (owner): the D124 trial and its guided tour were removed; nothing records a tour event any more. These names
// stay because Admin → Testers (services/testersReport.js) reads the events testers already left, step by step.
// Order is the tour's path: pick a résumé → the deck → Draft House (example) → the Atlas → pick 2 → Draft House live →
// The Table → the survey.

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
