// ⭐ D179 P4b (45l) · A PAGE FOR EVERY COMPANY — the sketch's FIRST version (owner 11-07: "use the first version for
// companies page"), opened inside the shell for a signed-in reader (/app/companies/<slug>, the dock stays; Back returns
// to where they were) and public at /companies/<slug> (the marketing nav above it). One read: GET
// /api/public/companies/:slug (services/companies/publicCompany.js). Sections, in the sketch's order, each drawn only when
// there is something to say: the header (name, site, the ATS, Careers site) · Tech stack with its evidence · open jobs by
// role · hiring trend · visa sponsorship history · locations · the newest open jobs · corrections.
// ⛔ D182: no label restates what the row already says; no taxonomy chips. ⛔ D60: no pills. Colours from tokens only.
// ⭐ A149 (45o — the probe's company-page gaps against the sketch's FIRST version): the logo (CompanyLogo, D61), industry ·
// HQ in the header (About's facts), proven / on-your-résumé marks on the stack (signed in, from Your match), and "What they
// ask for most" (their most-posted technologies with the share of postings and the Atlas page to learn each).
import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ApplyLink } from "../../components/CompanyLink.jsx";   // A157: the employer's apply link lives here now
import { api } from "../../lib/api.js";
import CompanyLogo from "../../components/CompanyLogo.jsx";   // A149: the company's own mark (D61)
import SendJobPicker from "../../components/SendJobPicker.jsx";
import WorksHere from "../../components/WorksHere.jsx";   // D180 P4 (45s: shared)   // (11) 45q: D180's Send on the open jobs
import "./CompanyPage.css";
// ⭐ D197 Wave 1 #4 (47h): the survey sheet — this page in plates, to the approved `Survey` board (plate/SurveySheet.jsx draws;
// the reads and the state stay here). On with the plate market (one switch, `?plate=0` keeps this classic page).
import SurveySheet from "../../plate/SurveySheet.jsx";
import { useMarketPlate } from "../../plate/marketPlate.js";

// ⭐ D180 P4: "1 connection works here" → Ask for a referral is components/WorksHere.jsx (45s: one component for the company
// page, the posting panel and the deck).
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
  // ⭐ A157 (45q): the posting the reader came from (?job=<board job id>) — first, with its Apply link.
  const { search } = useLocation();
  const cameFrom = new URLSearchParams(search).get("job") || null;
  // ⭐ (11) 45q · Send a job from the company page — inside the shell (signed in) and only while the network is on.
  const [networkOn, setNetworkOn] = useState(false);   // (also D180 P4's "works here", 45r)
  const [sending, setSending] = useState(null);
  const plate = useMarketPlate();
  const [people, setPeople] = useState(null);       // 47h: who works here, for the sheet's referral ticket (network on)
  const [resumeName, setResumeName] = useState(null);   // 47h: the résumé Your match reads ("FROM MAYA_CHEN.PDF")
  useEffect(() => {
    if (!inApp || !plate) return undefined;
    let live = true;
    api("/api/base-resume").then((r) => { if (live && r?.name) setResumeName(r.name); }).catch(() => {});
    return () => { live = false; };
  }, [inApp, plate]);
  useEffect(() => {
    if (!inApp) return undefined;
    let live = true;
    api("/api/network/status").then(r => live && setNetworkOn(!!r?.enabled)).catch(() => {});
    return () => { live = false; };
  }, [inApp]);
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
    api(`/api/public/companies/${encodeURIComponent(slug)}${cameFrom ? `?job=${encodeURIComponent(cameFrom)}` : ""}`)
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setError(e?.status === 404 || /no_such_company/.test(String(e?.message)) ? "missing" : "failed"); });
    return () => { live = false; };
  }, [slug, cameFrom]);

  const coName = data?.company?.name || null;
  useEffect(() => {
    setPeople(null);
    if (!plate || !networkOn || !coName) return undefined;
    let live = true;
    api(`/api/network/at-company?name=${encodeURIComponent(coName)}`).then((r) => { if (live) setPeople(r); }).catch(() => {});
    return () => { live = false; };
  }, [plate, networkOn, coName]);

  if (error === "missing") return <main className="co co--empty" data-company-missing=""><h1>We don't have a page for this company.</h1>
    <p><Link to={inApp ? "/app" : "/jobs"}>Browse open jobs</Link></p></main>;
  if (error) return <main className="co co--empty" role="alert"><p>This page couldn't load just now — try again in a moment.</p></main>;
  if (!data) return <main className="co co--empty" aria-busy="true"><p>Loading…</p></main>;

  const { company: c, openJobs, byCategory, hiringTrend, stack, sponsorship, locations, jobs, about, github, website, focus } = data;
  // Signed out there is no Pending list to tag — the link just opens the employer's posting.
  const applyOpen = inApp ? undefined : () => {};
  const jobsHref = (cat) => `${inApp ? "/app/jobs" : "/jobs"}?q=${encodeURIComponent(c.name)}${cat ? `&category=${encodeURIComponent(cat)}` : ""}`;
  const trendMax = Math.max(1, ...hiringTrend.map((t) => t.postings));
  const groups = stack ? GROUP_ORDER.filter((g) => stack.groups?.[g]?.length) : [];
  // A149: signed in, each technology says whether YOU have it — proven (checked / built) or only on your résumé.
  const markOf = (tech) => !match ? null : match.proven?.includes(tech) ? { kind: "proven", word: "you've proven it" }
    : match.listed?.includes(tech) ? { kind: "listed", word: "on your résumé" } : null;
  // A149: "What they ask for most" — the most-posted technologies across every group, with their share of the postings.
  const asked = stack ? Object.values(stack.groups || {}).flat().sort((a, b) => b.postings - a.postings).slice(0, 6) : [];

  const follow = () => api(`/api/companies/${encodeURIComponent(slug)}/follow`, { method: "POST", body: JSON.stringify({ on: !match?.following }) })
    .then((r) => setMatch((m) => ({ ...m, following: !!r.following }))).catch(() => {});
  if (plate) return (
    <SurveySheet data={data} match={match} inApp={inApp} base={base} resumeName={resumeName} people={people} networkOn={networkOn}
      onBack={inApp ? () => navigate(-1) : undefined} onFollow={follow} onSend={setSending} applyOpen={applyOpen}
      worksHere={networkOn ? <WorksHere company={c.name} job={focus || null} enabled /> : null}
      sendPicker={sending ? <SendJobPicker job={sending} onClose={() => setSending(null)} /> : null} />
  );

  return (
    <main className="co" data-company-page={c.slug}>
      {inApp && <button type="button" className="co__back" onClick={() => navigate(-1)} data-company-back="">‹ Back</button>}

      <header className="co__head">
        <div className="co__logo" aria-hidden="true"><CompanyLogo company={c.name} size={56} radius={12} /></div>
        <div className="co__headtext">
          <h1 className="co__name">{c.name}</h1>
          <p className="co__facts">
            {[about?.facts?.industry, about?.facts?.hq, c.domain, openJobs ? `${openJobs.toLocaleString("en-US")} open job${openJobs === 1 ? "" : "s"}` : "no open jobs right now", c.ats && `hires through ${c.ats}`]
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
                    {markOf(t.tech) && <span className={`co__mine co__mine--${markOf(t.tech).kind}`} data-mine={markOf(t.tech).kind}>{markOf(t.tech).word}</span>}
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

      {asked.length > 0 && (
        <section className="co__sec" data-company-asked="">
          <h2>What they ask for most</h2>
          <ul className="co__techs">
            {asked.map((t) => (
              <li key={t.tech}><b>{t.tech}</b>
                <span className="co__evidence">{Math.round((100 * t.postings) / Math.max(1, t.of))}% of their postings</span>
                {t.atlasSlug && <Link className="co__learn" to={`${inApp ? "/app" : ""}/atlas/${t.atlasSlug}`}>Learn it in Atlas</Link>}
              </li>
            ))}
          </ul>
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
          {focus && (
            <div className="co__focus" data-company-focus={focus.jobId}>
              <p className="co__focus-k">The job you opened</p>
              <p><a href={focus.path}>{focus.title}</a>{focus.location ? <span className="co__where"> · {focus.location}</span> : null}</p>
              {focus.applyUrl && <ApplyLink href={focus.applyUrl} jobId={focus.jobId} company={c.name} size="panel" className="co__apply" onOpen={applyOpen}>Apply at {c.name} ↗</ApplyLink>}
            </div>
          )}
          {networkOn && <WorksHere company={c.name} job={focus || null} enabled />}
          <h2>Newest open jobs</h2>
          <ul className="co__jobs">
            {jobs.filter((j) => !focus || j.jobId !== focus.jobId).map((j) => (
              <li key={j.id}><a href={j.path}>{j.title}</a>{j.location ? <span className="co__where"> · {j.location}</span> : null}
                {/* ⭐ A157: the employer's own apply link, beside each job (it tags Pending when signed in). */}
                {j.applyUrl && <> <ApplyLink href={j.applyUrl} jobId={j.jobId} company={c.name} className="co__apply-row" onOpen={applyOpen}>Apply ↗</ApplyLink></>}
                {/* ⭐ (11) 45q · D180 Send, only while the network is on and someone is signed in. */}
                {networkOn && <button type="button" className="co__send" data-company-send="" onClick={() => setSending({ title: j.title, publicPath: j.path })}>Send</button>}
              </li>
            ))}
          </ul>
          {sending && <SendJobPicker job={sending} onClose={() => setSending(null)} />}
          {openJobs > jobs.length && <p><Link to={jobsHref(null)}>All {openJobs.toLocaleString("en-US")} open jobs</Link></p>}
        </section>
      )}

      <footer className="co__foot">
        Something wrong here, or should this page come down? <Link to={`/contact?topic=company&company=${encodeURIComponent(c.slug)}`}>Request a correction or removal</Link> — we act on it within a day.
      </footer>
    </main>
  );
}
