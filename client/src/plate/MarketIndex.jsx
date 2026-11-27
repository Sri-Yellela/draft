// ⭐ D196 FIX-7 / FIX-8 (owner 11-24, 47f) · THE MARKET'S INDEX — the board's Gazetteer, and the row bubble kept.
// Owner: "the index section in the new plate is not done yet coz it has the older style" · "have the expanding bubble with
// the draft and star buttons on hover retained in the newly designed one too".
//
// FIX-7: the Index tab's list IS the board's own list — JobsPanel's JobsColumn draws this instead of its bubble rows when the
// plate market is on, with the SAME rows, the same server order (D184 B-8's tiers, then fit — services/jobs/jobCursor.js),
// the same 50-a-page loading (BoardMore) and the same empty states. One table in a white card that scrolls sideways inside
// its own box; the ink header row: # · OPENING · COMPANY · MATCH · STACK · YOURS · H-1B · STATUS (the board's seven).
// A row click opens the posting (JobsColumn's own onJobSelect → the long post); past 200 rows it windows (R3).
// R2: a cell the row can't back says "—" — no score (the scorer declined) is never a 0; the board rows carry the posting's
// skills but not which are on the résumé, so STACK · YOURS shows the count and the ✓ only when a report says them.
//
// FIX-8: the bubble at the row's right end — collapsed a 32 px white circle with a ✱; on hover or keyboard focus within the
// row it grows LEFTWARDS (0.25 s, the plate's easing) into a white pill holding Star and Draft (Draft the row's one clay
// element). It overlays the row's last cell, so the row never moves; on a touch screen the first tap on a row opens it
// (the second opens the posting); below 860 px (the board's 760 px table) the resting circle is not drawn — it would
// cover the tag — and hover / focus / a tap still open the pill; under Reduce motion it opens without the grow. Its two actions are the board's own: `onSave` / `onDraft` are JobsColumn's
// decideJob(job, SAVED / DRAFTED) and its Draft state comes from lib/jobDecisions.js draftButtonState (A181's limit, the
// view / explain cases) — never a second implementation.
import { StatusTag } from "./Marks.jsx";
import { plateState } from "./PlateState.jsx";
import { H1bStampPopover, CompanyStackPopover } from "./MarkPopover.jsx";   // ⭐ D200 Rule 2: the H-1B cell and the company answer
import { StarMark } from "../components/StarMark.jsx";
import { draftButtonState } from "../lib/jobDecisions.js";
import { companyPath } from "../lib/companySlug.js";
import { openingSheetHref } from "./OpeningSheet.jsx";   // D199 C7: the title is the opening sheet's link

// The widths are the board's own columns, set in plate.css (.pl-gzc--*): at 1280 the export measures 47 · 403 · 199 · 85 ·
// 162 · 85 · 150 of 1132 px; on its 390 artboard the table holds at 760 with 35 · 250 · 133 · 64 · 106 · 64 · 108. Fixed,
// so a page of new rows never moves them.
export const INDEX_COLS = Object.freeze([
  { key: "n", label: "#", kind: "num", col: "pl-gzc--n" },
  { key: "title", label: "OPENING", kind: "title", col: "pl-gzc--title" },
  { key: "company", label: "COMPANY", col: "pl-gzc--co" },
  { key: "match", label: "MATCH", kind: "serif", col: "pl-gzc--match" },
  { key: "stack", label: "STACK · YOURS", kind: "mono", col: "pl-gzc--stack" },
  { key: "sponsor", label: "H-1B", kind: "mono", col: "pl-gzc--h1b" },
  { key: "status", label: "STATUS", kind: "status", col: "pl-gzc--status" },
]);
export const INDEX_WINDOW_AFTER = 200;

/** Pure: a row's status tag. SENT = submitted · NEEDS YOU = held for an answer only the person can give · DRAFTED = in the
 *  pipeline (drafted, queued, in flight, in review) · NEW otherwise. */
export function indexStatus(jobId, { drafted = false, submitted = new Set(), needsYou = new Set() } = {}) {
  if (submitted.has(jobId)) return "SENT";
  if (needsYou.has(jobId)) return "NEEDS YOU";
  if (drafted) return "DRAFTED";
  return "NEW";
}

/** Pure: the STACK · YOURS cell — "5 · 4 ✓" when the résumé's matches are known, "5" when only the posting's list is. */
export function stackCell(job, yours = null) {
  const n = Array.isArray(job?.skills) ? job.skills.length : Array.isArray(job?.worksWith) ? job.worksWith.length : 0;
  if (!n) return "—";
  return Number.isFinite(yours) ? `${n} · ${yours} ✓` : String(n);
}

/** Pure: one index row from a board job. `score` = the shown score (null = declined → "—", never 0). */
/** ⭐ D40 → A251 (47j): an imported posting's line — "captured Nov 26 · from linkedin.com" (the retired card's words). Pure. */
export function capturedWords(c) {
  if (!c) return null;
  const day = c.at ? new Date(c.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;
  return [day ? `captured ${day}` : "captured", c.from ? `from ${c.from}` : null].filter(Boolean).join(" · ");
}

export function indexRow(job, i, { score = null, status = "NEW", yours = null, saved = false, offset = 0, ready = false } = {}) {
  const id = job.jobId || job.id;
  return {
    id, job, n: String(offset + i + 1), title: job.title || "", company: job.company || "", saved: !!saved,
    // ⭐ D57 → A249 (47j): a résumé generated for this job is stored — said on its row, so it is never "found nowhere"
    ready: !!ready,
    captured: capturedWords(job.captured),
    companyHref: companyPath(job.company, { job: id }) || null,
    match: Number.isFinite(score) ? `${Math.round(score)}%` : "—",
    stack: stackCell(job, yours),
    sponsor: job.isH1bSponsor === true ? "FILED" : "—",
    status,
  };
}

// ⭐ D199 C8 (owner 11-25: "the listing has an asterisk that cannot be reached because the draft buttons come up and cover
// them and idk what the asterisk serves, also the buttons need to push the options to the left not overlap") — this
// REPLACES FIX-8's overlay. The row is the `Market` board's flex row: # · the opening (★ before a saved title, the title, ·
// the company) · MATCH · STACK · YOURS · H-1B · STATUS · the actions cell. At rest the actions cell is 44 px (the board's
// ⋯ circle); on hover or keyboard focus within the row it grows to fit Star and Draft (0.25 s, the plate's easing) and the
// OPENING cell — the only flexible one — gives way to the left, its title ending in an ellipsis: nothing is ever under the
// buttons, and the row's height doesn't change. The old ✱ (the row's former save star) is gone: the bubble's Star does
// that, and a saved row shows a small filled ★ before its title. On a touch screen the actions are always open and the
// first tap opens the posting. ≥ 44 px targets; under Reduce motion the cell opens without the grow.

/** C8 · the row's actions: Star and Draft, the board's own handlers (JobsColumn's decideJob / draftControls).
 *  ⭐ 47m (A250, agent's pick — owner may reverse): + Send (`onSend`), the deck's and the sheet's fourth action on the row —
 *  the network's picker when it is on, else the posting's public link (shared or copied). No `onSend`, no button. */
export function RowBubble({ job, saved = false, drafted = false, drafting = false, draftBlocked = null, draftSlots = null,
                            onSave, onDraft, onViewDraft = null, onExplainDraft = null, onSend = null }) {
  const draft = draftButtonState({ drafted, drafting, block: draftBlocked, canView: !!onViewDraft, slots: draftSlots });
  const what = `${job.title || "this opening"}${job.company ? ` at ${job.company}` : ""}`;
  const canDraft = !!(job.applyUrl || job.url);
  const stop = (fn) => (e) => { e.stopPropagation(); fn?.(); };
  return (
    <span className="pl-ixrow__act" data-row-bubble="">
      <span aria-hidden="true" className="pl-ixrow__more">⋯</span>
      <button type="button" className="pl-ixrow__star" aria-pressed={saved} data-bubble-action="star"
        aria-label={saved ? `Starred: ${what}` : `Star ${what}`} onClick={stop(saved ? null : onSave)}>
        <StarMark filled={saved}/><span>{saved ? "Starred" : "Star"}</span>
      </button>
      {onSend ? (
        <button type="button" className="pl-ixrow__send" data-bubble-action="send" aria-label={`Send ${what}`} onClick={stop(onSend)}>Send</button>
      ) : null}
      {canDraft ? (
        <button type="button" className="pl-ixrow__draft" data-bubble-action="draft" data-draft-state={draft.kind}
          disabled={draft.disabled} aria-disabled={draft.ariaDisabled || undefined} title={draft.title}
          aria-label={draft.kind === "idle" ? `Draft ${what}` : `${draft.title}: ${what}`}
          onClick={stop(draft.action === "draft" ? onDraft : draft.action === "view" ? onViewDraft
            : draft.action === "explain" ? () => onExplainDraft?.(draft.title) : null)}>
          {draft.kind === "drafted" ? "Drafted" : draft.kind === "drafting" ? "Drafting…" : "Draft"}
        </button>
      ) : null}
    </span>
  );
}

/**
 * The Index. `rows` = indexRow(...) results (+ `saved` for the ★); `bubble(row)` draws the row's RowBubble (the caller wires
 * the board's own actions); `onOpen(job)` opens the posting. Loading / empty / error are the plate states (R1) — the board's
 * own empty states stay the caller's (they say WHY it is empty).
 */
export function MarketIndexTable({ rows = [], onOpen, bubble, state, ...s }) {
  const gate = plateState({ state, ...s }, { height: 320, radius: "card", label: "Loading every opening", lines: 5 });
  if (gate) return <div className="pl-marketindex" data-market-index="">{gate}</div>;
  return (
    <div className="pl-marketindex" data-market-index="">
      <div className="pl-ixtable" role="table" aria-label="Every opening">
        <div className="pl-ixrow pl-ixrow--head" role="row">
          <span role="columnheader" className="pl-ixc pl-ixc--n">#</span>
          <span role="columnheader" className="pl-ixc pl-ixc--title">OPENING · COMPANY</span>
          <span role="columnheader" className="pl-ixc pl-ixc--match">MATCH</span>
          <span role="columnheader" className="pl-ixc pl-ixc--stack pl-hide-sm">STACK · YOURS</span>
          <span role="columnheader" className="pl-ixc pl-ixc--h1b pl-hide-sm">H-1B</span>
          <span role="columnheader" className="pl-ixc pl-ixc--status">STATUS</span>
          <span role="columnheader" className="pl-ixc pl-ixc--act"><span className="pl-sr">Actions</span></span>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="pl-ixrow" role="row" data-row-opens="" data-saved={r.saved ? "true" : undefined}
            onClick={(e) => { if (e.target.closest("a, button")) return; onOpen?.(r.job); }}>
            <span role="cell" className="pl-ixc pl-ixc--n">{r.n}</span>
            <span role="cell" className="pl-ixc pl-ixc--title">
              {r.saved ? <span className="pl-ixrow__saved" aria-label="Starred">★</span> : null}
              <a className="pl-gz__title" href={openingSheetHref(r.id)} data-index-title=""
                onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); onOpen?.(r.job); }}>{r.title}</a>
              {r.company ? <span className="pl-ixrow__co"> · {r.companyHref
                ? <CompanyStackPopover company={r.company} markClass="pl-ixrow__comark"><span className="pl-gz__co">{r.company}</span></CompanyStackPopover>
                : r.company}</span> : null}
              {/* ⭐ A249 (D57) / A251 (D40), 47j: plain-word marks in the row's one line (D60 / D152: no box) — the title
                  cell is the row's flexible one, so they end in its ellipsis and the row's height never changes (C8) */}
              {r.ready ? <span className="pl-ixrow__mark" data-resume-ready="" title="A résumé is ready for this job — open the posting to view, download or regenerate it"> · résumé ready</span> : null}
              {r.captured ? <span className="pl-ixrow__mark" data-captured=""> · {r.captured}</span> : null}
            </span>
            <span role="cell" className="pl-ixc pl-ixc--match">{r.match}</span>
            <span role="cell" className="pl-ixc pl-ixc--stack pl-hide-sm">{r.stack}</span>
            <span role="cell" className="pl-ixc pl-ixc--h1b pl-hide-sm">{r.sponsor === "FILED"
              ? <H1bStampPopover company={r.company}><span className="pl-ixrow__filed">FILED</span></H1bStampPopover>
              : <span>—<span className="pl-sr"> no H-1B filings on record for this employer</span></span>}</span>
            <span role="cell" className="pl-ixc pl-ixc--status"><StatusTag>{r.status}</StatusTag></span>
            <span role="cell" className="pl-ixc pl-ixc--act">{bubble ? bubble(r) : null}</span>
          </div>
        ))}
      </div>
      <p className="pl-ixnote">Hover or focus a row: Star and Draft slide in and the row’s text moves aside — nothing is covered. A saved row shows ★ before its title.</p>
    </div>
  );
}
