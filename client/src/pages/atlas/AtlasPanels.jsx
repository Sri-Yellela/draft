// client/src/pages/atlas/AtlasPanels.jsx — ⭐ D167 (owner APPROVED 11-06, docs/sketches/Atlas.html) · THE PANELS of Atlas's
// own navigation. Each panel shows the EXISTING surface(s) mapped to it (docs/D167_ATLAS_MAP.md); a panel whose feature is
// not built yet says so and shows only what the data already holds — no made-up numbers (the sketch's figures are
// illustrations, never drawn here).
//   You     · Overview (where you stand, from /api/atlas/me, /api/navigator, /api/readiness) · Your map (YourMap.jsx) ·
//             Your skills (a SLOT: D142's check today; D169's panel replaces it at merge) · Your route (Navigator.jsx)
//   Grow    · Learn (the sketch's stages over the earned record, then LearnView.jsx) · Today's question (D154, not built) ·
//             The audit (D150 T04's role card, GET /api/audit/role/:slug; the questions step is not built)
//   Explore · Roles and skills (search, Explore by role, recently published; node pages and search results open here) ·
//             This week's market (D150 T09 is not built: the auditable roles' open and new-this-week counts) ·
//             Glossary (GET /api/atlas/glossary — the popup's own meaning, one source)
// Every colour is a theme token (AtlasPanels.css); no pills — marks and depth boxes (D60).
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { matchCandidate } from "../../../../shared/atlasSearchNormalize.js";
import Navigator from "./Navigator.jsx";
import ReadinessCheck from "./ReadinessCheck.jsx";
import SkillsListAndMap from "./YourSkillsPanel.jsx";   // D169
import { ExploreByRole, Recent, directionLine, useAtlasMe } from "./YourMap.jsx";
import { KIND_LABEL } from "./atlasModel.js";
import { flatSteps, stepState } from "./learnModel.js";
import { learnStages, overviewStats, panelHref } from "./atlasPanels.js";
import "./AtlasPanels.css";

const nodeHref = (base, slug) => `${base}/${encodeURIComponent(slug)}`;
const num = (n) => Number(n || 0).toLocaleString("en-US");

export function PanelHead({ eyebrow, title, lead = null }) {
  return (
    <header className="atl__head atl-pan__head">
      {eyebrow && <p className="atl-pan__eyebrow">{eyebrow}</p>}
      <h1 className="atl__title">{title}</h1>
      {lead && <p className="atl__lede">{lead}</p>}
    </header>
  );
}

/** An honest "not built yet" line: what the panel will hold, and what exists today. */
function NotYet({ children }) {
  return <p className="atl-pan__notyet" data-atlas-not-yet="">{children}</p>;
}

function SignInLine({ what }) {
  return <p className="atl__quiet" data-atlas-sign-in="">Sign in to see {what}. <Link to="/login" className="atl__link">Sign in</Link></p>;
}

// ── You · Overview ───────────────────────────────────────────────────────────────────────────────

/** Overview drawn from its answers — pure (the tests render it). */
export function OverviewView({ base, me, nav = null, readiness = null }) {
  const signedIn = !!me?.signedIn;
  const target = nav?.ready && nav.destination?.aim?.line ? nav.destination.aim.line
    : me?.targetRoles?.[0]?.name || null;
  const stats = overviewStats({ readiness, nav });
  const next = nav?.ready && nav.next ? { text: nav.next.text } : (me?.tree ? directionLine(me.tree) : null);
  return (
    <div className="atl-pan" data-atlas-panel-body="overview">
      <PanelHead eyebrow="Where you stand" title={target || "Your Atlas"}
        lead={signedIn
          ? (me?.map ? "Your skills against the market, and the next step on your route." : me?.prompt || "Add skills to your Profile and this page becomes yours.")
          : "Roles, skills, tools and stacks — how they connect, what the board asks for, and where to learn them."} />
      {stats.length > 0 && (
        <div className="atl-pan__stats" data-atlas-overview-stats="">
          {stats.map(s => (
            <Link key={s.id} to={panelHref(base, s.panel)} className="atl-pan__stat" data-atlas-stat={s.id}>
              <b>{s.value}</b><span>{s.label}</span>
            </Link>
          ))}
        </div>
      )}
      <div className="atl-pan__two">
        <section className="atl__section" data-atlas-overview-next="">
          <h2 className="atl__h2">Next step</h2>
          {next ? <p className="atl-pan__line">{next.text}</p>
            : <p className="atl__quiet">{signedIn ? "Your next step appears once your map has your skills." : "Sign in with a résumé and the Atlas points the way."}</p>}
          <p className="atl-pan__actions">
            <Link className="dbx-depth atl-home__go" to={panelHref(base, "your-route")}>Open your route</Link>
            <Link className="atl__link" to={panelHref(base, "learn")}>Go to Learn</Link>
          </p>
        </section>
        <section className="atl__section" data-atlas-overview-question="">
          <h2 className="atl__h2">Today's question</h2>
          <p className="atl__quiet">The daily question is not built yet. Meanwhile, check a skill you claim.</p>
          <p className="atl-pan__actions"><Link className="dbx-depth atl-home__go" to={panelHref(base, "your-skills")}>Check a skill</Link></p>
        </section>
      </div>
      {!signedIn && (
        <p className="atl-pan__actions">
          <Link className="atl__link" to={panelHref(base, "roles-and-skills")}>Explore roles and skills</Link>
          <Link className="atl__link" to={panelHref(base, "glossary")}>Read the glossary</Link>
        </p>
      )}
    </div>
  );
}

export function OverviewPanel({ base }) {
  const me = useAtlasMe();
  const [nav, setNav] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const signedIn = !!me?.signedIn;
  useEffect(() => {
    if (!signedIn) return undefined;
    let live = true;
    api("/api/navigator").then(r => live && setNav(r)).catch(() => {});
    api("/api/readiness").then(r => live && setReadiness(r.skills || [])).catch(() => {});
    return () => { live = false; };
  }, [signedIn]);
  if (me === null) return <p className="atl__quiet" role="status">Opening…</p>;
  return <OverviewView base={base} me={me || {}} nav={nav} readiness={readiness} />;
}

// ── You · Your skills (a slot) ─────────────────────────────────────────────────────────────────

/**
 * ⭐ D169 (owner 11-06, approved, revisable) · YOUR SKILLS — D169's panel (List + Map of the same data; claimed · checked
 * · built; "Check it · 1 min" in place), and below it D142's full readiness check, which keeps its home here
 * (docs/D167_ATLAS_MAP.md row 14; /atlas/check still lights this panel).
 */
export function YourSkillsSlot({ signedIn, base = "/app/atlas" }) {
  return (
    <div className="atl-pan" data-atlas-panel-body="your-skills" data-atlas-slot="your-skills">
      <SkillsListAndMap signedIn={signedIn} base={base} />
      <section className="atl-pan__more" data-atlas-readiness="" aria-label="The full readiness check">
        <ReadinessCheck signedIn={signedIn} />
      </section>
    </div>
  );
}

// ── You · Your route ─────────────────────────────────────────────────────────────────────────────

export function YourRoutePanel({ base, signedIn }) {
  return (
    <div className="atl-pan" data-atlas-panel-body="your-route">
      <PanelHead eyebrow="Your route" title="One tier on top of what you have"
        lead="Where you're headed, the skills in order with the Learn piece for each, and the roles to apply to while you learn." />
      {signedIn
        ? <Navigator base={base} fallback={<NotYet>Your route appears once your job profile names your current role and your résumé's skills are read.
            {" "}<Link to="/app/profile" className="atl__link">Open your Profile</Link></NotYet>} />
        : <SignInLine what="your route" />}
    </div>
  );
}

// ── Grow · Learn ─────────────────────────────────────────────────────────────────────────────────

/** The pathway's stages — pure (the tests render it). */
export function LearnStagesView({ base, stages, signedIn }) {
  if (!stages.length) return null;
  return (
    <section className="atl__section atl-pan__stages" data-atlas-learn-stages="" aria-labelledby="atl-stages">
      <p className="atl-pan__eyebrow">Learn · From silicon to software</p>
      <h2 className="atl__h2" id="atl-stages">The pathway</h2>
      <p className="atl__quiet">{signedIn ? "Each part's steps, in order — progress is earned by opening, explaining and building." : "Sign in and your progress is kept as you go."}</p>
      <ol className="atl-pan__stagelist">
        {stages.map(s => (
          <li key={s.index} className="atl-pan__stage" data-learn-stage={s.index} data-stage-state={s.state}>
            <div className="atl-pan__stage-t"><b>{s.title}</b> <span className="atl__count">{s.done} of {s.total} steps</span></div>
            <div className="atl-pan__bar" role="img" aria-label={`${s.pct} % done`}><i style={{ width: `${s.pct}%` }} /></div>
            {s.state === "done"
              ? <span className="mark mark--ok">done</span>
              : <Link className={s.state === "started" ? "dbx-depth atl-home__go" : "atl__link"} to={`${base}/learn#step-${encodeURIComponent(s.nextId)}`}>
                  {s.state === "started" ? "Continue" : "Start"}</Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function LearnStages({ base, signedIn }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    Promise.all([api("/api/learn"), signedIn ? api("/api/learn/earned").catch(() => ({ marks: {} })) : Promise.resolve({ marks: {} })])
      .then(([learn, earned]) => live && setData({ learn, marks: earned?.marks || {} })).catch(() => live && setData(false));
    return () => { live = false; };
  }, [signedIn]);
  const stages = useMemo(() => (data ? learnStages(flatSteps(data.learn), (s) => stepState(s, data.marks)) : []), [data]);
  return <LearnStagesView base={base} stages={stages} signedIn={signedIn} />;
}

// ── Grow · Today's question ──────────────────────────────────────────────────────────────────────

export function TodaysQuestionPanel({ base }) {
  return (
    <div className="atl-pan" data-atlas-panel-body="todays-question">
      <PanelHead eyebrow="Today's question · picked from your route" title="One question a day"
        lead="A short question from your route each day, with a review when you miss one." />
      <NotYet>The daily question is not built yet (D154). The question bank already serves D142's check: pick a skill you claim
        and answer a few questions on it.</NotYet>
      <p className="atl-pan__actions"><Link className="dbx-depth atl-home__go" to={panelHref(base, "your-skills")}>Check a skill</Link></p>
    </div>
  );
}

// ── Grow · The audit ─────────────────────────────────────────────────────────────────────────────

const usd = (v) => `$${Math.round(v / 1000)}k`;

/** One role's card — pure (the tests render it). */
export function AuditCard({ base, card }) {
  if (!card) return null;
  return (
    <section className="atl__section" data-atlas-audit-card={card.slug}>
      <h2 className="atl__h2">{card.title}</h2>
      <p className="atl-pan__line"><b>{num(card.openThisWeek)}</b> open posting{card.openThisWeek === 1 ? "" : "s"} · <b>{num(card.newThisWeek)}</b> new in the last 7 days</p>
      <p className="atl-pan__line" data-audit-pay="">{card.payRange?.hidden ? card.payRange.why : `Pay, middle half: ${usd(card.payRange.p25Usd)}–${usd(card.payRange.p75Usd)} (from ${num(card.payRange.n)} postings that state it)`}</p>
      {card.topRequirements?.length > 0 && (
        <>
          <h3 className="atl__h3">The most-asked must-haves</h3>
          <ul className="atl__links">
            {card.topRequirements.map(r => <li key={r.slug}><Link className="atl__link" to={nodeHref(base, r.slug)}>{r.name}</Link><span className="atl__count"> · {r.share} % of its postings</span></li>)}
          </ul>
        </>
      )}
      <p className="atl__quiet">{card.said} As of {card.asOf}.</p>
    </section>
  );
}

export function AuditPanel({ base }) {
  const [roles, setRoles] = useState(null);
  const [pick, setPick] = useState("");
  const [card, setCard] = useState(null);
  useEffect(() => {
    let live = true;
    api("/api/audit/roles").then(r => { if (!live) return; setRoles(r.roles || []); if (r.roles?.[0]) setPick(r.roles[0].slug); }).catch(() => live && setRoles([]));
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!pick) return undefined;
    let live = true;
    setCard(null);
    api(`/api/audit/role/${encodeURIComponent(pick)}`).then(c => live && setCard(c)).catch(() => live && setCard(null));
    return () => { live = false; };
  }, [pick]);
  return (
    <div className="atl-pan" data-atlas-panel-body="the-audit">
      <PanelHead eyebrow="The 3-minute audit" title="Do you clear the bar?"
        lead="The role's card from the board's own postings: how many are open, what they pay, what they ask for most." />
      {roles == null ? <p className="atl__quiet" role="status">Opening…</p> : !roles.length
        ? <NotYet>No role can be audited yet: a role needs reviewed questions in the bank and at least 30 open postings.</NotYet>
        : (
          <>
            <label className="atl-pan__pick">
              <span className="atl__h3">Role</span>
              <select className="atl__input" value={pick} onChange={(e) => setPick(e.target.value)} data-audit-role="">
                {roles.map(r => <option key={r.slug} value={r.slug}>{r.title} · {num(r.openPostings)} open</option>)}
              </select>
            </label>
            <AuditCard base={base} card={card} />
            <NotYet>The audit's questions and its result are not built yet (D150); the role card above is.</NotYet>
          </>
        )}
    </div>
  );
}

// ── Explore · Roles and skills ───────────────────────────────────────────────────────────────────

export function RolesPanel({ base, search }) {
  const me = useAtlasMe();
  return (
    <div className="atl-pan" data-atlas-panel-body="roles-and-skills">
      <PanelHead eyebrow="Explore" title="Roles and skills"
        lead="Every published role, skill, tool and stack: what it is, what the board asks for alongside it, and where to learn it." />
      {search}
      {me && <ExploreByRole roles={me.exploreByRole?.items} base={base} />}
      {me && <Recent items={me.recent} base={base} />}
    </div>
  );
}

// ── Explore · This week's market ─────────────────────────────────────────────────────────────────

export const MARKET_ROLES = 4;

/** The week as far as the data goes — pure (the tests render it). */
export function MarketView({ base, roles, cards }) {
  const total = roles.reduce((a, r) => a + (r.openPostings || 0), 0);
  return (
    <div className="atl-pan" data-atlas-panel-body="this-weeks-market">
      <PanelHead eyebrow="This week's market" title="What moved this week"
        lead={roles.length ? `The biggest roles the audit reads, from ${num(total)} open postings.` : null} />
      <NotYet>The weekly market read (D150 T09) is not built yet. What the board already counts:</NotYet>
      {!roles.length ? <p className="atl__quiet">Not enough postings are read as a role yet.</p> : (
        <div className="atl-pan__stats" data-atlas-market="">
          {roles.slice(0, MARKET_ROLES).map(r => {
            const c = cards[r.slug];
            return (
              <Link key={r.slug} to={nodeHref(base, r.slug)} className="atl-pan__stat" data-market-role={r.slug}>
                <b>{num(c ? c.newThisWeek : r.openPostings)}</b>
                <span>{c ? `new ${r.title} postings in 7 days · ${num(c.openThisWeek)} open` : `open ${r.title} postings`}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MarketPanel({ base }) {
  const [roles, setRoles] = useState(null);
  const [cards, setCards] = useState({});
  useEffect(() => {
    let live = true;
    api("/api/audit/roles").then(r => {
      if (!live) return;
      const list = r.roles || [];
      setRoles(list);
      for (const x of list.slice(0, MARKET_ROLES)) {
        api(`/api/audit/role/${encodeURIComponent(x.slug)}`).then(c => live && setCards(m => ({ ...m, [x.slug]: c }))).catch(() => {});
      }
    }).catch(() => live && setRoles([]));
    return () => { live = false; };
  }, []);
  if (roles == null) return <p className="atl__quiet" role="status">Opening…</p>;
  return <MarketView base={base} roles={roles} cards={cards} />;
}

// ── Explore · Glossary ───────────────────────────────────────────────────────────────────────────

export const GLOSSARY_PAGE = 120;

/** The glossary's search — the ONE normaliser (shared/atlasSearchNormalize.js), over the name, then its meaning. */
export function searchGlossary(terms, q) {
  const query = String(q ?? "").trim();
  if (!query) return terms || [];
  const hits = [];
  for (const t of terms || []) {
    const m = matchCandidate(query, { name: t.name, definition: t.meaning || "" });
    if (m) hits.push({ t, rank: m.rank });
  }
  return hits.sort((a, b) => a.rank - b.rank || a.t.name.localeCompare(b.t.name)).map(h => h.t);
}

/** The glossary drawn from GET /api/atlas/glossary — pure (the tests render it). */
export function GlossaryView({ base, terms, q = "", onQ = () => {}, shown = GLOSSARY_PAGE, onMore = () => {} }) {
  const hits = searchGlossary(terms, q);
  return (
    <div className="atl-pan" data-atlas-panel-body="glossary">
      <PanelHead eyebrow="Glossary" title="The words the market uses"
        lead="Every term in the Atlas, in plain words, with how many open postings use it. Hover a linked term in a posting to see the same definition." />
      <input className="atl__input atl-pan__search" type="search" value={q} onChange={(e) => onQ(e.target.value)} maxLength={80}
        aria-label="Search the glossary" placeholder="Search a term" data-glossary-search="" />
      <p className="atl__quiet" role="status" data-glossary-count="">{q.trim() ? `${num(hits.length)} of ${num(terms.length)} terms` : `${num(terms.length)} terms`}</p>
      <ul className="atl-pan__gloss" data-glossary="">
        {hits.slice(0, shown).map(t => (
          <li key={t.slug} className="atl-pan__term" data-glossary-term={t.slug}>
            <div className="atl-pan__term-t">
              <b>{t.name}</b> <span className="mark mark--dim">{KIND_LABEL[t.kind] || t.kind}</span>
              <p className="atl-pan__meaning" data-glossary-meaning="">
                {t.meaning || <span className="atl__quiet">No plain-words definition yet.</span>}
                {t.fromWikipedia && <span className="atl__quiet"> — From <a href={t.wikipediaUrl || "https://en.wikipedia.org"} target="_blank" rel="noopener noreferrer">Wikipedia</a> (CC BY-SA)</span>}
              </p>
            </div>
            <span className="atl__count" data-glossary-postings={t.postings}>{num(t.postings)} posting{t.postings === 1 ? "" : "s"}</span>
            <Link className="atl__link" to={nodeHref(base, t.slug)} data-glossary-open="">Open in Atlas</Link>
          </li>
        ))}
      </ul>
      {hits.length > shown && <button type="button" className="dbx-depth atl-home__go" onClick={onMore} data-glossary-more="">Show more ({num(hits.length - shown)} left)</button>}
    </div>
  );
}

export function GlossaryPanel({ base }) {
  const [terms, setTerms] = useState(null);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(GLOSSARY_PAGE);
  useEffect(() => {
    let live = true;
    api("/api/atlas/glossary").then(r => live && setTerms(r.terms || [])).catch(() => live && setTerms(false));
    return () => { live = false; };
  }, []);
  useEffect(() => { setShown(GLOSSARY_PAGE); }, [q]);
  if (terms === null) return <p className="atl__quiet" role="status">Opening…</p>;
  if (terms === false) return <p className="atl__quiet" role="alert">The glossary could not be reached just now.</p>;
  return <GlossaryView base={base} terms={terms} q={q} onQ={setQ} shown={shown} onMore={() => setShown(n => n + GLOSSARY_PAGE)} />;
}
