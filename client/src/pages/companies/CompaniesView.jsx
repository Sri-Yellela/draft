// ⭐ A144 (45o, owner 11-08) · THE COMPANIES TAB — the fourth view beside All jobs · Starred · Imported.
// Owner: "the companies tab wasnt supposed to be omitted, it should be built and discoverable by usbsearch as suggestions
// under the search field" (reverses the 11-07 override (2)). The sketch's (d): search companies; filter by industry,
// technology, hiring now, sponsorship; a company opens its page (/app/companies/<slug> inside the shell — Back returns here,
// the view is held in JobBoardContext). One read: GET /api/public/companies (services/companies/companyDirectory.js),
// TRUE counts (D153 (2)): every number beside a filter is what pressing it shows.
// ⛔ D60: no capsule shapes. ⛔ D182: a row says only what is new — name, open jobs, new this week, industry · HQ, the stack.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import "./CompaniesView.css";

const SORT_WORD = { open: "Most open jobs", new: "Hiring this week", name: "A to Z" };

export default function CompaniesView({ base = "/app/companies" }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [f, setF] = useState({ industry: "", tech: "", hiring: false, sponsor: false, sort: "open" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(false);
  const qTimer = useRef(null);
  const [qLive, setQLive] = useState("");

  // the typed name is sent 250 ms after the last key
  useEffect(() => {
    clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => setQLive(q.trim()), 250);
    return () => clearTimeout(qTimer.current);
  }, [q]);
  useEffect(() => { setPage(1); }, [qLive, f]);

  useEffect(() => {
    let live = true;
    const p = new URLSearchParams();
    if (qLive) p.set("q", qLive);
    if (f.industry) p.set("industry", f.industry);
    if (f.tech) p.set("tech", f.tech);
    if (f.hiring) p.set("hiring", "now");
    if (f.sponsor) p.set("sponsor", "1");
    p.set("sort", f.sort);
    p.set("page", String(page));
    setError(false);
    api(`/api/public/companies?${p}`)
      .then((d) => { if (!live) return; setData(d); setRows((prev) => (page === 1 ? d.companies : [...prev, ...d.companies])); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [qLive, f, page]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const facets = data?.facets;

  return (
    <section className="cov" data-companies-view="" aria-label="Companies">
      <div className="cov__bar">
        <input className="cov__search" type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search companies" aria-label="Search companies" data-companies-search="" />
        <select className="cov__sel" value={f.industry} onChange={(e) => set("industry", e.target.value)} aria-label="Industry" data-companies-industry="">
          <option value="">Any industry</option>
          {(facets?.industries || []).map((o) => <option key={o.value} value={o.value}>{o.value} · {o.count}</option>)}
          {f.industry && !(facets?.industries || []).some((o) => o.value === f.industry) && <option value={f.industry}>{f.industry} · 0</option>}
        </select>
        <select className="cov__sel" value={f.tech} onChange={(e) => set("tech", e.target.value)} aria-label="Technology" data-companies-tech="">
          <option value="">Any technology</option>
          {(facets?.technologies || []).map((o) => <option key={o.value} value={o.value}>{o.value} · {o.count}</option>)}
          {f.tech && !(facets?.technologies || []).some((o) => o.value.toLowerCase() === f.tech.toLowerCase()) && <option value={f.tech}>{f.tech} · 0</option>}
        </select>
        <button type="button" className="cov__tog dbx-depth" aria-pressed={f.hiring} onClick={() => set("hiring", !f.hiring)} data-companies-hiring="">
          Hiring this week{facets ? <span className="cov__n">{facets.hiringNow.toLocaleString()}</span> : null}
        </button>
        <button type="button" className="cov__tog dbx-depth" aria-pressed={f.sponsor} onClick={() => set("sponsor", !f.sponsor)} data-companies-sponsor=""
          title="Has filed H-1B labor condition applications (US Department of Labor) — a record, not a promise to sponsor you">
          Has sponsored H-1B{facets ? <span className="cov__n">{facets.sponsors.toLocaleString()}</span> : null}
        </button>
        <select className="cov__sel" value={f.sort} onChange={(e) => set("sort", e.target.value)} aria-label="Order" data-companies-sort="">
          {Object.entries(SORT_WORD).map(([v, w]) => <option key={v} value={v}>{w}</option>)}
        </select>
      </div>

      {error && <p className="cov__msg" role="alert">Companies couldn't load just now — try again in a moment.</p>}
      {!error && !data && <p className="cov__msg" aria-busy="true">Loading companies…</p>}
      {data && <p className="cov__total" data-companies-total={data.total}>{data.total.toLocaleString()} {data.total === 1 ? "company" : "companies"} with open jobs</p>}
      {data && data.total === 0 && <p className="cov__msg">No company matches all of these — loosen one.</p>}

      <ul className="cov__list">
        {rows.map((c) => (
          <li key={c.slug}>
            <button type="button" className="cov__row" onClick={() => navigate(`${base}/${c.slug}`)} data-company-row={c.slug}>
              <span className="cov__tile" aria-hidden="true">{(c.name || "?").slice(0, 1).toUpperCase()}</span>
              <span className="cov__main">
                <span className="cov__name">{c.name}</span>
                {(c.industry || c.hq) && <span className="cov__meta">{[c.industry, c.hq].filter(Boolean).join(" · ")}</span>}
                {c.tech?.length > 0 && <span className="cov__meta">Uses {c.tech.join(", ")}</span>}
              </span>
              <span className="cov__jobs">
                <b>{c.openJobs.toLocaleString()}</b> open {c.openJobs === 1 ? "job" : "jobs"}
                {c.newThisWeek > 0 && <span className="cov__fresh">{c.newThisWeek} new this week</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {data?.more && <button type="button" className="cov__more dbx-depth" onClick={() => setPage((p) => p + 1)} data-companies-more="">Show more companies</button>}
    </section>
  );
}
