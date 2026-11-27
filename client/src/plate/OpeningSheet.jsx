// ⭐ D199 C7 (owner 11-25, board `Opening` on the final canvas) · THE OPENING SHEET — one posting opened becomes a sheet in
// the survey sheet's language, at its own address /app/jobs/<id> (App.jsx), drawn OVER the market: the market stays mounted
// underneath, so Back (the browser's, Esc, "← Back to the market") returns to the same card, page and scroll.
// Owner: "a redesign is also missing to expanded job cards too, we did a good job with company pages and this has the same
// potential". The sheet, top to bottom:
//   the breadcrumb (MKT / the role / the company / this opening) + ← Back to the market ·
//   the header: the kicker row (OPENING SHEET · posted · live-checked), the logo / letter tile + the company (→ its survey
//   sheet) + the place, the serif title, the glance strip (pay · type · level · stack you have), the FILED H-1B stamp when
//   the employer files; the hero plate (the company's teams, this opening's beaconed — plate/TeamDiorama.jsx) + the match dial ·
//   01 The role in plain words (the posting's own duty lines; its requirements split must / nice) ·
//   02 How you fit = plate/FitCard.jsx (D202 — the same component as beside the deck) ·
//   03 Their stack (the company's technographics from its own postings, with your marks) ·
//   04 The full posting (its own sections as headed blocks — shared/postingFormat.js, nothing cut, nothing reordered) ·
//   05 Sponsorship and the company (the DOL facts, "not a promise", the survey sheet's ticket) ·
//   the sticky action bar: Pass · Save · Send · Draft this job — MarketCardFace's TicketActions (A93), wired to the board's
//   own decide (lib/assistantBridge.js "boardDecide" — the same call the board's buttons make, D200 Rule 1).
// ⛔ D190: no model — "plain words" are the posting's own lines (the scorer's duty phrases), never a paraphrase.
// ⛔ R2: nothing invented — no pay → "Not posted", no filings → no stamp, no stack → it says so, a team we can't name → blank.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PlateRoot from "./PlateRoot.jsx";
import { LegHeader } from "./Plates.jsx";
import { Breadcrumb, LetterTile, Stamp } from "./Marks.jsx";
import { Ticket } from "./Tickets.jsx";
import FitCard, { fitCardFor } from "./FitCard.jsx";
import TeamDiorama from "./TeamDiorama.jsx";
import { TicketActions, openingFromCard } from "./MarketCardFace.jsx";
import { sectorRegion } from "./marketPlate.js";
import { api } from "../lib/api.js";
import { companyPath } from "../lib/companySlug.js";
import { assistantAction } from "../lib/assistantBridge.js";
import SendJobPicker from "../components/SendJobPicker.jsx";
import { formatPosting } from "../../../shared/postingFormat.js";
import { reportAsks } from "../../../shared/atsReportModel.js";   // the asks as the one report model reads them (T9)
import { postingClick } from "../lib/openPosting.js";

export const OPENING_ROUTE = /^jobs\/([^/?#]+)$/;   // App.jsx: /app/jobs/<id> (the board's ?page= / ?job= stay on /app/jobs)
/** The sheet's address for one opening (the board's job id). */
export const openingSheetHref = (jobId) => (jobId ? `/app/jobs/${encodeURIComponent(jobId)}` : null);

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
  "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
/** 91 → "Ninety-one" (the board's section-02 title). */
export function numberWords(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 0 || v > 100) return null;
  const w = v === 100 ? "one hundred" : v < 20 ? ONES[v] : `${TENS[Math.floor(v / 10)]}${v % 10 ? `-${ONES[v % 10]}` : ""}`;
  return w.charAt(0).toUpperCase() + w.slice(1);
}
/** "Kestrel Payments" → "Kestrel Payments’", "Toast" → "Toast’s". */
export const possessive = (name) => (name ? `${name}${/s$/i.test(String(name)) ? "’" : "’s"}` : "their");
const firstWord = (name) => String(name || "").trim().split(/\s+/).shift().toUpperCase();   // "Kestrel Payments" → "KESTREL"
const subName = (id) => String(id || "").split(".").map((p) => p.replace(/-/g, " ")).filter(Boolean);

/** The posting's own sections: each of its headings with what follows it (paragraph lines and bullets as items). */
export function postingSections(text) {
  const out = [];
  let cur = { title: null, items: [] };
  for (const b of formatPosting(text)) {
    if (b.type === "h") { if (cur.title || cur.items.length) out.push(cur); cur = { title: b.text.replace(/:\s*$/, ""), items: [] }; continue; }
    if (b.type === "ul") cur.items.push(...b.items);
    else cur.items.push(...String(b.text).split("\n").filter((l) => l.trim()));
  }
  if (cur.title || cur.items.length) out.push(cur);
  return out;
}
const MUST = /requir|qualif|you bring|you have|must|what we.re looking|who you are|minimum|basic/i;
const NICE = /nice|bonus|preferred|plus|extra credit|desired/i;
const DOES = /what you.ll do|responsib|the role|day to day|you will|your impact|what you.ll work/i;
const TAIL = /benefit|perk|equal|eeo|opportunity employer|accommodat|compensation|salary|pay range|privacy/i;

/** Pure: the sheet's words from the opening, the company page and the fit read — what each section shows. */
export function openingSheetModel({ opening, company = null, fit = null }) {
  const o = opening || {};
  const sections = postingSections(o.description || "");
  const pick = (re) => sections.filter((s) => s.title && re.test(s.title)).flatMap((s) => s.items);
  const resp = fit?.contextual?.parts?.responsibility_overlap;
  const duties = [...(resp?.matched || []), ...(resp?.missing || [])];
  const does = (duties.length ? duties : pick(DOES)).slice(0, 5);
  const mine = new Set([...reportAsks(fit?.report || null).onResume.filter((t) => t.kind === "skill").map((t) => t.term), ...(fit?.resumeTech || [])].map((t) => String(t).toLowerCase()));
  const groups = company?.stack?.groups || {};
  const of = company?.stack?.ofPostings || null;
  const stack = Object.values(groups).flat().filter((t) => t && t.tech).sort((a, b) => b.postings - a.postings).slice(0, 8)
    .map((t) => ({ name: t.tech, postings: t.postings, of, share: of ? Math.min(1, t.postings / of) : 0, yours: mine.has(String(t.tech).toLowerCase()), atlasSlug: t.atlasSlug || null }));
  const top5 = stack.slice(0, 5);
  const role = fit?.contextual?.parts?.role_fit?.posting?.subcategory || null;
  const teamName = role ? subName(role).pop() : "";
  const teams = (company?.byCategory || []).flatMap((c) => (c.subcategories || []).map((s) => ({ id: s.id || s.subcategory || s.key, name: s.name || subName(s.id || s.subcategory).pop(), count: s.count || 0 })))
    .filter((t) => t.name).sort((a, b) => b.count - a.count);
  const mineTeam = teams.find((t) => t.id === role)?.name || teamName;
  const others = teams.filter((t) => t.id !== role && String(t.name).toLowerCase() !== String(mineTeam).toLowerCase()).slice(0, 2).map((t) => String(t.name).toUpperCase());
  // the match the deck showed for this opening first (one number per opening, across the market and its sheet); else the read's
  const score = Number.isFinite(o.match) ? Math.round(o.match) : Number.isFinite(fit?.contextual?.score) ? Math.round(fit.contextual.score) : Number.isFinite(fit?.score) ? Math.round(fit.score) : null;
  return {
    sections: sections.filter((s) => !(s.title && TAIL.test(s.title))),
    tail: sections.filter((s) => s.title && TAIL.test(s.title)),
    does, must: pick(MUST), nice: pick(NICE),
    stack, stackHave: top5.length ? `${top5.filter((t) => t.yours).length} / ${top5.length}` : null,
    team: o.team ?? (mineTeam ? String(mineTeam).toUpperCase() : ""), teamLeft: o.teamLeft ?? others[0] ?? "", teamRight: o.teamRight ?? others[1] ?? "",
    sector: o.sector ?? (role ? subName(role).map((x) => x.toUpperCase()).join(" › ") : null),
    score, sponsorship: company?.sponsorship || null, openRoles: Number.isFinite(company?.openJobs) ? company.openJobs : null,
  };
}

/** The match dial: 20 ticks, the lit share of them green, the number and MATCH in the middle (the board's 140 px dial). */
function MatchDial({ score }) {
  const n = 20, lit = score == null ? 0 : Math.round((score / 100) * n);
  return (
    <svg role="img" aria-label={score == null ? "Match dial: not scored yet" : `Match dial: ${score} percent`} viewBox="0 0 140 140" width="140" height="140">
      <circle cx="70" cy="70" r="64" strokeWidth="1.5" style={{ fill: "var(--pl-card)", stroke: "var(--pl-ink)" }}/>
      {Array.from({ length: n }, (_, i) => (
        <line key={i} x1="70" y1="10" x2="70" y2="22" strokeWidth={i < lit ? "3" : "1.4"} transform={`rotate(${i * 18} 70 70)`} style={{ stroke: i < lit ? "var(--pl-lit)" : "var(--pl-ink)" }}/>
      ))}
      <text x="70" y="78" textAnchor="middle" fontSize="40" style={{ fontFamily: "var(--pl-serif)", fill: "var(--pl-ink)" }}>{score ?? "—"}</text>
      <text x="70" y="98" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="1.2" style={{ fontFamily: "var(--pl-mono)", fill: "var(--pl-ink)" }}>MATCH</text>
    </svg>
  );
}

/** A sentence with its figures in bold ("214 H-1B applications in FY2025" → **214** …; a year after FY stays plain). */
function figures(text) {
  return String(text).split(/(?<![A-Za-z])(\d[\d,.]*(?:\s%)?)(?![\dA-Za-z])/).map((part, i) => (i % 2 && !/^\d{4}$/.test(part) ? <b key={i}>{part}</b> : part));
}

function Item({ yet, children }) {
  return <div className="pl-op__item"><span aria-hidden="true" className="pl-op__sq" data-yet={yet ? "" : undefined}/><span>{children}</span></div>;
}

/**
 * The sheet itself (pure of fetching): `opening` = { jobId, title, company, place, pay, type, level, mode, posted, live,
 * companyHref, logo, region, sponsors, match, applyUrl, description, publicPath }, `company` = the survey sheet's read,
 * `fit` = the FitCard read (or null: FitCard reads it by jobId). `still`: the F5 fixture (no reads, no motion).
 */
export function OpeningSheetView({ data, company = null, fit = null, fitFront = null, fitPlausibility, still = false, onDecide, onSend, onBack, backHref = "/app/jobs" }) {
  // ⛔ A246 (47j): `data` IS the opening. It used to read `data?.job || data`, and openingFromJob carried the raw job as
  // `job`, so every live sheet drew the RAW job: no place, pay, type, level, posted or match (the fixtures passed the opening
  // itself, so F5 and d202 never saw it). The raw job now rides as `raw`.
  const o = data || {};
  const m = useMemo(() => openingSheetModel({ opening: o, company, fit }), [o, company, fit]);
  const co = o.companyHref || companyPath(o.company) || null;
  const titleCrumb = String(o.title || "").split(",")[0].toUpperCase();
  const glance = [
    { label: "PAY, POSTED", value: o.pay || "Not posted" },
    o.type ? { label: "TYPE", value: o.type } : null,
    o.level ? { label: "LEVEL", value: o.level } : null,
    m.stackHave ? { label: "STACK YOU HAVE", value: m.stackHave } : null,
  ].filter(Boolean);
  const back = (e) => { if (onBack) { e.preventDefault(); onBack(); } };
  const coLink = (children, cls) => (co ? <Link className={cls} to={co}>{children}</Link> : <span className={cls}>{children}</span>);
  const sp = m.sponsorship;
  return (
    <PlateRoot region={o.region} className="pl-op" data-opening-sheet={o.jobId || ""}>
      <section className="pl-op__top" aria-labelledby="op-title">
        <div className="pl-op__crumbrow">
          <Breadcrumb crumbs={[{ label: "MKT", href: backHref }, ...(m.sector ? [{ label: m.sector, href: backHref, region: true }] : []),
            ...(o.company ? [{ label: String(o.company).toUpperCase(), href: co || undefined }] : []), { label: titleCrumb }]}/>
          <span className="pl-op__grow"/>
          <a className="pl-op__back" href={backHref} onClick={back} data-opening-back="">← Back to the market</a>
        </div>
        <div className="pl-op__hero">
          <div className="pl-op__head">
            <div className="pl-kickers">
              <span className="pl-kicker">OPENING SHEET</span>
              {o.posted ? <><span className="pl-kicker pl-kickers__sep">·</span><span className="pl-kicker">{o.posted}</span></> : null}
              {o.live ? <><span className="pl-kicker pl-kickers__sep">·</span><span className="pl-kicker pl-tone-lit">{o.live}</span></> : null}
            </div>
            <div className="pl-op__co"><span className="pl-op__tile"><LetterTile name={o.company || ""} logo={o.logo} region={o.region}/></span>
              {coLink(o.company, "pl-op__coname")}{o.place ? <span className="pl-op__place">{o.place}</span> : null}</div>
            <h1 id="op-title" className="pl-op__title">{o.title}<span className="pl-title__stop">.</span></h1>
            <div className="pl-stats pl-op__glance" role="list" aria-label="The opening at a glance">
              {glance.map((c) => <div key={c.label} role="listitem" className="pl-stats__cell"><span className="pl-stats__num">{c.value}</span><span className="pl-label">{c.label}</span></div>)}
            </div>
            {o.sponsors && sp?.fiscalYear ? <span className="pl-op__stamp"><Stamp land={!still}>FILED H-1B · FY{String(sp.fiscalYear).slice(-2)}</Stamp></span>
              : o.sponsors ? <span className="pl-op__stamp"><Stamp land={!still}>FILED H-1B</Stamp></span> : null}
          </div>
          <figure className="pl-op__fig">
            <div className="pl-op__plate"><TeamDiorama company={o.company} team={m.team} left={m.teamLeft} right={m.teamRight} place={o.hq ?? (o.place ? String(o.place).split("·")[0].trim().toUpperCase() : "")}/></div>
            <div className="pl-op__dial pl-hide-sm"><MatchDial score={m.score}/></div>
            <figcaption className="pl-op__cap"><span className="pl-label">{m.team ? `PLATE · THIS ROLE SITS ON THE ${m.team} TEAM` : "PLATE · THE COMPANY’S TEAMS BY OPEN ROLES"}</span></figcaption>
          </figure>
        </div>
      </section>

      <section className="pl-op__section" aria-labelledby="op-role">
        <LegHeader n={1} id="role" meta="THE ROLE IN PLAIN WORDS · FROM THE POSTING" title={<span id="op-role">What you’d do</span>}/>
        <p className="pl-op__lead">The posting’s own lines. The full text is in section 04.</p>
        <div className="pl-op__row">
          <div className="pl-op__does" data-opening-does="">
            {m.does.length ? m.does.map((l, i) => <div key={i} className="pl-op__line"><span className="pl-op__n">{i + 1}</span><span>{l}</span></div>)
              : <p className="pl-op__quiet">The posting doesn’t list its duties apart; read it whole in section 04.</p>}
          </div>
          <div className="pl-op__reqs">
            <div className="pl-op__req"><span className="pl-label">MUST HAVE</span><div className="pl-op__items">
              {m.must.length ? m.must.map((t, i) => <Item key={i}>{t}</Item>) : <span className="pl-op__quiet">The posting doesn’t say which are required.</span>}</div></div>
            {m.nice.length ? <div className="pl-op__req" data-yet=""><span className="pl-label pl-muted">NICE TO HAVE</span><div className="pl-op__items">
              {m.nice.map((t, i) => <Item key={i} yet>{t}</Item>)}</div></div> : null}
          </div>
        </div>
      </section>

      <section className="pl-op__section" aria-labelledby="op-fit">
        <LegHeader n={2} id="fit" meta="HOW YOU FIT · THE ATS CARD · NO AI" title={<span id="op-fit">{m.score != null ? `${numberWords(m.score)}, and why` : "How you fit"}</span>}/>
        <p className="pl-op__lead">Your résumé against this posting and their real stack. Every number shows its parts.</p>
        <div className="pl-op__fit" data-opening-fit="">
          <FitCard jobId={still ? null : o.jobId} data={fit || null} {...(fitFront || {})} plausibility={fitPlausibility} company={o.company}
            historyLines={[o.posted ? { label: "First posted", text: `${String(o.posted).replace(/^POSTED\s+/i, "").toLowerCase()}.` } : null,
              o.live ? { label: "Live check", text: `${String(o.live).replace(/^LIVE\s*·?\s*/i, "").toLowerCase() || "the posting is up"}.` } : null].filter(Boolean)}/>
        </div>
      </section>

      <section className="pl-op__section" aria-labelledby="op-stack">
        <LegHeader n={3} id="stack" meta={`THEIR STACK${m.stack[0]?.of ? ` · FROM ${m.stack[0].of} POSTINGS` : ""}`} title={<span id="op-stack">What {o.company || "they"} build{o.company ? "s" : ""} with</span>}/>
        <p className="pl-op__lead">Each technology’s share of {possessive(o.company)} postings; the square says whether it’s on your résumé.</p>
        <div className="pl-op__card pl-op__stack" data-opening-stack="">
          {m.stack.length ? m.stack.map((t) => (
            <div key={t.name} className="pl-op__srow">
              <span className="pl-op__ssq" data-yet={t.yours ? undefined : ""} aria-label={t.yours ? "on your résumé" : "not on your résumé yet"} role="img"/>
              <b className="pl-op__sname">{t.name}</b>
              <span aria-hidden="true" className="pl-op__sbar"><span style={{ width: `${Math.floor(t.share * 100)}%` }}/></span>
              <span className="pl-op__sline">in <b>{t.postings} of {t.of}</b> postings{!t.yours && t.atlasSlug ? <> · <Link to={`/app/atlas/${t.atlasSlug}`}>Learn it →</Link></> : null}</span>
            </div>
          )) : <p className="pl-op__quiet">No stack on record for {o.company || "this company"} yet: it comes from their own postings, and we haven’t seen enough of them.</p>}
        </div>
      </section>

      <section className="pl-op__section" aria-labelledby="op-posting">
        <LegHeader n={4} id="posting" meta={`THE FULL POSTING${o.company ? ` · AS ${firstWord(o.company)} WROTE IT` : ""}`} title={<span id="op-posting">Read it all</span>}/>
        <p className="pl-op__lead">Nothing cut; the posting’s own headings, set to read.</p>
        <article className="pl-op__card pl-op__posting" data-opening-posting="">
          {m.sections.length ? m.sections.map((s, i) => (
            <div key={i} className="pl-op__block">{s.title ? <h3 className="pl-op__h3">{s.title}</h3> : null}{s.items.map((t, k) => <p key={k} className="pl-op__p">{t}</p>)}</div>
          )) : <p className="pl-op__quiet">This posting came without its text. Open the original to read it.</p>}
          {m.tail.length ? <details className="pl-op__tail"><summary>{m.tail.map((s) => s.title).join(" · ")}</summary>
            {m.tail.map((s, i) => <div key={i}>{s.items.map((t, k) => <p key={k} className="pl-op__p">{t}</p>)}</div>)}</details> : null}
          {o.applyUrl ? <a className="pl-op__orig" href={o.applyUrl} target="_blank" rel="noreferrer" onClick={(e) => postingClick({ jobId: o.jobId, url: o.applyUrl }, e, { url: o.applyUrl })}>Open the original posting ↗</a> : null}
        </article>
      </section>

      <section className="pl-op__section pl-op__section--last" aria-labelledby="op-company">
        <LegHeader n={5} id="company" meta="SPONSORSHIP AND THE COMPANY" title={<span id="op-company">Who you’d be joining</span>}/>
        <p className="pl-op__lead">The short version of {possessive(o.company)} survey sheet.</p>
        <div className="pl-op__row">
          <div className="pl-op__visa" data-opening-visa="">
            <span className="pl-label">VISA SPONSORSHIP · DOL DATA</span>
            {sp?.parts?.length ? <p className="pl-op__visaline">{figures(sp.parts.map((p) => p.text).join(" · "))}.</p>
              : <p className="pl-op__visaline">No filings found for {o.company || "this company"}.</p>}
            <p className="pl-op__note">Past filings, not a promise to sponsor you.</p>
          </div>
          {co ? <Ticket href={co} kicker={`SURVEY SHEET · ${String(o.company || "").toUpperCase()}`} title="The whole company"
            line={`Their stack, their hiring${m.openRoles != null ? `, their ${m.openRoles} open roles` : ""}.`} go="Open the survey sheet →"/> : null}
        </div>
      </section>

      <div className="pl-op__bar" data-opening-actions="">
        <div className="pl-op__barin">
          <span className="pl-op__barname"><b>{o.title}{o.company ? ` · ${o.company}` : ""}</b>
            <span className="pl-label pl-muted">{[m.score != null ? `${m.score} MATCH` : null, o.pay ? String(o.pay).toUpperCase() : null, o.mode ? String(o.mode).toUpperCase() : null].filter(Boolean).join(" · ")}</span></span>
          <TicketActions onDecide={onDecide} onSend={onSend} title={o.title}/>
        </div>
      </div>
    </PlateRoot>
  );
}

/** The opening as the sheet shows it, from the board's job (GET /api/jobs/by-id/:id) — MarketCardFace's own reading. */
export function openingFromJob(job, now = Date.now()) {
  if (!job) return null;
  const o = openingFromCard({ job, why: { matched: [] } }, now);
  const pct = parseInt(o.match?.value, 10);
  return { ...o, match: Number.isFinite(pct) ? pct : null, jobId: job.jobId || job.id, level: job.experienceLevel || job.tagLevel || null, description: job.description || "",
    applyUrl: /^https?:\/\//i.test(String(job.applyUrl || job.url || "")) ? (job.applyUrl || job.url) : null, publicPath: job.publicPath || null,
    region: o.region || sectorRegion(job.bucketRole || null), raw: job };
}

/**
 * The sheet at /app/jobs/<id>, over the market. Reads the job and its company; Pass / Save / Draft go through the board's own
 * decide (the board stays mounted underneath and registered "boardDecide"); Send opens the same picker or share the deck uses.
 */
export default function OpeningSheet({ jobId }) {
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [err, setErr] = useState(null);
  const [company, setCompany] = useState(null);
  const [fit, setFit] = useState(null);   // the FitCard's one read (shared cache): the card, 01's duty lines and 03's marks
  const [said, setSaid] = useState("");
  const [picking, setPicking] = useState(null);
  const [networkOn, setNetworkOn] = useState(false);
  const scroller = useRef(null);
  const back = useCallback(() => { if (window.history.length > 1) navigate(-1); else navigate("/app/jobs"); }, [navigate]);
  useEffect(() => {
    let live = true;
    setJob(null); setErr(null); setCompany(null); setFit(null);
    fitCardFor(jobId).then((d) => { if (live) setFit(d || null); }).catch(() => {});
    api(`/api/jobs/by-id/${encodeURIComponent(jobId)}`).then((r) => { if (live) setJob(r?.job || null); })
      .catch((e) => { if (live) setErr(e?.status === 404 ? "missing" : "failed"); });
    api("/api/network/status").then((r) => live && setNetworkOn(!!r?.enabled)).catch(() => {});
    scroller.current?.scrollTo?.(0, 0);
    return () => { live = false; };
  }, [jobId]);
  useEffect(() => {
    const slug = job?.company ? companyPath(job.company)?.split("/").pop() : null;
    if (!slug) return undefined;
    let live = true;
    api(`/api/public/companies/${encodeURIComponent(slug)}?job=${encodeURIComponent(jobId)}`).then((d) => { if (live) setCompany(d || null); }).catch(() => {});
    return () => { live = false; };
  }, [job?.company, jobId]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !picking) { e.preventDefault(); back(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, picking]);
  const opening = useMemo(() => (job ? openingFromJob(job) : null), [job]);
  // ⭐ 47m: the deck's MATCH opens the sheet at section 02 (/app/jobs/<id>#fit, DeckView matchSheetHref) — once the
  // sheet is drawn, its overlay scrolls How you fit to the top (the browser can't: the overlay, not the window, scrolls).
  const { hash } = useLocation();
  useEffect(() => {
    if (!opening || !hash || hash.length < 2) return;
    const at = scroller.current?.querySelector?.(`[id="${hash.slice(1).replace(/"/g, "")}"]`);
    at?.scrollIntoView?.({ block: "start" });
  }, [opening, hash]);
  const decide = useCallback(async (decision) => {
    // ⛔ A247 (47j): the sheet opened from the deck's FRONT card is decided by the deck's own decide (its exit, its "Passed …"
    // line, its Undo — lib/assistantBridge.js "deckDecide", the same one Ask draft uses); any other opening by the board's.
    // Before, every sheet called the board's decide, and the deck's card underneath stayed undecided in front.
    const front = assistantAction("deckJob")?.();
    const onDeck = !!front && String(front.jobId ?? front.id) === String(job?.jobId ?? job?.id);
    const fn = onDeck ? assistantAction("deckDecide") : assistantAction("boardDecide");
    if (!fn) { setSaid("Open the market to decide on this one."); return; }
    try { await fn(job, decision); back(); }
    catch (e) { setSaid(e?.message || "That didn’t go through."); }
  }, [job, back]);
  const send = useCallback(async () => {
    if (!job) return;
    if (networkOn) { setPicking(job); return; }
    if (!job.publicPath) { setSaid("This job has no public page yet"); return; }
    const url = `${window.location.origin}${job.publicPath}`;
    try {
      if (navigator.share) { await navigator.share({ title: `${job.title} — ${job.company}`, url }); setSaid("Shared"); }
      else { await navigator.clipboard.writeText(url); setSaid("Link copied"); }
    } catch { /* the person closed the share sheet */ }
  }, [job, networkOn]);
  return (
    <div className="pl-op-over" ref={scroller} role="dialog" aria-modal="true" aria-label={job ? `${job.title} at ${job.company}` : "The opening"} data-opening-over="">
      {err ? <PlateRoot className="pl-op"><div className="pl-op__top"><p className="pl-op__quiet">{err === "missing" ? "This opening isn’t on the board any more." : "The opening didn’t load."}</p>
        <a className="pl-op__back" href="/app/jobs" onClick={(e) => { e.preventDefault(); back(); }}>← Back to the market</a></div></PlateRoot>
        : !opening ? <PlateRoot className="pl-op"><div className="pl-op__top" role="status"><p className="pl-op__quiet">Opening the sheet…</p></div></PlateRoot>
        : <OpeningSheetView data={opening} company={company} fit={fit} onDecide={decide} onSend={send} onBack={back}/>}
      {said ? <p className="pl-op__said" role="status">{said}</p> : null}
      {picking ? <SendJobPicker job={picking} onClose={() => setPicking(null)}/> : null}
    </div>
  );
}
