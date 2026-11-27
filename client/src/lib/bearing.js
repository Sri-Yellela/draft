// ⭐ D197 Wave 2 (47m, lane person) · A JOB PROFILE AS ITS BEARING — the market's word for the sentence filter (D196 addendum).
// PURE: one profile row (GET /api/domain-profiles) → the Cartouche's parts, each read value a dashed, tappable word that
// opens its wizard stop (plate/Tickets.jsx Cartouche). Read by Your bearings (panels/JobProfilesPanel.jsx) and Setting out
// (pages/settingout/SettingOutPage.jsx) — one sentence, built once.
export const LEVEL_WORDS = Object.freeze({ junior: "entry", mid: "mid", senior: "senior", executive: "executive" });

export function bearingParts(p = {}) {
  const titles = (p.target_titles || []).slice(0, 3);
  const keywords = (p.keywords || p.skills || []).slice?.(0, 2) || [];
  return [
    "discovering ", { id: "role", text: p.profile_name || p.role_family || "your field", label: `Field: ${p.profile_name || p.role_family || "not set"}. Change it` },
    " roles at ", { id: "level", text: `${LEVEL_WORDS[p.seniority] || p.seniority || "mid"} level`, label: "Level. Change it" },
    ...(titles.length ? [" as ", { id: "titles", text: titles.join(", "), label: "Titles. Change them" }] : []),
    ...(keywords.length ? [", using ", { id: "tech", text: keywords.join(" and "), label: "Keywords. Change them" }] : []),
    ".",
  ];
}

/** The bearing in words, for a caption ("Frontend · mid · Frontend Engineer"). */
export const bearingLine = (p = {}) => [p.profile_name, `${LEVEL_WORDS[p.seniority] || p.seniority || "mid"} level`, (p.target_titles || []).slice(0, 2).join(", ")].filter(Boolean).join(" · ");
