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
import { useState } from "react";
import { Gazetteer } from "./Lists.jsx";
import { StatusTag } from "./Marks.jsx";
import { StarMark } from "../components/StarMark.jsx";
import { draftButtonState } from "../lib/jobDecisions.js";
import { companyPath } from "../lib/companySlug.js";
import { jobDetailHref } from "../lib/jobUrl.js";

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
export function indexRow(job, i, { score = null, status = "NEW", yours = null } = {}) {
  const id = job.jobId || job.id;
  return {
    id, job, n: String(i + 1), title: job.title || "", company: job.company || "",
    companyHref: companyPath(job.company, { job: id }) || null,
    match: Number.isFinite(score) ? `${Math.round(score)}%` : "—",
    stack: stackCell(job, yours),
    sponsor: job.isH1bSponsor === true ? "FILED" : "—",
    status,
  };
}

/** FIX-8 · the row bubble: Star and Draft, the board's own handlers, in plate tokens. */
export function RowBubble({ job, saved = false, drafted = false, drafting = false, draftBlocked = null, draftSlots = null,
                            onSave, onDraft, onViewDraft = null, onExplainDraft = null }) {
  const draft = draftButtonState({ drafted, drafting, block: draftBlocked, canView: !!onViewDraft, slots: draftSlots });
  const what = `${job.title || "this opening"}${job.company ? ` at ${job.company}` : ""}`;
  const canDraft = !!(job.applyUrl || job.url);
  const stop = (fn) => (e) => { e.stopPropagation(); fn?.(); };
  return (
    <span className="pl-rowbubble" data-row-bubble="">
      <span aria-hidden="true" className="pl-rowbubble__dot">✱</span>
      <span className="pl-rowbubble__pill">
        <button type="button" className="pl-rowbubble__star" aria-pressed={saved} data-bubble-action="star"
          aria-label={saved ? `Starred: ${what}` : `Star ${what}`} onClick={stop(saved ? null : onSave)}>
          <StarMark filled={saved}/>
        </button>
        {canDraft ? (
          <button type="button" className="pl-rowbubble__draft" data-bubble-action="draft" data-draft-state={draft.kind}
            disabled={draft.disabled} aria-disabled={draft.ariaDisabled || undefined} title={draft.title}
            aria-label={draft.kind === "idle" ? `Draft ${what}` : `${draft.title}: ${what}`}
            onClick={stop(draft.action === "draft" ? onDraft : draft.action === "view" ? onViewDraft
              : draft.action === "explain" ? () => onExplainDraft?.(draft.title) : null)}>
            {draft.kind === "drafted" ? "Drafted" : draft.kind === "drafting" ? "Drafting…" : "Draft"}
          </button>
        ) : null}
      </span>
    </span>
  );
}

/**
 * The Index table. `rows` = indexRow(...) results; `bubble(row)` draws the row's RowBubble (the caller wires the board's
 * own actions); `onOpen(job)` opens the posting. Loading / empty / error are the Gazetteer's states (R1) — but the board's
 * own empty states stay the caller's (they say WHY it is empty).
 */
export function MarketIndexTable({ rows = [], onOpen, bubble, state, ...s }) {
  // FIX-8 on a touch screen (no hover): the FIRST tap on a row opens its bubble (Star · Draft) without opening the row; a
  // second tap on the same row opens the posting. A mouse or a keyboard opens the bubble by hover / focus, so a click opens.
  const [armed, setArmed] = useState(null);
  const touch = () => { try { return !!globalThis.matchMedia?.("(hover: none)").matches; } catch { return false; } };
  const tap = (r) => { if (touch() && armed !== r.id) { setArmed(r.id); return; } setArmed(null); onOpen?.(r.job); };
  const cols = INDEX_COLS.map((c) => (
    c.key === "title" ? { ...c, render: (r) => (
      <a className="pl-gz__title" href={jobDetailHref(r.id)} data-index-title=""
        onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); onOpen?.(r.job); }}>{r.title}</a>) }
    : c.key === "company" ? { ...c, render: (r) => (r.companyHref ? <a className="pl-gz__co" href={r.companyHref}>{r.company}</a> : r.company || "—") }
    : c.key === "status" ? { ...c, render: (r) => <StatusTag>{r.status}</StatusTag> }
    : c
  ));
  return (
    <div className="pl-marketindex" data-market-index="">
      <Gazetteer cols={cols} rows={rows} label="Every opening" rowClick onRow={tap}
        rowProps={(r) => (r.id === armed ? { "data-armed": "" } : null)}
        rowExtra={bubble} windowAfter={INDEX_WINDOW_AFTER} state={state} {...s}/>
    </div>
  );
}
