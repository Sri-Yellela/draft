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
import { overviewStats, panelHref, learnStepHref } from "./atlasPanels.js";
import "./AtlasPanels.css";
import RoleReadiness from "./RoleReadiness.jsx";
import CompareRoles from "./CompareRoles.jsx";
import { loginHref } from "../../lib/signInReturn.js";   // A138: back to this page after sign-in

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
 * ⭐ D169 (owner 11-06, approved, revisable) · YOUR SKILLS — D169's panel (List + Map of the same data; claimed · checked
 * · built; "Check it · 1 min" in place), and below it D142's full readiness check, which keeps its home here
 * (docs/D167_ATLAS_MAP.md row 14; /atlas/check still lights this panel).
 */
export function YourSkillsSlot({ signedIn, base = "/app/atlas" }) {
  // ⭐ D178-3 (owner's pick): tabs — For a role (the default: readiness, the tree grown for the role, what moves your %)
  // · Compare roles (Idea E: up to four dials, the skills-by-role grid, the skill that lifts the most roles)
  // · All my skills (D169's list and map, D142's check — unchanged).
  const [tab, setTab] = useState(signedIn ? "role" : "all");
  return (
    <div className="atl-pan" data-atlas-panel-body="your-skills" data-atlas-slot="your-skills">
      {signedIn && (
        <div className="rr-tabs" role="tablist" aria-label="Your skills" data-skills-tabs="">
          <button type="button" role="tab" aria-selected={tab === "role"} aria-pressed={tab === "role"} onClick={() => setTab("role")} data-skills-tab="role">For a role</button>
          <button type="button" role="tab" aria-selected={tab === "compare"} aria-pressed={tab === "compare"} onClick={() => setTab("compare")} data-skills-tab="compare">Compare roles</button>
          <button type="button" role="tab" aria-selected={tab === "all"} aria-pressed={tab === "all"} onClick={() => setTab("all")} data-skills-tab="all">All my skills</button>
        </div>
      )}
      {signedIn && tab === "role" && <RoleReadiness base={base} />}
      {signedIn && tab === "compare" && <CompareRoles base={base} />}
      <div hidden={signedIn && tab !== "all"} data-skills-all="">
        <SkillsListAndMap signedIn={signedIn} base={base} />
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
      <PanelHead eyebrow="Your route" title="One tier on top of what you have"
        lead="Where you're headed, the skills in order with the Learn piece for each, and the roles to apply to while you learn." />
      {signedIn
        ? <Navigator base={base} fallback={<NotYet>Your route appears once your job profile names your current role and your résumé's skills are read.
            {" "}<Link to="/app/profile" className="atl__link">Open your Profile</Link></NotYet>} />
        : <SignInLine what="your route" />}
    </div>
  );
}

// ── Grow · Today's question ──────────────────────────────────────────────────────────────────────

// ⭐ D154 P1 / P3 (45l): one question a day, picked from the person's own gaps (services/learn/dailyQuestion.js) — the why
// after the answer, then "Go to lesson" (the item's Learn pieces), and a quiet streak. Their LOCAL day is sent.
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// ⭐ D154 P1 (45m) · the gentle reminder — OFF until the person turns it on; their own hour (local), push or email.
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourWord = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });
function DailyReminderRow() {
  const [r, setR] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { api("/api/learn/today/reminder").then(setR).catch(() => setR(null)); }, []);
  if (!r) return null;
  const save = async (body) => {
    setMsg("");
    try { setR(await api("/api/learn/today/reminder", { method: "PUT", body: JSON.stringify(body) })); }
    catch (e) { setMsg(e.message || "Not saved."); }
  };
  const on = (patch = {}) => save({ on: true, hour: r.hour, tzOffsetMin: new Date().getTimezoneOffset(), channel: r.email && !r.push ? "email" : "push", ...patch });
  return (
    <div className="atl-dq__remind" data-daily-reminder={r.on ? "on" : "off"}>
      <label className="atl__quiet">
        <input type="checkbox" checked={r.on} onChange={e => (e.target.checked ? on() : save({ on: false }))} /> Remind me each day at{" "}
        <select value={r.hour} aria-label="Reminder time" onChange={e => (r.on ? on({ hour: Number(e.target.value) }) : setR({ ...r, hour: Number(e.target.value) }))}>
          {HOURS.map(h => <option key={h} value={h}>{hourWord(h)}</option>)}
        </select>{" "}by{" "}
        <select value={r.email && !r.push ? "email" : "push"} aria-label="Reminder by" onChange={e => (r.on ? save({ on: false }).then(() => on({ channel: e.target.value })) : setR({ ...r, push: e.target.value === "push", email: e.target.value === "email" }))}>
          <option value="push">notification</option>
          <option value="email">email</option>
        </select>
      </label>
      <span className="atl__quiet"> · only on days you haven't answered.</span>
      {msg && <span className="atl__quiet" role="alert"> {msg}</span>}
    </div>
  );
}

export function TodaysQuestionPanel({ base }) {
  const [t, setT] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const day = localDay();
  useEffect(() => { api(`/api/learn/today?day=${day}`).then(setT).catch(e => setErr(e?.status === 401 ? "Sign in to get a question a day, picked from your own gaps." : (e.message || "Today's question couldn't load."))); }, [day]);
  const answer = async (i, response = null) => {
    if (busy || t?.result) return;
    setBusy(true);
    try { const r = await api("/api/learn/today/answer", { method: "POST", body: JSON.stringify(response ? { day, response } : { day, chosen: i }) }); setT({ ...t, result: r, streak: r.streak }); }
    catch (e) { setErr(e.message || "That answer didn't save."); } finally { setBusy(false); }
  };
  const q = t?.question, r = t?.result;
  return (
    <div className="atl-pan" data-atlas-panel-body="todays-question">
      <PanelHead eyebrow={t?.reasonWords ? `Picked for you · ${t.reasonWords}` : "Picked from your route"} title="One question a day"
        lead={t?.streak ? `${t.streak} day${t.streak === 1 ? "" : "s"} in a row.` : "About two minutes. A review comes back when you miss one."} />
      {err && <p className="atl__quiet" role="alert">{err}</p>}
      {!t && !err && <p className="atl__quiet" role="status">Picking today's question…</p>}
      {t && !q && <NotYet>No question to ask yet — the bank has nothing new for you today.</NotYet>}
      {t && <DailyReminderRow />}
      {q && (
        <div className="atl-dq" data-daily-question={q.id}>
          <p className="atl__quiet">{(q.skills || []).map(s => String(s).replace(/-/g, " ")).join(" · ")}</p>
          <h3 className="atl__h2">{q.stem}</h3>
          {q.type === "match" && <MatchAnswer q={q} r={r} busy={busy} onAnswer={(resp) => answer(null, resp)} />}
          {q.type === "order" && <OrderAnswer q={q} r={r} busy={busy} onAnswer={(resp) => answer(null, resp)} />}
          {Array.isArray(q.choices) && <div className="atl-dq__choices" role="group" aria-label="Choices">
            {q.choices.map((c, i) => (
              <button key={i} type="button" className="atl-dq__choice" disabled={!!r || busy} onClick={() => answer(i)}
                data-state={r ? (i === r.correctIndex ? "right" : i === r.chosen ? "wrong" : "") : ""}>{c}</button>
            ))}
          </div>}
          {r && Array.isArray(q.choices) && (
            <div className="atl-dq__why" data-daily-why="" role="status">
              <p><b>{r.correct ? "Right." : "Not quite."}</b> {r.why.chosen}</p>
              {!r.correct && r.why.right && <p><b>The stronger move:</b> {r.why.rightChoice} — {r.why.right}</p>}
              {r.lessons?.length > 0 && <p>Go to lesson: {r.lessons.map((l, i) => <span key={l.path}>{i ? " · " : ""}<Link className="atl__link" to={learnStepHref(base, l.stepId)}>{l.label}</Link></span>)}</p>}
              <p className="atl__quiet">Come back tomorrow for the next one.</p>
            </div>
          )}
          {r && !Array.isArray(q.choices) && (
            <div className="atl-dq__why" data-daily-why="" role="status">
              <p><b>{r.correct ? "Right." : `${(r.parts || []).filter(Boolean).length} of ${(r.parts || []).length} in place.`}</b>{typeof r.why === "string" ? ` ${r.why}` : ""}</p>
              {r.lessons?.length > 0 && <p>Go to lesson: {r.lessons.map((l, i) => <span key={l.path}>{i ? " · " : ""}<Link className="atl__link" to={learnStepHref(base, l.stepId)}>{l.label}</Link></span>)}</p>}
              <p className="atl__quiet">Come back tomorrow for the next one.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ⭐ D154 P2 · MATCH: tap an item on the left, then its partner on the right (buttons, so Tab / Enter / Space work too);
// tap a paired left item again to undo. After the answer each pair shows right or wrong, the right partner, and its why.
function MatchAnswer({ q, r, busy, onAnswer }) {
  const [pick, setPick] = useState(null);            // the left index waiting for a partner
  const [pairs, setPairs] = useState({});            // left index → right's stored index
  const used = new Set(Object.values(pairs));
  const rightText = (i) => q.right.find(x => x.i === i)?.text || "";
  const done = Object.keys(pairs).length === q.left.length;
  if (r) {
    const resp = r.response || [];
    return (
      <ol className="atl-dq__pairs" data-daily-match-result="">
        {q.left.map((l, k) => (
          <li key={k} className="atl-dq__pair" data-state={r.parts?.[k] ? "right" : "wrong"}>
            <b>{l}</b> → {rightText(resp[k])}
            {!r.parts?.[k] && <span> · the match: {rightText(r.answer?.[k])}</span>}
            {Array.isArray(r.why) && r.why[k] && <span className="atl__quiet"> — {r.why[k]}</span>}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="atl-dq__match" data-daily-match="">
      <div className="atl-dq__choices" role="group" aria-label="Items">
        {q.left.map((l, k) => (
          <button key={k} type="button" className="atl-dq__choice" aria-pressed={pick === k} data-state={pick === k ? "picked" : ""}
            onClick={() => { if (pairs[k] != null) { const n = { ...pairs }; delete n[k]; setPairs(n); setPick(k); } else setPick(pick === k ? null : k); }}>
            {l}{pairs[k] != null && <span className="atl__quiet"> → {rightText(pairs[k])}</span>}
          </button>
        ))}
      </div>
      <div className="atl-dq__choices" role="group" aria-label="Partners">
        {q.right.map((x) => (
          <button key={x.i} type="button" className="atl-dq__choice" disabled={pick == null || used.has(x.i)}
            onClick={() => { setPairs({ ...pairs, [pick]: x.i }); setPick(null); }}>{x.text}</button>
        ))}
      </div>
      <button type="button" className="atl-dq__choice atl-dq__go" disabled={!done || busy} onClick={() => onAnswer(q.left.map((_, k) => pairs[k]))}>Check my pairs</button>
    </div>
  );
}

// ⭐ D154 P2 · ORDER: move each step up or down (buttons — keyboard reachable), then check. After the answer each position
// shows right or wrong, and the right order is listed.
function OrderAnswer({ q, r, busy, onAnswer }) {
  const [order, setOrder] = useState(() => q.steps.map(s => s.i));
  const text = (i) => q.steps.find(s => s.i === i)?.text || "";
  const move = (k, d) => { const n = [...order]; const j = k + d; if (j < 0 || j >= n.length) return; [n[k], n[j]] = [n[j], n[k]]; setOrder(n); };
  if (r) {
    const resp = r.response || order;
    return (
      <div data-daily-order-result="">
        <ol className="atl-dq__pairs">{resp.map((i, k) => <li key={k} className="atl-dq__pair" data-state={r.parts?.[k] ? "right" : "wrong"}>{text(i)}</li>)}</ol>
        {!r.correct && <><p className="atl__quiet">The order:</p><ol className="atl-dq__pairs">{(r.answer || []).map((i, k) => <li key={k} className="atl-dq__pair">{text(i)}{Array.isArray(r.why) && r.why[i] ? <span className="atl__quiet"> — {r.why[i]}</span> : null}</li>)}</ol></>}
      </div>
    );
  }
  return (
    <div data-daily-order="">
      <ol className="atl-dq__pairs">
        {order.map((i, k) => (
          <li key={i} className="atl-dq__pair atl-dq__step">
            <span>{text(i)}</span>
            <span className="atl-dq__moves">
              <button type="button" className="atl-dq__move" disabled={k === 0} aria-label={`Move "${text(i)}" up`} onClick={() => move(k, -1)}>↑</button>
              <button type="button" className="atl-dq__move" disabled={k === order.length - 1} aria-label={`Move "${text(i)}" down`} onClick={() => move(k, 1)}>↓</button>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" className="atl-dq__choice atl-dq__go" disabled={busy} onClick={() => onAnswer(order)}>Check my order</button>
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
            {/* ⭐ D150 T05: the audit itself — six questions, about three minutes. */}
            <p><a className="atl__link" href={`/audit?role=${encodeURIComponent(pick)}`} data-audit-take="">Take the 3-minute audit</a></p>
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

/**
 * ⭐ D178 · the Glossary's rows: the Atlas terms (each with its lesson when the path teaches it) and the concept index's
 * other concepts as rows of their own — one list, by name. Pure.
 */
export function glossaryRows(terms = [], concepts = []) {
  const rows = [...terms, ...concepts.map(c => ({ slug: null, concept: true, name: c.name, kind: "concept", meaning: c.meaning, postings: null, learn: c.learn }))];
  return rows.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/** The glossary drawn from GET /api/atlas/glossary — pure (the tests render it). */
export function GlossaryView({ base, terms, concepts = [], q = "", onQ = () => {}, shown = GLOSSARY_PAGE, onMore = () => {} }) {
  const all = useMemo(() => glossaryRows(terms, concepts), [terms, concepts]);
  const hits = searchGlossary(all, q);
  return (
    <div className="atl-pan" data-atlas-panel-body="glossary">
      <PanelHead eyebrow="Glossary" title="The words the market uses"
        lead="Every term in the Atlas and every idea the course teaches, in plain words — with how many open postings use it, and the lesson that teaches it. Hover a linked term in a posting to see the same definition." />
      <input className="atl__input atl-pan__search" type="search" value={q} onChange={(e) => onQ(e.target.value)} maxLength={80}
        aria-label="Search the glossary" placeholder="Search a term" data-glossary-search="" />
      <p className="atl__quiet" role="status" data-glossary-count="">{q.trim() ? `${num(hits.length)} of ${num(all.length)} terms` : `${num(all.length)} terms`}</p>
      <ul className="atl-pan__gloss" data-glossary="">
        {hits.slice(0, shown).map(t => (
          <li key={t.slug || `concept:${t.name}`} className="atl-pan__term" data-glossary-term={t.slug || undefined} data-glossary-concept={t.concept ? t.name : undefined}>
            <div className="atl-pan__term-t">
              <b>{t.name}</b> <span className="mark mark--dim">{KIND_LABEL[t.kind] || t.kind}</span>
              <p className="atl-pan__meaning" data-glossary-meaning="">
                {t.meaning || <span className="atl__quiet">No plain-words definition yet.</span>}
                {t.fromWikipedia && <span className="atl__quiet"> — From <a href={t.wikipediaUrl || "https://en.wikipedia.org"} target="_blank" rel="noopener noreferrer">Wikipedia</a> (CC BY-SA)</span>}
              </p>
            </div>
            {t.postings != null
              ? <span className="atl__count" data-glossary-postings={t.postings}>{num(t.postings)} posting{t.postings === 1 ? "" : "s"}</span>
              : <span />}
            <span className="atl-pan__term-go">
              {t.slug && <Link className="atl__link" to={nodeHref(base, t.slug)} data-glossary-open="">Open in Atlas</Link>}
              {/* ⭐ D178: the concept index's link — the lesson that teaches it, in the course's circle view. */}
              {t.learn && <Link className="atl__link" to={learnStepHref(base, t.learn.stepId)} data-glossary-learn={t.learn.stepId} title={t.learn.label}>Learn it</Link>}
            </span>
          </li>
        ))}
      </ul>
      {hits.length > shown && <button type="button" className="dbx-depth atl-home__go" onClick={onMore} data-glossary-more="">Show more ({num(hits.length - shown)} left)</button>}
    </div>
  );
}

export function GlossaryPanel({ base }) {
  const [terms, setTerms] = useState(null);
  const [concepts, setConcepts] = useState([]);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(GLOSSARY_PAGE);
  useEffect(() => {
    let live = true;
    api("/api/atlas/glossary").then(r => { if (live) { setTerms(r.terms || []); setConcepts(r.concepts || []); } }).catch(() => live && setTerms(false));
    return () => { live = false; };
  }, []);
  useEffect(() => { setShown(GLOSSARY_PAGE); }, [q]);
  if (terms === null) return <p className="atl__quiet" role="status">Opening…</p>;
  if (terms === false) return <p className="atl__quiet" role="alert">The glossary could not be reached just now.</p>;
  return <GlossaryView base={base} terms={terms} concepts={concepts} q={q} onQ={setQ} shown={shown} onMore={() => setShown(n => n + GLOSSARY_PAGE)} />;
}
