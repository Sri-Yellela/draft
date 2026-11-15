// extension/panelModel.js — ⭐ D191 (2a)–(2d), 46o · THE SIDE PANEL'S LINES, pure (ask.js draws them; the tests read them).
// From the press's read of this tab (draft's own data — services/extensionJobFacts.js on the server; no model). Each line is
// said only when draft knows it (D182: nothing that restates what is visible); an empty string draws nothing.
const TREND = { up: 'hiring more than three months ago', down: 'hiring less than three months ago', flat: 'hiring steadily' };
export function jobLines(j) {
  const f = j?.facts || {};
  return {
    sub: [f.subcategory || f.category, f.level, f.salary].filter(Boolean).join(' · '),
    fit: [f.fit, Number.isFinite(j?.score) ? `${Math.round(j.score)} ATS match` : null, f.proven ? `you've proven ${f.proven.count} of their top ${f.proven.of}` : null].filter(Boolean).join(' · '),
    works: Array.isArray(f.worksWith) && f.worksWith.length ? `Works with ${f.worksWith.join(', ')}` : '',
    state: j?.application?.state || '',
  };
}
export function companyLines(c) {
  const sponsorship = typeof c?.sponsorship === 'string' ? c.sponsorship : c?.sponsorship?.text || null;
  return [sponsorship, Number(c?.openJobs) > 0 ? `${c.openJobs} open job${c.openJobs === 1 ? '' : 's'} on draft` : null, c?.trend ? TREND[c.trend] : null].filter(Boolean).join(' · ');
}
