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
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useRepeatsNav } from "../../components/PlaceNav.jsx";
import Navigator from "./Navigator.jsx";
import ReadinessCheck from "./ReadinessCheck.jsx";
import YourSkillsPanel from "./YourSkillsPanel.jsx";   // D169
import { directionLine, useAtlasMe } from "./YourMap.jsx";
import { overviewStats, panelHref, learnStepHref } from "./atlasPanels.js";
import "./AtlasPanels.css";
import { NoteCard } from "../../components/TextBlocks.jsx";   // A233
import { loginHref } from "../../lib/signInReturn.js";   // A138: back to this page after sign-in

const nodeHref = (base, slug) => `${base}/${encodeURIComponent(slug)}`;
const num = (n) => Number(n || 0).toLocaleString("en-US");

export function PanelHead({ eyebrow, title, lead = null }) {
  const repeats = useRepeatsNav(eyebrow);   // D182: an eyebrow equal to the nav card's current item is not drawn
  return (
    <header className="atl__head atl-pan__head">
      {eyebrow && !repeats && <p className="atl-pan__eyebrow">{eyebrow}</p>}
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
  return <p className="atl__quiet" data-atlas-sign-in="">Sign in to see {what}. <Link to={loginHref()} className="atl__link">Sign in</Link></p>;
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
            <Link className="dbx-depth atl-home__go" to={panelHref(base, "your-map")}>Open your route</Link>
            <Link className="atl__link" to={panelHref(base, "library")}>Go to the Library</Link>
          </p>
        </section>
        <section className="atl__section" data-atlas-overview-question="">
          <h2 className="atl__h2">Today's question</h2>
          {/* ⭐ D154 P1 (45l): built — one question a day, picked from your own gaps. */}
          <p className="atl__quiet">One question a day, about two minutes, picked from your own gaps.</p>
          <p className="atl-pan__actions"><Link className="dbx-depth atl-home__go" to={panelHref(base, "todays-question")}>Today's question</Link></p>
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
 * ⭐ D169 (owner 11-06, approved, revisable) · YOUR SKILLS — D169's list (claimed · checked · built; "Check it · 1 min" in
 * place), and below it D142's full readiness check, which keeps its home here (docs/D167_ATLAS_MAP.md row 14; /atlas/check
 * still lights this panel). ⭐ A228 (46r, owner 11-16 "Build it"): the ring Map view, For a role (the readiness dial) and
 * Compare roles are retired — Your map (the skill map, SkillMap.jsx) answers them for every role at once.
 */
export function YourSkillsSlot({ signedIn, base = "/app/atlas" }) {
  return (
    <div className="atl-pan" data-atlas-panel-body="your-skills" data-atlas-slot="your-skills">
      <div data-skills-all="">
        <YourSkillsPanel signedIn={signedIn} base={base} />
        <section className="atl-pan__more" data-atlas-readiness="" aria-label="The full readiness check">
          <ReadinessCheck signedIn={signedIn} />
        </section>
      </div>
    </div>
  );
}

// ── You · Your route ─────────────────────────────────────────────────────────────────────────────

export function YourRoutePanel({ base, signedIn }) {
  return (
    <div className="atl-pan" data-atlas-panel-body="your-route">
      <PanelHead title="One tier on top of what you have"
        lead="Where you're headed, the skills in order with the lesson for each, and the roles to apply to while you learn." />
      {signedIn
        ? <Navigator base={base} fallback={<NotYet>Your route appears once your job profile names your current role and your résumé's skills are read.
            {" "}<Link to="/app/profile" className="atl__link">Open your Profile</Link></NotYet>} />
        : <SignInLine what="your route" />}
    </div>
  );
}

// ⭐ 47m (D197 Wave 2 #11, M5): Today's question left this file — it is the Today card on Your map (TodayCard.jsx); its
// practice progress is the Logbook's (Logbook.jsx) and its stack exposure Your survey's (Logbook.jsx StackOnTheBoard).

// ── Grow · The audit ─────────────────────────────────────────────────────────────────────────────

const usd = (v) => `$${Math.round(v / 1000)}k`;

/** One role's card — pure (the tests render it). */
export function AuditCard({ base, card }) {
  if (!card) return null;
  return (
    <section className="atl__section" data-atlas-audit-card={card.slug}>
      <h2 className="atl__h2">{card.title}</h2>
      <p className="atl-pan__line"><b>{num(card.openThisWeek)}</b> open job{card.openThisWeek === 1 ? "" : "s"} · <b>{num(card.newThisWeek)}</b> new in the last 7 days</p>
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
      <PanelHead title="Do you clear the bar?"
        lead="The role's card from the board's own jobs: how many are open, what they pay, what they ask for most." />
      {roles == null ? <p className="atl__quiet" role="status">Opening…</p> : !roles.length
        ? <NotYet>No role can be audited yet: a role needs reviewed questions and at least 30 open jobs.</NotYet>
        : (
          <>
            <label className="atl-pan__pick">
              <span className="atl__h3">Role</span>
              <select className="atl__input" value={pick} onChange={(e) => setPick(e.target.value)} data-audit-role="">
                {roles.map(r => <option key={r.slug} value={r.slug}>{r.title} · {num(r.openPostings)} open</option>)}
              </select>
            </label>
            <AuditCard base={base} card={card} />
            {/* ⭐ D150 T05: the audit itself — six questions, about three minutes. */}
            <p><a className="atl__link" href={`/audit?role=${encodeURIComponent(pick)}`} data-audit-take="">Take the 3-minute audit</a></p>
          </>
        )}
    </div>
  );
}

// ⭐ D201 (47m, lane gaz): Roles and skills, the Glossary and How it works are the Gazetteer's now (its browse by role, its
// A–Z, each entry's Why it works — pages/atlas/AtlasGazetteer.jsx); their panels are retired, their addresses forward.

// ── Explore · This week's market ─────────────────────────────────────────────────────────────────

export const MARKET_ROLES = 4;

/** The week as far as the data goes — pure (the tests render it). */
export function MarketView({ base, roles, cards }) {
  const total = roles.reduce((a, r) => a + (r.openPostings || 0), 0);
  return (
    <div className="atl-pan" data-atlas-panel-body="this-weeks-market">
      <PanelHead eyebrow="This week's market" title="What moved this week"
        lead={roles.length ? `The biggest roles on the board, from ${num(total)} open jobs.` : null} />
      {/* ⭐ A233: an explanation is a note card — and never a ticket code on the page. */}
      <NoteCard id="market-week" title="The weekly view is still being built">Until then, here is what the board counts today.</NoteCard>
      {!roles.length ? <p className="atl__quiet">Not enough jobs are sorted into roles yet.</p> : (
        <div className="atl-pan__stats" data-atlas-market="">
          {roles.slice(0, MARKET_ROLES).map(r => {
            const c = cards[r.slug];
            return (
              <Link key={r.slug} to={nodeHref(base, r.slug)} className="atl-pan__stat" data-market-role={r.slug}>
                <b>{num(c ? c.newThisWeek : r.openPostings)}</b>
                <span>{c ? `new ${r.title} jobs this week · ${num(c.openThisWeek)} open` : `open ${r.title} jobs`}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AtlasMarketPanel({ base }) {   // 47j: renamed — MarketPanel is the plate market's (plate/MarketControls.jsx)
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
