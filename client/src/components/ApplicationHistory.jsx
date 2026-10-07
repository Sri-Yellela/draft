// D15 · THE TABLE — the user's application history: every application, pending and sent.
//
// ⛔ The user-facing panel behind the top bar's "The Table", NOT the admin DB inspector.
// ⭐ THE POINT OF THIS PAGE IS CAPTURING OUTCOMES. job_applications' reply columns are the only
// thing that can ever show whether the ATS score predicts anything, so a sent application that
// has matured with nothing recorded ASKS "Did they reply?" — and the answer goes through the merge
// endpoint (PATCH /api/apply/applications/:jobId/response), never the generic field PATCH.
//
// The rule — one exclusive status, the timeline, the chips, the sort — is shared/applicationHistory.js
// (the server builds the rows with it; this file applies the view). ⛔ NO STATUS BAR: the chips
// carry the counts. D1's depth tokens and hover rail throughout (ApplicationHistory.css).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, authHeaders } from "../lib/api.js";
import {
  HISTORY_CHIPS, HISTORY_SORTS, REPLY_ASK, applyHistoryView, oldestUnanswered,
  kanbanColumns, historyFunnel, FUNNEL_ENDINGS,
} from "../../../shared/applicationHistory.js";
import {
  RESPONSE_OUTCOME, RESPONSE_OUTCOMES, RESPONSE_LABELS, MATURITY_DAYS,
} from "../../../shared/applicationResponse.js";
// ⭐ D54: By company — one identity across boards, never the display string alone.
import { companyRows, companySummary } from "../../../shared/companyIdentity.js";
import "./ApplicationHistory.css";

const fmtDay = (sec) => sec == null ? "—"
  : new Date(sec * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** A calendar day is the USER's day: bounds are computed in local time, then sent as seconds. */
function dayBound(iso, end) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const t = end ? new Date(y, m - 1, d, 23, 59, 59) : new Date(y, m - 1, d, 0, 0, 0);
  return Math.floor(t.getTime() / 1000);
}

/** What a failed download says. ⛔ Never silent, never an empty file. */
const DOWNLOAD_ERRORS = {
  artifact_missing: "This résumé is not stored any more, so there is nothing to download.",
  artifact_corrupt: "The stored résumé is damaged and could not be opened — nothing was downloaded.",
};

/**
 * O56(a): what the download IS, from row.resumeSource (shared/applicationHistory.js — D16's kept copy
 * first, the working résumé only without one). ⛔ Only a kept copy may be called "the résumé sent".
 */
const RESUME_LINK = {
  snapshot_at_record: { title: "Download the résumé sent with this application", label: "Download résumé" },
  backfill:           { title: "Download the copy kept for this application — saved after you applied, from the résumé as it was then", label: "Download résumé (kept later)" },
  current_resume:     { title: "No copy was kept when you applied — this downloads your résumé for this job as it is now, which may have changed since", label: "Download current résumé" },
};
const resumeLink = (row) => RESUME_LINK[row.resumeSource] || RESUME_LINK.current_resume;

/** D54 List | By company, and D55's Board (Kanban) and Funnel — four views of the SAME rows. */
const LAYOUTS = [["list", "List"], ["company", "By company"], ["board", "Board"], ["funnel", "Funnel"]];

/** The funnel's drop-offs, in the order they are drawn after the share that went on. */
const ENDING_LABEL = { active: "Still open", rejected: "Rejected", no_reply: "No reply", closed: "Withdrawn" };
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "—");

/**
 * ⭐ D55 F · THE FUNNEL — a stepped funnel, one SVG bar per step (text stays HTML so it reads at 390px).
 * Each bar is the applications that REACHED the step, centred, split into the share that went on to
 * the next step and where the rest stopped. ⛔ Every number is historyFunnel's over the List's rows.
 */
function Funnel({ rows }) {
  const f = historyFunnel(rows);
  if (!f.sent) {
    return <p className="ah__empty">Nothing sent yet — the funnel starts at the first application you send.</p>;
  }
  return (
    <section className="ah__funnel" aria-label="Application funnel" data-funnel="" data-sent={f.sent}>
      {f.steps.map((s, i) => {
        const next = f.steps[i + 1]?.reached ?? 0;
        const w = (s.reached / f.sent) * 100;
        let x = (100 - w) / 2;
        const segs = [["on", next], ...FUNNEL_ENDINGS.map(e => [e, s.here[e]])].filter(([, n]) => n > 0)
          .map(([k, n]) => { const sw = (n / f.sent) * 100; const seg = { k, n, x, w: sw }; x += sw; return seg; });
        const stops = FUNNEL_ENDINGS.filter(e => s.here[e] > 0).map(e => `${s.here[e]} ${ENDING_LABEL[e].toLowerCase()}`);
        return (
          <div key={s.id} className="ah__fstep" data-funnel-step={s.id} data-reached={s.reached}>
            <div className="ah__fhead">
              <span className="ah__fname">{s.label}</span>
              <span className="ah__fn">{s.reached}</span>
              <span className="ah__fpct">{i === 0 ? "of what you sent" : `${pct(s.reached, f.sent)} of applied`}</span>
            </div>
            <svg className="ah__fbar" viewBox="0 0 100 10" preserveAspectRatio="none" role="img"
              aria-label={`${s.label}: ${s.reached} of ${f.sent}${next ? `, ${next} went on` : ""}${stops.length ? `; ${stops.join(", ")}` : ""}`}>
              <rect className="ah__ftrack" x="0" y="0" width="100" height="10" rx="0"/>
              {segs.map(g => <rect key={g.k} className="ah__fseg" data-seg={g.k} x={g.x} y="0" width={g.w} height="10"/>)}
            </svg>
            {stops.length > 0 && <p className="ah__fstops">Stopped here: {stops.join(" · ")}</p>}
          </div>
        );
      })}
      <ul className="ah__flegend" aria-label="Legend">
        <li data-seg="on">Went on to the next step</li>
        {FUNNEL_ENDINGS.map(e => <li key={e} data-seg={e}>{ENDING_LABEL[e]}</li>)}
      </ul>
      <p className="ah__meta">
        {plural(f.sent, "application")} sent
        {f.inPlay ? ` · ${f.inPlay} in play, not sent yet` : ""}
        {f.notSent ? ` · ${f.notSent} you did not apply to` : ""} — the List's {plural(f.total, "row")}.
      </p>
    </section>
  );
}

export default function ApplicationHistory({ onOpenPending, onOpenDraftHouse }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chip, setChip] = useState(null);
  const [sort, setSort] = useState("newest");
  const [open, setOpen] = useState(null);
  // D54: List | By company. The same rows, grouped — so the counts are the List's rows grouped.
  const [layout, setLayout] = useState("list");
  const [openCompany, setOpenCompany] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});
  const rowRefs = useRef({});

  const load = useCallback(async (query) => {
    setLoading(true); setError("");
    try {
      const d = await api(`/api/applications/history${query ? `?q=${encodeURIComponent(query)}` : ""}`);
      setRows(Array.isArray(d?.rows) ? d.rows : []);
    } catch (e) {
      setError(`The history could not be loaded — ${e.message || "try again"}.`);
    } finally { setLoading(false); }
  }, []);

  // Search covers the posting text, which only the server holds — so it is a request, debounced.
  useEffect(() => {
    const t = setTimeout(() => load(q.trim()), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  const view = useMemo(() => applyHistoryView(rows, {
    chip, sort, from: dayBound(from, false), to: dayBound(to, true),
  }), [rows, chip, sort, from, to]);
  const nudge = useMemo(() => oldestUnanswered(rows), [rows]);

  const note = (jobId, text, kind = "info") => setNotes(n => ({ ...n, [jobId]: text ? { text, kind } : null }));

  async function recordReply(row, outcome) {
    setBusy(row.jobId); note(row.jobId, "");
    try {
      await api(`/api/apply/applications/${encodeURIComponent(row.jobId)}/response`, {
        method: "PATCH", body: JSON.stringify({ outcome, source: "manual" }),
      });
      note(row.jobId, outcome === RESPONSE_OUTCOME.NO_RESPONSE
        ? "Recorded: no reply." : `Recorded: ${RESPONSE_LABELS[outcome]?.label ?? outcome}.`, "ok");
      await load(q.trim());
    } catch (e) {
      note(row.jobId, `Not saved — ${e.message || "try again"}.`, "error");
    } finally { setBusy(null); }
  }

  async function downloadResume(row) {
    note(row.jobId, "");
    try {
      const r = await fetch(`/api/applications/${encodeURIComponent(row.recordId)}/resume`,
        { credentials: "include", headers: authHeaders() });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(DOWNLOAD_ERRORS[body.error] || body.message || `The download failed (${r.status}).`);
      }
      const blob = await r.blob();
      if (!blob.size) throw new Error(DOWNLOAD_ERRORS.artifact_corrupt);
      const name = /filename="?([^";]+)"?/.exec(r.headers.get("Content-Disposition") || "")?.[1]
        || `resume-${String(row.company || "application").replace(/[^\w-]+/g, "-")}.html`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      note(row.jobId, e.message, "error");
    }
  }

  function answerOldest() {
    setChip(null); setOpen(nudge.jobId);
    requestAnimationFrame(() => rowRefs.current[nudge.jobId]?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }

  const filtered = !!(q || from || to || chip);

  return (
    <div className="ah">
      <div className="ah__toolbar">
        <input className="ah__search" type="search" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search company, title or the posting…" aria-label="Search applications"/>
        <label className="ah__date">From
          <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}/>
        </label>
        <label className="ah__date">To
          <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}/>
        </label>
        <div className="ah__layout" role="group" aria-label="Layout">
          {LAYOUTS.map(([id, label]) => (
            <button key={id} type="button" className="ah__chip" aria-pressed={layout === id} data-layout={id}
              onClick={() => setLayout(id)}>{label}</button>
          ))}
        </div>
        <label className="ah__date">Sort
          <select value={sort} onChange={e => setSort(e.target.value)}>
            {HISTORY_SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {/* ⛔ The chips ARE the counts — there is no summary bar. Each one filters; a second click clears. */}
      <div className="ah__chips" role="group" aria-label="Filter by status">
        {/* D55 F: one chip per funnel stage; an optional one (a reply with no stage) only when it holds a row. */}
        {HISTORY_CHIPS.filter(c => !c.optional || view.counts[c.id] || chip === c.id).map(c => (
          <button key={c.id} type="button" className="ah__chip" data-status={c.id}
            aria-pressed={chip === c.id} title={c.title}
            onClick={() => setChip(chip === c.id ? null : c.id)}>
            {c.label} <span className="ah__chip-n">{view.counts[c.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {nudge && (
        <p className="ah__nudge">
          Waiting longest: <strong>{nudge.company || "an application"}</strong>
          {nudge.title ? ` — ${nudge.title}` : ""}, sent {plural(nudge.daysWaiting, "day")} ago.{" "}
          <button type="button" className="ah__link" onClick={answerOldest}>
            {nudge.ask ? "Did they reply?" : "Record a reply"}
          </button>
        </p>
      )}

      {error && <p className="ah__note" data-kind="error" role="alert">{error}</p>}

      {/* ⭐ D54 · BY COMPANY — each company one row (sent AND in play: "trying to apply" counts), expanding
          to its jobs with their status and dates. */}
      {layout === "company" && (
        <div className="ah__list" data-by-company="">
          {!view.rows.length ? <p className="ah__empty">{loading ? "Loading your applications…" : "Nothing to group yet."}</p>
            : companyRows(view.rows).map(g => {
              const expanded = openCompany === g.key;
              return (
                <article key={g.key} className="ah__row" data-company-row={g.key} data-open={expanded}>
                  <div className="ah__head">
                    <button type="button" className="ah__main" aria-expanded={expanded}
                      onClick={() => setOpenCompany(expanded ? null : g.key)}>
                      <span className="ah__company">{g.name || "Unknown company"}</span>
                      <span className="ah__title">{companySummary(g)}</span>
                      <span className="ah__meta">{g.last ? `Last activity ${fmtDay(g.last)}` : ""}</span>
                    </button>
                  </div>
                  {expanded && (
                    <ul className="ah__fold ah__company-jobs">
                      {g.roles.map(row => (
                        <li key={row.jobId} data-status={row.status}>
                          <strong>{row.title || "—"}</strong> — {row.label}
                          {" · "}{row.sentAt ? `sent ${fmtDay(row.sentAt)}` : `added ${fmtDay(row.draftedAt)}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
        </div>
      )}

      {/* ⭐ D55 F · THE BOARD — a Kanban of the same rows, one column per stage. A card opens its row in
          the List; a sent card can be moved by recording its outcome (the merge endpoint, as the List). */}
      {layout === "board" && (
        !view.rows.length ? <p className="ah__empty">{loading ? "Loading your applications…" : "Nothing on the board yet."}</p> : (
          <div className="ah__board" data-board="">
            {kanbanColumns(view.rows).map(col => (
              <section key={col.id} className="ah__col" data-kanban-column={col.id} data-count={col.rows.length}
                aria-label={`${col.label}: ${col.rows.length}`}>
                <h3 className="ah__col-head" data-stage={col.id}>
                  {col.label} <span className="ah__chip-n">{col.rows.length}</span>
                </h3>
                {col.rows.length === 0 ? <p className="ah__col-empty">None</p> : col.rows.map(row => (
                  <article key={row.jobId} className="ah__card" data-stage={row.stage}>
                    <button type="button" className="ah__main" title="Open in the List"
                      onClick={() => { setLayout("list"); setOpen(row.jobId);
                        requestAnimationFrame(() => rowRefs.current[row.jobId]?.scrollIntoView({ block: "center" })); }}>
                      <span className="ah__company">{row.company || "Unknown company"}</span>
                      <span className="ah__title">{row.title || "—"}</span>
                      <span className="ah__meta">{row.sentAt ? `Sent ${fmtDay(row.sentAt)}` : `Added ${fmtDay(row.draftedAt)}`}</span>
                    </button>
                    {row.applicationId != null && (
                      <label className="ah__move">
                        <span className="ah__sr">Record the outcome for {row.company || "this application"}</span>
                        <select value={row.responseOutcome ?? ""} disabled={busy === row.jobId}
                          onChange={e => e.target.value && recordReply(row, e.target.value)}>
                          <option value="">{row.responseOutcome ? "—" : "Record outcome…"}</option>
                          {RESPONSE_OUTCOMES.map(o => <option key={o} value={o}>{RESPONSE_LABELS[o].label}</option>)}
                        </select>
                      </label>
                    )}
                    {notes[row.jobId] && (
                      <p className="ah__note" data-kind={notes[row.jobId].kind} role="status">{notes[row.jobId].text}</p>
                    )}
                  </article>
                ))}
              </section>
            ))}
          </div>
        )
      )}

      {layout === "funnel" && (
        loading && !rows.length ? <p className="ah__empty">Loading your applications…</p> : <Funnel rows={view.rows}/>
      )}

      {layout === "list" && (
      <div className="ah__list">
        {loading && !rows.length ? <p className="ah__empty">Loading your applications…</p>
          : !view.rows.length ? (
            <p className="ah__empty">
              {filtered ? "Nothing matches — clear the search, dates or chip."
                : "No applications yet. Draft a job, or open a posting from Full House, and it appears here."}
            </p>
          ) : view.rows.map(row => {
            const expanded = open === row.jobId;
            return (
              <article key={row.jobId} ref={el => { rowRefs.current[row.jobId] = el; }}
                className="ah__row" data-status={row.status} data-open={expanded}>
                <div className="ah__head">
                  <button type="button" className="ah__main" aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : row.jobId)}>
                    <span className="ah__company">{row.company || "Unknown company"}</span>
                    <span className="ah__title">{row.title || "—"}</span>
                    <span className="ah__meta">
                      {row.sentAt ? `Sent ${fmtDay(row.sentAt)}` : `Added ${fmtDay(row.draftedAt)}`}
                      {row.daysWaiting != null ? ` · ${plural(row.daysWaiting, "day")} waiting` : ""}
                      {/* D43: the posting was deleted; the record shows what was snapshot when you applied. */}
                      {row.postingListed === false ? " · posting no longer listed" : ""}
                    </span>
                  </button>
                  <span className="ah__status" data-status={row.status} data-stage={row.stage} data-ask={row.ask}>{row.label}</span>
                  {/* D1's rail: revealed on hover AND keyboard focus; always shown on touch. */}
                  <div className="ah__rail">
                    {row.applyUrl && (
                      <a className="ah__sq" href={row.applyUrl} target="_blank" rel="noopener noreferrer"
                        title="Open the posting" aria-label={`Open the posting for ${row.company || "this job"}`}>
                        <span aria-hidden="true">⌂</span><span className="ah__sq-cap">posting</span>
                      </a>
                    )}
                    {row.hasResume && row.recordId != null && (
                      <button type="button" className="ah__sq" onClick={() => downloadResume(row)}
                        title={resumeLink(row).title} aria-label={resumeLink(row).label}>
                        <span aria-hidden="true">⤓</span><span className="ah__sq-cap">résumé</span>
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="ah__fold">
                    <ol className="ah__timeline">
                      {row.timeline.map(s => (
                        <li key={s.key} data-reached={s.at != null || !!s.ongoing} data-skipped={!!s.skipped}>
                          <span className="ah__step">{s.label}</span>
                          <span className="ah__when">
                            {s.skipped ? "not needed"
                              : s.ongoing ? `${plural(s.days, "day")} so far`
                              : s.at == null ? "not yet"
                              : `${fmtDay(s.at)}${s.days != null ? ` · +${plural(s.days, "day")}` : ""}`}
                          </span>
                        </li>
                      ))}
                    </ol>

                    {/* D51: a Draft waits in Draft House — that is where it is acted on, not recorded here. */}
                    {row.status === "in_play" && row.origin === "drafted" && (
                      <p className="ah__ask">
                        Drafted — it waits for your review.{" "}
                        <button type="button" className="ah__btn" onClick={() => onOpenDraftHouse?.(row.jobId)}>
                          Open Draft House
                        </button>
                      </p>
                    )}
                    {row.status === "in_play" && row.origin !== "drafted" && (
                      <p className="ah__ask">
                        Not sent yet.{" "}
                        <button type="button" className="ah__btn" onClick={() => onOpenPending?.(row.jobId)}>
                          Record the submission
                        </button>
                      </p>
                    )}

                    {row.status === "sent" && row.ask && (
                      <div className="ah__ask">
                        <strong>Did they reply?</strong> It has been over {MATURITY_DAYS} days.
                        <div className="ah__answers">
                          {REPLY_ASK.map(a => (
                            <button key={a.outcome} type="button" className="ah__btn" disabled={busy === row.jobId}
                              onClick={() => recordReply(row, a.outcome)}>{a.label}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {row.applicationId != null && !(row.status === "sent" && row.ask) && (
                      <div className="ah__ask">
                        <span>{row.status === "sent" ? "Heard back? Record it:" : "Update the reply:"}</span>
                        <div className="ah__answers">
                          {RESPONSE_OUTCOMES.map(o => (
                            <button key={o} type="button" className="ah__btn" disabled={busy === row.jobId}
                              aria-pressed={row.responseOutcome === o}
                              onClick={() => recordReply(row, o)}>{RESPONSE_LABELS[o].label}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {row.hasResume && row.recordId != null && (
                      <p className="ah__ask">
                        <button type="button" className="ah__btn" onClick={() => downloadResume(row)}
                          title={resumeLink(row).title}>{resumeLink(row).label}</button>
                      </p>
                    )}
                  </div>
                )}
                {notes[row.jobId] && (
                  <p className="ah__note" data-kind={notes[row.jobId].kind} role="status">{notes[row.jobId].text}</p>
                )}
              </article>
            );
          })}
      </div>
      )}
    </div>
  );
}
