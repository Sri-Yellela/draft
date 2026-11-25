// ⭐ D197 Wave 1 #4 (47h) · THE SURVEY SHEET — the company page in plates, to the approved `Survey` board
// (docs/sketches/final/project/Survey.dc.html): the title block + the team plate, 01 What they build with (the stack legend,
// LIVE from stackFor + your marks), 02 hiring (the elevation profile + the company's line of roles + the newest openings),
// 03 sponsorship (sponsorshipFactFor, "not a promise"), 04 your match (the dial + the interchanges to Atlas), 05 tickets out.
// pages/companies/CompanyPage.jsx keeps the reads and the state; this file draws. The M1 inventory, row by row, is
// docs/revamp/survey.md — every row of today's page has its place here (D200 Rule 1), and every mark answers (Rule 2):
// a stats cell is a link, a stop on the line is a link, NEW THIS QUARTER says when, the stamp opens its source.
import { Link, useNavigate } from "react-router-dom";
import PlateRoot from "./PlateRoot.jsx";
import { Breadcrumb, Kickers, Legend, LetterTile } from "./Marks.jsx";
import { LegHeader, StatsStrip, CalloutTag } from "./Plates.jsx";
import { Ticket } from "./Tickets.jsx";
import { Gazetteer } from "./Lists.jsx";
import { NoData } from "./PlateState.jsx";
import { TeamPlate, HiringProfile, RoleLine, MatchDial } from "./surveyDrawings.jsx";
import { surveyView, teamsWord, andList, numWord, shortName } from "./surveySheet.js";
import { sectorRegion } from "./marketPlate.js";
import { ApplyLink } from "../components/CompanyLink.jsx";
import { getKnownLogoUrl } from "../../../shared/companyLogos.js";
import "./sheets.css";

const dateWord = (sec) => (sec ? new Date(sec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null);
const ago = (sec) => {
  if (!sec) return null;
  const d = Math.max(0, Math.round((Date.now() / 1000 - sec) / 86400));
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

/** An interchange's line: "In 4 of their postings — the Checkout team uses it, new this quarter." */
function learnLine(r) {
  const who = r.teams.length > 3 ? "most of their teams use it" : r.teams.length ? `the ${andList(r.teams)} team${r.teams.length > 1 ? "s use" : " uses"} it` : "";
  return `In ${r.postings} of their postings${r.isNew ? ", new this quarter" : ""}${who ? ` — ${who}` : ""}.`;
}

/**
 * `data` = GET /api/public/companies/:slug · `match` = GET /api/companies/:slug/match (null signed out) · `inApp` = inside the
 * shell · `resumeName` = the résumé the match reads (the kicker's "FROM …") · `people` = who works here (network on) ·
 * `onBack`, `onFollow`, `onSend(job)` = the page's own handlers · `applyOpen` = ApplyLink's onOpen (signed out: no Pending).
 * `worksHere` = the page's WorksHere element (its own component, kept whole); `sendPicker` = SendJobPicker when open.
 */
export default function SurveySheet({ data, match = null, inApp = false, base = "/companies", resumeName = null, people = null,
  onBack, onFollow, onSend, networkOn = false, applyOpen, worksHere = null, sendPicker = null }) {
  const v = surveyView(data, match);
  const c = v.company;
  const short = shortName(c.name);   // the name as the prose says it ("Kestrel")
  const app = inApp ? "/app" : "";
  const jobsBase = inApp ? "/app/jobs" : "/jobs";
  const jobsHref = (cat) => `${jobsBase}?q=${encodeURIComponent(c.name)}${cat ? `&category=${encodeURIComponent(cat)}` : ""}`;
  const region = sectorRegion(v.sector);
  const navigate = useNavigate();
  // in the shell a ticket moves within the app (a modified click still opens a tab); outside it a plain link
  const go = (href) => (e) => { if (!href || /^(https?:|#)/.test(href) || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); navigate(href); };
  const source = v.about?.sources?.[0] || null;
  const stats = v.stats.map((s) => ({ ...s,
    ...(s.key === "open" ? { href: jobsHref(null), aria: `${s.value} open roles — see them on the market` }
      : s.key === "h1b" ? { href: "#sponsor", aria: "Their H-1B filings — the section below" }
      : source ? { href: source.url, aria: `${s.label.toLowerCase()} — from ${source.name}` } : {}) }));
  const crumbs = [
    { label: "MKT", href: jobsBase },
    ...(v.sector ? [{ label: v.sector.toUpperCase().replace(/ENGINEERING$/, "ENG."), href: jobsHref(v.sectorId), region }] : []),
    { label: c.name.toUpperCase() },
  ];
  const kickers = ["SURVEY SHEET", v.facts.industry, v.facts.hq, c.ats && `HIRES THROUGH ${c.ats}`].filter(Boolean).map((k) => String(k).toUpperCase());
  const plate = v.plate;
  const lede = v.about?.line || null;
  const focus = v.focus;
  const newestJob = focus || v.jobs[0] || null;
  const line = v.line;
  const yours = line.find((s) => s.yours) || null;
  const lead = line.length ? (yours || line[0]) : null;

  return (
    <PlateRoot className="pl-sheetpage" region={region} data-plate-page="survey" data-company-page={c.slug}>
      {/* ── the title block + the team plate ── */}
      <section className="pl-sv-hero" aria-labelledby="sv-title">
        <div className="pl-sv-crumbs">
          <Breadcrumb crumbs={crumbs}/>
          {inApp && onBack ? <button type="button" className="pl-crumb pl-sv-back" onClick={onBack} data-company-back="">‹ BACK</button> : null}
        </div>
        <div className="pl-sv-herorow">
          <div className="pl-hero__main">
            <Kickers parts={kickers}/>
            {c.parent ? <span className="pl-sv-parent">Part of <Link to={`${base}/${c.parent.slug}`}>{c.parent.name}</Link></span> : null}
            <div className="pl-sv-name">
              <span className="pl-sv-tile"><LetterTile name={c.name} logo={getKnownLogoUrl(c.name)} region={region}/></span>
              <h1 id="sv-title" className="pl-title pl-sv-title">{c.name}<span className="pl-title__stop">.</span></h1>
            </div>
            {lede ? <p className="pl-lead pl-sv-lede" data-company-about="">{lede}</p> : null}
            <span className="pl-sv-source">Written by draft from public facts
              {c.domain ? <> · <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer">{c.domain}</a></> : null}
              {source ? <> · <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name.replace(/ \(CC0\)$/, "")}</a></> : null}
              {" · "}<Link to={`/contact?topic=company&company=${encodeURIComponent(c.slug)}`}>Suggest a correction</Link></span>
            <StatsStrip label={`${c.name} at a glance`} cells={stats}/>
            <div className="pl-actions">
              {inApp && match ? <button type="button" className="pl-btn pl-btn--ink pl-sv-follow" aria-pressed={!!match.following} data-company-follow="" onClick={onFollow}>
                {match.following ? "Following" : "Follow"}</button> : null}
              {c.careersUrl ? <a className="pl-btn pl-btn--secondary" href={c.careersUrl} target="_blank" rel="noopener noreferrer">Careers site ↗</a> : null}
            </div>
          </div>
          <figure className="pl-platehero pl-platehero--sheet">
            <div className="pl-platehero__frame" style={{ "--pl-aspect": "640 / 460" }}>
              <TeamPlate teams={plate.teams} beacon={plate.beacon} hq={v.facts.hq || ""}
                label={plate.teams.length ? `${c.name} drawn as an isometric plate of its ${numWord(plate.teams.length)} most-named teams: ${andList(plate.teams)}.${plate.yours ? ` A beacon marks ${plate.yours.team}, the team of the job you opened.` : ""}`
                  : `${c.name}'s plate — their postings name no teams yet`}/>
            </div>
            {plate.yours ? <CalloutTag kind="here" kicker="YOU’D JOIN HERE" line={`${plate.yours.team} team`} sub={plate.yours.job.title} x={52} y={4} index={0}/> : null}
            {plate.largest ? <CalloutTag kicker="LARGEST TEAM" line={plate.largest.team} sub={plate.largest.techs.join(", ")} x={2} y={62} index={1}/> : null}
            <figcaption className="pl-platehero__cap pl-platehero__cap--box">
              <span className="pl-label">PLATE · {c.name.toUpperCase()}, BY TEAM</span>
              <span className="pl-label pl-muted">FROM THEIR {v.stackPostings} POSTINGS</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── 01 · the stack legend (live: stackFor + your marks) ── */}
      <section className="pl-section" data-company-stack="">
        <LegHeader n={1} id="stack" meta={`THEIR STACK · FROM ${v.legend.of} POSTINGS, LAST 180 DAYS · 2+ POSTINGS TO SHOW`} title="What they build with"/>
        <p className="pl-lead pl-lead--body">Read from {short}’s own postings{v.github ? " and public GitHub" : ""}. Each bar is how many of their postings ask for it; the square says whether it’s on your résumé.</p>
        <div className="pl-sv-block">
          <Legend label={`${c.name}'s technologies`} keyText={match ? "■ ON YOUR RÉSUMÉ · ⬚ NOT YET" : "◌ SIGN IN TO SEE YOURS"}
            columns={v.legend.columns.map((col) => ({ label: col.label, rows: col.rows.map((r) => ({
              name: r.tech, n: r.postings, of: r.of, pct: r.pct, teams: teamsWord(r.teams),
              mark: r.mark == null ? null : r.mark === "not" ? "not" : "yours", isNew: r.isNew,
              newNote: r.firstSeen ? `First named in their postings on ${dateWord(r.firstSeen)}.` : null,
              seen: r.lastSeen ? `last seen ${ago(r.lastSeen)}` : null, href: r.atlasSlug ? `${app}/atlas/${r.atlasSlug}` : null,
              attrs: { "data-tech": r.tech, ...(r.mark && r.mark !== "not" ? { "data-mine": r.mark } : {}) } })) }))}
            nameLink={(r) => <Link to={r.href} data-learn-tech={r.name}>{r.name}</Link>}
            foot={<>
              {v.github ? (
                <div className="pl-legend__foot" data-company-github="">
                  <a className="pl-label pl-sv-footlabel" href={v.github.url} target="_blank" rel="noopener noreferrer" aria-label={`Public GitHub: github.com/${v.github.org}`}>PUBLIC GITHUB</a>
                  <span className="pl-legend__share" aria-hidden="true">{v.github.top.map((l) => <span key={l.language} style={{ width: `${l.pct}%` }}/>)}<span/></span>
                  <span className="pl-legend__foottext">{v.github.top.map((l) => `${l.language} ${l.pct}%`).join(" · ")}</span>
                </div>
              ) : null}
              {v.website ? (
                <div className="pl-legend__foot" data-company-website="">
                  <span className="pl-label">THEIR WEBSITE</span>
                  <span className="pl-legend__foottext">{v.website.signals.join(" · ")} <span className="pl-muted">— what {c.domain} runs on, not necessarily the product team’s stack</span></span>
                </div>
              ) : null}
            </>}/>
        </div>
      </section>

      {/* ── 02 · hiring: the elevation profile, the line of roles, the newest openings ── */}
      <section className="pl-section" data-company-trend="">
        <LegHeader n={2} id="hiring" meta="HIRING · FROM DRAFT’S OWN CRAWL" title={v.hiring ? v.hiring.title : "Hiring, as we’ve seen it"}/>
        <p className="pl-lead pl-lead--body">New postings each month, and where the open roles sit today.{yours ? ` Your stop on the line is ${yours.name}.` : ""}</p>
        <div className="pl-sv-figs">
          <figure className="pl-sv-fig pl-sv-fig--profile">
            {v.hiring ? <HiringProfile profile={v.hiring}/> : <div className="pl-sv-none"><NoData>FEWER THAN TWO MONTHS OF POSTINGS SEEN</NoData></div>}
            <figcaption className="pl-sv-figcap">
              <span className="pl-label">ELEVATION PROFILE · NEW POSTINGS BY MONTH</span>
              {v.hiring?.change != null ? <span className="pl-label" data-tone={v.hiring.change >= 0 ? "lit" : "clay"}>{`${v.hiring.change >= 0 ? "+" : ""}${v.hiring.change}% SINCE ${v.hiring.first.monthWord.toUpperCase()}`}</span> : null}
            </figcaption>
          </figure>
          <figure className="pl-sv-fig pl-sv-fig--line" data-company-roles="">
            <div className="pl-sv-figstrip"><span className="pl-label">THE {c.name.toUpperCase()} LINE · {v.openJobs} OPEN, BY ROLE</span></div>
            <div className="pl-sv-linescroll">
              {line.length ? <RoleLine stops={line} company={c.name} href={(s) => jobsHref(s.category)}/> : <div className="pl-sv-none"><NoData>NO OPEN ROLES RIGHT NOW</NoData></div>}
            </div>
            {lead ? (
              <div className="pl-sv-linefoot">
                <span className="pl-sv-linesay">{lead.n} open in {lead.name}, {lead.yours ? "the job you opened among them." : "the most of any role."}</span>
                <Link className="pl-sv-go" to={jobsHref(lead.category)}>See them on the market →</Link>
              </div>
            ) : null}
          </figure>
        </div>
        {v.jobs.length ? (
          <div className="pl-sv-jobs" data-company-jobs="">
            <span className="pl-label pl-muted">THE NEWEST OPEN ROLES · {Math.min(v.jobs.length, 20)} OF {v.openJobs}</span>
            <Gazetteer label={`${c.name}'s newest open roles`} rows={v.jobs.filter((j) => !focus || j.jobId !== focus.jobId).map((j) => ({ ...j, id: j.id }))}
              cols={[
                { key: "title", label: "OPENING", render: (j) => <a href={j.path} style={{ color: "var(--pl-ink)", fontWeight: 700 }}>{j.title}</a> },
                { key: "location", label: "WHERE" },
                { key: "act", label: "", render: (j) => <span className="pl-sv-acts">
                  {j.applyUrl ? <ApplyLink href={j.applyUrl} jobId={j.jobId} company={c.name} className="pl-btn pl-sv-apply" onOpen={applyOpen}>Apply ↗</ApplyLink> : null}
                  {networkOn ? <button type="button" className="pl-btn" data-company-send="" onClick={() => onSend?.({ title: j.title, publicPath: j.path })}>Send</button> : null}
                </span> },
              ]}/>
            {sendPicker}
            <p className="pl-sv-more">
              {v.locations.length ? <span data-company-locations=""><span className="pl-label pl-muted">WHERE THEY’RE HIRING</span> {v.locations.map((l) => `${l.location} (${l.count})`).join(" · ")}</span> : null}
              {v.openJobs > v.jobs.length ? <Link className="pl-sv-go" to={jobsHref(null)}>All {v.openJobs.toLocaleString("en-US")} open jobs →</Link> : null}
            </p>
          </div>
        ) : null}
      </section>

      {/* ── 03 · visa sponsorship (the DOL's disclosure data; never a promise) ── */}
      <section className="pl-section" data-company-sponsorship="">
        <LegHeader n={3} id="sponsor" meta="VISA SPONSORSHIP · U.S. DEPARTMENT OF LABOR DISCLOSURE DATA"
          title={v.sponsorship?.filed ? "They have sponsored before" : "No filings found"}/>
        <p className="pl-lead pl-lead--body">{v.sponsorship
          ? `What ${short} filed in FY${v.sponsorship.year}. Past filings show what an employer has done, not a promise to sponsor you.`
          : `We found no H-1B filings for ${c.name} in the Department of Labor’s disclosure data. That isn’t a no — only that nothing is on record.`}</p>
        {v.sponsorship ? (
          <div className="pl-sv-sponsor">
            <StatsStrip label={`${c.name}'s filings in FY${v.sponsorship.year}`} cells={v.sponsorship.cells}/>
            <div className="pl-sv-spsource">
              <span className="pl-label pl-muted">THE SOURCE</span>
              <span className="pl-sv-sptext">{v.sponsorship.source?.url
                ? <a href={v.sponsorship.source.url} target="_blank" rel="noopener noreferrer">{v.sponsorship.source.name}</a> : v.sponsorship.source?.name}
                {v.sponsorship.source?.through ? `, through ${v.sponsorship.source.through}` : ""}
                {v.sponsorship.uscisSource ? <> · <a href={v.sponsorship.uscisSource.url} target="_blank" rel="noopener noreferrer">{v.sponsorship.uscisSource.name}</a></> : null}.</span>
            </div>
            {v.sponsorship.filed ? (
              <a className="pl-sv-stamp at-stamp" href={v.sponsorship.source?.url || "#sponsor"} target={v.sponsorship.source?.url ? "_blank" : undefined} rel="noopener noreferrer"
                aria-label={`Sponsored in FY${v.sponsorship.year} — open the source`}>SPONSORED · {v.sponsorship.fy}</a>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* ── 04 · your match ── */}
      <section className="pl-section" data-company-match="">
        <LegHeader n={4} id="match" meta={`YOUR MATCH${resumeName ? ` · FROM ${String(resumeName).toUpperCase()}` : ""}`}
          title={v.match ? v.match.title : inApp ? "Your match, once they have a stack" : "Your match"}/>
        <p className="pl-lead pl-lead--body">{v.match ? `How much of what ${short} works with you’ve already used, and the shortest way to the rest.`
          : inApp ? "They need two postings naming a technology before it counts; nothing to compare yet." : "Sign in and draft compares their stack with your résumé."}</p>
        <div className="pl-sv-matchrow">
          {(() => { const Dial = v.match && inApp ? Link : "div"; return (
          <Dial className="pl-sv-dial" {...(Dial === Link ? { to: "/app/atlas/your-skills", "aria-label": "Your match — check and prove your skills in Atlas", "data-company-check-skills": "" } : {})}>
            {v.match ? <>
              <MatchDial have={v.match.have} of={v.match.of}/>
              <div className="pl-sv-dialtext">
                <span className="pl-sv-dialnum">{v.match.have} of {v.match.of}</span>
                <span className="pl-label">OF THEIR TOP TECHNOLOGIES</span>
                <span className="pl-sv-dialsay">{v.match.names.length ? `${andList(v.match.names)} ${v.match.names.length === 1 ? "is" : "are"} on your résumé.` : "None of them is on your résumé yet."}</span>
              </div>
            </> : <div className="pl-sv-dialtext">{inApp ? <NoData>NOTHING TO COMPARE YET</NoData> : <Link className="pl-sv-go" to="/login">Sign in to see your match →</Link>}</div>}
          </Dial>); })()}
          {(v.match?.learn || []).map((m) => (
            <Ticket key={m.tech} href={`${app}/atlas/${m.atlasSlug}`} onClick={go(`${app}/atlas/${m.atlasSlug}`)} kicker="⇄ INTERCHANGE · ATLAS" title={m.tech}
              line={m.row ? learnLine(m.row) : "Not on your résumé yet."} go="Learn it →"/>
          ))}
        </div>
      </section>

      {/* ── 05 · tickets out ── */}
      <section className="pl-section pl-section--last" aria-labelledby="sv-onward">
        <LegHeader n={5} meta="ONWARD · FROM THIS SURVEY SHEET" title={<span id="sv-onward">Tickets out</span>}/>
        <p className="pl-lead pl-lead--body">Where this page leads next.</p>
        <div className="pl-tickets">
          {newestJob ? (
            <Ticket tone="clay-tint" href={newestJob.path} onClick={go(newestJob.path)} kicker={focus ? "THE JOB YOU OPENED" : "NEWEST OPENING HERE"} title={newestJob.title}
              line={[newestJob.postedAt ? `Posted ${ago(Math.floor(Date.parse(newestJob.postedAt) / 1000)) || ""}`.trim() : null, newestJob.location].filter(Boolean).join(" · ") || null}
              go={inApp ? "Open it →" : "See the posting →"}/>
          ) : null}
          {people?.count ? (
            <Ticket href="#works-here" kicker={`NETWORK · ${people.count} CONNECTION${people.count === 1 ? "" : "S"} HERE`}
              title={`Ask ${String(people.people?.[0]?.name || "them").split(" ")[0]} for a referral`} line={people.people?.[0]?.title || null} go="Write the ask →"
              onClick={(e) => { e.preventDefault(); document.querySelector("[data-ask-referral]")?.click(); document.getElementById("works-here")?.scrollIntoView({ block: "center" }); }}/>
          ) : (
            <Ticket href={jobsHref(null)} onClick={go(jobsHref(null))} kicker={`THE MARKET · ${v.openJobs} OPEN HERE`} title={`Every ${c.name} opening`} line="On the market, with your fit on each." go="See them all →"/>
          )}
          <Ticket href={`/contact?topic=company&company=${encodeURIComponent(c.slug)}`} onClick={go(`/contact?topic=company&company=${encodeURIComponent(c.slug)}`)} kicker="IS THIS YOUR COMPANY?" title="Correct or remove this sheet" line="Handled within a day." go="Request a change →"/>
        </div>
        {newestJob?.applyUrl ? (
          <p className="pl-sv-more pl-sv-applyline" data-company-focus={focus ? focus.jobId : undefined}>
            <span>{focus ? "The job you opened" : "The newest opening"} applies on {c.name}’s own site.</span>
            <ApplyLink href={newestJob.applyUrl} jobId={newestJob.jobId} company={c.name} size="panel" className="pl-btn pl-sv-apply" onOpen={applyOpen}>Apply at {c.name} ↗</ApplyLink>
          </p>
        ) : null}
        {worksHere ? <div id="works-here" className="pl-sv-workshere">{worksHere}</div> : null}
      </section>
    </PlateRoot>
  );
}
