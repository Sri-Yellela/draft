// ⭐ D196 F3 · perforated things: the onward ticket, the opening (a posting as a ticket), the question (Needs you, one at
// a time) and the cartouche (the bearing). The boards' markup; perforations are two radial gradients at 62 %.
import { plateState, NoData } from "./PlateState.jsx";
import { LetterTile, StackChip, Stamp } from "./Marks.jsx";

/** An onward ticket: mono kicker, serif title, one line, the tear, the go-line. tone: plain | clay-tint (the one primary) | clay. */
export function Ticket({ kicker, title, line, go, href, tone = "plain", onClick, ...s }) {
  const gate = plateState(s, { height: 170, radius: "plate", label: "Loading" });
  if (gate) return gate;
  const body = (
    <>
      <div className="pl-ticket__head">
        {kicker ? <span className="pl-label">{kicker}</span> : null}
        <span className="pl-ticket__title">{title}</span>
        {line ? <span className="pl-ticket__line">{line}</span> : null}
      </div>
      {go ? <><div aria-hidden="true" className="pl-tear"/><span className="pl-ticket__go">{go}</span></> : null}
    </>
  );
  const tag = tone === "plain" ? undefined : tone;
  return href
    ? <a className="pl-ticket pl-lift" href={href} data-tone={tag} onClick={onClick}>{body}</a>
    : <div className="pl-ticket" data-tone={tag}>{body}</div>;
}

/**
 * An opening — a posting as a perforated ticket (the market's deck card). `opening` = { company, place, title, match,
 * pay, type, mode, posted, live, stack: [{ name, yours }], sponsors, sponsorLabel, logo, region, companyHref }.
 * R2: long titles and names wrap; no logo → the letter tile; no pay → "Pay not posted"; no sponsorship data → no stamp
 * (nothing says "no"). The actions are the caller's (R6: the deck keeps its own Pass / Save / Send / Draft).
 */
// ⭐ D196 FIX-4 (47f): the deck draws its ticket with THIS component (A93 — built once), through four optional slots that
// leave the gallery's markup unchanged when absent: `as` (the deck's FanCard is already the <article>, so its face is a
// div), `company` (the deck's router Link with its data-company-link hook), `match` (the deck's button that opens the
// report) and `titleProps` (+ `titleTag`: the deck's h2 with its id, ref and view-transition name). `rest` lands on the root.
// ⭐ D200 Rule 2 (47h): `logo(tile)`, `chip(t, node)` and `stamp(node)` let a page wrap the marks so each answers (the market's
// popovers, plate/MarkPopover.jsx); without them the marks draw as before.
export function Opening({ opening = {}, actions, as: Root = "article", company, match, titleProps, titleTag: TitleTag = "h3", rootProps, logo, chip, stamp, ...s }) {
  const gate = plateState(s, { height: 420, radius: "sheet", label: "Loading the opening", lines: 4 });
  if (gate) return gate;
  const o = opening;
  const label = Root === "article" ? `${o.title || "Opening"} at ${o.company || "a company"}${o.match == null ? "" : `, ${o.match}% match`}` : undefined;
  return (
    <Root className="pl-opening" aria-label={label} data-region={o.region} {...rootProps}>
      <div className="pl-opening__strip">
        <span className="pl-label">OPENING{o.posted ? ` · ${o.posted}` : ""}</span>
        {o.live ? <span className="pl-label pl-tone-lit">{o.live}</span> : null}
      </div>
      <div className="pl-opening__body">
        <div className="pl-opening__top">
          <div className="pl-opening__co">
            {logo ? logo(<LetterTile name={o.company} logo={o.logo} region={o.region}/>) : <LetterTile name={o.company} logo={o.logo} region={o.region}/>}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              {company || (o.companyHref ? <a className="pl-opening__coname" href={o.companyHref}>{o.company}</a> : <span className="pl-opening__coname">{o.company}</span>)}
              {o.place ? <span className="pl-opening__place" data-deck-location="">{o.place}</span> : null}
            </div>
          </div>
          {match !== undefined ? match : o.match == null ? null : (
            <div className="pl-opening__match"><span className="pl-opening__pct">{o.match}%</span><span className="pl-label">MATCH</span></div>
          )}
        </div>
        <TitleTag className="pl-opening__title" {...titleProps}>{o.title}</TitleTag>
        <div className="pl-opening__facts" data-deck-info="">
          <b>{o.pay || "Pay not posted"}</b>{o.type ? <span>{o.type}</span> : null}{o.mode ? <span>{o.mode}</span> : null}
        </div>
        {o.stack?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-works-with="">
            {/* 47m (public.md §7): signed out there is no résumé — the label says only what is true for a visitor */}
            <span className="pl-label pl-muted">{o.signedOut ? "WORKS WITH" : "WORKS WITH · ✓ ON YOUR RÉSUMÉ"}</span>
            <div className="pl-stackchips">{o.stack.map((t) => (chip ? <span key={t.name} style={{ display: "contents" }}>{chip(t, <StackChip name={t.name} yours={t.yours}/>)}</span> : <StackChip key={t.name} name={t.name} yours={t.yours}/>))}</div>
          </div>
        ) : s.state === "partial" ? <NoData>STACK · NO DATA YET</NoData> : null}
        {o.sponsors ? <span className="pl-opening__stamp" data-stamp-answers={stamp ? "" : undefined}>{stamp ? stamp(<Stamp land={o.stampLand !== false}>{o.sponsorLabel || "FILED H-1B"}</Stamp>) : <Stamp land={o.stampLand !== false}>{o.sponsorLabel || "FILED H-1B"}</Stamp>}</span> : null}
      </div>
      {actions ? <><div aria-hidden="true" className="pl-opening__tear"/><div className="pl-opening__actions" data-deck-actions="">{actions}</div></> : null}
    </Root>
  );
}

/** The two cards fanned behind the top opening (the deck renders three tickets — R3). */
export function DeckPile({ children }) {
  return (
    <div className="pl-deckpile">
      <div aria-hidden="true" className="pl-deckpile__back pl-deckpile__back--1"/>
      <div aria-hidden="true" className="pl-deckpile__back pl-deckpile__back--2"/>
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

/**
 * Needs you — one question at a time, 44 px serif, big Yes / No tickets, or a draft to check (a 2,000-character draft
 * grows its box; nothing clips — R2). `progress` = squares (lit = answered, today = this one).
 * ⭐ 47h (D197 #3, Home's held stepper wears this face): optional, controlled — `options` (the form's own Yes / No words),
 * `pressed` (the answer given), `saved` + `onSaved` (the keep-it box), kind "choice" (a select of `options`) or "text" (an
 * input) with `value` / `onChange`, `onNext` + `nextLabel` + `canNext` (the step's own button), `backDisabled`, `children`
 * (a line under the answer). Without them the markup is the gallery's.
 */
export function QuestionTicket({ kicker, n, text, kind = "yesno", draft, onAnswer, onBack, progress = [], saveLabel = "Save this answer for next time", more, aside = null,
  options, pressed, saved, onSaved, value, onChange, onNext, nextLabel = "Next", canNext = true, backDisabled = false, children, rootProps, ...s }) {
  const gate = plateState(s, { height: 380, radius: "hero", label: "Loading the question", lines: 4 });
  if (gate) return gate;
  const done = progress.filter((p) => p === "lit").length;
  const save = saveLabel ? (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, minHeight: 44 }} data-save-for-next-time="">
      {onSaved ? <input type="checkbox" className="pl-check" checked={saved !== false} onChange={(e) => onSaved(e.target.checked)}/> : <input type="checkbox" className="pl-check" defaultChecked/>}{saveLabel}
    </label>
  ) : null;
  const yn = options?.length ? options : ["Yes", "No"];
  return (
    <article className="pl-question pl-in" aria-live="polite" {...rootProps}>
      <div className="pl-question__strip">
        <span className="pl-label">{kicker}</span>
        <span className="pl-squares pl-squares--gap4" role="img" aria-label={`${done} of ${progress.length} answered`}>
          {progress.map((p, i) => <span key={i} className="pl-sq pl-sq--12" data-s={p === "lit" ? "lit" : p === "today" ? "today" : undefined}/>)}
        </span>
      </div>
      <div className="pl-question__body">
        {/* 47i: `aside` (Ask draft) rides the progress line — in the foot it pushed See all onto a second line at 292 px */}
        {n ? (aside ? <div className="pl-question__top"><span className="pl-kicker pl-muted" data-held-progress="">{n}</span>{aside}</div>
          : <span className="pl-kicker pl-muted" data-held-progress="">{n}</span>) : null}
        <h3 className="pl-question__text" data-held-question="">{text}</h3>
        {kind === "yesno" ? (
          <>
            <div className="pl-answers" role="group" aria-label={text}>
              {yn.map((o) => <button key={o} type="button" className="pl-answer" data-yes-no={o} aria-pressed={pressed == null ? undefined : pressed === o}
                onClick={() => onAnswer?.(options?.length || pressed !== undefined ? o : o.toLowerCase())}>{o}</button>)}
            </div>
            {save}
          </>
        ) : kind === "choice" || kind === "text" ? (
          <>
            {kind === "choice"
              ? <select className="pl-q-select" aria-label={text} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)}>
                  <option value="">Choose…</option>{(options || []).map((o) => <option key={o} value={o}>{o}</option>)}</select>
              : <input className="pl-q-input" aria-label={text} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canNext) onNext?.(); }}/>}
            {save}
          </>
        ) : kind === "custom" ? null /* 47m: the answer is the caller's own (children) — the Today card's match / order */ : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="pl-label pl-muted">DRAFTED FROM YOUR PROFILE AND THE POSTING · EDIT ANYTHING</span>
              <label className="pl-sr" htmlFor="pl-q-draft">Your answer</label>
              {onChange ? <textarea id="pl-q-draft" className="pl-textarea" rows={Math.min(14, Math.max(4, Math.ceil((value || "").length / 90)))} value={value ?? ""}
                  placeholder="In your own words…" onChange={(e) => onChange(e.target.value)}/>
                : <textarea id="pl-q-draft" className="pl-textarea" rows={Math.min(14, Math.max(4, Math.ceil((draft || "").length / 90)))} defaultValue={draft}/>}
            </div>
            {onNext ? null : (
              <div className="pl-actions">
                <button type="button" className="pl-btn pl-btn--ink" style={{ minHeight: 48, padding: "0 22px", borderRadius: "var(--pl-r-input)" }}
                  onClick={() => onAnswer?.(document.getElementById("pl-q-draft")?.value ?? draft)}>Use this</button>
                <span className="pl-muted" style={{ alignSelf: "center", fontSize: "var(--pl-t-meta)" }}>or edit it above first</span>
              </div>
            )}
          </>
        )}
        {children}
        {onNext && kind !== "yesno" ? (
          <div className="pl-actions">
            <button type="button" className="pl-btn pl-btn--ink" data-action="next-question" disabled={!canNext} style={{ minHeight: 48, padding: "0 22px", borderRadius: "var(--pl-r-input)" }}
              onClick={onNext}>{nextLabel}</button>
          </div>
        ) : null}
      </div>
      <div aria-hidden="true" className="pl-opening__tear"/>
      <div className="pl-question__foot">
        {onBack ? <button type="button" className="pl-btn" onClick={onBack} disabled={backDisabled} data-action="back-question">← Back</button> : null}
        <span className="pl-grow"/>
        {more}
      </div>
    </article>
  );
}

/**
 * The bearing as a printed cartouche: a sentence whose dashed italic parts are tappable (D184 B-7's sentence filter).
 * `parts` = strings and { id, text, label } — each object is a button that says what it changes.
 */
export function Cartouche({ kicker = "CARTOUCHE · THE BEARING", source, parts = [], onPart, actions, ...s }) {
  const gate = plateState(s, { height: 220, radius: "sheet", label: "Loading the bearing" });
  if (gate) return gate;
  return (
    <div className="pl-cartouche">
      <div className="pl-cartouche__strip"><span className="pl-label">{kicker}</span>{source ? <span className="pl-label pl-muted">{source}</span> : null}</div>
      <p className="pl-cartouche__text">
        {parts.map((p, i) => typeof p === "string"
          ? <span key={i}>{p}</span>
          : <button key={p.id} type="button" className="pl-cartouche__part" aria-label={p.label || `${p.id}: ${p.text}. Change it`} onClick={() => onPart?.(p.id)}>{p.text}</button>)}
      </p>
      {actions ? <div className="pl-cartouche__actions">{actions}</div> : null}
    </div>
  );
}

