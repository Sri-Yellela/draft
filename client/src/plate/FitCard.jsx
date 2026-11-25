// ⭐ D202 (owner 11-25) · THE FIELD CARD ⇄ THE ATS CARD — ONE card, two faces (board `ATSCard` on the final canvas).
// "i like our current ATS card design but also the field card; find a way to not lose the design on the field card but make
// way for it to lead to the format and facts that the current one can give, and also the current one needs to expand more to
// give all listed words and contextuality match related things".
//   FRONT = the field card (plate/Cards.jsx FieldCard — the same component, not a copy: FIELD CARD · WHY IT FITS · NO AI,
//           Lines up / Doesn't, yet + Learn it, the three labelled scores), now opening on the count + the bar
//           ("25 of 38 things · 66 %") and ending on "↻ Turn over · the full ATS card".
//   BACK  = the ATS card: "N of M things this posting asks for", "A N % match. The score is still being tuned, so read it
//           with the count.", the three-part bar + its key, and four tabs — Every word · N (every ask the scorer read,
//           grouped, marked, filterable, where it sits on the résumé, a claim on every missing one) · Context (D192: the
//           parts and weights, similarities / dissimilarities, their real stack vs yours, the plausibility check) · You
//           could claim · N · History — and the claiming small print.
// Claiming (AG2's reversible call, lib/profileSuggestions.js setProfileClaim) updates the count, the bar and the group
// counts at once; the card then reads itself again, so the number follows (the scorer reads the claims).
// Where it sits: beside the deck ticket on the market (D199 C6) and as section 02 of the opening sheet (D199 C7) — this
// one component in both (test/d202OneComponentTwoPlaces).
// The words: shared/fitCardModel.js (the back) and shared/contextualView.js fieldCardView (the front) — pure, tested.
// ⛔ No model (D190). ⛔ D60: every box is a 9–12 px corner on a 32–46 px box — no capsule.
import { useCallback, useEffect, useMemo, useState } from "react";
import { FieldCard } from "./Cards.jsx";
import { plateState } from "./PlateState.jsx";
import { api } from "../lib/api.js";
import { setProfileClaim } from "../lib/profileSuggestions.js";
import { useAtlasSlugs, atlasHref } from "../lib/atlasLinks.js";
import { PlausibilityFlags } from "../components/PlausibilityFlags.jsx";
import { fieldCardView } from "../../../shared/contextualView.js";
import { TERM_KINDS } from "../../../shared/atsReportModel.js";
import { fitCardModel, initialClaims, toggleClaim, FIT_FILTERS, filterCount, contextView } from "../../../shared/fitCardModel.js";

export const FIT_SMALL_PRINT = "Claiming says it’s true of you: it counts toward this score and where jobs rank, and it’s used in résumés made from now on. It never rewrites one you already have, and you can withdraw it any time.";
const KEY = (
  <span className="pl-fit__key" aria-hidden="true"><span>■ ON YOUR RÉSUMÉ</span><span className="pl-tone-clay">■ CLAIMED BY YOU</span><span className="pl-muted">□ MISSING</span></span>
);

// One read per opening, shared by every FitCard on the page (the market's and the sheet's); a claim clears it.
const cache = new Map();
export function fitCardFor(jobId, { fresh = false } = {}) {
  if (fresh) cache.delete(jobId);
  if (!cache.has(jobId)) {
    const p = api(`/api/jobs/${encodeURIComponent(jobId)}/fit-card`);
    p.catch(() => cache.delete(jobId));
    cache.set(jobId, p);
  }
  return cache.get(jobId);
}

/** The bar: on your résumé (lit) · claimed by you (clay) · the rest is the track (missing). */
function FitBar({ model }) {
  return (
    <span className="pl-fit__bar" role="img" aria-label={`${model.on} on your résumé, ${model.claimed} claimed by you, ${model.missing} missing, of ${model.total}`} data-fit-bar="">
      <span className="pl-fit__seg" data-k="on" style={{ width: `${model.onShare}%` }}/>
      <span className="pl-fit__seg" data-k="claimed" style={{ width: `${model.clShare}%` }}/>
    </span>
  );
}

const have = (m) => m.on + m.claimed;
const pctWords = (m) => (m.pct == null ? null : `${m.pct} %`);

function WordsTab({ model, onClaim, busy }) {
  const [filter, setFilter] = useState("all");
  const keep = FIT_FILTERS.find((f) => f.id === filter)?.keep || (() => true);
  const groups = model.groups.map((g) => ({ ...g, shown: g.words.filter(keep) })).filter((g) => g.shown.length);
  return (
    <div className="pl-fit__panel pl-in" data-fit-tab="words">
      <div role="group" aria-label="Show" className="pl-fit__filters">
        {FIT_FILTERS.map((f) => (
          <button key={f.id} type="button" className="pl-fit__filter" aria-pressed={filter === f.id ? "true" : "false"} data-fit-filter={f.id}
            onClick={() => setFilter(f.id)}>{f.name} · {filterCount(model, f.id)}</button>
        ))}
      </div>
      {groups.map((g) => (
        <div key={g.id} className="pl-fit__group" data-fit-group={g.id}>
          <div className="pl-fit__ghead"><span className="pl-fit__glabel">{g.name}</span><span className="pl-fit__glabel" data-fit-group-count="">{g.have} OF {g.total}</span></div>
          <div className="pl-fit__words">
            {g.shown.map((w) => (
              <span key={w.key} className="pl-fit__word" data-state={w.state} data-fit-word={w.key} tabIndex={w.state === "on" && w.where ? 0 : undefined}
                title={w.state === "on" ? `On your résumé${w.where ? `: ${w.where}` : ""}` : w.state === "claimed" ? "Claimed by you" : "Not on your résumé"}>
                <span aria-hidden="true" className="pl-fit__wsq"/>{w.label}
                {w.state === "on" && w.where ? <span className="pl-fit__where" data-fit-where="">{w.where}</span> : null}
                <span className="pl-fit__tag">{w.state === "claimed" ? "CLAIMED" : ""}</span>{/* the board keeps this slot on every word (its gap is part of the chip) */}
                {w.claimable ? <button type="button" className="pl-fit__claim" disabled={busy === w.key} onClick={() => onClaim(w)}
                  aria-label={w.state === "claimed" ? `Undo your claim: ${w.label}` : `${w.label}: that’s true of me`}>{w.state === "claimed" ? "undo" : "That’s true of me"}</button> : null}
              </span>
            ))}
          </div>
        </div>
      ))}
      {model.facts.length ? (
        <div className="pl-fit__facts" data-fit-facts="">
          {model.facts.map((f, i) => <span key={i} className="pl-fit__fact">{f.mark ? <b aria-hidden="true">{f.mark.mark} </b> : null}{f.text}</span>)}
        </div>
      ) : null}
      {model.generic.length ? <p className="pl-fit__small" data-fit-generic="">Read and set aside, not asks: {model.generic.join(", ")}.</p> : null}
      <p className="pl-fit__small">Hover a word on your résumé to see where it is. {FIT_SMALL_PRINT}</p>
    </div>
  );
}

function ContextTab({ view, plausibility, company }) {
  if (!view) return <div className="pl-fit__panel pl-in" data-fit-tab="context"><p className="pl-fit__small">The contextual score needs the posting placed in a role and your résumé read; it isn’t ready for this one yet.</p></div>;
  const KIND = { exact: "EXACT", ecosystem: "ECOSYSTEM", gap: "GAP", extra: "EXTRA" };
  const flags = (plausibility?.entries || []).reduce((n, e) => n + (e.flags || []).length, 0);
  const confirmed = (plausibility?.entries || []).filter((e) => e.status === "all_confirmed").map((e) => e.employer).filter(Boolean);
  return (
    <div className="pl-fit__panel pl-in" data-fit-tab="context">
      <div data-fit-parts="">
        <span className="pl-fit__glabel">THE CONTEXTUAL SCORE · ITS PARTS AND WEIGHTS</span>
        {view.parts.map((p) => (
          <div key={p.id} className="pl-fit__part" data-fit-part={p.id}>
            <span className="pl-fit__pname">{p.name} {p.weight ? <span className="pl-fit__pw">· {p.weight}</span> : null}</span>
            <span aria-hidden="true" className="pl-fit__pbar"><span style={{ width: `${p.score ?? 0}%` }}/></span>
            <span className="pl-fit__pnum">{p.score ?? <><span aria-hidden="true">—</span><span className="pl-sr">not scored for this posting</span></>}</span>
          </div>
        ))}
        <div className="pl-fit__total"><b>Contextual score</b><span className="pl-fit__tnum">{view.score ?? "—"}</span></div>
      </div>
      <div className="pl-fit__cols">
        <div className="pl-fit__col"><span className="pl-fit__glabel pl-tone-lit">SIMILARITIES</span>
          {view.similar.length ? view.similar.map((t, i) => <div key={i} className="pl-fit__li"><span aria-hidden="true" className="pl-fit__lsq"/><span>{t}</span></div>) : <span className="pl-fit__small">None found yet.</span>}</div>
        <div className="pl-fit__col"><span className="pl-fit__glabel pl-tone-clay">DISSIMILARITIES</span>
          {view.different.length ? view.different.map((t, i) => <div key={i} className="pl-fit__li"><span aria-hidden="true" className="pl-fit__lsq" data-yet=""/><span>{t}</span></div>) : <span className="pl-fit__small">None found.</span>}</div>
      </div>
      <div data-fit-stack="">
        <span className="pl-fit__glabel">THEIR REAL STACK VS YOURS{view.ofPostings ? ` · FROM ${view.ofPostings}${company ? ` ${String(company).split(/\s+/)[0]}` : ""} POSTINGS` : ""}</span>
        {view.stack.length ? view.stack.map((s, i) => (
          <div key={i} className="pl-fit__srow" data-fit-stack-kind={s.kind}>
            <span className="pl-fit__skind" data-k={s.kind}>{KIND[s.kind]}</span><b>{s.name}</b><span className="pl-muted">{s.line}{s.href ? <> · <a href={s.href}>Learn it →</a></> : null}</span>
          </div>
        )) : <p className="pl-fit__small">No stack on record for this company yet: it comes from their own postings, and we haven’t seen enough of them.</p>}
      </div>
      <div className="pl-fit__plaus" data-fit-plausibility="">
        <span className="pl-fit__glabel pl-fit__glabel--ink">DOES IT ADD UP? · PLAUSIBILITY</span>
        {plausibility == null ? <span className="pl-fit__pline">Checking your résumé against what its employers post…</span>
          : flags ? <PlausibilityFlags data={plausibility} title={`${flags} to check`}/>
          : <span className="pl-fit__pline">✓ Every checkable claim lines up{confirmed.length ? ` with what ${confirmed.slice(0, 3).join(" and ")} post` : ""}. No flags.</span>}
      </div>
    </div>
  );
}

function ClaimTab({ model, onClaim, busy }) {
  const order = (id) => model.groups.findIndex((g) => g.id === id);
  const list = model.words.filter((w) => w.claimable).sort((x, y) => order(x.group) - order(y.group));   // the Every word order
  const name = (id) => model.groups.find((g) => g.id === id)?.name || "";
  return (
    <div className="pl-fit__panel pl-fit__panel--tight pl-in" data-fit-tab="claim">
      <p className="pl-fit__lead">The posting asks for these and your résumé doesn’t show them. Claim only the ones that are true of you.</p>
      {list.length ? list.map((w) => (
        <div key={w.key} className="pl-fit__crow" data-state={w.state}>
          <span className="pl-fit__cw"><b>{w.label}</b><span className="pl-fit__tag">{name(w.group).toUpperCase()}</span></span>
          <button type="button" className="pl-fit__cbtn" disabled={busy === w.key} onClick={() => onClaim(w)}>{w.state === "claimed" ? "Claimed · undo" : "That’s true of me"}</button>
        </div>
      )) : <p className="pl-fit__small">Nothing to claim: your résumé shows everything this posting asks for.</p>}
      <p className="pl-fit__small">{FIT_SMALL_PRINT}</p>
    </div>
  );
}

function HistoryTab({ lines = [], history = null }) {
  return (
    <div className="pl-fit__panel pl-fit__panel--tight pl-fit__hist pl-in" data-fit-tab="hist">
      {lines.length ? lines.map((l, i) => <p key={i}><i>{l.label}</i> {l.text}</p>) : (!history ? <p>Nothing to show for this posting yet.</p> : null)}
      {history}
    </div>
  );
}

/**
 * The card. `jobId` → it reads GET /api/jobs/:id/fit-card itself; `data` → that payload, given (the gallery / F5 fixture).
 * `alike` / `gaps` / `figures` override the front's lines (the market's own field card props, so it drops in where
 * FieldCard was). `historyLines` = [{ label, text }] (posted, live check — the host's facts); `history` = a node (the job's
 * résumé versions). `face` / `tab` = where it opens. `plausibility` / `atlasSlugs` (given) skip their reads (the fixture);
 * `company` names whose postings the stack is read from.
 */
export function FitCard({ jobId = null, data: given = null, alike, gaps, figures, historyLines = [], history = null,
  face: initialFace = "front", tab: initialTab = "words", plausibility: givenPlaus, atlasSlugs = null, company = null, className = "", ...gate }) {
  const [state, setState] = useState(() => (given ? { status: "ready", data: given } : { status: jobId ? "loading" : "idle", data: null }));
  const [nonce, setNonce] = useState(0);
  const [face, setFace] = useState(initialFace);
  const [tab, setTab] = useState(initialTab);
  const [claimed, setClaimed] = useState(() => initialClaims(given?.report));
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState("");
  const [plaus, setPlaus] = useState(givenPlaus);

  useEffect(() => {
    // given (the sheet's own read, or the fixture) until a claim asks for a fresh one
    if (given && nonce === 0) { setState({ status: "ready", data: given, jobId }); setClaimed(initialClaims(given.report)); return undefined; }
    if (!jobId) { setState({ status: "idle", data: null }); return undefined; }
    let live = true;
    setState((s) => (s.data && s.jobId === jobId ? s : { status: "loading", data: null, jobId }));
    fitCardFor(jobId, { fresh: nonce > 0 }).then((d) => { if (!live) return; setState({ status: "ready", data: d, jobId }); setClaimed(initialClaims(d?.report)); })
      .catch(() => { if (live) setState({ status: "error", data: null, jobId }); });
    return () => { live = false; };
  }, [jobId, given, nonce]);
  useEffect(() => {
    if (givenPlaus !== undefined || face !== "back" || tab !== "context" || plaus !== undefined || !jobId) return undefined;
    let live = true;
    api("/api/resume/plausibility").then((r) => { if (live) setPlaus(r || { entries: [] }); }).catch(() => { if (live) setPlaus({ entries: [] }); });
    return () => { live = false; };
  }, [face, tab, givenPlaus, plaus, jobId]);

  const d = state.data;
  const model = useMemo(() => fitCardModel({ report: d?.report || null, where: d?.where || {}, claimed }), [d, claimed]);
  const front = useMemo(() => (d ? fieldCardView({ report: d.report || null, contextual: d.contextual || null }) : null), [d]);
  const ctx = useMemo(() => contextView(d?.contextual, { resumeTech: d?.resumeTech || [] }), [d]);
  const techs = useMemo(() => [...(front?.gaps || []).map((g) => g.tech), ...(ctx?.stack || []).filter((s) => s.kind === "gap").map((s) => s.tech)].filter(Boolean), [front, ctx]);
  const fetched = useAtlasSlugs(atlasSlugs ? [] : techs);
  const slugs = atlasSlugs || fetched;   // given: the fixture (no server)

  const onClaim = useCallback(async (w) => {
    const next = w.state !== "claimed";
    setClaimed((c) => toggleClaim(c, w.key));   // the count, the bar and the group counts move at once
    setNote("");
    const pid = d?.profileId;
    if (!pid || !jobId) return;   // the fixture: local only
    setBusy(w.key);
    try {
      await setProfileClaim(pid, (TERM_KINDS[w.kind] || TERM_KINDS.skill).claim, w.term, next);
      setNonce((n) => n + 1);     // read again: the number follows the claim
    } catch (e) {
      setClaimed((c) => toggleClaim(c, w.key));
      setNote(e?.message || "That claim didn’t save. Try again.");
    } finally { setBusy(null); }
  }, [d, jobId]);

  const g = plateState(gate, { height: 300, radius: "plate", label: "Loading why it fits", lines: 4 });   // R1: the field card's own skeleton / drawer / alert
  if (g) return g;
  if (state.status === "idle") return <FieldCard state="empty" emptyText="The field card fills in for the opening you’re looking at."/>;
  if (state.status === "loading") return <FieldCard state="loading"/>;
  if (state.status === "error") return <FieldCard state="error" errorText="Why it fits didn’t load." onRetry={() => setNonce((n) => n + 1)}/>;

  const learn = (t) => (t && slugs[t] ? { label: "Learn it →", href: atlasHref(slugs[t]) } : null);
  const fAlike = alike ?? front?.alike ?? [];
  const fGaps = gaps ?? (front?.gaps || []).map((g) => ({ text: g.text, link: g.link ?? learn(g.tech) }));
  const fFigures = figures !== undefined ? figures : front?.figures || null;
  const count = model ? (
    <div className="pl-fit__count" data-fit-count="">
      <div className="pl-fit__headline"><span className="pl-fit__serif" data-fit-headline="">{have(model)} of {model.total} things</span>{pctWords(model) ? <span className="pl-fit__serif" data-fit-pct="">{pctWords(model)}</span> : null}</div>
      <FitBar model={model}/>{KEY}
    </div>
  ) : null;

  if (face === "front" || !model) {
    return (
      <FieldCard className={`pl-fitcard ${className}`.trim()} data-fit-face="front" lead={count} groupRule={false} inlineLinks
        alike={fAlike} gaps={fGaps} figures={fFigures}
        foot={model ? <button type="button" className="pl-fit__turn" aria-expanded="false" data-fit-turn="" onClick={() => setFace("back")}>↻ Turn over · the full ATS card</button> : null}/>
    );
  }
  const TABS = [["words", `Every word · ${model.total}`], ["context", "Context"], ["claim", `You could claim · ${model.missing}`], ["hist", "History"]];
  return (
    <article className={`pl-fit pl-in ${className}`.trim()} aria-label="The ATS card: your résumé against this job" data-fit-face="back">
      <div className="pl-fit__strip"><span className="pl-label">THE ATS CARD · YOUR RÉSUMÉ AGAINST THIS JOB</span>
        <button type="button" className="pl-fit__back" data-fit-turn="" onClick={() => setFace("front")}>↻ Back to the field card</button></div>
      <div className="pl-fit__head">
        <h3 className="pl-fit__h" data-fit-headline="">{have(model)} of {model.total} things this posting asks for</h3>
        {model.pct != null ? <span className="pl-fit__sentence" data-fit-pct="">A {model.pct} % match. The score is still being tuned, so read it with the count.</span>
          : <span className="pl-fit__sentence">Not enough signal for a number yet, so read the count.</span>}
        <FitBar model={model}/>{KEY}
      </div>
      <div role="tablist" aria-label="The ATS card" className="pl-fit__tabs">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" className="pl-fit__tab" aria-selected={tab === id ? "true" : "false"} data-fit-tabbtn={id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="pl-fit__tabrule"/>
      {note ? <p className="pl-fit__small pl-fit__note" role="alert">{note}</p> : null}
      {tab === "words" ? <WordsTab model={model} onClaim={onClaim} busy={busy}/> : null}
      {tab === "context" ? <ContextTab view={ctx ? { ...ctx, stack: ctx.stack.map((s) => (s.kind === "gap" && learn(s.tech) ? { ...s, href: learn(s.tech).href } : s)) } : null} plausibility={plaus ?? null} company={company}/> : null}
      {tab === "claim" ? <ClaimTab model={model} onClaim={onClaim} busy={busy}/> : null}
      {tab === "hist" ? <HistoryTab lines={historyLines} history={history}/> : null}
    </article>
  );
}

export default FitCard;
