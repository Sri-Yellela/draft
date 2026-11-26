// ⭐ D196 F3 · cards: the field card (why an opening fits — D192's Lines up / Doesn't, yet), the side panel, the catalogue
// card (a primary source) and the field-note card (a harvested reel). The boards' / the report's anatomy in plate classes.
import { plateState, NoData } from "./PlateState.jsx";
import { Stamp } from "./Marks.jsx";

/**
 * The field card. `alike` = lines that line up (lit squares), `gaps` = [{ text, link: { label, href } }] (dashed squares),
 * `figures` = { label, value } (D192's contextual parts, e.g. "ROLE FIT · STACK · DUTIES" / "88 · 75 · 72").
 * partial: a list with no data says so; nothing is invented.
 */
// D199 C6 (47h): `children` = what the page adds under the scores (the market's company in brief and the sheet link).
// 47i: a caller's data-* hooks reach the DOM (FitCard's data-fit-face="front" was swallowed into the state props)
const dataAttrs = (s) => Object.fromEntries(Object.entries(s).filter(([k]) => k.startsWith("data-")));
export function FieldCard({ kicker = "FIELD CARD · WHY IT FITS", note = "NO AI", alike = [], gaps = [], figures, className = "", lead = null, foot = null, groupRule = true, inlineLinks = false, children = null, ...s }) {   // D202: lead / foot — FitCard's count on top, its Turn over below
  const gate = plateState(s, { height: 300, radius: "plate", label: "Loading why it fits", lines: 4 });
  if (gate) return gate;
  return (
    <aside className={`pl-card pl-fieldcard ${className}`.trim()} aria-label="Why this opening fits you" {...dataAttrs(s)}>
      <div className="pl-card__strip"><span className="pl-label">{kicker}</span>{note ? <span className="pl-label pl-muted">{note}</span> : null}</div>
      <div className="pl-card__body">
        {lead ? <>{lead}<div className="pl-card__rule"/></> : null}
        <div className="pl-card__group">
          <span className="pl-label pl-tone-lit">LINES UP</span>
          {alike.length ? alike.map((a, i) => <div key={i} className="pl-card__item"><span aria-hidden="true" className="pl-card__mark"/><span>{a}</span></div>) : <NoData/>}
        </div>
        {groupRule ? <div className="pl-card__rule"/> : null}
        <div className="pl-card__group">
          <span className="pl-label pl-tone-clay">DOESN’T, YET</span>
          {gaps.length ? gaps.map((g, i) => (
            <div key={i} className="pl-card__item"><span aria-hidden="true" className="pl-card__mark" data-yet=""/>
              <span>{g.text}{g.link ? <>{inlineLinks ? " " : null}<a href={g.link.href} style={{ display: inlineLinks ? "inline" : "block", fontWeight: 700 }}>{g.link.label}</a></> : null}</span></div>
          )) : <NoData>NOTHING MISSING</NoData>}
        </div>
        {figures ? <>
          <div className="pl-card__rule"/>
          {/* D196 FIX-5: the three numbers as a labelled row (role · stack · duties), each its own cell — never bare numbers */}
          {Array.isArray(figures.items) ? (
            <dl className="pl-card__figs" data-field-figures="">
              {figures.items.map((f) => (
                <div key={f.label} className="pl-card__fig" data-fig={f.key}>
                  <dt className="pl-label pl-muted">{f.label}</dt>
                  <dd className="pl-card__num">{f.value ?? <><span aria-hidden="true">—</span><span className="pl-card__why">{f.why || "NOT SCORED YET"}</span></>}</dd>
                </div>
              ))}
            </dl>
          ) : <div className="pl-card__foot"><span className="pl-label pl-muted">{figures.label}</span><span className="pl-card__num">{figures.value ?? "—"}</span></div>}
        </> : null}
        {children ? <><div className="pl-card__rule"/>{children}</> : null}
        {foot}
      </div>
    </aside>
  );
}

const ASK_TIER = { T1: "T1 • ACTION", T2: "T2 • FROM YOUR DATA", T3: "T3 • WRITTEN BY THE ASSISTANT", ask: "ASKS BACK" };
/**
 * ⭐ 47j (D197 Wave 2 #12 · M3, lane w2-practice) · ASK DRAFT'S CARD — D190's panel (components/AppNav.jsx AskDraftPanel) as a
 * plate piece: the strip (its name + the one rule), the conversation scrolling inside the card (newest kept in view by the
 * page), each of draft's turns labelled with its tier as a plain mono word (T1 • ACTION · T2 • FROM YOUR DATA ·
 * T3 • WRITTEN BY THE ASSISTANT · ASKS BACK — the D152 mark, no box), its lessons and links, *Next:*, Undo on a T1 change,
 * Yes / No on an ask-back, Confirm / Cancel on a proposed action, *Use as my answer* on an application draft; then the input
 * with Speak (only where the browser can listen) and Ask, the voice note, and the "improve Atlas" opt-in.
 * `turns` = [{ who: "you" | "draft" | "question", tier, text, lessons: [{ name, href, kind }], links: [{ title, href }], next,
 * undo, undone, confirm, action: { summary }, decided, usable, used, failed }]; `children` = what sits above the turns (a held
 * application's thread). The page owns every behaviour: `on*` callbacks receive the turn's index.
 */
export function AskDraftCard({ name = "Ask draft", sub = "draft’s helper — no AI for anything draft already holds", intro, turns = [], busy = false,
  value = "", onChange, onSend, placeholder, canSpeak = false, listening = false, onSpeak, voiceNote, improve = null,
  onClose, onUndo, onAnswerBack, onDecide, onUseAnswer, children = null, bodyRef, ...s }) {
  const gate = plateState(s, { height: 420, radius: "plate", label: `Loading ${name}`, lines: 5 });
  if (gate) return gate;
  const send = (e) => { e.preventDefault(); if (value.trim() && !busy) onSend?.(value.trim()); };
  return (
    <aside className="pl-card pl-ask" aria-label={name} data-ask-card="">
      <div className="pl-card__strip pl-ask__strip">
        <span className="pl-ask__who"><b className="pl-ask__name">{name}</b><span className="pl-label pl-muted">{sub}</span></span>
        {onClose ? <button type="button" className="pl-btn" onClick={onClose} aria-label={`Close ${name}`}>Close</button> : null}
      </div>
      <div className="pl-ask__body" ref={bodyRef}>
        {children}
        {!turns.length && intro ? <p className="pl-ask__intro">{intro}</p> : null}
        <ol className="pl-ask__turns" aria-live="polite">
          {turns.map((t, i) => (
            <li key={i} className="pl-ask__turn" data-who={t.who} data-tier={t.tier || undefined} data-failed={t.failed ? "" : undefined}>
              {t.who === "draft" && ASK_TIER[t.tier] ? <span className="pl-label pl-ask__tier" data-tier={t.tier}>{ASK_TIER[t.tier]}</span> : null}
              <p className="pl-ask__text">{t.who === "you" ? <b>You: </b> : t.who === "question" ? <b>Question: </b> : null}{t.text}</p>
              {t.lessons?.length ? (
                <ul className="pl-ask__links" aria-label="Lessons">
                  {t.lessons.map((l) => <li key={l.href}><a href={l.href}>{l.name}</a>{l.kind ? <span className="pl-label pl-muted"> {l.kind}</span> : null}</li>)}
                </ul>
              ) : null}
              {t.links?.length ? <ul className="pl-ask__links" aria-label="Links">{t.links.map((l) => <li key={l.href}><a href={l.href}>{l.title}</a></li>)}</ul> : null}
              {t.next ? <p className="pl-ask__next"><b>Next: </b>{t.next}</p> : null}
              <div className="pl-ask__acts">
                {t.usable ? (t.used ? <span className="pl-label pl-muted">IN YOUR ANSWER — EDIT IT THERE</span>
                  : <button type="button" className="pl-btn" onClick={() => onUseAnswer?.(i)}>Use as my answer</button>) : null}
                {t.undo && !t.undone ? <button type="button" className="pl-btn" onClick={() => onUndo?.(i)}>Undo</button> : null}
                {t.undone ? <span className="pl-label pl-muted">{t.undone}</span> : null}
                {t.confirm ? <><button type="button" className="pl-btn" onClick={() => onAnswerBack?.(i, true)}>Yes</button>
                  <button type="button" className="pl-btn pl-btn--dashed" onClick={() => onAnswerBack?.(i, false)}>No</button></> : null}
                {t.action ? (t.decided ? <span className="pl-label pl-muted">{t.decided}</span> : <>
                  <span className="pl-ask__summary">{t.action.summary}?</span>
                  <button type="button" className="pl-btn pl-btn--ink" onClick={() => onDecide?.(i, true)}>Confirm</button>
                  <button type="button" className="pl-btn pl-btn--dashed" onClick={() => onDecide?.(i, false)}>Cancel</button></>) : null}
              </div>
            </li>
          ))}
        </ol>
        {busy ? <p className="pl-label pl-muted" role="status">THINKING…</p> : null}
      </div>
      <form className="pl-ask__form" onSubmit={send}>
        <label className="pl-sr" htmlFor="pl-ask-input">{`Ask ${name}`}</label>
        <textarea id="pl-ask-input" className="pl-textarea pl-ask__input" rows={2} maxLength={600} value={value} placeholder={placeholder || `Ask ${name}`}
          onChange={(e) => onChange?.(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) send(e); }}/>
        <div className="pl-ask__formacts">
          {canSpeak ? <button type="button" className="pl-btn" aria-pressed={!!listening} aria-label="Speak a command" onClick={onSpeak}>{listening ? "Stop" : "Speak"}</button> : null}
          <button type="submit" className="pl-btn pl-btn--primary" disabled={busy || !value.trim()}>Ask</button>
        </div>
        {voiceNote ? <p className="pl-label pl-muted" aria-live="polite">{voiceNote}</p> : null}
        {improve ? (
          <label className="pl-ask__opt"><input type="checkbox" className="pl-check" checked={!!improve.on} onChange={improve.onToggle}/>
            Use my questions to improve Atlas (stored without your name or contact details)</label>
        ) : null}
      </form>
    </aside>
  );
}

/** A side panel: a strip, then label / value rows (the ledger's "Filled for you"). Values are never guessed. */
export function FactSheet({ kicker, rows = [], foot, label, ...s }) {
  const gate = plateState(s, { height: 260, radius: "plate", label: "Loading", lines: 4 });
  if (gate) return gate;
  return (
    <aside className="pl-card pl-fieldcard" aria-label={label || kicker}>
      <div className="pl-card__strip"><span className="pl-label">{kicker}</span></div>
      <div className="pl-card__body" style={{ gap: 8 }}>
        {rows.map((r) => (
          <div key={r.label} className="pl-card__item" style={{ justifyContent: "space-between", gap: 10, borderBottom: "var(--pl-border-rule)", paddingBottom: 7, overflowWrap: "normal" }}>
            {/* 47i: as the board — the label wraps at its spaces ("Alma / mater"), a value stays whole ("anywhere" split the email) */}
            <span className="pl-muted">{r.label}</span>{r.value == null ? <NoData/> : <b style={{ textAlign: "right" }}>{r.value}</b>}
          </div>
        ))}
        {foot ? <span className="pl-muted" style={{ fontSize: "var(--pl-t-tiny)" }}>{foot}</span> : null}
      </div>
    </aside>
  );
}

/** A catalogue card — a primary source: call number tag, serif title, mono authors, punch hole; EXPLAINED when marked. */
export function CatalogueCard({ call, title, authors, href, explained = false, onToggle, ...s }) {
  const gate = plateState(s, { height: 150, radius: "card", label: "Loading the source" });
  if (gate) return gate;
  return (
    <div className="pl-catalogue">
      <span aria-hidden="true" className="pl-catalogue__hole"/>
      {call ? <span className="pl-catalogue__call">{call}</span> : null}
      {href ? <a className="pl-catalogue__title" href={href} style={{ color: "var(--pl-ink)" }}>{title}</a> : <span className="pl-catalogue__title">{title}</span>}
      {authors ? <span className="pl-catalogue__authors">{authors}</span> : null}
      {onToggle ? <button type="button" className="pl-btn" aria-pressed={explained} onClick={onToggle} style={{ alignSelf: "flex-start" }}>{explained ? "Explained" : "Mark as explained"}</button> : null}
      {explained ? <Stamp tone="lit" rotate={-6}>EXPLAINED</Stamp> : null}
    </div>
  );
}

/** A field-note card: a dark 9:16 poster (kicker, duration, the highlighted phrase, progress) + the FN label strip. */
export function FieldNoteCard({ code, kicker, duration, text, highlight, progress = 0, views, href, ...s }) {
  const gate = plateState(s, { height: 380, radius: "q", label: "Loading the field note" });
  if (gate) return gate;
  const parts = highlight && text?.includes(highlight) ? text.split(highlight) : [text];
  const Tag = href ? "a" : "div";
  return (
    <Tag className="pl-fieldnote pl-lift" href={href}>
      <div className="pl-fieldnote__poster">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
          <span className="pl-label pl-tone-on">{kicker}</span>{duration ? <span className="pl-label pl-tone-on">{duration}</span> : null}
        </div>
        <span className="pl-fieldnote__text">{parts.length === 2 ? <>{parts[0]}<span className="pl-fieldnote__hi">{highlight}</span>{parts[1]}</> : text}</span>
        <div className="pl-fieldnote__bar" role="img" aria-label={`${Math.round(progress * 100)}% watched`}><span style={{ width: `${Math.round(progress * 100)}%` }}/></div>
      </div>
      <div className="pl-fieldnote__strip"><span className="pl-label">{code}</span>{views ? <span className="pl-label pl-muted">{views}</span> : null}</div>
    </Tag>
  );
}
