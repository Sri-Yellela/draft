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
import "../../components/UnifiedSearchBar.css";
import "./PublicBoardPage.css";

const KEYS = ["q", "category", "subcategory", "tech", "places", "work_models", "experience_levels", "page"];
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

export default function PublicBoardPage() {
  const [sp, setSp] = useSearchParams();
  const params = useMemo(() => Object.fromEntries(KEYS.filter((k) => sp.get(k)).map((k) => [k, sp.get(k)])), [sp]);
  const [text, setText] = useState(params.q || "");
  const [board, setBoard] = useState(null);
  const [facets, setFacets] = useState(null);
  const [error, setError] = useState(null);
  const [picker, setPicker] = useState(false);
  const [pickCat, setPickCat] = useState(params.category || null);

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

  return (
    <main className="pb" data-public-board="">
      <header className="pb__head">
        <h1>{board?.total != null ? `${board.total.toLocaleString("en-US")} open jobs` : "Open jobs"}{roleWord ? ` in ${roleWord}` : ""}</h1>
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

      {error && <p className="pb__msg" role="alert">{error === "busy" ? "A lot of searches at once — try again in a minute." : "The board couldn't load just now — try again in a moment."}</p>}
      {!board && !error && <p className="pb__msg" aria-busy="true">Loading…</p>}
      {board && board.jobs.length === 0 && <p className="pb__msg">Nothing open matches that. <button type="button" className="pb__link" onClick={() => set({ category: null, subcategory: null, q: null })}>See every job</button></p>}

      {board && board.jobs.length > 0 && (
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
