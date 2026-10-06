// ── D54 · ONE COMPANY, HOWEVER MANY BOARDS — the identity the company-wise views group by ──────────────
//
// ⛔ THE COMPANY KEY IS THE WHOLE PROBLEM (owner, 10-07). A display-name string is not an identity:
// "Scale AI", "Scale" and scale.com must be ONE company, and two different companies that share a name
// must NOT merge — the "Localhost" and "Physical Superintelligence → Intel" defects were exactly this.
//
// MEASURED BEFORE BUILDING (10-07, the local board — 2,616 postings, 22 names, 20 boards; production not
// read): no name on two boards, no name variants, and ONE board key under three names — `workable:j`,
// because Workable's apply URLs (apply.workable.com/j/<id>) carry no company slug. So a board key is
// only an identity when the URL names the company; for Workable it does not, and it is not used.
//
// THE RULE — union-find over the user's own applications (a small set), three evidences:
//   1. the same ATS BOARD (greenhouse:stripe — the URL's own company slug)        → one company
//   2. the same DOMAIN (the company KB / logo store's domain for that name)        → one company
//   3. the same NAME KEY (legal suffixes and punctuation dropped)                  → one company,
//      ⛔ UNLESS both sides carry a known domain and the domains DIFFER — then they are two companies
//      that share a name, and stay separate.
// A company on Greenhouse AND Workday is one company when its name or its domain says so.

const LEGAL = /\b(inc|llc|ltd|limited|corp|corporation|co|company|plc|gmbh|sa|ag|bv)\b\.?/g;

/** "Stripe, Inc." and "STRIPE" → "stripe". Not "Scale AI" → "scale": AI is part of a name. */
export function companyNameKey(name) {
  return String(name ?? "").toLowerCase().replace(LEGAL, " ").replace(/[^a-z0-9]+/g, "");
}

/**
 * The ATS board a posting URL names, or null when the URL does not name a company (Workable's /j/ links,
 * a bare host, the local fake ATS). `?for=` is Greenhouse's embed form.
 */
export function companyBoardOf(url) {
  let u; try { u = new URL(String(url ?? "")); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const seg = u.pathname.split("/").filter(Boolean);
  const slug = (s) => (s && /^[a-z0-9][a-z0-9_.-]*$/i.test(s) ? s.toLowerCase() : null);
  let s = null, ats = null;
  if (/(^|\.)greenhouse\.io$/.test(host)) { ats = "greenhouse"; s = slug(u.searchParams.get("for") || seg[0]); }
  else if (/(^|\.)lever\.co$/.test(host)) { ats = "lever"; s = slug(seg[0]); }
  else if (/(^|\.)ashbyhq\.com$/.test(host)) { ats = "ashby"; s = slug(seg[0]); }
  else if (/(^|\.)myworkdayjobs\.com$/.test(host)) { ats = "workday"; s = slug(host.split(".")[0]); }
  else if (/(^|\.)workable\.com$/.test(host)) { ats = "workable"; s = seg[0] === "j" ? null : slug(seg[0]); }
  else if (/(^|\.)smartrecruiters\.com$/.test(host)) { ats = "smartrecruiters"; s = slug(seg[0]); }
  if (!ats || !s || s === "embed" || s === "job_app") return null;
  return `${ats}:${s}`;
}

/**
 * Group items into companies.
 * @param items  [{ id, company, url, domain? }] — `id` is the caller's own (a jobId)
 * @returns {{ groups: Array<{ key, name, ids: string[] }>, keyOf: Map<id, key> }}
 */
export function groupCompanies(items = []) {
  const n = items.length;
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const facts = items.map(it => ({
    name: companyNameKey(it.company), board: companyBoardOf(it.url), domain: it.domain ? String(it.domain).toLowerCase() : null,
  }));
  // A component's known domains, so rule 3 can refuse to merge two that differ.
  const domains = items.map((_, i) => new Set(facts[i].domain ? [facts[i].domain] : []));
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra === rb) return;
    parent[rb] = ra;
    for (const d of domains[rb]) domains[ra].add(d);
  };
  const byKey = (k) => { const m = new Map(); facts.forEach((f, i) => { const v = f[k]; if (v) (m.get(v) || m.set(v, []).get(v)).push(i); }); return m; };
  for (const ids of byKey("board").values()) for (const i of ids.slice(1)) union(ids[0], i);
  for (const ids of byKey("domain").values()) for (const i of ids.slice(1)) union(ids[0], i);
  const conflict = (x, y) => { const a = domains[find(x)], b = domains[find(y)]; return a.size && b.size && ![...a].some(d => b.has(d)); };
  for (const ids of byKey("name").values()) {
    for (const i of ids.slice(1)) if (!conflict(ids[0], i)) union(ids[0], i);
  }
  // 4. The same SLUG on a different ATS ("scaleai" on Greenhouse and on Ashby) is one company only when
  //    the names agree as well — one name key a prefix of the other ("scale" ⊂ "scaleai"). A slug alone
  //    is not enough: "mercury" on two ATSs can be two employers.
  const slugs = new Map();
  facts.forEach((f, i) => { const s = f.board?.split(":")[1]; if (s) (slugs.get(s) || slugs.set(s, []).get(s)).push(i); });
  for (const ids of slugs.values()) {
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
      const a = facts[ids[x]].name, b = facts[ids[y]].name;
      if (a && b && (a.startsWith(b) || b.startsWith(a)) && !conflict(ids[x], ids[y])) union(ids[x], ids[y]);
    }
  }
  const comps = new Map();
  for (let i = 0; i < n; i++) (comps.get(find(i)) || comps.set(find(i), []).get(find(i))).push(i);
  const groups = [], keyOf = new Map();
  for (const idx of comps.values()) {
    // The name most of its rows carry; the key is stable for the same evidence.
    const tally = new Map();
    for (const i of idx) { const c = String(items[i].company ?? "").trim(); if (c) tally.set(c, (tally.get(c) || 0) + 1); }
    const name = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    // Distinct per group: two groups that share a name exist only when their domains differ, so the
    // domain leads; otherwise the name, the board, or (nothing known) the item itself.
    const d = [...domains[find(idx[0])]].sort()[0];
    const f0 = idx.map(i => facts[i]).find(f => f.name) || facts[idx[0]];
    const key = d ? `d:${d}` : f0.name ? `n:${f0.name}` : f0.board ? `b:${f0.board}` : `j:${String(items[idx[0]].id)}`;
    const ids = idx.map(i => String(items[i].id));
    groups.push({ key, name, ids });
    for (const id of ids) keyOf.set(id, key);
  }
  return { groups, keyOf };
}

/**
 * Which of `groups` a job about to be drafted belongs to, by the same three evidences — or null.
 * @param job     { company, url, domain? }
 * @param members Map key → [{ company, url, domain }] — the rows already grouped
 */
export function matchCompany(job, members) {
  const name = companyNameKey(job?.company), board = companyBoardOf(job?.url), domain = job?.domain ? String(job.domain).toLowerCase() : null;
  const slug = board?.split(":")[1] ?? null;
  let byName = null;
  for (const [key, rows] of members) {
    const ds = new Set(rows.map(r => r.domain && String(r.domain).toLowerCase()).filter(Boolean));
    if (board && rows.some(r => companyBoardOf(r.url) === board)) return key;
    if (domain && ds.has(domain)) return key;
    const domainsAgree = !(domain && ds.size && !ds.has(domain));
    if (!byName && domainsAgree && name && rows.some(r => {
      const n = companyNameKey(r.company);
      if (n === name) return true;
      // Rule 4, as groupCompanies: the same slug on another ATS, the names agreeing by prefix.
      const s = companyBoardOf(r.url)?.split(":")[1];
      return slug && s === slug && n && (n.startsWith(name) || name.startsWith(n));
    })) byName = key;
  }
  return byName;
}

// ── The views over it ─────────────────────────────────────────────────────────────────────────────────

const SENT = new Set(["sent", "no_reply"]);
// "28 Sep", as the owner wrote it — fixed, not the runtime's locale (en-GB says "Sept").
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (sec) => { const d = new Date(sec * 1000); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };

/** The Table's "By company": history rows grouped by companyKey — counts, the latest activity, the rows. */
export function companyRows(rows = []) {
  const by = new Map();
  for (const r of rows) {
    const k = r.companyKey ?? `j:${r.jobId}`;
    if (!by.has(k)) by.set(k, { key: k, name: r.companyName ?? r.company ?? null, roles: [], counts: { sent: 0, replied: 0, inPlay: 0, closed: 0 }, last: null });
    const g = by.get(k);
    g.roles.push(r);
    if (SENT.has(r.status)) g.counts.sent++;
    else if (r.status === "replied") g.counts.replied++;
    else if (r.status === "in_play") g.counts.inPlay++;
    else g.counts.closed++;
    const d = r.date ?? null;
    if (d != null && (g.last == null || d > g.last)) g.last = d;
  }
  return [...by.values()].sort((a, b) => (b.last ?? 0) - (a.last ?? 0) || String(a.name).localeCompare(String(b.name)));
}

/** "3 roles: 1 sent · 1 replied · 1 in play" — only the parts that are not zero. */
export function companySummary(g) {
  const n = g.roles.length;
  const parts = [[g.counts.sent, "sent"], [g.counts.replied, "replied"], [g.counts.inPlay, "in play"], [g.counts.closed, "closed"]]
    .filter(([c]) => c > 0).map(([c, w]) => `${c} ${w}`);
  return `${n} role${n === 1 ? "" : "s"}: ${parts.join(" · ")}`;
}

/**
 * ⭐ D54 · the notice AT THE POINT OF ACTION — non-blocking. Warns at the SECOND role (the owner's
 * default): returns null when the company has no active or sent application. Sent counts for all time,
 * in play for now, with the date of the latest send so the user can judge. ⛔ Never a block.
 * @param g     a companyRows group (or null)
 * @param name  the display name for the job being drafted
 */
export function companyNotice(g, name) {
  if (!g) return null;
  const sent = g.roles.filter(r => SENT.has(r.status) || r.status === "replied");
  const live = g.roles.filter(r => r.status === "in_play");
  if (!sent.length && !live.length) return null;
  const latest = sent.map(r => r.sentAt ?? r.date).filter(x => x != null).sort((a, b) => b - a)[0];
  const parts = [];
  if (sent.length) parts.push(`${sent.length} sent${latest ? ` ${fmtDay(latest)}` : ""}`);
  if (live.length) parts.push(`${live.length} ${live.every(r => r.origin === "drafted") ? "queued" : "in play"}`);
  const roles = sent.length + live.length;
  return `You already have ${roles} role${roles === 1 ? "" : "s"} at ${g.name || name || "this company"} — ${parts.join(", ")}. Draft this one too?`;
}
