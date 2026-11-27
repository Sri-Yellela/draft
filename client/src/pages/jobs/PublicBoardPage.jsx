// ⭐ D179 P3 (45l) · THE OPEN BOARD — every shown job, browsable signed out (owner 11-07: "i want all the jobs open for
// everyone to see"). /jobs for a visitor; a signed-in reader is sent to their own board (/app/jobs).
// ⭐ D197 Wave 2 #16 · M5 (47m, lane public — the approved mock `public-jobs`, docs/revamp/public.md §1 + §6): THE MARKET,
// SIGNED OUT, in plate (Region IV, the market's own). Every row of the M1 has its home:
//   · the one-line header (D200): "N open jobs" (+ "in <role>") under the kicker THE MARKET · OPEN TO EVERYONE, the lead
//     with its Sign up link (an ink link — the page's ONE clay point is the nav's Get started), the stats strip of COUNTED
//     figures only (open jobs · new this week · sectors) — no figure that isn't counted;
//   · the search: the plate NavSearch row around UsbSuggest's input + grouped dropdown (one implementation);
//   · the cartouche (the bearing, signed out): "discovering <role> roles, … using <technology>" — the role part opens the
//     Category → Subcategory picker with TRUE counts (All of <category>, N not yet sorted into a role); the technology part
//     clears the technology; Clear all clears the four;
//   · 01 the political map signed out (plate/MarketMap.jsx — territories = the five largest categories, area = open jobs;
//     tap a territory = the role filter; NO hatching and NO "you": those are personal);
//   · 02 Every opening: BinderTabs Deck / Index (`view=list` still selects Index). The deck: a plate Opening (no match, no
//     résumé marks) with ‹ · Pass · Save · Read it · Draft (ink) and the position line; the Index: the Gazetteer without
//     the personal columns (# · OPENING · COMPANY · PLACE · PAY · POSTED · Save / Draft); the sign-up ticket; MarketPager;
//   · 03 the gazetteer: popular role pages (→ /jobs/role/<id>, ≥ 10 jobs), Hiring by technology (chips with counts, each
//     sets the technology), Companies hiring now (→ their survey sheet) beside the gazetteer drawing (GazetteerGridPage);
//   · onward: the ATS check, the 3-minute audit, Atlas.
// The URL state is unchanged (q · category · subcategory · tech · places · work_models · experience_levels · page · view).
// Loading = paper skeleton, error = ErrorLine (Try again; the 429 words kept), empty = the drawer with See every job.
// ⛔ No user data on a public page (no match, no Starred / Imported, no résumé marks). ⛔ D60: no pills.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import UsbSuggest from "../../components/UsbSuggest.jsx";
import { Kickers, FilterChips } from "../../plate/Marks.jsx";
import { StatsStrip, LegHeader, BinderTabs } from "../../plate/Plates.jsx";
import { Opening, DeckPile, Ticket, Cartouche } from "../../plate/Tickets.jsx";
import { Gazetteer } from "../../plate/Lists.jsx";
import { NavSearch } from "../../plate/Shell.jsx";
import { MarketMap } from "../../plate/MarketMap.jsx";
import MarketPager from "../../plate/MarketPager.jsx";
import { Drawer, ErrorLine, Skeleton } from "../../plate/PlateState.jsx";
import { DRAWINGS } from "../../plate/drawings/index.js";
import { PublicPage, usePublicGo } from "../../components/PublicChrome.jsx";
import "../../components/UnifiedSearchBar.css";

const KEYS = ["q", "category", "subcategory", "tech", "places", "work_models", "experience_levels", "page", "view"];
export const salary = (min, max) => {
  const k = (v) => `$${Math.round(v / 1000)}k`;
  return min && max ? `${k(min)}–${k(max)}` : min ? `from ${k(min)}` : max ? `up to ${k(max)}` : null;
};
export const posted = (iso) => {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return null;
  const d = Math.max(0, Math.round((Date.now() - t) / 86400000));
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
const WORKPLACE = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
const n = (v) => (Number.isFinite(v) ? v.toLocaleString("en-US") : "—");
const plain = (e) => !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

async function getJson(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return r.json();
}

/** Pure: a public job row (GET /api/public/jobs) as the plate Opening — signed out: no match, no résumé marks. */
export function openingOfPublicJob(j) {
  const p = posted(j.postedAt);
  return {
    company: j.company, place: j.location || null, title: j.title, match: null, signedOut: true,
    pay: salary(j.salaryMinUsd, j.salaryMaxUsd), type: j.employmentType || null, mode: WORKPLACE[j.workplace] || null,
    posted: p ? `POSTED ${p.toUpperCase()}` : null, companyHref: j.companySlug ? `/${j.companySlug}` : null,
    logo: j.companyIconUrl || null, region: "IV",
  };
}

/** Pure: the facets' categories as the political map's sectors — the five largest, each with its three largest roles. */
export function sectorsFromCategories(cats = []) {
  return cats.filter((c) => c.count > 0).slice().sort((a, b) => b.count - a.count).slice(0, 5)
    .map((c) => ({ id: c.id, name: c.name, n: c.count,
      subs: (c.subcategories || []).filter((s) => !/\.general$/.test(s.id)).slice(0, 3).map((s) => ({ label: s.name, n: s.count })) }));
}

export default function PublicBoardPage() {
  const go = usePublicGo();
  const [sp, setSp] = useSearchParams();
  const params = useMemo(() => Object.fromEntries(KEYS.filter((k) => sp.get(k)).map((k) => [k, sp.get(k)])), [sp]);
  const [text, setText] = useState(params.q || "");
  const [board, setBoard] = useState(null);
  const [facets, setFacets] = useState(null);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);   // Try again
  const [picker, setPicker] = useState(false);
  const [pickCat, setPickCat] = useState(params.category || null);
  const view = params.view === "list" ? "list" : "deck";   // the deck first, as signed in
  const [at, setAt] = useState(0);
  useEffect(() => { setAt(0); }, [board]);

  const set = (patch) => {
    const next = { ...params, ...patch };
    if (!("page" in patch)) delete next.page;
    for (const k of Object.keys(next)) if (next[k] == null || next[k] === "") delete next[k];
    setSp(next);
  };
  const qs = useMemo(() => new URLSearchParams(params).toString(), [params]);
  useEffect(() => { setText(params.q || ""); }, [params.q]);
  useEffect(() => {
    let live = true;
    setError(null);
    getJson(`/api/public/jobs?${qs}`).then((d) => { if (live) setBoard(d); }).catch((e) => { if (live) setError(e.status === 429 ? "busy" : "failed"); });
    return () => { live = false; };
  }, [qs, nonce]);
  const facetQs = useMemo(() => { const { category, subcategory, page, ...rest } = params; return new URLSearchParams(rest).toString(); }, [params]);
  useEffect(() => {
    let live = true;
    getJson(`/api/public/jobs/facets?${facetQs}`).then((d) => { if (live) setFacets(d); }).catch(() => { if (live) setFacets(null); });
    return () => { live = false; };
  }, [facetQs]);

  const cats = facets?.categories || [];
  const shownCat = cats.find((c) => c.id === (pickCat || params.category)) || null;
  const roleWord = params.subcategory
    ? cats.flatMap((c) => c.subcategories).find((s) => s.id === params.subcategory)?.name
    : params.category ? cats.find((c) => c.id === params.category)?.name : null;
  const page = Number(params.page || 1);
  // ⭐ A147 (45o, owner 11-08): with nothing searched or narrowed, /jobs opens on the browse board (the map, the gazetteer);
  // any search or filter goes straight to the jobs.
  const entryShown = !params.q && !params.category && !params.subcategory && !params.tech && page === 1;
  const [entry, setEntry] = useState(null);
  useEffect(() => {
    if (entry) return undefined;
    let live = true;
    getJson("/api/public/jobs/entry").then((d) => { if (live) setEntry(d); }).catch(() => {});
    return () => { live = false; };
  }, [entry]);
  const sectors = useMemo(() => sectorsFromCategories(cats), [cats]);
  const popular = cats.flatMap((c) => c.subcategories.filter((s) => !/\.general$/.test(s.id) && s.count >= 10).map((s) => ({ ...s, sector: c.name })))
    .sort((a, b) => b.count - a.count).slice(0, 8);
  const anyFilter = !!(params.category || params.q || params.tech);
  const total = board?.total;
  const pageSize = board?.pageSize || 50;
  const Grid = DRAWINGS.GazetteerGridPage;
  const register = (path) => `/register?returnTo=${encodeURIComponent(path || "/jobs")}`;
  const linkTo = (href) => (e) => { if (!plain(e)) return; e.preventDefault(); go(href); };

  const indexCols = [
    { key: "n", label: "#", kind: "num" }, { key: "title", label: "OPENING", kind: "title" },
    { key: "company", label: "COMPANY", render: (r) => (r.companySlug ? <a href={`/${r.companySlug}`} style={{ color: "var(--pl-ink)" }}>{r.company}</a> : r.company) },
    { key: "place", label: "PLACE" }, { key: "pay", label: "PAY", kind: "mono" }, { key: "posted", label: "POSTED", kind: "mono" },
    { key: "act", label: "", render: (r) => (
      <span style={{ display: "inline-flex", gap: 6 }}>
        <a className="pl-btn pl-btn--paper" href={register(r.href)} onClick={linkTo(register(r.href))}>Save</a>
        <a className="pl-btn pl-btn--paper" href={register(r.href)} onClick={linkTo(register(r.href))}>Draft</a>
      </span>) },
  ];

  return (
    <PublicPage region="IV" data-public-board="">
      <main className="pl-page" style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 28 }}>
        {/* the one-line header (a working page, D200): what it is in plain words */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-labelledby="pj-title">
          <Kickers parts={["THE MARKET · OPEN TO EVERYONE"]}/>
          <h1 id="pj-title" className="pl-mk-hero__title">{total != null ? `${n(total)} open jobs` : "Open jobs"}{roleWord ? ` in ${roleWord}` : ""}</h1>
          <p className="pl-mk-hero__line">Every job on draft, open to read. <a href="/register" onClick={linkTo("/register")} style={{ color: "var(--pl-ink)", fontWeight: 700 }}>Sign up</a> to save one, draft your résumé for it, or apply.</p>
          <StatsStrip label="The open board" cells={[
            { value: total ?? null, label: "OPEN JOBS" },
            ...(entry?.newThisWeek > 0 ? [{ value: entry.newThisWeek, label: "NEW THIS WEEK", attrs: { "data-entry-new": "" } }] : []),
            ...(cats.length ? [{ value: cats.length, label: "SECTORS" }] : []),
          ]}/>
          <NavSearch placeholder="Company, role, tech or title…" renderInput={(p) => (
            <UsbSuggest field="title" value={text} onChange={setText}
              onAccept={(v) => set({ q: v })}
              onPickRole={(r) => set({ subcategory: r.id, category: r.categoryId, q: "" })}
              onPickTech={(t) => set({ tech: t.name })}>
              {(sugg) => (
                <input {...sugg} type="search" enterKeyHint="search" placeholder={p.placeholder} aria-label="Search jobs" className={p.className}
                  onKeyDown={(e) => { sugg.onKeyDown(e); if (e.defaultPrevented) return; if (e.key === "Enter") set({ q: text.trim() }); }}/>
              )}
            </UsbSuggest>
          )}/>
          <div data-role-picker="">
            <Cartouche kicker="THE BEARING · ANYONE'S" source="SIGN UP AND IT SETS ITSELF FROM YOUR RÉSUMÉ"
              onPart={(id) => { if (id === "role") setPicker((o) => !o); if (id === "tech") set({ tech: null }); }}
              parts={["discovering ", { id: "role", text: roleWord ? roleWord.toLowerCase() : "any role", label: "Role. Change it" }, " roles",
                ...(params.q ? [`, matching “${params.q}”`] : []),
                ...(params.tech ? [", using ", { id: "tech", text: params.tech, label: `Technology ${params.tech}. Clear it` }] : [", using any technology"]), "."]}
              actions={anyFilter ? <button type="button" className="pl-btn pl-btn--dashed" onClick={() => set({ category: null, subcategory: null, q: null, tech: null })}>Clear all</button> : null}/>
          </div>
          {picker && (
            <div className="pl-card" data-role-panel="" style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: 16 }}>
              <div role="group" aria-label="Sectors" style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 6 }}>
                {cats.map((c) => (
                  <button key={c.id} type="button" className="pl-btn pl-btn--paper" style={{ justifyContent: "space-between" }} aria-pressed={shownCat?.id === c.id} onClick={() => setPickCat(c.id)}>
                    {c.name} <span className="pl-label pl-muted">{n(c.count)}</span>
                  </button>
                ))}
                {facets?.unclassified > 0 && <span className="pl-label pl-muted">{n(facets.unclassified)} not yet sorted into a role</span>}
              </div>
              {shownCat && (
                <div role="group" aria-label={`Roles in ${shownCat.name}`} style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <button type="button" className="pl-btn pl-btn--paper" style={{ justifyContent: "space-between" }} onClick={() => { set({ category: shownCat.id, subcategory: null }); setPicker(false); }}>
                    All of {shownCat.name} <span className="pl-label pl-muted">{n(shownCat.count)}</span></button>
                  {shownCat.subcategories.filter((s) => !/\.general$/.test(s.id)).map((s) => (
                    <button key={s.id} type="button" className="pl-btn pl-btn--paper" style={{ justifyContent: "space-between" }} aria-pressed={params.subcategory === s.id}
                      onClick={() => { set({ category: shownCat.id, subcategory: s.id }); setPicker(false); }}>
                      {s.name} <span className="pl-label pl-muted">{n(s.count)}</span></button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {sectors.length > 0 && (
          <section aria-labelledby="pj-map" data-public-map="">
            <LegHeader n={1} id="pj-map" meta="THE POLITICAL MAP · AREA = OPEN JOBS" title="Where the openings are"/>
            <div style={{ marginTop: 16 }}>
              <MarketMap sectors={sectors} picked={params.category || null} figures={{ fit: total ?? null, newToday: null, filed: null }}
                onPick={(id) => set({ category: id || null, subcategory: null })} caption="PLATE · THE MARKET, SIGNED OUT"/>
            </div>
          </section>
        )}

        <section aria-labelledby="pj-open">
          <LegHeader n={2} id="pj-open" meta="ONE AT A TIME, OR EVERY OPENING · NO MATCH UNTIL YOU SIGN UP" title="Every opening"/>
          <div style={{ marginTop: 16 }}>
            {error ? <ErrorLine text={error === "busy" ? "A lot of searches at once — try again in a minute." : "The board couldn't load just now — try again in a moment."} onRetry={() => setNonce((x) => x + 1)}/>
              : !board ? <Skeleton label="Loading the board" lines={4}/>
              : board.jobs.length === 0 ? <Drawer kicker="NOTHING HERE" text="Nothing open matches that." action={{ label: "See every job", onClick: () => set({ category: null, subcategory: null, q: null }) }}/>
              : (
                <BinderTabs label="View openings" selected={view === "list" ? "index" : "deck"} onSelect={(id) => set({ view: id === "index" ? "list" : null })} idBase="pj-tab"
                  tabs={[{ id: "deck", label: "Deck", sub: "ONE AT A TIME" }, { id: "index", label: "Index", sub: "EVERY OPENING" }]}>
                  {view === "deck" ? (() => {
                    const j = board.jobs[Math.min(at, board.jobs.length - 1)];
                    const next = () => { if (at + 1 < board.jobs.length) setAt(at + 1); else if (board.more) set({ page: String(page + 1) }); };
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }} data-public-deck="" aria-label="Open jobs, one at a time">
                        <DeckPile>
                          <Opening opening={openingOfPublicJob(j)} rootProps={{ "data-public-job": j.id }}
                            titleProps={{ role: "link", tabIndex: 0, style: { cursor: "pointer" }, onClick: () => window.location.assign(j.path),
                              onKeyDown: (e) => { if (e.key === "Enter") window.location.assign(j.path); } }}
                            actions={<>
                              <button type="button" className="pl-btn" onClick={() => setAt(Math.max(0, at - 1))} disabled={at === 0} aria-label="Back">‹</button>
                              <button type="button" className="pl-btn" onClick={next}>Pass</button>
                              <a className="pl-btn" href={register(j.path)} onClick={linkTo(register(j.path))}>Save</a>
                              <a className="pl-btn" href={j.path}>Read it</a>
                              <span className="pl-grow"/>
                              <a className="pl-btn pl-btn--ink" href={register(j.path)} onClick={linkTo(register(j.path))}>Draft</a>
                            </>}/>
                        </DeckPile>
                        <span className="pl-label pl-muted" aria-live="polite">{n((page - 1) * pageSize + at + 1)} OF {n(total)}</span>
                      </div>
                    );
                  })() : (
                    <Gazetteer label="Every opening" cols={indexCols}
                      rows={board.jobs.map((j, i) => ({ id: j.id, n: String((page - 1) * pageSize + i + 1), title: j.title, href: j.path, company: j.company, companySlug: j.companySlug,
                        place: [j.location, WORKPLACE[j.workplace]].filter(Boolean).join(" · ") || "—", pay: salary(j.salaryMinUsd, j.salaryMaxUsd) || "—", posted: posted(j.postedAt) || "—" }))}
                      rowProps={(r) => ({ "data-public-job": r.id })}/>
                  )}
                </BinderTabs>
              )}
          </div>
          {board && board.jobs.length > 0 && (
            <div className="pl-tickets" data-public-signup="">
              <Ticket tone="clay-tint" kicker="SIGN UP FREE · NO CARD" title="Draft tailors your résumé to each of these" line="…and fills the employer's own form, then waits for you." go="Sign up →" href="/register" onClick={linkTo("/register")}/>
            </div>
          )}
          {board && (page > 1 || board.more) && (
            <div style={{ marginTop: 16 }}>
              <MarketPager page={page} totalPages={total != null ? Math.max(1, Math.ceil(total / pageSize)) : page + (board.more ? 1 : 0)} total={total} pageSize={pageSize}
                onGo={(p) => set({ page: p > 1 ? String(p) : null })}/>
            </div>
          )}
        </section>

        {entryShown && (popular.length > 0 || entry?.technologies?.length || entry?.companies?.length) ? (
          <section aria-labelledby="pj-gz" data-public-entry="">
            <LegHeader n={3} id="pj-gz" meta="THE GAZETTEER · EACH ROLE HAS ITS OWN PAGE" title="Popular roles, technologies and companies"/>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 16, alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 300px", minWidth: 0 }} className="pl-platehero">
                <div className="pl-platehero__frame" style={{ "--pl-aspect": "360 / 220" }}>{Grid ? <Grid/> : null}</div>
              </div>
              <div style={{ flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
                {popular.length > 0 && (
                  <Gazetteer label="Popular roles" cols={[{ key: "n", label: "#", kind: "num" }, { key: "title", label: "ROLE", kind: "title" }, { key: "company", label: "SECTOR" }, { key: "count", label: "OPEN", kind: "mono" }]}
                    rows={popular.map((s, i) => ({ id: s.id, n: String(i + 1), title: s.name, company: s.sector, count: n(s.count), href: `/jobs/role/${s.id}` }))}/>
                )}
                {entry?.technologies?.length > 0 && (
                  <div data-entry-tech="">
                    <FilterChips label="Hiring by technology" onToggle={(id) => set({ tech: id })}
                      chips={entry.technologies.map((t) => ({ id: t.name, tag: "TECH", region: "IV", label: t.name, count: t.count }))}/>
                  </div>
                )}
                {entry?.companies?.length > 0 && (
                  <div data-entry-companies="">
                    <Gazetteer label="Companies hiring now" cols={[{ key: "title", label: "COMPANY", kind: "title" }, { key: "open", label: "OPEN", kind: "mono" }, { key: "fresh", label: "THIS WEEK", kind: "mono" }]}
                      rows={entry.companies.map((c) => ({ id: c.slug, title: c.name, href: `/${c.slug}`, open: `${n(c.openJobs)} open`, fresh: c.newThisWeek ? `${c.newThisWeek} new this week` : "—" }))}/>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section aria-label="Where to go next" className="pl-tickets">
          <Ticket kicker="NO ACCOUNT · NOTHING KEPT" title="Check a résumé" line="Your résumé against one job, read the way an applicant-tracking system reads it." go="Open the ATS check →" href="/tools/ats" onClick={linkTo("/tools/ats")}/>
          <Ticket kicker="THE 3-MINUTE AUDIT" title="Do you clear the bar?" line="Six questions for a role, and what closes the distance." go="Take the audit →" href="/audit" onClick={linkTo("/audit")}/>
          <Ticket kicker="ATLAS · VOL. I" title="Learn what the market asks for" line="The skills each role asks for, drawn as a map you walk." go="Open Atlas →" href="/atlas" onClick={linkTo("/atlas")}/>
        </section>
      </main>
    </PublicPage>
  );
}
