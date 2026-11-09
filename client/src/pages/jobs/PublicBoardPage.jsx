// ⭐ D179 P3 (45l) · THE OPEN BOARD — every shown job, browsable signed out (owner 11-07: "i want all the jobs open for
// everyone to see"). /jobs for a visitor; a signed-in reader is sent to their own board (/app/jobs). The 11-07 overrides:
// the jobs page WITHOUT the personal parts (no match %, no Starred / Imported, no For you / Best fit sorts); acting asks
// to sign up; the one search box suggests Companies · Roles · Technologies · Titles (UsbSuggest's grouped list); the role
// picker is Category → Subcategory with TRUE counts (GET /api/public/jobs/facets). The postings: GET /api/public/jobs.
// Each posting opens its public page (/jobs/<slug>, D128); each company its page (/companies/<slug>, D179 P4b).
// ⛔ D182: no label restates a value. ⛔ D60: no pills. Colours from tokens only.
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import UsbSuggest from "../../components/UsbSuggest.jsx";
// ⭐ D179 (owner 11-07 override (f)): signed out, the SAME page — the deck's own card, without the personal parts.
import { CardFace } from "../../panels/DeckView.jsx";
import "../../components/UnifiedSearchBar.css";
import "./PublicBoardPage.css";

const KEYS = ["q", "category", "subcategory", "tech", "places", "work_models", "experience_levels", "page", "view"];
const salary = (min, max) => {
  const k = (v) => `$${Math.round(v / 1000)}k`;
  return min && max ? `${k(min)}–${k(max)}` : min ? `from ${k(min)}` : max ? `up to ${k(max)}` : null;
};
const posted = (iso) => {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return null;
  const d = Math.max(0, Math.round((Date.now() - t) / 86400000));
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
const WORKPLACE = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };

async function getJson(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return r.json();
}

/**
 * ⭐ A147 · the browse board. Role cards from the open board's own facets (true counts; a ".general" bucket is not a role
 * of its own); popular role pages = the largest subcategories with a landing page (≥ 10 open jobs, D179 P7); technologies
 * and companies from GET /api/public/jobs/entry. A card narrows the board below in place; a popular link opens its page.
 */
function EntryBoard({ cats, entry, set }) {
  const roles = cats.slice(0, 8).map((c) => ({ ...c, top: c.subcategories.filter((s) => !/.general$/.test(s.id)).slice(0, 3) }));
  const popular = cats.flatMap((c) => c.subcategories.filter((s) => !/.general$/.test(s.id) && s.count >= 10))
    .sort((a, b) => b.count - a.count).slice(0, 8);
  return (
    <div className="pb__entry" data-public-entry="">
      {popular.length > 0 && (
        <nav className="pb__popular" aria-label="Popular roles">
          {popular.map((s) => <a key={s.id} href={`/jobs/role/${s.id}`}>{s.name}</a>)}
        </nav>
      )}
      {roles.length > 0 && (
        <section className="pb__sec" data-entry-roles="">
          <h2>Browse by role</h2>
          <ul className="pb__cards">
            {roles.map((c) => (
              <li key={c.id} className="pb__cardrole">
                <button type="button" className="pb__cardhead" onClick={() => set({ category: c.id, subcategory: null })}>
                  {c.name} <span className="pb__n">{c.count.toLocaleString("en-US")}</span></button>
                {c.top.map((s) => (
                  <button key={s.id} type="button" className="pb__cardsub" onClick={() => set({ category: c.id, subcategory: s.id })}>
                    {s.name} <span className="pb__n">{s.count.toLocaleString("en-US")}</span></button>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
      {entry?.technologies?.length > 0 && (
        <section className="pb__sec" data-entry-tech="">
          <h2>Hiring by technology</h2>
          <div className="pb__chips">
            {entry.technologies.map((t) => (
              <button key={t.name} type="button" className="pb__tech dbx-depth" onClick={() => set({ tech: t.name })}>
                {t.name} <span className="pb__n">{t.count.toLocaleString("en-US")}</span></button>
            ))}
          </div>
        </section>
      )}
      {entry?.companies?.length > 0 && (
        <section className="pb__sec" data-entry-companies="">
          <h2>Companies hiring now</h2>
          <ul className="pb__cos">
            {entry.companies.map((c) => (
              <li key={c.slug}><Link to={`/companies/${c.slug}`}>{c.name}</Link>
                <span className="pb__n"> · {c.openJobs.toLocaleString("en-US")} open{c.newThisWeek ? ` · ${c.newThisWeek} new this week` : ""}</span></li>
            ))}
          </ul>
        </section>
      )}
      <h2 className="pb__every">Every open job</h2>
    </div>
  );
}

export default function PublicBoardPage() {
  const [sp, setSp] = useSearchParams();
  const params = useMemo(() => Object.fromEntries(KEYS.filter((k) => sp.get(k)).map((k) => [k, sp.get(k)])), [sp]);
  const [text, setText] = useState(params.q || "");
  const [board, setBoard] = useState(null);
  const [facets, setFacets] = useState(null);
  const [error, setError] = useState(null);
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
  }, [qs]);
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
  // ⭐ A147 (45o, owner 11-08: "On /jobs, board below"): with nothing searched or narrowed, /jobs opens on the browse board
  // (live totals, Browse by role, Hiring by technology, Companies hiring now — the D179 sketch's (3)); the deck / list
  // follow it. Any search or filter goes straight to the jobs.
  const entryShown = !params.q && !params.category && !params.subcategory && !params.tech && page === 1;
  const [entry, setEntry] = useState(null);
  useEffect(() => {
    if (!entryShown || entry) return undefined;
    let live = true;
    getJson("/api/public/jobs/entry").then((d) => { if (live) setEntry(d); }).catch(() => {});
    return () => { live = false; };
  }, [entryShown, entry]);

  return (
    <main className="pb" data-public-board="">
      <header className="pb__head">
        <h1>{board?.total != null ? `${board.total.toLocaleString("en-US")} open jobs` : "Open jobs"}{roleWord ? ` in ${roleWord}` : ""}</h1>
        {entryShown && entry?.newThisWeek > 0 && <p className="pb__live" data-entry-new="">{entry.newThisWeek.toLocaleString("en-US")} new this week</p>}
        <p className="pb__lead">Every job on draft, open to read. <Link to="/register">Sign up</Link> to save one, draft your résumé for it, or apply.</p>
      </header>

      <div className="pb__bar">
        <div className="pb__search" role="search">
          <UsbSuggest field="title" value={text} onChange={setText}
            onAccept={(v) => set({ q: v })}
            onPickRole={(r) => set({ subcategory: r.id, category: r.categoryId, q: "" })}
            onPickTech={(t) => set({ tech: t.name })}>
            {(sugg) => (
              <input {...sugg} type="search" enterKeyHint="search" placeholder="Search a company, role, technology or title"
                aria-label="Search jobs" className="pb__input"
                onKeyDown={(e) => { sugg.onKeyDown(e); if (e.defaultPrevented) return; if (e.key === "Enter") set({ q: text.trim() }); }} />
            )}
          </UsbSuggest>
        </div>
        <button type="button" className="pb__role dbx-depth" aria-expanded={picker} onClick={() => setPicker((o) => !o)} data-role-picker="">
          {roleWord || "Any role"} ▾
        </button>
        {params.tech && <button type="button" className="pb__role dbx-depth" onClick={() => set({ tech: null })} title="Clear the technology">using {params.tech} ×</button>}
        {(params.category || params.q || params.tech) && <button type="button" className="pb__clear" onClick={() => set({ category: null, subcategory: null, q: null, tech: null })}>Clear</button>}
      </div>

      {picker && (
        <div className="pb__picker" data-role-panel="">
          <ul className="pb__cats">
            {cats.map((c) => (
              <li key={c.id}>
                <button type="button" aria-pressed={shownCat?.id === c.id} onClick={() => setPickCat(c.id)}>
                  {c.name} <span className="pb__n">{c.count.toLocaleString("en-US")}</span>
                </button>
              </li>
            ))}
            {facets?.unclassified > 0 && <li className="pb__note">{facets.unclassified.toLocaleString("en-US")} not yet sorted into a role</li>}
          </ul>
          {shownCat && (
            <ul className="pb__subs">
              <li><button type="button" onClick={() => { set({ category: shownCat.id, subcategory: null }); setPicker(false); }}>
                All of {shownCat.name} <span className="pb__n">{shownCat.count.toLocaleString("en-US")}</span></button></li>
              {shownCat.subcategories.filter((s) => !/\.general$/.test(s.id)).map((s) => (
                <li key={s.id}><button type="button" aria-pressed={params.subcategory === s.id}
                  onClick={() => { set({ category: shownCat.id, subcategory: s.id }); setPicker(false); }}>
                  {s.name} <span className="pb__n">{s.count.toLocaleString("en-US")}</span></button></li>
              ))}
            </ul>
          )}
        </div>
      )}

      {entryShown && <EntryBoard cats={cats} entry={entry} set={set} />}

      {error && <p className="pb__msg" role="alert">{error === "busy" ? "A lot of searches at once — try again in a minute." : "The board couldn't load just now — try again in a moment."}</p>}
      {!board && !error && <p className="pb__msg" aria-busy="true">Loading…</p>}
      {board && board.jobs.length === 0 && <p className="pb__msg">Nothing open matches that. <button type="button" className="pb__link" onClick={() => set({ category: null, subcategory: null, q: null })}>See every job</button></p>}

      {board && board.jobs.length > 0 && (
        <div className="pb__views" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "deck"} onClick={() => set({ view: null })}>Deck</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => set({ view: "list" })}>List</button>
        </div>
      )}

      {board && board.jobs.length > 0 && view === "deck" && (() => {
        const j = board.jobs[Math.min(at, board.jobs.length - 1)];
        const card = { job: { id: j.jobId || String(j.id), title: j.title, company: j.company, companyIconUrl: j.companyIconUrl, location: j.location,
          salaryMin: j.salaryMinUsd, salaryMax: j.salaryMaxUsd, postedAt: j.postedAt, tagWorkplace: j.workplace, contractType: j.employmentType },
          band: null, score: null, why: {}, report: null };
        const next = () => { if (at + 1 < board.jobs.length) setAt(at + 1); else if (board.more) set({ page: String(page + 1) }); };
        return (
          <section className="pb__deck" data-public-deck="" aria-label="Open jobs, one at a time">
            <div className="pb__card">
              <CardFace card={card} isFront expanded={false} why={false} orientation="horizontal"
                onWhy={() => {}} onExpand={() => {}} onCollapse={() => {}} onReport={() => {}} onSignal={() => {}} />
            </div>
            <div className="pb__deckacts">
              <button type="button" onClick={() => setAt(Math.max(0, at - 1))} disabled={at === 0 && page === 1}>‹</button>
              <button type="button" onClick={next}>Pass</button>
              <Link to={`/register?returnTo=${encodeURIComponent(j.path)}`}>Save</Link>
              <a href={j.path}>Read it</a>
              <Link className="pb__primary" to={`/register?returnTo=${encodeURIComponent(j.path)}`}>Draft</Link>
              <span className="pb__n">{(page - 1) * board.pageSize + at + 1} of {board.total?.toLocaleString("en-US")}</span>
            </div>
          </section>
        );
      })()}

      {board && board.jobs.length > 0 && view === "list" && (
        <ol className="pb__list" start={(page - 1) * board.pageSize + 1}>
          {board.jobs.map((j, i) => (
            <li key={j.id} className="pb__row" data-public-job={j.id}>
              <a className="pb__title" href={j.path}>{j.title}</a>
              <div className="pb__meta">
                {j.companySlug ? <Link to={`/companies/${j.companySlug}`}>{j.company}</Link> : <span>{j.company}</span>}
                {[j.location, WORKPLACE[j.workplace] || null, salary(j.salaryMinUsd, j.salaryMaxUsd), posted(j.postedAt)].filter(Boolean).map((x) => <span key={x}> · {x}</span>)}
              </div>
              <div className="pb__acts">
                <Link to={`/register?returnTo=${encodeURIComponent(j.path)}`} className="pb__act">Save</Link>
                <Link to={`/register?returnTo=${encodeURIComponent(j.path)}`} className="pb__act">Draft my résumé</Link>
              </div>
              {i === 9 && <div className="pb__signup" data-public-signup="">Draft tailors your résumé to each of these and applies for you. <Link to="/register">Sign up free</Link></div>}
            </li>
          ))}
        </ol>
      )}

      {board && (page > 1 || board.more) && (
        <nav className="pb__pages" aria-label="Pages">
          {page > 1 && <button type="button" onClick={() => set({ page: String(page - 1) })}>‹ Newer</button>}
          <span>Page {page}</span>
          {board.more && <button type="button" onClick={() => set({ page: String(page + 1) })}>Older ›</button>}
        </nav>
      )}
    </main>
  );
}
