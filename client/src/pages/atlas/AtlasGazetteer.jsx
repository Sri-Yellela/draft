// ⭐ D197 Wave 1 #8 (47m, lane gaz) · D201 · THE GAZETTEER AND ROUTES ON REAL DATA — the approved boards Gazetteer (an entry),
// GazetteerIndex (Look anything up) and Route (a route over entries), drawn by plate/Gazetteer.jsx and plate/RouteMap.jsx:
//   /atlas/gazetteer            the index: search with grouped suggestions, Show, Browse by, the A–Z page, the rail
//   /atlas/<slug>               an entry for an Atlas term (a role, skill, tool, stack, concept — the old node page)
//   /atlas/gazetteer/<lesson>   an entry for a place (a lesson of the course) or a coding pattern
//   /atlas/routes               every route (the courses, the guided routes, the pathways, the guides' ladder, the builds)
//   /atlas/routes/<id>          one route on the physical map, its stops, its rail
// The data is Atlas's own (gazetteerModel.js says where each part comes from); nothing here calls a model (D190). Earning
// is the one rule (D117 C8): open a link from here, explain a checkpoint in your own words, link what you built — the same
// three writes the circle made (POST /api/learn/opened · PUT /explained · PUT /built); nothing is ticked by hand.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import PlateRoot from "../../plate/PlateRoot.jsx";
import RouteMap, { RouteLegend, ProjectRoute } from "../../plate/RouteMap.jsx";
import { GoLink, GzCard, PlateChip, GzSquares, CrossRefText, LookUp, GzChip, ShowBrowse, DictRow, AzPage, PlateCards, RoleRows, StageBands,
  InterviewRows, IndexRail, DueRow, Door, RouteRow, WordChip, EntryHead, WatchIt, WhereItRuns, WhyItWorks, PracticeLadder, Compass, ReadMore,
  EntryRoutes, EntrySide, RouteHead, StopsList, StopRow, RouteStamp, RouteFacts } from "../../plate/Gazetteer.jsx";
import { entriesOf, showCounts, showFilter, searchEntries, matchedPart, byLetter, LETTERS, letterOf, regionCounts, stageCounts, roleRows,
  interviewRows, dueList, dueMinutes, routesOf, stopStates, routeProgress, mapWindow, routesThrough, crossings, readMine, writeMine, joinRoute,
  leaveRoute, copyRoute, dropStop, myCopies, practiceLadder, crossRefs, neighbours, deckFor, flowFor, compassOf, entryHref, routeHref, SHOW,
  BROWSE, KIND_WORD, lessonsOf } from "./gazetteerModel.js";
import { STAGES } from "./volumeModel.js";
import { routesFor, pasteVerdict } from "./learnModel.js";
import { coursePieces, lessonState } from "./libraryModel.js";
import { loadNode, resolveSearch, payLine, computedLine, orderedResources, WIKI_LICENCE } from "./atlasModel.js";
import { localDay, MatchAnswer, OrderAnswer } from "./BankAnswers.jsx";
import { checkpointId, buildId, wordCount, EXPLAIN_MIN_WORDS } from "../../../../shared/learnStepState.js";
import LearnView from "./LearnView.jsx";   // the circle (D203 (8): a route's overview view), until a plate ring is drawn

const COURSE = "silicon-to-software", PATTERNS = "coding-interview-patterns";
const cache = new Map();
function loadOnce(key, fn, ttl = 20000) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.p;
  const p = fn().catch((e) => { cache.delete(key); throw e; });
  cache.set(key, { at: Date.now(), p });
  return p;
}
const soft = (p) => p.catch(() => null);
const PUBLIC = { glossary: "/api/atlas/glossary", course: `/api/learn/course/${COURSE}`, patterns: `/api/learn/course/${PATTERNS}`, circle: "/api/learn/circle",
  pathways: "/api/learn/pathways", guides: "/api/learn/guides", ideas: "/api/learn/how-it-works", content: "/api/learn", me: "/api/atlas/me" };
const PRIVATE = { earned: "/api/learn/earned", checks: () => `/api/learn/checks?day=${localDay()}`, readiness: "/api/readiness", questions: "/api/interview/questions" };

/** Atlas's data for the Gazetteer: each part is loaded once (20 s), and a part that fails is null — never the whole page. */
export function useGazetteerData(signedIn, parts = []) {
  const [d, setD] = useState({ status: "loading" });
  const [tick, setTick] = useState(0);
  const want = parts.join(",");
  useEffect(() => {
    let live = true;
    const list = want.split(",").filter(Boolean);
    Promise.all(list.map((k) => {
      if (PUBLIC[k]) return soft(loadOnce(k, () => api(PUBLIC[k]), k === "content" || k === "ideas" ? 60000 : 20000));
      if (PRIVATE[k]) return signedIn ? soft(loadOnce(k, () => api(typeof PRIVATE[k] === "function" ? PRIVATE[k]() : PRIVATE[k]))) : Promise.resolve(null);
      return Promise.resolve(null);
    })).then((vals) => {
      if (!live) return;
      const out = Object.fromEntries(list.map((k, i) => [k, vals[i]]));
      const core = list.filter((k) => k === "glossary" || k === "course");
      setD({ status: core.length && core.every((k) => out[k] == null) ? "error" : "ready", ...out });
    });
    return () => { live = false; };
  }, [want, signedIn, tick]);
  const retry = useCallback(() => { cache.clear(); setTick((t) => t + 1); }, []);
  const patch = useCallback((fn) => setD((x) => fn(x)), []);
  return { ...d, retry, patch };
}

const useGo = () => { const navigate = useNavigate(); return useCallback((href) => navigate(href), [navigate]); };
const regionHref = (base, e) => (e?.region ? `${base}/region/${["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].indexOf(e.region.roman) + 1}${e.lessonId && !e.pattern ? `?at=${encodeURIComponent(e.lessonId)}` : ""}` : `${base}`);
const marketHref = (base) => (base.startsWith("/app") ? "/app/jobs" : "/jobs");
const num = (n) => Number(n || 0).toLocaleString("en-US");
const useEntries = (d) => useMemo(() => entriesOf({ glossary: d.glossary, course: d.course, patterns: d.patterns, marks: d.earned?.marks || {}, checks: d.checks }),
  [d.glossary, d.course, d.patterns, d.earned, d.checks]);
function useRoutes(d, entries) {
  return useMemo(() => {
    const circleRoutes = d.course && d.circle ? routesFor(d.circle, coursePieces(d.course, d.circle), null).filter((r) => r.id !== "all") : [];
    return routesOf({ course: d.course, patterns: d.patterns, circleRoutes, pathways: d.pathways, guides: d.guides, entries });
  }, [d.course, d.patterns, d.circle, d.pathways, d.guides, entries]);
}
const stopHref = (base, s) => (s.deck ? `${base}/library/${encodeURIComponent(s.deck)}` : s.planned ? null : entryHref(base, s));
const recentKey = "atlas.gazetteer.recent";
function remember(e) {
  try {
    const v = JSON.parse(localStorage.getItem(recentKey) || "[]").filter((x) => x.key !== e.key);
    localStorage.setItem(recentKey, JSON.stringify([{ key: e.key, name: e.name, slug: e.slug || null, lessonId: e.lessonId || null }, ...v].slice(0, 6)));
  } catch { /* private mode: nothing remembered */ }
}
const recentList = () => { try { return JSON.parse(localStorage.getItem(recentKey) || "[]"); } catch { return []; } };

/** The suggestion groups for a query: entries, then an interview question, a route and ⇄ the market. */
function suggestions(base, q, entries, routes, questions) {
  const hits = searchEntries(entries, q, 5);
  const t = String(q || "").trim().toLowerCase();
  const items = hits.map((e) => ({ id: e.key, href: entryHref(base, e), word: e.name, match: matchedPart(e.name, q), region: e.region, line: e.meaning, squares: e.squares }));
  const also = [];
  const qq = t ? (questions || []).find((x) => String(x.question || "").toLowerCase().includes(t)) : null;
  if (qq && hits[0]) also.push({ id: `q:${qq.id}`, href: entryHref(base, hits[0]), kind: "question", kindLabel: "QUESTION", text: `“${qq.question}”`, tail: `→ ${hits[0].name}` });
  const r = t ? routes.find((x) => x.stops.some((s) => hits.some((h) => h.key === s.key)) || x.name.toLowerCase().includes(t)) : null;
  if (r) { const i = r.stops.findIndex((s) => hits.some((h) => h.key === s.key)); also.push({ id: `r:${r.id}`, href: routeHref(base, r.id), kind: "route", kindLabel: "ROUTE", text: r.name, tail: i >= 0 ? `· stop ${i + 1} of ${r.stops.length}` : `· ${r.stops.length} stops` }); }
  const m = hits.find((e) => e.postings);
  if (m) also.push({ id: `m:${m.key}`, href: marketHref(base), kind: "market", kindLabel: "⇄ MARKET", text: `${num(m.postings)} openings ask for ${m.name}` });
  return [{ id: "entries", label: "ENTRIES", items }, { id: "also", label: "ALSO MATCHES", items: also }];
}

function Message({ status, onRetry, what }) {
  if (status === "error") return <p className="pl-gz-msg" role="alert">The {what} didn’t load. <button type="button" className="pl-btn" onClick={onRetry}>Try again</button></p>;
  return <p className="pl-gz-msg" role="status">Opening the {what}…</p>;
}

// ══ /atlas/gazetteer — THE INDEX ══════════════════════════════════════════════════════════════════════════════════
export function GazetteerIndexPage({ base, signedIn }) {
  const location = useLocation();
  const navigate = useNavigate();
  const go = useGo();
  const d = useGazetteerData(signedIn, ["glossary", "course", "patterns", "circle", "pathways", "guides", "me", "earned", "checks", "readiness", "questions"]);
  const entries = useEntries(d);
  const routes = useRoutes(d, entries);
  const params = new URLSearchParams(location.search);
  const [q, setQ] = useState(params.get("q") || "");
  useEffect(() => { setQ(new URLSearchParams(location.search).get("q") || ""); }, [location.search]);
  const show = SHOW.some((s) => s.id === params.get("show")) ? params.get("show") : "all";
  const browse = BROWSE.some((s) => s.id === params.get("by")) ? params.get("by") : "az";
  const set = (k, v) => { const p = new URLSearchParams(location.search); if (v == null || v === "") p.delete(k); else p.set(k, v); navigate(`${location.pathname}${p.toString() ? `?${p}` : ""}`, { replace: true }); };
  const shown = showFilter(entries, show);
  const pick = params.get("region") || params.get("stage") || params.get("iv");
  const narrowed = params.get("region") ? shown.filter((e) => e.region?.roman === params.get("region"))
    : params.get("stage") ? shown.filter((e) => STAGES[e.stage]?.id === params.get("stage"))
    : params.get("iv") ? (() => { const r = interviewRows(entries, d.questions?.questions, entries.filter((e) => e.pattern)).find((x) => x.id === params.get("iv")); const keys = new Set((r?.entries || []).map((e) => e.key)); return shown.filter((e) => keys.has(e.key)); })()
    : shown;
  const letters = byLetter(narrowed);
  const have = new Set(letters.keys());
  const letter = have.has(params.get("letter")) ? params.get("letter") : [...have].sort()[0] || "A";
  const page = letters.get(letter) || [];
  const half = Math.ceil(page.length / 2);
  const row = (e) => <DictRow key={e.key} word={e.name} kind={e.kind === "place" || e.kind === "term" ? null : KIND_WORD[e.kind]} href={entryHref(base, e)} onGo={go} region={e.region} regionHref={regionHref(base, e)}
    squares={e.squares} line={<CrossRefText parts={crossRefs(e.meaning, entries, e.key, 2).map((p) => (typeof p === "string" ? p : { text: p.text, href: entryHref(base, p.entry) }))} onGo={go}/>}
    meta={metaLine(e, routes)}/>;
  const sorted = [...have].sort();
  const li = sorted.indexOf(letter);
  const counts = showCounts(entries);
  const total = entries.length, lit = counts.lit;
  const proven = new Set((d.readiness?.skills || []).filter((s) => s.state === "checked" || s.state === "built").map((s) => String(s.skill || s.name || "").toLowerCase()));
  const roles = roleRows(d.me?.exploreByRole?.items || [], proven);
  const due = dueList(entries);
  const mineIds = Object.keys(readMine());
  const myRoutes = [...routes.filter((r) => mineIds.includes(r.id)), ...myCopies(readMine(), routes)];
  const yourRoutes = (myRoutes.length ? myRoutes : routes.filter((r) => r.stops.some((s) => s.state === "lit")).slice(0, 3));
  const recent = recentList();
  const firstMissing = d.me?.exploreByRole?.items?.[0]?.topSkills?.map((s) => entries.find((e) => e.slug === s.slug)).find((e) => e && e.state !== "lit");
  const plateFirst = entries.find((e) => e.kind === "place" && e.state !== "lit");
  const iq = d.questions?.questions?.[0];
  if (d.status !== "ready") return <PlateRoot className="pl-at-page"><Message status={d.status} onRetry={d.retry} what="Gazetteer"/></PlateRoot>;
  const range = page.length ? `${page[0].name} — ${page[page.length - 1].name}` : null;
  const regionTitle = pick ? (params.get("region") ? `PLATE ${params.get("region")}` : params.get("stage") ? params.get("stage").toUpperCase() : "THIS ROUND") : null;
  return (
    <PlateRoot region="III" className="pl-at-page" data-gazetteer-index="">
      <div className="pl-gz-page">
        <p className="pl-gz-kicker"><span className="pl-gz-k pl-gz-k--muted">THE GAZETTEER</span> Every concept is one entry. Start from a word, a region, a role, a stage, an interview, or whatever is due.</p>
        <header className="pl-gz-ihead">
          <span className="pl-gz-k">VOL. I · GAZETTEER · {num(total)} ENTRIES{signedIn ? ` · YOU’VE LIT ${num(lit)}` : ""}</span>
          <h1 className="pl-gz-ihead__title">Look anything up</h1>
          <LookUp value={q} onChange={setQ} onGo={go} groups={suggestions(base, q, entries, routes, d.questions?.questions)}
            onSubmit={async (v) => {
              const t = String(v || "").trim();
              if (!t) return;
              const hit = searchEntries(entries, t, 1)[0];
              if (hit && hit.name.toLowerCase() === t.toLowerCase()) { remember(hit); go(entryHref(base, hit)); return; }
              const r = await resolveSearch(t).catch(() => null);   // an alias ("k8s") lands on its entry, as the old search did
              if (r?.go) go(`${base}/${encodeURIComponent(r.go)}`); else set("q", t);
            }}/>
          <ShowBrowse show={show} shows={SHOW} counts={counts} onShow={(id) => set("show", id === "all" ? null : id)} browse={browse} browses={BROWSE}
            onBrowse={(id) => { set("by", id === "az" ? null : id); setTimeout(() => document.getElementById(id === "az" ? "az" : `by-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}/>
        </header>
        <div className="pl-gz-cols">
          <div className="pl-gz-main">
            {params.get("q") ? (
              <GzCard title={`LOOKED UP · “${params.get("q").toUpperCase()}”`} right={`${searchEntries(entries, params.get("q"), 40).length} FOUND`} id="results">
                {searchEntries(entries, params.get("q"), 40).length ? searchEntries(entries, params.get("q"), 40).map(row)
                  : <p className="pl-gz-empty" data-atlas-none="">Nothing in the Gazetteer matches “{params.get("q")}” yet. <button type="button" className="pl-btn" onClick={() => set("q", null)}>Clear</button></p>}
              </GzCard>
            ) : null}
            {pick ? <p className="pl-gz-empty">Showing {regionTitle}. <button type="button" className="pl-btn" onClick={() => { const p = new URLSearchParams(location.search); ["region", "stage", "iv"].forEach((k) => p.delete(k)); navigate(`${location.pathname}?${p}`, { replace: true }); }}>Show every entry</button></p> : null}
            <AzPage letter={letter} letters={LETTERS} have={have} onLetter={(L) => set("letter", L)} range={range} count={page.length}
              cols={[page.slice(0, half).map(row), page.slice(half).map(row)]}
              empty={page.length ? null : show === "due" ? "Nothing is due for review today." : "Nothing here yet."}
              prev={li > 0 ? { letter: sorted[li - 1], onClick: () => set("letter", sorted[li - 1]) } : null}
              next={li >= 0 && li < sorted.length - 1 ? { letter: sorted[li + 1], onClick: () => set("letter", sorted[li + 1]) } : null}/>
            <GzCard title="BROWSE BY REGION · THE EIGHT PLATES OF VOL. I" right="TAP A PLATE = ITS ENTRIES" id="by-region">
              <PlateCards regions={regionCounts(entries)} onPick={(r) => { set("region", r.roman); document.getElementById("az")?.scrollIntoView({ behavior: "smooth" }); }}/>
            </GzCard>
            <GzCard title="BROWSE BY ROLE · WHAT THE MARKET ASKS, AND WHAT YOU’VE PROVEN" right="⇄ THE MARKET · YOUR SURVEY" id="by-role">
              <RoleRows rows={roles} onGo={go} signedIn={signedIn} roleHref={(r) => `${base}/${encodeURIComponent(r.slug)}`} surveyHref={() => `${base}/your-map`}/>
              <p className="pl-gz-foot">The counts come from the openings on the market this week; the % counts only proven skills.</p>
            </GzCard>
            <GzCard title="BROWSE BY STAGE · ONE SCALE FOR EVERYTHING" right="HEIGHT = WHAT YOU’VE PROVEN" id="by-stage">
              <StageBands stages={stageCounts(entries)} onPick={(s) => { set("stage", s.id); document.getElementById("az")?.scrollIntoView({ behavior: "smooth" }); }}/>
            </GzCard>
            <GzCard title="BROWSE BY INTERVIEW" id="by-interview">
              <InterviewRows rows={interviewRows(entries, d.questions?.questions, entries.filter((e) => e.pattern))} onPick={(r) => { set("iv", r.id); document.getElementById("az")?.scrollIntoView({ behavior: "smooth" }); }}
                empty={signedIn ? "Log a round in Interview → Debrief and its questions file their entries here." : "Sign in: the rounds you log in Interview file their entries here."}/>
            </GzCard>
          </div>
          <IndexRail>
            {signedIn ? (
              <GzCard title={`DUE FOR REVIEW · ${due.length}`} tone="clay" data-gazetteer-due="">
                <p className="pl-gz-rail__lead">Entries you lit a while ago come back so they stay lit.</p>
                {due.length ? due.slice(0, 4).map((e) => <DueRow key={e.key} word={e.name} href={`${entryHref(base, e)}#practice`} onGo={go} region={e.region} stage={STAGES[e.stage]?.label.toUpperCase() || "—"} when={`${e.due} DUE`}/>)
                  : <p className="pl-gz-empty">Nothing is due today.</p>}
                {due.length ? <div className="pl-gz-acts">
                  <GoLink className="pl-btn pl-btn--ink" href={`${entryHref(base, due[0])}#practice`} onGo={go}>Review {Math.min(4, due.length)} · about {dueMinutes(due.slice(0, 4).reduce((a, e) => a + e.due, 0))} min</GoLink>
                  {due.length > 4 ? <button type="button" className="pl-btn" onClick={() => set("show", "due")}>Show all {due.length}</button> : null}
                </div> : null}
              </GzCard>
            ) : null}
            <GzCard title="START ANYWHERE">
              <div className="pl-gz-doors">
                {firstMissing ? <Door kicker="A JOB’S MISSING SKILL" text={`${firstMissing.name}: the market asks for it`} href={entryHref(base, firstMissing)} onGo={go} tone="market"/> : null}
                {iq ? <Door kicker="AN INTERVIEW QUESTION" text={`“${iq.question}”`} href={`${base}/gazetteer?by=interview`} onGo={go} tone="question"/> : null}
                <Door kicker="A PLOT ON YOUR SURVEY" text="Your skills as plots: what a role needs, what you’ve claimed" href={`${base}/your-map`} onGo={go} tone="route"/>
                {plateFirst ? <Door kicker="A PLACE ON THE MAP" text={`Region ${plateFirst.region?.roman} · ${plateFirst.name}`} href={regionHref(base, plateFirst)} onGo={go} tone="place"/> : null}
              </div>
            </GzCard>
            <GzCard title="YOUR ROUTES">
              {yourRoutes.length ? yourRoutes.map((r) => { const p = routeProgress(r.stops); return <RouteRow key={r.id} name={r.name} lit={p.lit} total={p.total} href={routeHref(base, r.id)} onGo={go}/>; })
                : <p className="pl-gz-empty">No route started yet.</p>}
              <div className="pl-gz-acts"><GoLink className="pl-btn" href={`${base}/routes`} onGo={go}>All routes →</GoLink></div>
            </GzCard>
            <GzCard title="RECENTLY LOOKED UP">
              {recent.length ? <div className="pl-gz-words">{recent.map((x) => <WordChip key={x.key} href={x.slug ? `${base}/${encodeURIComponent(x.slug)}` : `${base}/gazetteer/${encodeURIComponent(x.lessonId)}`} onGo={go}>{x.name}</WordChip>)}</div>
                : <p className="pl-gz-empty">The entries you open show here (kept in this browser).</p>}
            </GzCard>
          </IndexRail>
        </div>
      </div>
    </PlateRoot>
  );
}

/** A row's "where it's used" line: ON N ROUTES · N QUESTIONS · N OPENINGS · its lesson. */
function metaLine(e, routes) {
  const on = routes.filter((r) => r.stops.some((s) => s.key === e.key || (e.lessonId && s.lessonId === e.lessonId))).length;
  const parts = [on ? `ON ${on} ROUTE${on === 1 ? "" : "S"}` : "NOT ON A ROUTE YET"];
  if (e.postings) parts.push(`${num(e.postings)} OPENINGS`);
  if (e.due) parts.push(`${e.due} DUE`);
  if (e.fromWikipedia) parts.push("MEANING FROM WIKIPEDIA (CC BY-SA)");
  return parts.join(" · ");
}

// ══ AN ENTRY ═══════════════════════════════════════════════════════════════════════════════════════════════════════
/** One checkpoint, explained in the reader's own words (≥ 25 words, never a paste of 25+) — the circle's rule, kept. */
function Explain({ id, question, saved, signedIn, onExplain }) {
  const [text, setText] = useState(saved?.text || "");
  const [pasted, setPasted] = useState(0);
  const [say, setSay] = useState("");
  const words = wordCount(text);
  if (!signedIn) return <li className="pl-gz-check" data-learn-checkpoint={id}><span className="pl-gz-check__q">{question}</span></li>;
  return (
    <li className="pl-gz-check" data-learn-checkpoint={id} data-done={saved ? "" : undefined}>
      <label className="pl-gz-check__q" htmlFor={`gz-exp-${id}`}>{question}</label>
      <textarea id={`gz-exp-${id}`} className="pl-gz-check__box" value={text} data-learn-explain={id} placeholder="Explain it in your own words, as if teaching a friend (25 words or more)"
        onChange={(e) => { setText(e.target.value); setSay(""); }}
        onPaste={(e) => { const v = pasteVerdict(e.clipboardData?.getData("text") || ""); if (v.refused) { e.preventDefault(); setSay(v.message); } else setPasted((p) => Math.max(p, v.words)); }}/>
      <div className="pl-gz-check__foot">
        <span aria-live="polite">{say || (saved ? `Explained · ${words} words` : `${words} of ${EXPLAIN_MIN_WORDS} words`)}</span>
        <button type="button" className="pl-btn" disabled={words < EXPLAIN_MIN_WORDS || text === saved?.text} data-learn-save={id}
          onClick={async () => { const r = await onExplain(id, text, pasted); setSay(r?.ok ? "Saved. The square lights when every checkpoint is explained." : r?.message || "Could not save it just now."); if (r?.ok) setPasted(0); }}>
          {saved ? "Save my changes" : "Save my explanation"}</button>
      </div>
    </li>
  );
}
function BuildLink({ step, saved, onBuild }) {
  const [url, setUrl] = useState(saved?.url || "");
  const [kind, setKind] = useState(saved?.kind || "repository");
  const [say, setSay] = useState("");
  return (
    <div data-learn-build={step}>
      <p className="pl-gz-empty">This entry asks you to build something. Link it (a repository or a live demo) to light it.</p>
      <div className="pl-gz-build">
        <select className="pl-gz-input" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="What the link is"><option value="repository">Repository</option><option value="demo">Live demo</option></select>
        <input type="url" className="pl-gz-input pl-gz-input--grow" value={url} onChange={(e) => { setUrl(e.target.value); setSay(""); }} placeholder="https://github.com/you/your-project" aria-label="The link to what you built"/>
        <button type="button" className="pl-btn" disabled={!url.trim() || url === saved?.url} data-learn-build-save="" onClick={async () => { const r = await onBuild(step, url.trim(), kind); setSay(r?.ok ? "Linked." : r?.message || "Could not save it just now."); }}>Save the link</button>
      </div>
      {say ? <p className="pl-gz-foot" aria-live="polite">{say}</p> : null}
    </div>
  );
}

/** The entry's practice: the piece's bank questions on the one scale; Try it opens one in place, judged on the server. */
function EntryPractice({ pieceId, signedIn, deckCheck, deckId, asked }) {
  const [d, setD] = useState(null);
  const [cur, setCur] = useState(null);
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const day = localDay();
  useEffect(() => {
    let live = true;
    setD(null); setCur(null); setR(null);
    if (!pieceId) { setD({ questions: [] }); return undefined; }
    api(`/api/learn/piece/${encodeURIComponent(pieceId)}/questions?day=${day}`).then((x) => live && setD(x)).catch(() => live && setD({ questions: [] }));
    return () => { live = false; };
  }, [pieceId, day, signedIn]);
  const qs = d?.questions || [];
  const rungs = practiceLadder(qs).map((rung) => {
    const q = rung.questions[0];
    const right = q && d?.state && !(d.state.due || []).includes(q.id) && d.state.checked;
    return { ...rung, text: q?.stem || null, lit: !!right, asked: rung.id === "master" && asked ? asked : null,
      empty: rung.id === "start" && deckCheck ? "The explainer’s last slide asks one — Watch it." : undefined,
      action: q ? (signedIn ? <button type="button" className="pl-btn" onClick={() => { setCur(q.id); setR(null); setErr(""); }} data-gazetteer-try={q.id}>{(d?.state?.due || []).includes(q.id) ? "Again" : "Try it"}</button>
        : <span className="pl-gz-k pl-gz-k--muted">SIGN IN TO ANSWER</span>) : null };
  });
  const q = qs.find((x) => x.id === cur) || null;
  const answer = async (chosen, response = null) => {
    if (busy || r || !q) return;
    setBusy(true); setErr("");
    try {
      const out = await api(`/api/learn/piece/${encodeURIComponent(pieceId)}/answer`, { method: "POST", body: JSON.stringify(response ? { questionId: q.id, response, day } : { questionId: q.id, chosen, day }) });
      setR(out.result); setD((x) => ({ ...x, state: out.state, next: out.next }));
    } catch (e) { setErr(e.message || "That answer didn’t save."); } finally { setBusy(false); }
  };
  const due = d?.state?.due?.length || 0;
  return (
    <div id="practice">
      <PracticeLadder rungs={rungs} right={qs.length ? `${qs.length} QUESTION${qs.length === 1 ? "" : "S"}${due ? ` · ${due} DUE` : ""}` : "NONE WRITTEN YET"}>
        {!qs.length ? <p className="pl-gz-foot">No approved question is filed against this entry yet{deckId ? "; its explainer ends in one" : ""}.</p> : null}
        {q ? (
          <div className="pl-gz-q" data-learn-question={q.id} aria-live="polite">
            <p className="pl-gz-q__stem">{q.stem}</p>
            {q.type === "match" ? <MatchAnswer key={q.id} q={q} r={r} busy={busy} onAnswer={(resp) => answer(null, resp)}/> : null}
            {q.type === "order" ? <OrderAnswer key={q.id} q={q} r={r} busy={busy} onAnswer={(resp) => answer(null, resp)}/> : null}
            {Array.isArray(q.choices) ? (
              <div className="pl-gz-q__choices" role="group" aria-label="Choices">
                {q.choices.map((c, i) => <button key={i} type="button" className="pl-gz-q__choice" disabled={!!r || busy} onClick={() => answer(i)}
                  data-state={r ? (i === r.correctIndex ? "right" : i === r.chosen ? "wrong" : undefined) : undefined}>{c}</button>)}
              </div>
            ) : null}
            {r ? (
              <div data-learn-why="">
                {Array.isArray(q.choices)
                  ? <><p className="pl-gz-q__why"><b>{r.correct ? "Right." : "Not quite."}</b> {r.why?.chosen}</p>{!r.correct && r.why?.right ? <p className="pl-gz-q__why"><b>The stronger move:</b> {r.why.rightChoice} — {r.why.right}</p> : null}</>
                  : <p className="pl-gz-q__why"><b>{r.correct ? "Right." : `${(r.parts || []).filter(Boolean).length} of ${(r.parts || []).length} in place.`}</b>{typeof r.why === "string" ? ` ${r.why}` : ""}</p>}
                {!r.correct ? <p className="pl-gz-foot">It comes back for review tomorrow (1 → 3 → 7 → 21 days).</p> : null}
                <div className="pl-gz-acts"><button type="button" className="pl-btn" onClick={() => { setCur(d?.next && d.next !== q.id ? d.next : null); setR(null); }} data-learn-next="">{d?.next && d.next !== q.id ? "Next question" : "Done"}</button></div>
              </div>
            ) : null}
            {err ? <p className="pl-gz-foot" role="alert">{err}</p> : null}
          </div>
        ) : null}
      </PracticeLadder>
    </div>
  );
}

/** The earned record and its three writes (the circle's useEarned, here for an entry). */
function useEarnedWrites(signedIn, patch) {
  const fail = (e) => ({ ok: false, message: e?.payload?.message || e?.message || "Could not save it just now." });
  const mark = (id, extra = {}) => patch((x) => ({ ...x, earned: { ...(x.earned || {}), marks: { ...(x.earned?.marks || {}), [id]: Math.floor(Date.now() / 1000) }, ...extra(x) } }));
  const onOpen = (link) => {
    if (!signedIn || !link?.id) return;
    api("/api/learn/opened", { method: "POST", body: JSON.stringify({ id: link.id }), keepalive: true }).then(() => mark(link.id, () => ({}))).catch(() => {});
  };
  const onExplain = async (id, text, pasted) => {
    try {
      const r = await api("/api/learn/explained", { method: "PUT", body: JSON.stringify({ id, text, pasted }) });
      mark(id, (x) => ({ explanations: { ...(x.earned?.explanations || {}), [id]: { text, words: r.words } } }));
      cache.delete("earned");
      return r;
    } catch (e) { return fail(e); }
  };
  const onBuild = async (step, url, kind) => {
    try {
      const r = await api("/api/learn/built", { method: "PUT", body: JSON.stringify({ step, url, kind }) });
      mark(buildId(step), (x) => ({ builds: { ...(x.earned?.builds || {}), [step]: { url, kind } } }));
      cache.delete("earned");
      return r;
    } catch (e) { return fail(e); }
  };
  return { onOpen, onExplain, onBuild };
}

/** A checkpoint's words: the course content's own (GET /api/learn PARTS → steps → c). */
function checkpointText(content, stepId) {
  for (const part of content?.PARTS || []) for (const ph of part.phases || []) for (const st of ph.steps || []) if (st.id === stepId) return st.c || [];
  return [];
}

/**
 * /atlas/<slug> (a term) and /atlas/gazetteer/<lesson> (a place or a pattern) — ONE entry page. A term the course teaches
 * carries its lesson (checks, links, practice); a lesson that teaches a published term carries the term's board data.
 */
export function GazetteerEntryPage({ base, signedIn, slug = null, lessonId = null }) {
  const location = useLocation();
  const go = useGo();
  const d = useGazetteerData(signedIn, ["glossary", "course", "patterns", "circle", "pathways", "guides", "ideas", "content", "earned", "checks"]);
  const entries = useEntries(d);
  const routes = useRoutes(d, entries);
  const [node, setNode] = useState({ status: slug ? "loading" : "none", node: null });
  const lessons = useMemo(() => [...lessonsOf(d.course), ...lessonsOf(d.patterns)], [d.course, d.patterns]);
  const lesson0 = lessonId ? lessons.find((l) => l.id === lessonId) || null : null;
  const piece = lessonId ? d.circle?.pieces?.[lessonId] : null;
  const teachSlug = slug || piece?.teaches?.find((t) => t.slug)?.slug || null;
  useEffect(() => {
    let live = true;
    if (!teachSlug) { setNode({ status: "none", node: null }); return undefined; }
    setNode({ status: "loading", node: null });
    loadNode(teachSlug).then((n) => live && setNode({ status: n ? "done" : "missing", node: n })).catch((e) => live && setNode({ status: "error", node: null, error: e.message }));
    return () => { live = false; };
  }, [teachSlug]);
  const n = node.node;
  const lesson = lesson0 || (n?.learn ? lessons.find((l) => l.id === n.learn.stepId) || null : null);
  const entry = entries.find((e) => (slug ? e.slug === slug : e.lessonId === lessonId && (e.kind === "place" || e.kind === "pattern")));
  const writes = useEarnedWrites(signedIn, d.patch);
  useEffect(() => { if (entry) remember(entry); }, [entry?.key]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (location.hash === "#practice") setTimeout(() => document.getElementById("practice")?.scrollIntoView({ behavior: "smooth" }), 60); }, [location.hash, d.status]);
  if (d.status !== "ready" || (slug && node.status === "loading")) return <PlateRoot className="pl-at-page"><Message status={d.status === "ready" ? "loading" : d.status} onRetry={d.retry} what="entry"/></PlateRoot>;
  if ((slug && (node.status === "missing" || node.status === "error")) || (lessonId && !lesson0)) {
    return (
      <PlateRoot className="pl-at-page">
        <p className="pl-gz-msg" role="status" data-atlas-missing="">{node.status === "error" ? `The Atlas could not be reached: ${node.error}` : "There’s no Gazetteer entry by that name."} <GoLink href={`${base}/gazetteer`} onGo={go}>Look it up in the Gazetteer</GoLink></p>
      </PlateRoot>
    );
  }
  const name = n?.name || lesson?.title || entry?.name || slug;
  const self = entry || { key: slug ? `t:${slug}` : `l:${lessonId}`, name, region: lesson?.region || null, stage: lesson?.stage ?? null, squares: 0 };
  const marks = d.earned?.marks || {};
  const region = lesson?.region || self.region;
  const stageI = lesson?.stage ?? self.stage;
  const meaningText = n?.definition || (lesson ? lesson.goal : "") || entry?.meaning || "";
  const fromWiki = !n?.definition && !!n?.wikipedia?.extract && !lesson;
  const toRef = (p) => (typeof p === "string" ? p : { text: p.text, href: entryHref(base, p.entry) });
  const meaning = <CrossRefText parts={crossRefs(fromWiki ? n.wikipedia.extract.split(/(?<=\.)\s/)[0] : meaningText, entries, self.key).map(toRef)} onGo={go}/>;
  const deck = deckFor(name, d.guides);
  const video = (lesson?.links || []).find((x) => x.kind === "Video" && x.url);
  const flow = flowFor(name, deck?.id, d.ideas?.ideas);
  const checks = lesson && !lesson.pattern && d.course?.modules?.some((m) => m.lessons.some((l) => l.id === lesson.id)) ? checkpointText(d.content, lesson.id) : [];
  const lessonTitles = new Map(lessons.map((l) => [l.id, l.title]));
  const compass = compassOf({ node: n, piece: lesson ? d.circle?.pieces?.[lesson.id] : null, lessonTitles, entries });
  const through = routesThrough(routes, self.key).concat(lesson && !entry?.lessonId ? routesThrough(routes, `l:${lesson.id}`) : []);
  const drawnR = through[0]?.route;
  const drawn = drawnR ? (() => { const st = stopStates(drawnR.stops); const w = mapWindow(st, 9); return <RouteMap small stops={w.stops.map((s) => ({ id: s.key, name: s.name, region: s.region?.roman || "IV", regionName: s.region?.name, stage: s.stage ?? 0, state: s.mapState, href: stopHref(base, s) || undefined }))} onStop={(s) => s.href && go(s.href)} label={`The ${drawnR.name} route around ${name}`}/>; })() : null;
  const stats = n?.onTheBoard;
  const where = [];
  if (stats?.postings) where.push(<><b>{num(stats.postings)}</b> open postings ask for {name}{stats.topRoles?.length ? <>, most for {stats.topRoles.slice(0, 3).map((r, i) => <span key={r.slug}>{i ? ", " : ""}<GoLink href={`${base}/${encodeURIComponent(r.slug)}`} onGo={go} className="pl-gz-xref">{r.name}</GoLink></span>)}</> : null}.</>);
  if (n?.kind === "role" && n.roleBoard?.companies?.items?.length) where.push(<>Hiring now: {n.roleBoard.companies.items.slice(0, 5).map((c) => c.company).join(", ")}{n.roleBoard.companies.total > 5 ? ` and ${n.roleBoard.companies.total - 5} more` : ""}.</>);
  if (stats?.topSkills?.length && n?.kind !== "role") where.push(<>Often asked for with it: {stats.topSkills.slice(0, 4).map((s, i) => <span key={s.slug}>{i ? ", " : ""}<GoLink href={`${base}/${encodeURIComponent(s.slug)}`} onGo={go} className="pl-gz-xref">{s.name}</GoLink></span>)}.</>);
  const pay = payLine((n?.kind === "role" ? n.roleBoard?.pay : null) || stats?.pay);
  if (pay) where.push(<>Pay where postings state it: {pay}.</>);
  if (n?.sponsors?.length) where.push(<>Certified LCAs on record: {n.sponsors.slice(0, 4).map((s) => `${s.company} (${s.postings} open)`).join(", ")} — a record of filings, not a promise.</>);
  if (lesson?.pattern && lesson.where?.length) where.push(<>Where it shows up: {lesson.where.join(", ")}.</>);
  const resources = [...orderedResources(n?.resources || []).map((r) => ({ id: r.url, url: r.url, title: r.title, kind: r.format || "Article", by: r.cost === "free" ? "free" : null })),
    ...((lesson?.links || []).filter((x) => x.url && !["Build", "Project", "Atlas"].includes(x.kind)).map((x) => ({ id: x.id, url: x.url, title: x.title, kind: x.kind, by: x.source?.name || x.by, opened: !!marks[x.id] })))];
  const letters = byLetter(entries.filter((e) => e.kind !== "place"));
  const L = letterOf(name);
  const near = neighbours(entries, self.key, 7).map((e) => ({ key: e.key, name: e.name, region: e.region, href: entryHref(base, e), current: e.key === self.key }));
  const qText = (lesson?.pattern && lesson.spot) ? `Spot it: ${lesson.spot}` : null;
  const kicker = ["GAZETTEER · ENTRY", region ? `PL. ${region.roman} · ${String(region.name || "").toUpperCase()}` : "NO PLATE YET", ...(stageI != null ? [`STAGE: ${STAGES[stageI].label.toUpperCase()}`] : []),
    n?.kind ? KIND_WORD[n.kind]?.toUpperCase() : lesson?.pattern ? "PATTERN" : "PLACE"];
  const also = [n?.kind ? KIND_WORD[n.kind] : lesson?.pattern ? "pattern" : "place", ...(n?.aliases?.length ? [`also ${n.aliases.join(", ")}`] : []),
    ...(location.state?.via === "alias" && location.state?.from ? [`“${location.state.from}” is another name for ${name}`] : [])].join(" · ");
  const explanations = d.earned?.explanations || {};
  const lessonSt = lesson ? lessonState(lesson, marks) : null;
  const linkLink = (x) => (x.entry ? <WordChip href={entryHref(base, x.entry)} onGo={go}>{x.name}</WordChip>
    : x.slug ? <WordChip href={`${base}/${encodeURIComponent(x.slug)}`} onGo={go}>{x.name}</WordChip>
    : x.lessonId ? <WordChip href={`${base}/gazetteer/${encodeURIComponent(x.lessonId)}`} onGo={go}>{x.name}</WordChip> : <WordChip dim>{x.name}</WordChip>);
  const sideSearch = <SideLook base={base} entries={entries} routes={routes} go={go}/>;
  return (
    <PlateRoot region={region?.roman || "III"} className="pl-at-page" data-gazetteer-entry-page={self.key} data-atlas-node={slug || undefined}>
      <div className="pl-gz-page">
        <p className="pl-gz-kicker"><span className="pl-gz-k pl-gz-k--muted">THE GAZETTEER</span> One concept, one entry: what it means, the explainer, why it works, where it runs, its practice, links in every direction, and the routes it sits on.</p>
        <div className="pl-gz-cols">
          <EntrySide search={sideSearch} letters={LETTERS} letter={L} have={new Set(letters.keys())} onLetter={(x) => go(`${base}/gazetteer?letter=${x}`)}
            heading={`${L} · ${(letters.get(L) || []).length} ENTRIES`} near={near} onGo={go}
            browse={BROWSE.filter((b) => b.id !== "az").map((b) => ({ id: b.id, label: b.label, href: `${base}/gazetteer?by=${b.id}#by-${b.id}` }))}/>
          <article className="pl-gz-entry" data-atlas-card="">
            <EntryHead kicker={kicker} word={name} also={also} meaning={meaning} squares={<GzSquares n={self.squares || 0} label={`${self.squares || 0} of 3 squares lit${lessonSt?.complete ? " — lit" : ""}`}/>}>
              {fromWiki ? <p className="pl-gz-foot" data-wiki-licence="">The meaning is the first line of Wikipedia’s article — {WIKI_LICENCE.line} · <a href={n.wikipedia.pageUrl || "https://en.wikipedia.org"} target="_blank" rel="noopener noreferrer">the article</a> · <a href={WIKI_LICENCE.url} target="_blank" rel="noopener noreferrer license">the licence</a></p> : null}
              {!meaningText && !fromWiki ? <p className="pl-gz-foot">draft’s own meaning for it has not been written yet.</p> : null}
              {n?.you ? <p className="pl-gz-foot" data-atlas-you={n.you.status}>You: {n.you.status === "have" ? "on your résumé" : n.you.status === "partial" ? "partly there" : "not on your résumé yet"}{n.you.missing?.length ? ` · missing ${n.you.missing.map((m) => m.name).join(", ")}` : ""}.</p> : null}
              <div className="pl-gz-head__acts">
                {region ? <GoLink className="pl-btn" href={regionHref(base, { region, lessonId: lesson?.id, pattern: lesson?.pattern })} onGo={go}>Show on the map</GoLink> : null}
                {signedIn && n && (n.kind === "skill" || n.kind === "tool") ? <GoLink className="pl-btn" href={`${base}/your-skills?prove=${encodeURIComponent(n.name)}`} onGo={go} data-atlas-prove-it="">Prove it · 1 min</GoLink> : null}
                {slug && lesson ? <GoLink className="pl-btn" href={`${base}/gazetteer/${encodeURIComponent(lesson.id)}`} onGo={go} data-atlas-learn-it="">The place that teaches it</GoLink> : null}
                {lessonId && n ? <GoLink className="pl-btn" href={`${base}/${encodeURIComponent(n.slug)}`} onGo={go}>{n.name} on the board</GoLink> : null}
              </div>
            </EntryHead>
            <div className="pl-gz-pair">
              <div className="pl-gz-main">
                <WatchIt title={deck ? deck.title : video?.title} line={deck ? `${deck.slides || 5} slides · ▶ plays muted until you turn the sound on` : video ? `${video.source?.name || video.by || "a field note"} · opening it from here counts` : null}
                  href={deck ? `${base}/library/${encodeURIComponent(deck.id)}?play=watch` : video?.url} onGo={go} region={region}
                  none="No explainer is drawn for it yet. Its Library sources are below."/>
                <WhyItWorks title={checks.length ? "WHY IT WORKS · EXPLAIN IT BACK" : "WHY IT WORKS"} flow={flow?.flow}
                  line={lesson && !lesson.pattern ? `${lessonSt?.complete ? "LIT" : `${placeChecksLine(lesson, marks)}`} · A SQUARE LIGHTS ONLY WHEN YOU EXPLAIN IT IN YOUR OWN WORDS` : null}>
                  {lesson?.pattern ? <>{lesson.idea ? <p className="pl-gz-q__why">{lesson.idea}</p> : null}{lesson.why ? <p className="pl-gz-q__why">{lesson.why}</p> : null}</> : null}
                  {!flow && !checks.length && !lesson?.pattern ? <p className="pl-gz-empty">{n?.wikipedia?.extract ? <span className="pl-gz-wiki">{n.wikipedia.extract}</span> : "How it works hasn’t been drawn for this one yet."}</p> : null}
                  {checks.length ? <ul className="pl-gz-checks">{checks.map((c, i) => { const id = checkpointId(lesson.id, i); return <Explain key={id} id={id} question={c} saved={marks[id] ? explanations[id] || { text: "" } : null} signedIn={signedIn} onExplain={writes.onExplain}/>; })}</ul> : null}
                  {lesson?.build && signedIn ? <BuildLink step={lesson.id} saved={d.earned?.builds?.[lesson.id]} onBuild={writes.onBuild}/> : null}
                  {checks.length && !signedIn ? <p className="pl-gz-foot">Sign in to explain them: a square lights only when you’ve explained it.</p> : null}
                </WhyItWorks>
              </div>
              <div className="pl-gz-main">
                <WhereItRuns lines={where} onGo={go} market={stats?.postings ? { href: marketHref(base), text: `${num(stats.postings)} openings ask for ${name} · the market` } : null}
                  foot={stats ? computedLine(stats) : null}/>
                <ReadMore items={resources.slice(0, 8)} onOpen={(x) => x.id && !String(x.id).startsWith("http") && writes.onOpen(x)}
                  foot={<GoLink className="pl-btn" href={`${base}/library`} onGo={go}>The whole Library →</GoLink>}/>
              </div>
            </div>
            <EntryPractice pieceId={lesson?.id || null} signedIn={signedIn} deckId={deck?.id} deckCheck={!!deck} asked={qText}/>
            <Compass word={name} up={compass.up} down={compass.down} side={compass.side} roles={compass.roles} link={linkLink}/>
            <EntryRoutes routes={through.map((t) => ({ id: t.route.id, name: t.route.name, at: t.at, of: t.of, href: routeHref(base, t.route.id) }))} onGo={go} drawn={drawn}
              empty="It isn’t on a route yet. Any entry can start one: open Routes and copy one that passes near it."/>
          </article>
        </div>
      </div>
    </PlateRoot>
  );
}
const placeChecksLine = (lesson, marks) => { const ids = [...(lesson.checks || []), ...(lesson.build ? [buildId(lesson.id)] : [])]; const done = ids.filter((id) => marks[id]).length; return `${done} OF ${ids.length} EXPLAINED`; };

/** The side index's small look-up (the same suggestions). */
function SideLook({ base, entries, routes, go }) {
  const [q, setQ] = useState("");
  return <LookUp big={false} value={q} onChange={setQ} onGo={go} groups={suggestions(base, q, entries, routes, null)} placeholder="Look up a concept"
    onSubmit={(v) => { const t = String(v || "").trim(); if (t) go(`${base}/gazetteer?q=${encodeURIComponent(t)}`); }}/>;
}

// ══ /atlas/routes — EVERY ROUTE ════════════════════════════════════════════════════════════════════════════════════
const KIND_LABEL = { course: "COURSE", patterns: "STARTER ROUTE", guided: "GUIDED ROUTE", pathway: "PATHWAY", project: "PROJECT ROUTE", guides: "GUIDES", copy: "YOUR COPY" };
export function RoutesPage({ base, signedIn }) {
  const go = useGo();
  const d = useGazetteerData(signedIn, ["glossary", "course", "patterns", "circle", "pathways", "guides", "earned", "checks"]);
  const entries = useEntries(d);
  const routes = useRoutes(d, entries);
  const [mine, setMine] = useState(readMine);
  if (d.status !== "ready") return <PlateRoot className="pl-at-page"><Message status={d.status} onRetry={d.retry} what="routes"/></PlateRoot>;
  const copies = myCopies(mine, routes);
  const joined = routes.filter((r) => mine[r.id]?.joined);
  const groups = [
    { id: "yours", title: "YOUR ROUTES", list: [...joined, ...copies], empty: "Join a route below (or copy one to make it yours) and it shows here. Your progress lives on the entries either way." },
    { id: "courses", title: "THE COURSES · A ROUTE IS A SAVED ORDER OF ENTRIES", list: routes.filter((r) => r.kind === "course" || r.kind === "patterns" || r.kind === "guides") },
    { id: "guided", title: "GUIDED ROUTES THROUGH THE COURSE", list: routes.filter((r) => r.kind === "guided") },
    { id: "pathways", title: "PATHWAYS · EACH ROLE FAMILY’S ROUTE", list: routes.filter((r) => r.kind === "pathway") },
    { id: "projects", title: "PROJECT ROUTES · EACH ENDS IN A BUILD", list: routes.filter((r) => r.kind === "project") },
  ];
  const review = d.checks?.review?.count || 0;
  return (
    <PlateRoot region="III" className="pl-at-page" data-routes-page="">
      <div className="pl-gz-page">
        <p className="pl-gz-kicker"><span className="pl-gz-k pl-gz-k--muted">ROUTES</span> A route is a saved order of entries drawn on the map. Progress lives on the entries, so a stop you lit on one route is already lit on every other.</p>
        <header className="pl-gz-ihead">
          <span className="pl-gz-k">VOL. I · ROUTES · {routes.length} ROUTES{signedIn && review ? ` · ${review} TO REVIEW` : ""}</span>
          <h1 className="pl-gz-ihead__title">Routes through the Gazetteer</h1>
          {signedIn && review ? <p className="pl-gz-empty" data-library-review={review}>{review} question{review === 1 ? "" : "s"} to review across your entries — <GoLink href={`${base}/gazetteer?show=due`} onGo={go}>the Gazetteer’s Due</GoLink>.</p> : null}
        </header>
        {groups.map((g) => (
          <GzCard key={g.id} title={g.title} right={g.list.length ? `${g.list.length}` : null} id={`routes-${g.id}`}>
            {g.list.length ? (
              <div className="pl-gz-rlist">
                {g.list.map((r) => {
                  const p = routeProgress(r.stops);
                  return (
                    <GoLink key={r.id} href={routeHref(base, r.id)} onGo={go} className="pl-gz-rcard" data-route-card={r.id}>
                      <span className="pl-gz-k" data-tone={r.kind === "project" ? "market" : "route"}>{r.copy ? KIND_LABEL.copy : KIND_LABEL[r.kind]}{r.later ? " · LATER" : ""}</span>
                      <span className="pl-gz-rcard__name">{r.name}</span>
                      <span className="pl-gz-rcard__about">{r.about}</span>
                      <span aria-hidden="true" className="pl-gz-bar pl-gz-bar--thin"><span style={{ width: `${p.total ? Math.round((100 * p.lit) / p.total) : 0}%` }}/></span>
                      <span className="pl-gz-k pl-gz-k--muted">{p.lit} OF {p.total} STOPS LIT{p.here ? ` · NEXT: ${String(p.here.name).toUpperCase()}` : ""}</span>
                    </GoLink>
                  );
                })}
              </div>
            ) : <p className="pl-gz-empty">{g.empty || "None yet."}</p>}
          </GzCard>
        ))}
        {mine && Object.keys(mine).length ? <p className="pl-gz-foot">Your routes are kept in this browser for now. <button type="button" className="pl-btn" onClick={() => setMine(writeMine({}))}>Forget them</button></p> : null}
      </div>
    </PlateRoot>
  );
}

// ══ /atlas/routes/<id> — ONE ROUTE ═════════════════════════════════════════════════════════════════════════════════
export function RoutePage({ base, signedIn, id, compete = null }) {
  const go = useGo();
  const location = useLocation();
  const navigate = useNavigate();
  const d = useGazetteerData(signedIn, ["glossary", "course", "patterns", "circle", "pathways", "guides", "earned", "checks"]);
  const entries = useEntries(d);
  const routes = useRoutes(d, entries);
  const [mine, setMine] = useState(readMine);
  const save = (m) => setMine(writeMine(m));
  const view = new URLSearchParams(location.search).get("view") === "circle" ? "circle" : "map";
  if (d.status !== "ready") return <PlateRoot className="pl-at-page"><Message status={d.status} onRetry={d.retry} what="route"/></PlateRoot>;
  const all = [...routes, ...myCopies(mine, routes)];
  const route = all.find((r) => r.id === id);
  if (!route) return <PlateRoot className="pl-at-page"><p className="pl-gz-msg" role="status" data-route-missing="">There’s no route by that name. <GoLink href={`${base}/routes`} onGo={go}>Every route</GoLink></p></PlateRoot>;
  const st = stopStates(route.stops);
  const p = routeProgress(route.stops);
  const hereI = st.findIndex((s) => s.mapState === "here");
  const here = hereI >= 0 ? st[hereI] : null;
  const elsewhere = st.filter((s) => s.mapState === "elsewhere").length;
  const romans = [...new Set(route.stops.map((s) => s.region?.roman).filter(Boolean))];
  const stagesSpan = [...new Set(route.stops.map((s) => s.stage).filter((x) => x != null))].sort();
  const w = mapWindow(st, 14);
  const cross = crossings(routes, route);
  const ir = cross[0] ? { at: Math.max(0, w.stops.findIndex((s) => s.key === cross[0].at.key)), label: `${cross[0].route.name}`, href: routeHref(base, cross[0].route.id) } : null;
  const joined = !!mine[route.id]?.joined;
  const squares = st.map((s) => (s.mapState === "here" ? "here" : s.state === "lit" ? "lit" : "ahead"));
  const mapStops = w.stops.map((s) => ({ id: s.key, name: s.name, region: s.region?.roman || "IV", regionName: s.region?.name, stage: s.stage ?? 0, state: s.mapState, href: stopHref(base, s) || undefined }));
  if (route.round && mapStops.length) mapStops[mapStops.length - 1].round = true;
  const stageWord = (s) => (s.stage != null ? STAGES[s.stage].label.toUpperCase() : null);
  let lastRegion = null;
  const rows = st.map((s, i) => {
    const head = route.kind === "course" && s.region?.roman !== lastRegion ? (lastRegion = s.region?.roman, <li key={`g-${s.region?.roman}`} className="pl-gz-stop__group"><span className="pl-gz-k">PL. {s.region?.roman} · {String(s.region?.name || "").toUpperCase()}</span></li>) : null;
    const href = stopHref(base, s);
    const open = s.mapState === "here" ? (
      <>
        <div className="pl-gz-stop__next"><span className="pl-gz-k">UP NEXT IN THIS ENTRY · {stageWord(s) || "START"}</span><span className="pl-gz-stop__q">{s.planned ? "This topic isn’t written yet — it’s planned." : "Its next question, its explainer and its checkpoints are on the entry."}</span>
          <span className="pl-gz-acts">{href ? <GoLink className="pl-btn pl-btn--ink" href={`${href}#practice`} onGo={go}>Try it</GoLink> : null}{href ? <GoLink className="pl-btn" href={href} onGo={go}>Open the entry</GoLink> : null}</span></div>
      </>
    ) : null;
    const tail = route.copy ? <button type="button" className="pl-gz-stop__drop" onClick={() => save(dropStop(mine, route.id, s.key))} aria-label={`Drop ${s.name} from your copy`}>drop</button> : null;
    return [head, <StopRow key={s.key + i} n={i + 1} word={s.name} href={href || undefined} onGo={go} region={s.region} regionHref={regionHref(base, s)} stage={stageWord(s)} stageId={s.stage != null ? STAGES[s.stage].id : null}
      squares={s.squares || 0} state={s.mapState} meta={s.planned ? (s.drafted ? "DRAFTED" : "PLANNED") : s.kind === "deck" ? "EXPLAINER" : null} open={open} tail={tail}/>];
  });
  const stamp = <RouteStamp done={!!p.total && p.lit === p.total} total={p.total} logbook={<GoLink href={`${base}/your-map#logbook`} onGo={go}>Logbook</GoLink>}/>;
  return (
    <PlateRoot region={romans[0] || "III"} className="pl-at-page" data-route-page={route.id} data-course-page={route.kind === "course" || route.kind === "patterns" ? route.id : undefined}>
      <div className="pl-gz-page">
        <p className="pl-gz-kicker"><span className="pl-gz-k pl-gz-k--muted">A ROUTE</span> A route is a saved order of entries drawn on the map. Progress lives on the entries, so a stop you lit on another route is already lit here.</p>
        <nav aria-label="Breadcrumb" className="pl-gz-crumbs"><GoLink href={`${base}/routes`} onGo={go}>Routes</GoLink><span aria-hidden="true">/</span><span>{route.name}</span></nav>
        <RouteHead kicker={`ROUTE · ${route.stops.length} STOPS${romans.length ? ` · PL. ${romans[0]}${romans.length > 1 ? ` → PL. ${romans[romans.length - 1]}` : ""}` : ""}${stagesSpan.length ? ` · ${["LOWLANDS", "FOOTHILLS", "HIGHLANDS", "SUMMIT"][stagesSpan[0]]} TO ${["LOWLANDS", "FOOTHILLS", "HIGHLANDS", "SUMMIT"][stagesSpan[stagesSpan.length - 1]]}` : ""}`}
          name={route.name} line={<>{p.lit} of {p.total} stops lit{elsewhere ? ` — ${elsewhere} of them you lit on other routes` : ""}.{here ? <> Next: <b>{here.name}</b>.</> : " Every stop is lit."}</>}
          squares={squares.length > 60 ? squares.slice(Math.max(0, hereI - 20), Math.max(0, hereI - 20) + 60) : squares}
          actions={<>{here && stopHref(base, here) ? <GoLink className="pl-btn pl-btn--ink" href={stopHref(base, here)} onGo={go}>Continue at {here.name} →</GoLink> : null}
            <GoLink className="pl-btn" href={base} onGo={go}>Show on Your map</GoLink>
            {route.circle ? <button type="button" className="pl-btn" aria-pressed={view === "circle"} onClick={() => navigate(`${location.pathname}${view === "circle" ? "" : "?view=circle"}${location.hash}`, { replace: true })} data-course-view="circle">{view === "circle" ? "The map" : "The circle"}</button> : null}</>}/>
        {view === "circle" && route.circle ? (
          <GzCard title="THE ROUTE AS A CIRCLE · EVERY LESSON, ITS LINKS BEFORE AND AFTER" data-course-circle-view=""><LearnView signedIn={signedIn}/></GzCard>
        ) : (
          <section aria-label="The route on the map" className="pl-gz-card">
            <div className="pl-gz-card__strip"><span className="pl-gz-k">THE ROUTE ON THE PHYSICAL MAP{w.stops.length < st.length ? ` · STOPS ${w.from + 1}–${w.from + w.stops.length} OF ${st.length}` : ""}</span><span className="pl-gz-k pl-gz-k--muted">HEIGHT = STAGE · NO BORDERS ON ATLAS’S MAP</span></div>
            <div style={{ overflowX: "auto" }}>
              {route.kind === "project" ? <ProjectRoute stops={route.stops.map((s) => ({ id: s.key, name: s.name, region: s.region?.roman || "IV", lit: s.state === "lit", href: stopHref(base, s) || undefined }))} build={route.build} onStop={(s) => s.href && go(s.href)}/>
                : <RouteMap stops={mapStops} interchange={ir && ir.at >= 0 ? ir : null} onInterchange={(x) => go(x.href)} onStop={(s) => s.href && go(s.href)}/>}
            </div>
            <RouteLegend last={route.kind === "project" ? "The last stop: the build" : route.round ? "The last stop: a practice round" : "The last stop: the route’s summit"}/>
          </section>
        )}
        <div className="pl-gz-cols">
          <div className="pl-gz-main">
            <StopsList title={`THE STOPS · ${route.stops.length} ENTRIES IN ORDER`} stops={rows}/>
            {route.kind === "project" && route.build ? (
              <GzCard title="THE BUILD BRIEF · A PROJECT ROUTE ENDS IN A BUILD" right="IT COUNTS AS PROOF" data-route-build="">
                <p className="pl-gz-q__why">{route.build.brief}</p>
                {route.build.steps?.length ? <ol className="pl-gz-where">{route.build.steps.map((x, i) => <li key={i}>{typeof x === "string" ? x : x.title || x.text}</li>)}</ol> : null}
                {route.build.show ? <p className="pl-gz-foot">Show it: {typeof route.build.show === "string" ? route.build.show : JSON.stringify(route.build.show)}</p> : null}
              </GzCard>
            ) : null}
            {route.stages?.length ? <GzCard title="ITS STAGES"><ul className="pl-gz-where">{route.stages.map((s) => <li key={s.id}>{s.title} · {s.n} topics</li>)}</ul></GzCard> : null}
            {route.levels?.length ? <GzCard title="THE LADDER"><ul className="pl-gz-where">{route.levels.map((l) => <li key={l.id}>Level {l.level} · {l.name} · {l.written ? `${l.n} decks` : "not written yet"}</li>)}</ul></GzCard> : null}
          </div>
          <aside aria-label="About this route" className="pl-gz-rail">
            <GzCard title="THIS ROUTE">
              <RouteFacts rows={[["MADE BY", route.made], ["CROSSES", romans.length ? romans.map((r) => `Plate ${r}`).join(" → ") : "no plate yet"], ["ABOUT", route.about || `${route.stops.length} stops`]]}/>
              <div className="pl-gz-acts">
                {!route.copy ? <button type="button" className="pl-btn" onClick={() => { save(copyRoute(mine, route)); go(routeHref(base, `mine-${route.id}`)); }} data-route-copy="">Copy as my route</button> : null}
                {joined ? <button type="button" className="pl-btn" onClick={() => { save(leaveRoute(mine, route.id)); if (route.copy) go(`${base}/routes`); }} data-route-leave="">Leave</button>
                  : <button type="button" className="pl-btn" onClick={() => save(joinRoute(mine, route.id))} data-route-join="">Join this route</button>}
              </div>
              <p className="pl-gz-foot">A copy is yours to drop stops from. Your progress stays on the entries either way. (Kept in this browser for now.)</p>
            </GzCard>
            <GzCard title="THE STAMP AT THE END" tone="r5">{stamp}</GzCard>
            {compete?.challenges || compete?.league ? (
              <GzCard title="CHALLENGES OVER THIS ROUTE" right="COMPETE ON" data-route-challenges="">
                <div className="pl-gz-chal"><span className="pl-gz-chal__t">Beat the bar</span><span className="pl-gz-chal__s">take the 3-minute audit for this route’s role and share the score</span></div>
                <div className="pl-gz-chal"><span className="pl-gz-chal__t">Time attack</span><span className="pl-gz-chal__s">five reviewed questions against the clock</span></div>
                <div className="pl-gz-chal"><span className="pl-gz-chal__t">Friday duel</span><span className="pl-gz-chal__s">the same five for your pod</span></div>
                <div className="pl-gz-acts"><GoLink className="pl-btn" href={`${base}/challenges`} onGo={go}>Open the challenges</GoLink></div>
              </GzCard>
            ) : null}
            <GzCard title="ROUTES THAT CROSS THIS ONE">
              {cross.length ? cross.slice(0, 5).map((c) => (
                <GoLink key={c.route.id} href={routeHref(base, c.route.id)} onGo={go} className="pl-gz-cross"><span className="pl-gz-cross__n">⇄ {c.route.name}</span><span className="pl-gz-k pl-gz-k--muted">AT {String(c.at.name).toUpperCase()} · STOP {c.stop} OF {c.of}</span></GoLink>
              )) : <p className="pl-gz-empty">No other route shares a stop with it yet.</p>}
            </GzCard>
          </aside>
        </div>
      </div>
    </PlateRoot>
  );
}
