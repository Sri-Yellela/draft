// ⭐ D197 Wave 1 #4 (47h) · THE SURVEY SHEET's model — pure: the company page's one read (GET /api/public/companies/:slug,
// services/companies/publicCompany.js) + Your match (GET /api/companies/:slug/match) → what each section of the `Survey`
// board draws. Nothing here is invented: a figure the data doesn't hold is null, and the sheet says so (D200 Rule 2).
// The stack legend is LIVE data — stackFor() (services/companies/companyTech.js, table company_tech: ≥ 2 postings inside
// 180 days, each technology with its evidence count) — never the old name-keyed table with no writer since A80 V4 (47h's check).

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_WORDS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const NUM_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
/** "Four" / "twelve" — number words to twelve, digits after (the board's "Four of their top twelve"). */
export const numWord = (n, cap = false) => { const w = n >= 0 && n <= 12 ? NUM_WORDS[n] : String(n); return cap ? w[0].toUpperCase() + w.slice(1) : w; };

// The legend's columns: stackFor's groups, two folded together where the board folds them (Data & cloud).
export const STACK_COLUMNS = Object.freeze([
  { id: "languages", label: "LANGUAGES", groups: ["languages"] },
  { id: "frameworks", label: "FRAMEWORKS", groups: ["frameworks"] },
  { id: "data", label: "DATA & CLOUD", groups: ["data", "cloud"] },
  { id: "devops", label: "DEVOPS", groups: ["devops"] },
  { id: "ml", label: "ML / AI", groups: ["ml-ai"] },
  { id: "tools", label: "TOOLS", groups: ["tools"] },
]);

/** The name as prose says it: "Kestrel Payments" → "Kestrel", "Acme, Inc." → "Acme" (a trailing corporate or trade word
 *  dropped, never the only word). */
const TRAILING = /[,\s]+(inc\.?|llc|ltd\.?|corp\.?|corporation|co\.?|company|technologies|technology|labs|payments|group|holdings|systems|software)$/i;
export function shortName(name) {
  let n = String(name || "").trim();
  for (let i = 0; i < 2; i++) { const m = n.replace(TRAILING, ""); if (m && m !== n && /\S/.test(m)) n = m; }
  return n;
}

/** Wikidata's head count as the band people use ("501–1k"); null when unknown. */
export function peopleBand(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  const bands = [[10, "1–10"], [50, "11–50"], [200, "51–200"], [500, "201–500"], [1000, "501–1k"], [5000, "1k–5k"], [10000, "5k–10k"], [50000, "10k–50k"]];
  for (const [top, word] of bands) if (v <= top) return word;
  return "50k+";
}

/** "Data engineering" → "Data eng." (the line's stop labels stay short; the full name is in the aria label). */
export const stopWord = (name) => String(name || "").replace(/\s+engineering$/i, " eng.");

/** Teams named in the postings: "Platform, Backend" · "most teams" past three. */
export const teamsWord = (teams = []) => (teams.length > 3 ? "most teams" : teams.join(", "));

/** Your mark on one technology: "yours" (proven or listed on your résumé), "not" (not yet), null signed out. */
export function markFor(tech, match) {
  if (!match) return null;
  const t = String(tech).toLowerCase();
  const has = (list) => (list || []).some((x) => String(x).toLowerCase() === t);
  return has(match.proven) ? "proven" : has(match.listed) ? "listed" : "not";
}

/** The legend: a column per group with technologies, each { tech, postings, of, pct, teams, isNew, lastSeen, atlasSlug, mark }. */
export function stackLegend(stack, match) {
  if (!stack?.groups) return { of: 0, columns: [] };
  const of = stack.ofPostings || Object.values(stack.groups).flat()[0]?.of || 0;
  const columns = STACK_COLUMNS.map((c) => ({
    id: c.id, label: c.label,
    rows: c.groups.flatMap((g) => stack.groups[g] || []).map((t) => ({
      tech: t.tech, postings: t.postings, of: t.of || of, pct: Math.floor((100 * t.postings) / Math.max(1, t.of || of)),
      teams: t.teams || [], isNew: !!t.newThisQuarter, firstSeen: t.firstSeen || null, lastSeen: t.lastSeen || null,
      atlasSlug: t.atlasSlug || null, mark: markFor(t.tech, match),
    })),
  })).filter((c) => c.rows.length);
  return { of, columns };
}

/** GitHub's languages as shares of their public repos (the legend's foot): the top three + the rest. */
export function githubShares(github) {
  const langs = github?.languages || [];
  const total = langs.reduce((s, l) => s + (Number(l.repos) || 0), 0);
  if (!total) return null;
  const top = langs.slice(0, 3).map((l) => ({ language: l.language, pct: Math.round((100 * l.repos) / total) }));
  return { org: github.org, url: github.url, top };
}

/** The elevation profile: one point per month (x 60 → 580, y = 260 − n × 190 / max), the change since the first month. */
export function hiringProfile(trend = []) {
  const rows = (trend || []).filter((t) => t && /^\d{4}-\d{2}$/.test(t.month));
  if (rows.length < 2) return null;
  const max = Math.max(1, ...rows.map((t) => t.postings));
  const step = 520 / (rows.length - 1);
  const points = rows.map((t, i) => ({ x: Math.round(60 + i * step), y: Math.round(260 - (t.postings * 190) / max), n: t.postings,
    month: MONTHS[Number(t.month.slice(5)) - 1], monthWord: MONTH_WORDS[Number(t.month.slice(5)) - 1] }));
  const first = rows[0].postings, last = rows[rows.length - 1].postings;
  const change = first > 0 ? Math.round((100 * (last - first)) / first) : null;
  const rising = rows.every((t, i) => !i || t.postings >= rows[i - 1].postings);
  const title = change == null ? "New postings by month" : change >= 20 ? (rising ? "Climbing every month" : "Climbing")
    : change <= -20 ? "Slowing down" : "Holding steady";
  return { points, change, first: points[0], title, max };
}

/** The line of open roles: one stop per role (the subcategories, largest first, at most seven); yours = the job you opened. */
export function roleLine(byCategory = [], focus = null) {
  const stops = [];
  for (const c of byCategory || []) {
    const subs = (c.subcategories || []).filter((s) => !/\.general$/.test(s.id));
    if (subs.length) for (const s of subs) stops.push({ id: s.id, category: c.id, name: s.name, n: s.count });
    else stops.push({ id: c.id || "other", category: c.id, name: c.name, n: c.count });
  }
  stops.sort((a, b) => b.n - a.n);
  const shown = stops.slice(0, 7);
  const yours = focus?.subcategory ? shown.findIndex((s) => s.id === focus.subcategory) : -1;
  const big = shown.length ? Math.max(...shown.map((s) => s.n)) : 0;
  return shown.map((s, i) => ({ ...s, word: stopWord(s.name), x: 50 + i * 90, yours: i === yours, big: s.n === big && i === 0 }));
}

/** Sponsorship as the strip's cells — only what sponsorshipFactFor holds (certified LCAs, the median wage, USCIS). */
export function sponsorshipCells(sp) {
  if (!sp) return null;
  const fy = sp.fiscalYear ? `FY${String(sp.fiscalYear).slice(-2)}` : "";
  const cells = [{ value: sp.filings, label: "CERTIFIED LCAS", key: "lca" }];
  if (sp.wage?.medianUsd) cells.push({ value: `$${Math.round(sp.wage.medianUsd / 1000)}k`, label: "MEDIAN WAGE", key: "wage" });
  if (sp.uscis) {
    cells.push({ value: sp.uscis.approvals, label: "H-1B APPROVALS", key: "uscis" });
    const all = (sp.uscis.approvals || 0) + (sp.uscis.denials || 0);
    if (all) cells.push({ value: `${Math.round((100 * sp.uscis.approvals) / all)}%`, label: "APPROVED", key: "approved" });
  }
  return { fy, year: sp.fiscalYear || null, filed: sp.filings > 0, cells, source: sp.source || null, uscisSource: (sp.parts || []).find((p) => p.kind === "uscis")?.source || null, note: sp.note };
}

/**
 * The hero plate's teams — the teams their postings name (company_tech.teams_json), ranked by the postings of the
 * technologies that name them; the top three are drawn. The beacon is the team the job you opened names in its title.
 */
export function teamPlate(stack, focus = null) {
  const score = new Map(), techs = new Map();
  for (const t of Object.values(stack?.groups || {}).flat()) {
    for (const team of t.teams || []) {
      score.set(team, (score.get(team) || 0) + (t.postings || 0));
      techs.set(team, [...(techs.get(team) || []), t]);
    }
  }
  const teams = [...score.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([team]) => team);
  const title = String(focus?.title || "").toLowerCase();
  const beacon = title ? teams.findIndex((team) => new RegExp(`\\b${team.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(title)) : -1;
  const topTechs = (team) => (techs.get(team) || []).sort((a, b) => b.postings - a.postings).slice(0, 2).map((t) => t.tech);
  // the plate's front block carries the beacon (plate/TeamDiorama.jsx): the job's team goes there, the others left / right
  const drawn = beacon >= 0 && teams.length === 3 ? [...teams.filter((_, i) => i !== beacon), teams[beacon]] : teams;
  return { teams: drawn, beacon: beacon >= 0 ? drawn.indexOf(teams[beacon]) : null, largest: teams[0] ? { team: teams[0], techs: topTechs(teams[0]) } : null,
    yours: beacon >= 0 ? { team: teams[beacon], job: focus } : null };
}

/** "React, TypeScript, Next.js and Python". */
export const andList = (xs = []) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** Your match: { have, of, names, ticks (12 marks, the first `have` lit), angle, missing with an Atlas page }. */
export function matchDial(match, legend) {
  if (!match || !match.of) return null;
  const names = [...(match.proven || []), ...(match.listed || [])];
  const rows = new Map(legend.columns.flatMap((c) => c.rows).map((r) => [r.tech.toLowerCase(), r]));
  const learn = (match.missing || []).filter((m) => m.atlasSlug).slice(0, 2).map((m) => ({ ...m, row: rows.get(String(m.tech).toLowerCase()) || null }));
  return { have: names.length, of: match.of, names, angle: Math.round((360 * names.length) / match.of), learn, title: `${numWord(names.length, true)} of their top ${numWord(match.of)}` };
}

/** The whole sheet. `data` = the public read; `match` = Your match or null (signed out); `now` in ms. */
export function surveyView(data, match = null) {
  const c = data.company;
  const legend = stackLegend(data.stack, match);
  const sp = sponsorshipCells(data.sponsorship);
  const facts = data.about?.facts || {};
  return {
    company: c, about: data.about || null, facts,
    sector: data.byCategory?.[0]?.name || null, sectorId: data.byCategory?.[0]?.id || null,
    stats: [
      { key: "open", value: data.openJobs, label: "OPEN ROLES" },
      ...(peopleBand(facts.employees) ? [{ key: "people", value: peopleBand(facts.employees), label: "PEOPLE" }] : []),
      ...(facts.founded ? [{ key: "founded", value: String(facts.founded).slice(0, 4), label: "FOUNDED" }] : []),
      ...(sp?.filed ? [{ key: "h1b", value: sp.cells[0].value, label: `H-1B ${sp.fy}` }] : []),
    ],
    plate: teamPlate(data.stack, data.focus), stackPostings: data.stack?.ofPostings || legend.of || 0,
    legend, github: githubShares(data.github), website: data.website || null,
    hiring: hiringProfile(data.hiringTrend), line: roleLine(data.byCategory, data.focus), openJobs: data.openJobs,
    locations: data.locations || [], jobs: data.jobs || [], focus: data.focus || null,
    sponsorship: sp, match: matchDial(match, legend),
  };
}
