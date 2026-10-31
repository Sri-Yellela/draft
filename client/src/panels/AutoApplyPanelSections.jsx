// ── The four surfaces of the Auto Apply panel ────────────────────────────────────────────────
//
// Extracted from AutoApplyPanel.jsx so the restructure is readable: the panel used to be one strip
// of status badges plus a modal, organised around RUNS. A run is an implementation detail — nobody
// thinks "run 47" — so it is organised around the only thing a user can act on: the OBSTACLE.
//
// Every row here names an obstacle and an action. Never a status code. The vocabulary lives in
// lib/applyObstacles.js, which the board's own chip reads too, so the two surfaces cannot describe
// the same application differently.
import { useState } from "react";
import { useTheme } from "../styles/theme.jsx";
import { api } from "../lib/api.js";
import { describeApplication, attemptStatusChip } from "../lib/applyObstacles.js";
import { companyLabel } from "../../../shared/atsHosts.js";
import { atsBandFor, atsBandLabel } from "../../../shared/atsBands.js";
import { markStyle, bandMarkStyle, dotCue } from "../styles/mark.js";
import { C } from "../styles/colorTokens.js";
import { postingClick } from "../lib/openPosting.js";
// AD1: OUTCOME_LABELS moved to AutoApplyPanel with the groups themselves — they name the SUB-TABS
// now, and nothing in this module reads them. The partition still lives in shared/ because
// routes/apply.js groups rows with it; a copy on each side is how the two come to disagree.

// A93: SectionHeading moved to components/SectionHeading.jsx (shared — WaitingLine and the Draft panel both
// draw it); re-exported here so this module's callers keep their import.
export { SectionHeading } from "../components/SectionHeading.jsx";

// D25: ObstacleCard (one obstacle, one action, a count) is gone with the cards it drew. D113 UI (10-31):
// Draft House is a tree of bubbles (components/DraftHouseTree.jsx); a job's branch uses AttemptRow and
// ApplicationRow below, and the portal item (lib/draftHouseExceptions.js) is the side column's first block.

/**
 * The COMPANY tier of AB4's hierarchy: outcome -> company -> application.
 *
 * Quieter than SectionHeading on purpose — it is a tier below it, and two headings competing for the
 * same weight is how a hierarchy stops reading as one. The count is the point for an employer with
 * several roles, which is the case this tier exists to make visible.
 */
export function CompanyHeading({ company, count, theme }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.04em",
                     textTransform: "uppercase", color: theme.textMuted }}>
        {/* A posting removed by the cleanup leaves an application with no employer, and so does a
            row whose only identifying data is an ATS host. Both are said plainly — companyLabel is
            the ONE place a company becomes display text, which is what makes "an ATS host can never
            appear as a company name" (AE3) a property rather than a promise about call sites. */}
        {companyLabel(company)}
      </span>
      {count > 1 && (
        <span style={markStyle(theme.textDim)}>
          {count} roles
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: theme.border, opacity: 0.5 }} />
    </div>
  );
}

/**
 * ONE APPLICATION, with every obstacle blocking it listed inside (TASK AB2).
 *
 * The counterpart to ObstacleCard, and the other half of the grouping rule in applyObstacles.js:
 * ObstacleCard is for one action that unblocks MANY applications, this is for many obstacles
 * blocking ONE. The panel previously had only the first, and used it for both — so an application
 * with three problems became three cards, each claiming to be "1 APPLICATION".
 *
 * Company and role are the headline, never "One application". A card that names neither leaves the
 * user unable to tell which job it is about, which is the one thing they need to know first.
 *
 * ── AC2: THE MODAL RENDERS THIS SAME COMPONENT ────────────────────────────────────────────────
 *
 * The modal used to be a flat list of problem-cards built from run-job rows by its own inline JSX —
 * two problems on one job rendered as two entries, and a dead posting for a different job sat
 * alongside them with a Review pill and nothing to click. AC2 requirement 1 says the modal must
 * MATCH the card summary, which already gets this right. So it is not re-described there; the modal
 * renders this component under a company tier, and the two surfaces cannot drift apart because
 * there is only one of them.
 *
 * Three optional props carry what the modal needs and the panel does not:
 *
 *   plan          resolutionPlan(app, …) — the problem list with CO-RESOLVABLE ones lifted out and
 *                 counted. When absent the flat reason list renders exactly as before, so the
 *                 panel's own cards are unchanged.
 *   onGroupAction called with a plan item when its amortised action is pressed.
 *   children      rendered at the foot of the card. The modal puts the per-ATTEMPT rows there —
 *                 the run-job detail this component collapses — so grouping loses nothing.
 */
export function ApplicationObstacleCard({
  app, theme, artifactUrl, onResolve, resolveLabel, resolveTitle, onDetails, onRerun, packet,
  onGenerateResume, plan = null, onGroupAction, detailsLabel, children,
}) {
  const many = app.reasons.length > 1;
  const tone = app.postingGone ? C.INK_FAINT : app.protective ? C.WARNING : C.DANGER;
  const stale = packet?.stale;

  return (
    // The data-* hooks are for scripts/abPanelUi.mjs, which counts cards in a real browser. AB2 is a
    // defect of how many cards one application produces, so the check has to be able to say WHICH
    // application a card belongs to — and matching on an inline-style substring to find the card
    // boundary is the kind of assertion that silently stops covering anything.
    <div data-rm-card="application"
         data-rm-job={app.jobId || ""}
         data-rm-company={app.company || ""}
         data-rm-obstacles={app.reasons.length}
         style={{ border: `1px solid ${theme.border}`, borderLeft: `3px solid ${tone}`,
                  borderRadius: 8, padding: "12px 14px", background: theme.surfaceHigh,
                  display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                        textTransform: "uppercase", color: tone, marginBottom: 3 }}>
            {app.postingGone ? "the posting is gone"
              : stale ? "prepared too long ago"
              : app.protective ? "held on purpose" : "did not complete"}
          </div>
          {/* THE APPLICATION, named. */}
          <div style={{ fontSize: 14, fontWeight: 800, color: theme.text, lineHeight: 1.35 }}>
            {companyLabel(app.company)}
            {app.title && <span style={{ color: theme.textMuted, fontWeight: 600 }}> — {app.title}</span>}
            {!app.title && app.jobId && (
              <span style={{ fontSize: 10, color: theme.textDim, fontWeight: 600 }}> · {app.jobId}</span>
            )}
          </div>
          {/* "1 application, 3 things to resolve" — the honest count. Three cards each saying
              "1 APPLICATION" made three jobs' worth of work out of one. */}
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
            One application · {app.reasons.length} thing{many ? "s" : ""} to resolve
            {app.attempts > 1 && ` · ${app.attempts} attempts`}
            {app.when ? ` · ${new Date(app.when).toLocaleDateString()}` : ""}
          </div>
        </div>
        {/* The count is of OBSTACLES here, not applications: this card IS one application, and a
            big "1" beside it was the number that made three cards look like three jobs. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                      minWidth: 46, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 400,
                         fontSize: 36, lineHeight: 1, color: tone }}>{app.reasons.length}</span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                         textTransform: "uppercase", color: theme.textDim, textAlign: "center" }}>
            to resolve
          </span>
        </div>
      </div>

      {/* EVERY obstacle, inside the one card. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5,
                    borderTop: `1px solid ${theme.border}`, paddingTop: 7 }}>
        {plan
          // ── AC2 requirement 2: CO-RESOLVABLE PROBLEMS, GROUPED ──────────────────────────────
          // An amortised item is not a bullet with a bigger font. It is a different OFFER — one
          // action, a count of what it releases — so it is rendered as the offer, and the count is
          // the part that carries the argument. resolutionPlan decides which items qualify; see the
          // table there for what can and cannot share one crossing (a CAPTCHA cannot, and is
          // excluded by name even though the server groups it by origin like a sign-in does).
          ? plan.map((item) => item.kind === "group" ? (
            <div key={item.key} data-rm-plan="group" data-rm-unblocks={item.unblocks}
              style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
                       border: `1px solid ${C.INFO}55`, borderLeft: `3px solid ${C.INFO}`,
                       borderRadius: 6, padding: "8px 10px", background: `${theme.surface}` }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                            minWidth: 34, flexShrink: 0 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 400,
                               fontSize: 26, lineHeight: 1, color: C.INFO }}>{item.unblocks}</span>
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em",
                               textTransform: "uppercase", color: theme.textDim }}>unblocked</span>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                              textTransform: "uppercase", color: C.INFO, marginBottom: 2 }}>
                  one action, {item.unblocks} applications
                </div>
                <div style={{ fontSize: 11.5, color: theme.text, lineHeight: 1.45 }}>
                  {item.headline}
                </div>
                {item.detail && (
                  <div style={{ fontSize: 10.5, color: theme.textMuted, lineHeight: 1.45 }}>
                    {item.detail}
                  </div>
                )}
              </div>
              {item.action && onGroupAction && (
                <button onClick={() => onGroupAction(item)}
                  style={{ border: "none", borderRadius: 6, padding: "6px 11px", background: C.INFO,
                           color: C.SURFACE_SOLID, fontWeight: 800, fontSize: 11, cursor: "pointer",
                           whiteSpace: "nowrap", flexShrink: 0 }}>
                  {item.action}
                </button>
              )}
            </div>
          ) : (
            // Its own problem, and only its own. No count — a "1" beside every line is the number
            // that made three cards look like three jobs, and it would do the same here.
            <div key={item.key} data-rm-plan="single"
                 style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", marginTop: 6, flexShrink: 0,
                             background: item.protective ? C.WARNING : C.DANGER, ...dotCue(item.protective ? "warn" : "bad") }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: theme.text, lineHeight: 1.45 }}>
                  {item.headline}
                  {item.detail && <span style={{ color: theme.textMuted }}> — {item.detail}</span>}
                </div>
                {item.action && (
                  <div style={{ fontSize: 10.5, color: theme.textMuted }}>→ {item.action}</div>
                )}
              </div>
            </div>
          ))
          : app.reasons.map((r, i) => (
            <div key={`${r.code}-${i}`} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", marginTop: 6, flexShrink: 0,
                             background: r.protective ? C.WARNING : C.DANGER, ...dotCue(r.protective ? "warn" : "bad") }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: theme.text, lineHeight: 1.45 }}>
                  {r.obstacle}
                  {r.detail && r.detail !== r.obstacle && (
                    <span style={{ color: theme.textMuted }}> — {r.detail}</span>
                  )}
                </div>
                {r.action && (
                  <div style={{ fontSize: 10.5, color: theme.textMuted }}>→ {r.action}</div>
                )}
              </div>
            </div>
          ))}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {app.primary?.row?.resumeAvailable ? (
          <a className="dbx-depth" href={artifactUrl(app.primary.row.id, "resume")} target="_blank" rel="noreferrer"
            style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px",
                     border: `1px solid ${theme.border}`, background: theme.surface,
                     color: theme.text, textDecoration: "none", whiteSpace: "nowrap" }}>
            Resume PDF ↗
          </a>
        ) : onGenerateResume && !app.postingGone
             && app.reasons.some(r => r.resumeBlocked) ? (
          // Requirement 5. No resume means this application cannot be submitted, which is a problem
          // with an obvious fix — so it is a button, not the dead chip it used to be. Offered only
          // when a missing resume is one of the reasons this application is held, and withheld when
          // the posting is gone: there would be nothing to tailor a resume to.
          <button className="dbx-depth" onClick={() => onGenerateResume(app)}
            title="Drafts this job again — the new run generates a tailored resume for it before it applies."
            style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px",
                     border: "none", background: C.INFO, color: C.SURFACE_SOLID, cursor: "pointer",
                     whiteSpace: "nowrap" }}>
            Generate a resume
          </button>
        ) : null}
        {/* ── AE4: "What we filled" IS GONE FROM HELD ROWS ────────────────────────────────────
            AB1 reframed this from a route into evidence, which was the right correction and not
            enough: on a held application it carries nothing the row does not already say. The row
            names the company, the role, the obstacle and the field count; the picture adds a second
            way to look at the same facts. And when a run holds before it fills anything — which is
            what AE1 made happen — the "evidence" is a screenshot of an EMPTY form, offered under a
            label that promises a record of work that never happened.
            It stays on SUBMITTED rows (ApplicationRow, variant="submitted"), where it is the one
            thing a candidate actually needs months later when an interview lands and they have to
            remember what they told this employer. The artifact and its endpoint are untouched — the
            audit row still references screenshot_path, and this removes an affordance, not a record. */}
        {(() => {
          // The REVIEW SCREEN's band. Renders even when atsScore is null, because null is the
          // scorer declining — its own band — and a reviewer deciding whether to submit is exactly
          // who needs to know the difference between "weak match" and "no basis to judge".
          const band = atsBandFor(app.atsScore ?? null);
          const meta = atsBandLabel(band);
          return (
            <span title={meta.blurb}
              style={bandMarkStyle(band)}>
              {meta.short}
            </span>
          );
        })()}
        {app.applyUrl && (
          <a className="dbx-depth" href={app.applyUrl} target="_blank" rel="noreferrer" onClick={(e) => postingClick(app, e)}
            style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px",
                     border: `1px solid ${theme.border}`, background: theme.surface,
                     color: theme.text, textDecoration: "none", whiteSpace: "nowrap" }}>
            The posting ↗
          </a>
        )}

        <span style={{ flex: 1 }} />

        {/* A posting that no longer exists gets no action, and says why. There is no form to open
            and no run that would find one. */}
        {app.postingGone ? (
          <span style={{ fontSize: 10, color: theme.textDim }}>
            posting gone — cannot be resumed
          </span>
        ) : stale && onRerun ? (
          <button onClick={() => onRerun(app)}
            title="These answers were prepared too long ago to fill safely. A fresh run prepares new ones."
            style={{ border: `1px solid ${theme.border}`, borderRadius: 6, padding: "6px 12px",
                     background: theme.surface, color: theme.text, fontWeight: 700, fontSize: 11.5,
                     cursor: "pointer", whiteSpace: "nowrap" }}>
            Run it again
          </button>
        ) : onResolve ? (
          <button onClick={() => onResolve(app)} title={resolveTitle}
            style={{ border: "none", borderRadius: 6, padding: "7px 13px", background: tone,
                     color: C.SURFACE_SOLID, fontWeight: 800, fontSize: 11.5, cursor: "pointer",
                     whiteSpace: "nowrap" }}>
            {resolveLabel || "Open"}
          </button>
        ) : null}
        {onDetails && (
          <button onClick={() => onDetails(app)}
            style={{ border: `1px solid ${theme.border}`, borderRadius: 6, padding: "6px 11px",
                     background: theme.surface, color: theme.text, fontWeight: 700, fontSize: 11.5,
                     cursor: "pointer", whiteSpace: "nowrap" }}>
            {/* In the panel this opens the scoped popup and reads "Details". In the modal there is
                nothing further to open, so it toggles the per-ATTEMPT rows and says so — the label
                is the caller's because the two mean different things. */}
            {detailsLabel || "Details"}
          </button>
        )}
      </div>
      {/* The per-attempt rows, when the caller supplies them. Collapsing run-jobs into one
          application is only honest if the attempts remain reachable. */}
      {children}
    </div>
  );
}

/**
 * One application, described by its obstacle rather than its status.
 *
 * `variant` picks how much evidence to show: SUBMITTED needs the date, the resume that went out and
 * the screenshot, because that is what a user reaches for when an interview lands. STOPPED needs the
 * plain-language reason and a retry ONLY where retrying can work.
 */
export function ApplicationRow({ job, theme, variant, artifactUrl, onRetry, onOpenRun, onGenerateResume,
  onAbort, onHide, busy = false }) {
  const d = describeApplication(job);
  const when = job.finishedAt || job.startedAt || job.createdAt;
  // Protective vs broken is the distinction the old UI lost by calling both "failed".
  const tone = variant === "submitted" ? C.SUCCESS
    : variant === "inFlight" ? C.INFO
    : d.protective ? C.INK_FAINT : C.DANGER;

  const chip = (bg, fg, text, title) => (
    <span title={title} style={markStyle(fg)}>{text}</span>
  );
  // posting: the job whose posting this is (D99 J11 — handed to the extension); artifacts pass none
  const link = (href, text, posting = null) => (
    <a className="dbx-depth" href={href} target="_blank" rel="noreferrer" onClick={posting ? (e) => postingClick(posting, e) : undefined}
      style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px",
               border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text,
               textDecoration: "none", whiteSpace: "nowrap" }}>{text}</a>
  );

  return (
    // Same reason as the card's hooks: scripts/abPanelUi.mjs has to be able to say which ROW a
    // control belongs to, and finding a row boundary by inline-style substring does not work — React
    // does not serialise the style attribute in a form that survives that kind of matching.
    <div data-rm-card="row"
         data-rm-job={job.jobId || ""}
         data-rm-variant={variant || ""}
         style={{ border: `1px solid ${theme.border}`, borderLeft: `3px solid ${tone}`,
                  borderRadius: 6, padding: "9px 12px", background: theme.surfaceHigh,
                  display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.text }}>
          {companyLabel(job.company)}
        </span>
        <span data-vt-title={job.jobId || undefined} style={{ fontSize: 11.5, color: theme.textMuted, flex: 1, minWidth: 120 }}>
          {job.title || job.jobId || "—"}
        </span>
        {when && (
          <span style={{ fontSize: 10, color: theme.textDim, whiteSpace: "nowrap" }}>
            {new Date(when).toLocaleDateString()} {new Date(when).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* THE OBSTACLE, as a sentence. This replaces the status pill that used to say "Failed". */}
      {variant !== "submitted" && (
        <div style={{ fontSize: 11.5, color: theme.text, lineHeight: 1.5 }}>
          {/* A DEAD POSTING IS ITS OWN STATE, and it is WHY this row is filed as aborted rather than
              pending — said, rather than left for the reader to infer from which tab they are on.
              This sentence used to live on HistoryRow, which AD1 removed; a held row whose posting
              the 7-day cleanup deleted lands in ABORTED by the override, so it is rendered by THIS
              component now and the sentence had to come with it. Without it the row would report
              whatever hold it was in when the posting vanished, which is a hold that can no longer
              be cleared by anything. */}
          {job.postingGone && !job.title
            ? "The posting was removed from the board, so there is nothing left to finish"
            : d.obstacle}
          {/* A detail that merely repeats the obstacle reads as a stutter ("You rejected this one —
              You rejected this one"), which happens whenever reason_detail restates reason_code. */}
          {d.detail && d.detail !== d.obstacle && (
            <span style={{ color: theme.textMuted }}> — {d.detail}</span>
          )}
        </div>
      )}
      {variant !== "submitted" && d.action && (
        <div style={{ fontSize: 11, color: theme.textMuted }}>→ {d.action}</div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {/* EVIDENCE. What a user needs when an interview lands: when it went, which resume, and a
            picture of the form as submitted. */}
        {variant === "submitted" && (
          job.submitVerified
            ? chip(C.SUCCESS_QUIET, C.SUCCESS, "confirmed by the site", job.submitEvidence || "")
            : chip(C.WARNING_QUIET, C.WARNING, "sent, not confirmed",
                   "We clicked submit and the page did not show a confirmation. Check the screenshot.")
        )}
        {job.resumeAvailable
          ? link(artifactUrl(job.id, "resume"), variant === "submitted" ? "The resume that went out ↗" : "Resume PDF ↗")
          : variant === "submitted"
            // On a SUBMITTED application there is nothing to fix — it already went out, and a
            // Generate button here would offer to change something that has been sent.
            ? chip(`${theme.border}55`, theme.textDim, "no resume recorded")
            // AB4 requirement 5: a missing resume is a problem with a one-click fix, so it gets the
            // button rather than the dead chip it used to be — but ONLY where the resume is what is
            // actually wrong. `d.resumeBlocked` is that test. Keyed on resumeAvailable alone, the
            // button appeared beside "the apply browser is not installed on the server", which the
            // row correctly says needs an operator and which no resume will fix.
            : onGenerateResume && d.resumeBlocked
              ? (
                <button className="dbx-depth" onClick={() => onGenerateResume(job)}
                  title="Drafts this job again — the new run generates a tailored resume for it before it applies."
                  style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px",
                           border: "none", background: C.INFO, color: C.SURFACE_SOLID, cursor: "pointer",
                           whiteSpace: "nowrap" }}>
                  Generate a resume
                </button>
              )
              : null}
        {/* EVIDENCE, AND ONLY WHERE IT IS EVIDENCE OF SOMETHING (AE4). A submitted application is
            the case where this genuinely earns its place: it is what a candidate needs when an
            interview lands and they have to recall what they told this employer, and it is the only
            record of it. On an in-flight or stopped row it is a picture of a form in a browser that
            has since closed, saying nothing the row does not already say — so it is not offered
            there at all rather than offered under a softer label. */}
        {variant === "submitted" && job.screenshotAvailable
          && link(artifactUrl(job.id, "screenshot"), "Screenshot of the form ↗")}
        <span title={atsBandLabel(atsBandFor(job.atsScore ?? null)).blurb}
          style={bandMarkStyle(atsBandFor(job.atsScore ?? null))}>
          {atsBandLabel(atsBandFor(job.atsScore ?? null)).short}
        </span>
        {job.applyUrl && link(job.applyUrl, "The posting ↗", job)}

        <span style={{ flex: 1 }} />

        {/* RETRY ONLY WHERE RETRY IS MEANINGFUL. A missing browser binary and a login wall both
            "failed"; offering Retry on the first is a lie, so it is not offered. */}
        {variant === "stopped" && d.retryable && onRetry && (
          <button onClick={() => onRetry(job)}
            style={{ border: `1px solid ${theme.border}`, borderRadius: 6, padding: "4px 10px",
                     background: theme.surface, color: theme.text, fontWeight: 700, fontSize: 11,
                     cursor: "pointer" }}>
            Retry
          </button>
        )}
        {variant === "stopped" && !d.retryable && (
          <span style={{ fontSize: 10, color: theme.textDim }}>retrying will not change this</span>
        )}
        {onOpenRun && job.runId && (
          <button onClick={() => onOpenRun(job.runId)}
            style={{ border: "none", background: "transparent", color: theme.textDim,
                     fontSize: 10, cursor: "pointer", textDecoration: "underline" }}>
            details
          </button>
        )}
        {/* ── AD1: ABORT AND REMOVE, moved here from the deleted HistoryRow ────────────────────
            The dated listing IS the run history now, so the two per-item actions AC4 built have to
            live on the rows that listing renders. They are the same actions against the same two
            endpoints; what changed is that this row already carries the evidence links, the ATS
            chip and the posting link that the compact history row did not, so a reader no longer
            has to choose between "the log" and "the record".

            ABORT's presence is still the SERVER's decision (`job.abortable`), not re-derived here:
            the button and the endpoint's guard have to agree, and two copies of that rule is how a
            button appears for something the server will refuse. */}
        {job.abortable && onAbort && (
          <button onClick={() => onAbort(job)} disabled={busy}
            title="Stops this application. If it is filling a form right now, the browser is closed, nothing is submitted, and the prepared answers are voided."
            style={{ border: `1px solid ${C.DANGER}55`, borderRadius: 6, padding: "4px 10px",
                     background: theme.surface, color: C.DANGER, fontWeight: 700, fontSize: 11,
                     cursor: busy ? "wait" : "pointer", opacity: busy ? 0.5 : 1 }}>
            Abort
          </button>
        )}
        {onHide && (
          <button onClick={() => onHide(job)} disabled={busy}
            title={job.status === "submitted"
              ? "Removes this from your history. The record is KEPT — an application that reached an employer is never erased, and an operator can restore it."
              : "Removes this from your history. It is hidden, not deleted, and can be restored."}
            style={{ border: `1px solid ${theme.border}`, borderRadius: 6, padding: "4px 10px",
                     background: theme.surface, color: theme.text, fontWeight: 700, fontSize: 11,
                     cursor: busy ? "wait" : "pointer", opacity: busy ? 0.5 : 1 }}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

// D25: PrerequisiteCards is gone the same way — a missing prerequisite is a Stopped item of kind
// "prerequisite", still FIRST in the column because it blocks every application.

/**
 * THE FILL LOG (AH5), fetched when asked for and not before.
 *
 * AB1/AE4 removed the "What we filled" screenshot correctly — it was a dead snapshot of a browser
 * context that had already closed. What was missing afterwards was any account at all of what the
 * run put in the form. This is that account, in text: every field with the rule that produced it
 * and how confident that rule was, and every blank with the reason it is blank.
 *
 * ON DEMAND because it is a record you go and read, not a thing every row in a list should carry.
 */
function FillLog({ runJobId, theme }) {
  const [state, setState] = useState({ status: "idle", data: null, error: null });

  const load = async () => {
    setState({ status: "loading", data: null, error: null });
    try {
      const data = await api(`/api/apply/run-jobs/${runJobId}/fill-log`);
      setState({ status: "ready", data, error: null });
    } catch (e) {
      setState({ status: "error", data: null, error: e.message || "Could not load the fill log" });
    }
  };

  if (state.status === "idle") {
    return (
      <button className="dbx-depth" onClick={e => { e.stopPropagation(); load(); }}
        title="Every field this run filled, where each answer came from, and every field left blank with the reason."
        style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px",
                 border: `1px solid ${theme.border}`, background: theme.surfaceHigh,
                 color: theme.text, cursor: "pointer", whiteSpace: "nowrap" }}>
        What was filled
      </button>
    );
  }
  if (state.status === "loading") {
    return <span style={{ fontSize: 10, color: theme.textMuted }}>reading the record…</span>;
  }
  if (state.status === "error") {
    return <span style={{ fontSize: 10, color: C.DANGER }}>{state.error}</span>;
  }

  const d = state.data;
  const REASON = {
    low_confidence: "we would not send a guess",
    needs_you:      "only you can answer this",
    no_answer:      "your profile has no answer for it",
    unmatched:      "we did not recognise the field",
    fill_failed:    "we had an answer and could not enter it",
  };
  const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
  return (
    <div data-rm-fill-log={runJobId} onClick={e => e.stopPropagation()} style={{
      width: "100%", border: `1px solid ${theme.border}`, borderRadius: 6,
      background: theme.surfaceHigh, padding: "8px 10px", display: "flex",
      flexDirection: "column", gap: 6, fontSize: 10.5,
    }}>
      {/* Whether anything was regenerated. This is the answer to "I already generated a resume for
          this job — did queueing it do that work again?" and it is stated rather than implied. */}
      {d.resume?.reuse && (
        <div style={{ color: d.resume.reuse.reused ? C.SUCCESS : theme.textMuted, fontWeight: 600 }}>
          {d.resume.reuse.summary}
        </div>
      )}
      <div style={{ color: theme.textDim }}>
        {d.filled.length} filled
        {d.blanks == null
          ? " · the form was never reached, so nothing is recorded about what is blank"
          : ` · ${d.blanks.length} left blank`}
        {d.fieldsDiscovered != null && ` · ${d.fieldsDiscovered} fields discovered`}
      </div>

      {d.filled.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {d.filled.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "baseline", ...mono }}>
              <span style={{ color: theme.text, minWidth: 0, flex: "0 1 38%", overflow: "hidden",
                             textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.label}</span>
              <span style={{ color: theme.textMuted, flex: "1 1 auto", minWidth: 0, overflow: "hidden",
                             textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.value === "" || f.value == null ? "—" : String(f.value)}
              </span>
              {/* The provenance is the point: a label_fuzzy answer is a guess and an exact one is
                  not, and only this line tells them apart. */}
              <span style={{ color: theme.textDim, flexShrink: 0 }}>
                {f.provenance || "unknown"}{f.confidence != null ? ` ${f.confidence}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {Array.isArray(d.blanks) && d.blanks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2,
                      borderTop: `1px solid ${theme.border}`, paddingTop: 5 }}>
          {d.blanks.map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "baseline", ...mono }}>
              <span style={{ color: b.required ? C.WARNING : theme.textMuted, flex: "0 1 38%",
                             minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                             whiteSpace: "nowrap" }}>
                {b.label || b.field}{b.required ? " *" : ""}
              </span>
              <span style={{ color: theme.textDim, flex: "1 1 auto" }}>
                {b.detail || REASON[b.reason] || b.reason}
              </span>
            </div>
          ))}
        </div>
      )}

      {d.corrections?.length > 0 && (
        <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 5, color: theme.textMuted }}>
          You corrected {d.corrections.length} field{d.corrections.length === 1 ? "" : "s"} by hand:{" "}
          {d.corrections.map(c => c.field).filter(Boolean).join(", ")}
        </div>
      )}
    </div>
  );
}

export function AttemptRow({ job, theme, artifactUrl, packetFor, onHandoff, onRerun }) {
  // The status pill's words and colour come from the shared vocabulary, not from a chain of
  // ternaries here. They used to be written inline in the modal — a second copy of a mapping the
  // rest of the app already had — and that is precisely the drift applyObstacles.js exists to stop:
  // this surface said "Failed" while the panel behind it said "This one did not complete".
  const { label: statusLabel, color: statusColor } = attemptStatusChip(job.status, theme.accent);

  return (
    <div data-rm-card="attempt" data-rm-job={job.jobId || ""} style={{
      border: `1px solid ${theme.border}`, borderRadius: 6,
      padding: "8px 11px", display: "flex", flexDirection: "column", gap: 5,
      background: theme.surface,
    }}>
      {/* which attempt, and how it ended */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 10.5, color: theme.textMuted }}>
          {job.startedAt && `Started ${new Date(job.startedAt).toLocaleString()}`}
          {job.startedAt && job.finishedAt && " · "}
          {job.finishedAt && `Finished ${new Date(job.finishedAt).toLocaleTimeString()}`}
          {(job.startedAt || job.finishedAt) && " · "}Attempts: {job.attemptCount || 1}
        </div>
        <span style={{ ...markStyle(statusColor), flexShrink: 0 }}>
          {statusLabel}
        </span>
      </div>

      {/* The obstacle SENTENCE, from the shared vocabulary, plus the score. This line used to be
          `job.reasonCode.replace(/_/g, " ")` — a raw code with its underscores swapped for spaces,
          so the modal said "ats below threshold" while the panel behind it said "Resume scored
          below your ATS threshold" for the same row. applyObstacles.js exists precisely so the two
          cannot disagree. */}
      {(job.reasonCode || job.atsScore != null) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {job.reasonCode && (() => {
            const d = describeApplication(job);
            return (
              <span style={{ fontSize: 11, color: statusColor, fontWeight: 600 }}>
                {d.obstacle}
                {d.detail && d.detail !== d.obstacle ? ` — ${d.detail}` : ""}
              </span>
            );
          })()}
          <span title={atsBandLabel(atsBandFor(job.atsScore ?? null)).blurb}
            style={bandMarkStyle(atsBandFor(job.atsScore ?? null))}>
            {atsBandLabel(atsBandFor(job.atsScore ?? null)).short}
          </span>
        </div>
      )}

      {/* AH5: NAME THE FIELDS. "Required fields were left empty" is a hold the candidate cannot act
          on — the same defect class as the old unscoped review modal. The list was always computed;
          it lived in an apply_job_logs event that no surface reads. */}
      {job.missingRequired?.length > 0 && (
        <div data-rm-missing-required={job.id} style={{ fontSize: 10.5, color: C.WARNING }}>
          Still yours to answer: <span style={{ fontWeight: 700 }}>{job.missingRequired.join(", ")}</span>
        </div>
      )}

      {/* What was actually sent on THIS attempt. The audit trail has recorded the resume artifact
          and the end-of-attempt screenshot all along; nothing linked them, so there was no way to
          tell whether a resume had even been generated. */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {job.resumeAvailable ? (
          <a className="dbx-depth" href={artifactUrl(job.id, "resume")} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px",
                     border: `1px solid ${theme.border}`, background: theme.surfaceHigh,
                     color: theme.text, textDecoration: "none", whiteSpace: "nowrap" }}>
            Resume PDF ↗
          </a>
        ) : (
          <span title="No resume artifact was recorded for this attempt."
            style={markStyle(theme.textDim)}>
            no resume on this attempt
          </span>
        )}
        {/* Same rule as the rows above (AE4): kept for an attempt that SUBMITTED, where it is the
            record of what went to the employer, and dropped for a held attempt, where it duplicated
            the attempt line beside it. Gated on this attempt's own status rather than the
            application's — one application can have a held attempt and a submitted one, and only
            the second has anything to show. */}
        {job.status === "submitted" && job.screenshotAvailable && (
          <a className="dbx-depth" href={artifactUrl(job.id, "screenshot")} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            title="A picture of the form as it was submitted. This is the record of what went out."
            style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px",
                     border: `1px solid ${theme.border}`, background: theme.surfaceHigh,
                     color: theme.textMuted, textDecoration: "none", whiteSpace: "nowrap" }}>
            Screenshot of the form ↗
          </a>
        )}
        {/* THE ROUTE. Present on every held attempt that has a prepared packet, so the list is not
            just readable but finishable. */}
        {(() => {
          if (!["held_review", "held_gate"].includes(job.status)) return null;
          const packet = packetFor?.(job);
          if (!packet) return null;
          // A posting that no longer exists is a STATE, not a disabled button (requirement 6).
          // There is no form to open and no run that would find one, so nothing is offered —
          // saying so is the whole affordance.
          if (packet.postingGone) {
            return (
              <span title="This posting was removed from the board. There is no application left to finish; the record of the attempt stays here."
                style={markStyle(theme.textDim)}>
                posting gone — cannot be resumed
              </span>
            );
          }
          const stale = packet.stale;
          return (
            <button className="dbx-depth"
              onClick={e => { e.stopPropagation(); if (stale) onRerun?.(job); else onHandoff?.(packet, job); }}
              title={stale
                ? "These answers were prepared too long ago to fill safely. A fresh run prepares new ones."
                : "Opens the real application in your own browser and fills it with the answers we prepared. You review and submit."}
              style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px",
                       border: stale ? `1px solid ${theme.border}` : "none",
                       background: stale ? theme.surfaceHigh : C.INFO,
                       color: stale ? theme.text : C.SURFACE_SOLID, cursor: "pointer",
                       whiteSpace: "nowrap" }}>
              {stale ? "Run it again" : "Open & fill ↗"}
            </button>
          );
        })()}
        {job.status === "submitted" && (
          <span title={job.submitEvidence || ""}
            style={markStyle(job.submitVerified ? C.SUCCESS : C.WARNING)}>
            {job.submitVerified ? "submission verified" : "unverified submit"}
          </span>
        )}
        {job.fillLogAvailable && <FillLog runJobId={job.id} theme={theme}/>}
      </div>

      {/* apply URL */}
      {job.applyUrl && (
        <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
          onClick={e => { e.stopPropagation(); postingClick(job, e); }}
          style={{ fontSize: 10, color: theme.accentText, textDecoration: "none", wordBreak: "break-all" }}>
          {job.applyUrl.length > 90 ? job.applyUrl.slice(0, 90) + "…" : job.applyUrl}
        </a>
      )}
    </div>
  );
}

// ── D25: THE COMPANY TILES ARE GONE ─────────────────────────────────────────────────────────
//
// AC3 put AD1's dated listings into company TILES (CompanyTile, CompanyApplicationRow) under three
// outcome sub-tabs. Draft House's workspace model has neither the sub-tabs nor the listings: what
// needs the user is one StoppedItem per application, and what went out or ended is history, which
// is The Table's (D15). TileCard itself stays in components/ui — Job Profiles renders it.
//
// What the tiles carried and where it is now: the application's obstacle sentences -> the item's
// fold; Open / Open & fill (AC1, scoped) -> the item's rail; Details and every attempt -> the review
// modal (CompanyHeading + ApplicationObstacleCard + AttemptRow, above); Remove -> the rail; Abort ->
// In flight's own row; the held-on-purpose vs broke split -> only BROKE is listed, as kind "broke".
