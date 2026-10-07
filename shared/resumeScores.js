// ── D58 · THE SCORE OF THE RÉSUMÉ THAT WOULD BE SENT — one read, every surface ─────────────────────
//
// Owner, 10-07: "the ATS did not update after the résumé was generated". A tailored résumé's score is
// written ONCE, at generation, on the résumé (`resumes.ats_score`), beside the base résumé's score for the
// same posting measured just before (`resumes.base_ats_score`, migration 131). The card badge, the posting
// header's ATS box, the ATS card and the board all call atsScorePair with the SAME two stored values —
// the A52 / O19b "No signal beside Strong match" was two surfaces reading two different numbers.
//
//   shown           what the header box and the card badge print: the tailored score when a tailored
//                   résumé exists, else the base. ⛔ NULL renders no digit (D50) — never a 0.
//   tailoredShown   whether `shown` is the tailored one (the box's "tailored" marker).
//   lower           ⛔ the tailored résumé scores BELOW the base — said, never hidden: hiding it would be
//                   the very thing the score exists to prevent.
//   line            the ATS card's sentence: "Base 58 → tailored 71", or "… — lower than your base résumé".

const finite = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));

export function atsScorePair({ base = null, tailored = null } = {}) {
  const b = finite(base), t = finite(tailored);
  const shown = t ?? b;
  const lower = b != null && t != null && t < b;
  let line = null;
  if (b != null && t != null) line = `Base ${b} → tailored ${t}` + (lower ? " — lower than your base résumé" : t === b ? " — no change" : "");
  else if (t != null) line = `Tailored ${t}`;
  return { base: b, tailored: t, shown, tailoredShown: t != null, lower, line };
}
