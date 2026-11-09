// shared/durationLabel.js — ⭐ A153 (45o): ONE "2 yrs 4 mos" for the profile page (services/profilePage.js) and the section
// editor (client ProfileSections), moved here from services/profilePage.js so the screen and the server never disagree.
const ymMonths = (ym) => { const m = /^(\d{4})-(\d{2})$/.exec(String(ym || "")); return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null; };

/** PURE. "2 yrs 4 mos" between two YYYY-MM (end null = now); null when either is missing or end is before start. */
export function durationLabel(start, end, now = new Date()) {
  const a = ymMonths(start);
  const b = end ? ymMonths(end) : now.getUTCFullYear() * 12 + now.getUTCMonth();
  if (a == null || b == null || b < a) return null;
  const n = b - a + 1, y = Math.floor(n / 12), m = n % 12;
  return [y ? `${y} yr${y === 1 ? "" : "s"}` : "", m ? `${m} mo${m === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ") || null;
}
