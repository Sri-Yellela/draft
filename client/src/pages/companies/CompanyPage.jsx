// ⭐ D179 P4b (45l) · A PAGE FOR EVERY COMPANY — the sketch's FIRST version (owner 11-07: "use the first version for
// companies page"), opened inside the shell for a signed-in reader (/app/companies/<slug>, the dock stays; Back returns
// to where they were) and public at /companies/<slug> (the marketing nav above it). One read: GET
// /api/public/companies/:slug (services/companies/publicCompany.js). Sections, in the sketch's order, each drawn only when
// there is something to say: the header (name, site, the ATS, Careers site) · Tech stack with its evidence · open jobs by
// role · hiring trend · visa sponsorship history · locations · the newest open jobs · corrections.
// ⛔ D182: no label restates what the row already says; no taxonomy chips. ⛔ D60: no pills. Colours from tokens only.
// ⚠ Not built yet (said on the page only by their absence): About in draft's words (Wikidata facts), Follow, Your match.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import "./CompanyPage.css";

const GROUP_WORD = { languages: "Languages", frameworks: "Frameworks", data: "Data", cloud: "Cloud", devops: "DevOps", "ml-ai": "ML / AI", tools: "Tools" };
const GROUP_ORDER = ["languages", "frameworks", "data", "cloud", "devops", "ml-ai", "tools"];
const ago = (sec) => {
  if (!sec) return null;
  const d = Math.max(0, Math.round((Date.now() / 1000 - sec) / 86400));
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
const monthWord = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" });

export default function CompanyPage({ slug, base = "/companies", inApp = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [match, setMatch] = useState(null);   // D179: Your match — signed in (inside the shell) only
  const navigate = useNavigate();
  useEffect(() => {
    if (!inApp) return undefined;
    let live = true;
    setMatch(null);
    api(`/api/companies/${encodeURIComponent(slug)}/match`).then((m) => { if (live) setMatch(m); }).catch(() => {});
    return () => { live = false; };
  }, [slug, inApp]);
  useEffect(() => {
    let live = true;
    setData(null); setError(null);
    api(`/api/public/companies/${encodeURIComponent(slug)}`)
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setError(e?.status === 404 || /no_such_company/.test(String(e?.message)) ? "missing" : "failed"); });
    return () => { live = false; };
  }, [slug]);

  if (error === "missing") return <main className="co co--empty" data-company-missing=""><h1>We don't have a page for this company.</h1>
    <p><Link to={inApp ? "/app" : "/jobs"}>Browse open jobs</Link></p></main>;
  if (error) return <main className="co co--empty" role="alert"><p>This page couldn't load just now — try again in a moment.</p></main>;
  if (!data) return <main className="co co--empty" aria-busy="true"><p>Loading…</p></main>;

  const { company: c, openJobs, byCategory, hiringTrend, stack, sponsorship, locations, jobs, about, github, website } = data;
  const jobsHref = (cat) => `${inApp ? "/app/jobs" : "/jobs"}?q=${encodeURIComponent(c.name)}${cat ? `&category=${encodeURIComponent(cat)}` : ""}`;
  const trendMax = Math.max(1, ...hiringTrend.map((t) => t.postings));
  const groups = stack ? GROUP_ORDER.filter((g) => stack.groups?.[g]?.length) : [];

  return (
    <main className="co" data-company-page={c.slug}>
      {inApp && <button type="button" className="co__back" onClick={() => navigate(-1)} data-company-back="">‹ Back</button>}

      <header className="co__head">
        <div className="co__tile" aria-hidden="true">{(c.name || "?").slice(0, 1).toUpperCase()}</div>
        <div className="co__headtext">
          <h1 className="co__name">{c.name}</h1>
          <p className="co__facts">
            {[c.domain, openJobs ? `${openJobs.toLocaleString("en-US")} open job${openJobs === 1 ? "" : "s"}` : "no open jobs right now", c.ats && `hires through ${c.ats}`]
              .filter(Boolean).join(" · ")}
            {c.parent && <> · part of <Link to={`${base}/${c.parent.slug}`}>{c.parent.name}</Link></>}
          </p>
        </div>
        {inApp && match && (
          <button type="button" className="co__btn dbx-depth" aria-pressed={!!match.following} data-company-follow=""
            onClick={() => api(`/api/companies/${encodeURIComponent(slug)}/follow`, { method: "POST", body: JSON.stringify({ on: !match.following }) })
              .then((r) => setMatch((m) => ({ ...m, following: !!r.following }))).catch(() => {})}>
            {match.following ? "Following" : "Follow"}</button>
        )}
        {c.careersUrl && <a className="co__btn dbx-depth" href={c.careersUrl} target="_blank" rel="noopener noreferrer">Careers site</a>}
      </header>

      {about && (
        <section className="co__sec" data-company-about="">
          <h2>About</h2>
          <p>{about.line}</p>
          <p className="co__lead">From public facts: {about.sources.map((s, i) => <span key={s.url}>{i ? ", " : ""}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a></span>)}.</p>
        </section>
      )}

      {groups.length > 0 && (
        <section className="co__sec" data-company-stack="">
          <h2>Tech stack</h2>
          <p className="co__lead">From their own job postings — a technology shows once two or more postings in the last six months name it.</p>
          {groups.map((g) => (
            <div key={g} className="co__group">
              <h3>{GROUP_WORD[g] || g}</h3>
              <ul className="co__techs">
                {stack.groups[g].map((t) => (
                  <li key={t.tech} data-tech={t.tech}>
                    <b>{t.tech}</b>{t.newThisQuarter && <span className="co__new"> new this quarter</span>}
                    {t.atlasSlug && <Link className="co__learn" to={`${inApp ? "/app" : ""}/atlas/${t.atlasSlug}`} data-learn-tech={t.tech}>Learn it</Link>}
                    <span className="co__evidence">in {t.postings} of {t.of} postings · last seen {ago(t.lastSeen)}{t.teams?.length ? ` · ${t.teams.slice(0, 3).join(", ")}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {github && (
        <section className="co__sec" data-company-github="">
          <h2>On GitHub</h2>
          <p>{github.languages.map((l) => `${l.language} (${l.repos} repo${l.repos === 1 ? "" : "s"})`).join(" · ")}</p>
          <p className="co__lead">Their public repositories active in the last year — <a href={github.url} target="_blank" rel="noopener noreferrer">github.com/{github.org}</a>.</p>
        </section>
      )}

      {website && (
        <section className="co__sec" data-company-website="">
          <h2>From their website</h2>
          <p>{website.signals.join(" · ")}</p>
          <p className="co__lead">Light signals read from {c.domain}'s own homepage — what the site runs on, not necessarily the product team's stack.</p>
        </section>
      )}

      {match && match.of > 0 && (
        <section className="co__sec" data-company-match="">
          <h2>Your match</h2>
          <p>You've proven <b>{match.proven.length}</b> of their top {match.of}{match.proven.length ? `: ${match.proven.join(", ")}` : ""}.
            {match.listed.length > 0 && <> Listed but not yet proven: {match.listed.join(", ")}.</>}</p>
          {match.missing.length > 0 && (
            <p className="co__lead">Not on your skills yet: {match.missing.map((m, i) => <span key={m.tech}>{i ? ", " : ""}{m.atlasSlug
              ? <Link to={`/app/atlas/${m.atlasSlug}`}>{m.tech}</Link> : m.tech}</span>)} — <Link to="/app/atlas/your-skills">check and prove your skills</Link>.</p>
          )}
        </section>
      )}

      {byCategory.length > 0 && (
        <section className="co__sec" data-company-roles="">
          <h2>Open jobs by role</h2>
          <ul className="co__roles">
            {byCategory.map((cat) => (
              <li key={cat.id || "other"}>
                <Link to={jobsHref(cat.id)}><b>{cat.name}</b> <span className="co__count">{cat.count}</span></Link>
                {cat.subcategories.length > 0 && (
                  <span className="co__subs">{cat.subcategories.filter((s) => !/\.general$/.test(s.id)).slice(0, 6).map((s) => `${s.name} ${s.count}`).join(" · ")}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hiringTrend.length > 1 && (
        <section className="co__sec" data-company-trend="">
          <h2>Hiring over the last six months</h2>
          <div className="co__bars" role="img" aria-label={hiringTrend.map((t) => `${monthWord(t.month)} ${t.postings}`).join(", ")}>
            {hiringTrend.map((t) => (
              <div key={t.month} className="co__bar">
                <span className="co__barfill" style={{ height: `${Math.max(4, Math.round((t.postings / trendMax) * 100))}%` }} />
                <span className="co__barn">{t.postings}</span>
                <span className="co__barm">{monthWord(t.month)}</span>
              </div>
            ))}
          </div>
          <p className="co__lead">New postings we found each month.</p>
        </section>
      )}

      {sponsorship && (
        <section className="co__sec" data-company-sponsorship="">
          <h2>Visa sponsorship history</h2>
          <p>{sponsorship.text}.</p>
          <p className="co__lead">{sponsorship.note}{sponsorship.source?.url ? <> Source: <a href={sponsorship.source.url} target="_blank" rel="noopener noreferrer">{sponsorship.source.name}</a>{sponsorship.source.through ? `, through ${sponsorship.source.through}` : ""}.</> : sponsorship.source?.name ? ` Source: ${sponsorship.source.name}.` : ""}</p>
        </section>
      )}

      {locations.length > 0 && (
        <section className="co__sec" data-company-locations="">
          <h2>Where they're hiring</h2>
          <p>{locations.map((l) => `${l.location} (${l.count})`).join(" · ")}</p>
        </section>
      )}

      {jobs.length > 0 && (
        <section className="co__sec" data-company-jobs="">
          <h2>Newest open jobs</h2>
          <ul className="co__jobs">
            {jobs.map((j) => (
              <li key={j.id}><a href={j.path}>{j.title}</a>{j.location ? <span className="co__where"> · {j.location}</span> : null}</li>
            ))}
          </ul>
          {openJobs > jobs.length && <p><Link to={jobsHref(null)}>All {openJobs.toLocaleString("en-US")} open jobs</Link></p>}
        </section>
      )}

      <footer className="co__foot">
        Something wrong here, or should this page come down? <Link to={`/contact?topic=company&company=${encodeURIComponent(c.slug)}`}>Request a correction or removal</Link> — we act on it within a day.
      </footer>
    </main>
  );
}
