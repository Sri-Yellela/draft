// client/src/components/AtsReport.jsx — THE ATS REPORT. ONE IMPLEMENTATION, EVERY SURFACE (A52).
//
// ⛔ THIS IS THE ONLY FILE THAT DRAWS AN ATS REPORT. The board's side panel (panels/ATSPanel.jsx,
// inside AtsReportPanel), the deck's left panel and the phone's sheet (DeckView, through ATSPanel),
// the free public tool (/tools/ats) and the signup hook (AtsBandCard) all render from here. It is
// pure presentation: it takes a report in ONE shape (the scorer's own — tier1_matched,
// competencies_*, action_verbs_*, decline_reasons …) and draws it; fetching, caching and claiming
// stay with the caller. The two other shapes that exist — the deck's frozen report and the public
// route's result — are converted HERE (fromDeckReport, fromStandaloneResult), so no other file
// needs to know a report's field names at all.
//
// Why it matters: three implementations of the brand mark existed, a rebrand swept two, and the
// third shipped the legacy name on every page while the guard passed green. The public tool's own
// copy of this report was already thinner (no competencies, no generic language, no matched verbs)
// before anyone noticed. test/atsReportOneImplementation.test.js refuses a second copy.
//
// ── D31 (owner, 10-04) · THE SIMPLE CARD — reverses D2's weave ───────────────────────────────────
//
// The weave drew threads between two columns. It looked good and told the reader nothing a count
// does not, and it cost a thread cap, a replay rule and a layout minimum. It is gone. The card is:
//
//   SUMMARY    band · (the score, once A76 earns it) · "9 of 12" · ONE two-segment bar. That is all.
//   OPEN       "You could claim" — the ONLY open section: claim chips with a + affordance, and the
//              claim copy ONCE, beneath them, where the action is.
//   FOLDED     "Already on your résumé" and "Generic — not a gap".
//
// ⭐ Nothing in it moves and nothing in it needs a width, so it renders the same in the deck's panel,
// the board's panel, the phone's sheet and /tools/ats. That is what makes A52's one component hold.
//
// Behaviour kept from every surface it replaces:
//   · BAND-FIRST (G5). `band` may be passed by a caller that holds only the band (the deck);
//     otherwise it is derived from report.score with shared/atsBands.js. The number is the largest
//     element when it is shown, and ⛔ it is shown only when ATS_NUMBER_SHOWN — A76's corpus is the
//     condition (A75), not a follow-up.
//   · "Not enough signal" is the scorer DECLINING — the dashed, hue-less chip (bandStyle), "no
//     judgement" under it, a dashed hue-less bar, and the decline reasons — never a low grade, and
//     rendered for every report, including a declined one.
//   · Generic language is separated from real gaps, folded, labelled NOT A GAP, and never claimable.
//   · Claim chips are interactive only when the caller passes `claims` (the board and the deck, on
//     a profile); the public tool passes none and the chips are read-only. Nothing is pre-selected.
//   · D1's depth on every control; colours are tokens only (C.*, var(--c-*)).
import { atsBandFor, atsBandLabel, ATS_BAND, ATS_NUMBER_SHOWN } from "../../../shared/atsBands.js";
import { profileSignalKey } from "../../../shared/profileSignals.js";
import { bandChipStyle, bandStyle } from "../styles/bandStyle.js";
import { C } from "../styles/colorTokens.js";
import "./AtsReport.css";

/** The band a report reads as — the ONE derivation every ATS surface uses. */
export function reportBand(report, knownBand = null) {
  if (knownBand) return knownBand;
  return atsBandFor(report?.score ?? null);
}

/** The deck's frozen report (services/dailyDraft.js deckReport — every section, no number). */
export function fromDeckReport(r) {
  if (!r) return null;
  return {
    source: "local_ats_deck", decline_reasons: r.declineReasons,
    tier1_matched: r.skillsMatched, tier1_missing: r.skillsMissing,
    competencies_matched: r.competenciesMatched, competencies_missing: r.competenciesMissing,
    action_verbs_matched: r.verbsMatched, action_verbs_missing: r.verbsMissing, action_verbs_generic: r.verbsGeneric,
    claimed_matches: r.claimedMatches,
    experience: r.experience ? { summary: r.experience, fit: r.experienceFit !== false } : null,
    hard_constraint_misses: r.hardConstraintMisses,
    seniority_cap: r.seniorityNote ? { applied: true, reason: r.seniorityNote } : { applied: false },
    resume_depth: r.depthHeadline ? { headline: r.depthHeadline, detail: r.depthDetail || "" } : null,
  };
}

/** The public route's result (services/standaloneAts.js — a band and the term lists, no number). */
export function fromStandaloneResult(r) {
  if (!r) return null;
  return {
    source: r.source || "local_ats_public", decline_reasons: r.decline_reasons || [],
    tier1_matched: r.matched_skills || [], tier1_missing: r.missing_skills || [],
    competencies_matched: r.competencies_matched || [], competencies_missing: r.competencies_missing || [],
    action_verbs_matched: r.matched_verbs || [], action_verbs_missing: r.missing_verbs || [],
    action_verbs_generic: r.generic_verbs || [],
    experience: r.experience ? { summary: r.experience, fit: true } : null,
    // No profile on the public tool, so the board's "…against this profile" fallback would be untrue.
    verdict: r.experience || "Deterministic local ATS match against this posting.",
    seniority_cap: r.seniority ? { applied: true, reason: r.seniority } : { applied: false },
    resume_depth: r.resume_depth ? { headline: r.resume_depth.headline, detail: r.resume_depth.detail || "" } : null,
  };
}

/**
 * D31: what the card counts. Every real ask the posting makes — skills, competencies and its
 * job-specific verbs — is either already on the résumé or something the candidate could claim.
 * Generic language is in NEITHER: it is not a gap, so it is not in the denominator either.
 * The bar's two segments and the two sections are these same two lists, so they cannot disagree.
 */
export function reportAsks(report) {
  const onResume = [
    ...(report?.tier1_matched || []), ...(report?.competencies_matched || []), ...(report?.action_verbs_matched || []),
  ];
  const couldClaimSkills = [...(report?.tier1_missing || []), ...(report?.competencies_missing || [])];
  const couldClaimVerbs = [...(report?.action_verbs_missing || [])];
  const generic = [...(report?.action_verbs_generic || [])];
  const missing = couldClaimSkills.length + couldClaimVerbs.length;
  return { onResume, couldClaimSkills, couldClaimVerbs, generic, matched: onResume.length, total: onResume.length + missing };
}

/** The one two-segment bar: on your résumé | not yet. Not enough signal is a dashed, hue-less outline. */
function AskBar({ band, matched, total }) {
  const unknown = band === ATS_BAND.NOT_ENOUGH_SIGNAL;
  const s = bandStyle(band);
  const share = total > 0 ? (matched / total) * 100 : 0;
  return (
    <div className="ats-bar" data-ats-bar data-unknown={unknown ? "true" : "false"} role="img"
      aria-label={`${matched} of ${total} asks already on your résumé`}>
      <div className="ats-bar__seg" style={{ width: `${share}%`, background: unknown ? `${C.BAND_UNKNOWN_EDGE}55` : s.fg }} />
      <div className="ats-bar__seg" style={{ flex: 1, background: unknown ? "transparent" : s.bg }} />
    </div>
  );
}

/**
 * The band card — THE SUMMARY: the band, the score (only once A76 earns it), "9 of 12", one bar.
 * Below it, only when they exist, the reasons the band is what it is: why the scorer declined, the
 * seniority note, the profile facts the posting requires. The full report opens with it; the signup
 * hook shows only this.
 */
export function AtsBandCard({ report, band: knownBand = null, compact = false, children = null }) {
  const band = reportBand(report, knownBand);
  const meta = atsBandLabel(band);
  const isUnknown = band === ATS_BAND.NOT_ENOUGH_SIGNAL;
  const declineReasons = Array.isArray(report?.decline_reasons) ? report.decline_reasons : [];
  const seniority = report?.seniority_cap?.applied ? report.seniority_cap : null;
  const hardMisses = Array.isArray(report?.hard_constraint_misses) ? report.hard_constraint_misses : [];
  const { matched, total } = reportAsks(report);
  return (
    <div data-ats-band-card className="ats-sum" data-compact={compact ? "true" : "false"}>
      <div className="ats-sum__head">
        {/* BAND-FIRST: the band is read first; the number, when it is earned, is the largest thing. */}
        <span data-ats-band className="ats-sum__band" style={bandChipStyle(band, { edgeAlpha: "33" })}>{meta.label}</span>
        <span className="ats-sum__cap">{isUnknown ? "no judgement" : "fit band"}</span>
        {/* ⛔ A75/A76: the number only once A76 has earned it (ATS_NUMBER_SHOWN). Static — nothing counts up. */}
        {ATS_NUMBER_SHOWN && !isUnknown && Number.isFinite(report?.score) && (
          <span data-ats-score className="ats-sum__score">{Math.round(report.score)}</span>
        )}
      </div>
      {total > 0 && (
        <>
          <div data-ats-count className="ats-sum__count"><b>{matched} of {total}</b> on your résumé</div>
          <AskBar band={band} matched={matched} total={total} />
        </>
      )}
      {declineReasons.length > 0 && (
        <ul className="ats-notes">{declineReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
      )}
      {seniority && <div className="ats-note">{seniority.reason}</div>}
      {hardMisses.length > 0 && (
        <div data-ats-hard className="ats-note" style={{ color: C.DANGER }}>
          Required by this posting, not on your profile: {hardMisses.join(" · ")}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * THE FULL REPORT.
 *
 * @param report  the scorer's report shape (see fromDeckReport / fromStandaloneResult for the others)
 * @param band    a band the caller already holds (the deck), else derived from report.score
 * @param claims  optional — { onToggle(kind, label, claimed), pending:Set, claimedLookup, lockedSkills:Set,
 *                lockedVerbs:Set } — present only where the candidate can claim a term (a profile)
 */
export function AtsReport({ report, band: knownBand = null, claims = null }) {
  if (!report) return null;
  // Strengths and improvements only ever came from the LLM scorer. Matched on the family, so a new
  // local report version cannot quietly switch them back on.
  const isLocalReport = String(report.source || "").startsWith("local_ats");
  // `pct` survives only for the best-possible line (LLM reports), which is itself shown as a band.
  const pct = Math.max(0, Math.min(100, report.score ?? 0));
  const depth = report.resume_depth || null;
  const { onResume, couldClaimSkills, couldClaimVerbs, generic } = reportAsks(report);
  // Provenance: what the résumé already evidences — the scorer decided this; nothing is re-derived.
  const evidencedLookup = new Set([
    ...(report.tier1_matched || []),
    ...(report.competencies_matched || []),
    ...(report.action_verbs_matched || []),
  ].map(profileSignalKey).filter(Boolean));
  const claimable = (kind) => claims?.onToggle
    ? { onToggleClaim: (item, claimed) => claims.onToggle(kind, item, claimed), pendingItems: claims.pending,
        claimedLookup: claims.claimedLookup, lockedLookup: kind === "action_verb" ? claims.lockedVerbs : claims.lockedSkills }
    : {};
  const canClaim = !!claims?.onToggle;
  const couldClaimCount = couldClaimSkills.length + couldClaimVerbs.length;
  const verdict = report.verdict || report.experience?.summary || null;
  const showExperience = report.experience && report.experience.summary !== (report.verdict || report.experience.summary);
  const more = verdict || showExperience || (!isLocalReport && (report.strengths?.length || report.improvements?.length));

  return (
    <div data-ats-report className="ats-card">
      {/* Band card. Renders for EVERY report, including a declined one. */}
      <AtsBandCard report={report} band={knownBand}>
        {report.best_possible_score != null && (
          <div className="ats-note" style={pct === report.best_possible_score
            ? { background: C.SUCCESS_QUIET, color: C.SUCCESS, borderColor: `color-mix(in srgb, ${C.SUCCESS} 20%, transparent)` }
            : undefined}>
            {/* A BAND, NOT THE NUMBER (G5). */}
            {pct === report.best_possible_score
              ? "✓ The best fit your profile can reach for this posting"
              : <>
                  <span style={{ fontWeight: 700 }}>Best possible for your profile: {atsBandLabel(atsBandFor(report.best_possible_score)).label}</span>
                  {report.best_possible_reason && <span> — {report.best_possible_reason}</span>}
                </>}
          </div>
        )}
      </AtsBandCard>

      {/* The résumé-depth warning sits under the band it qualifies, never above it (band-first). */}
      {depth && (
        <div className="ats-note">
          <div style={{ fontWeight: 800, color: "var(--color-text)", marginBottom: 2 }}>{depth.headline}</div>
          <div>{depth.detail}</div>
        </div>
      )}

      {/* ⭐ D31: "YOU COULD CLAIM" IS THE ONLY OPEN SECTION — every real ask the résumé does not show. */}
      {couldClaimCount > 0 && (
        <section data-ats-could-claim>
          <div className="rm-section-label">You could claim ({couldClaimCount})</div>
          <div className="ats-sec__sub">
            {canClaim ? "This posting asks for these and your résumé does not show them. Claim the ones that are true of you."
                      : "This posting asks for these and your résumé does not show them."}
          </div>
          <div className="ats-chips">
            <TermChips items={couldClaimSkills} kind="skill" evidencedLookup={evidencedLookup} {...claimable("skill")} />
            <TermChips items={couldClaimVerbs} kind="action_verb" evidencedLookup={evidencedLookup} {...claimable("action_verb")} />
          </div>
          {/* ⛔ THE CLAIM COPY APPEARS ONCE — beneath the chips, where the action is. */}
          {canClaim && (
            <div data-claim-note className="ats-claim-note">
              Claiming a term says it is true of you — claim it only if it is. It counts toward this score and toward
              where jobs rank on your board, and it is used in resumes generated from now on;
              it never rewrites one you already have. Withdraw it at any time and all three go back.
              Nothing is ever pre-selected.
            </div>
          )}
        </section>
      )}

      {/* FOLDED: what the résumé already shows. Read-only — there is nothing to do here. */}
      {onResume.length > 0 && (
        <details data-ats-on-resume className="ats-fold">
          <summary>Already on your résumé ({onResume.length})</summary>
          <div className="ats-chips">
            <TermChips items={onResume} kind="skill" evidencedLookup={evidencedLookup} />
          </div>
        </details>
      )}

      {/* Generic language — AH3. NOT a gap, and deliberately not claimable. */}
      {/* ⛔ FOLDED AWAY and labelled NOT A GAP — surfacing "Managed" or "collaboration" as a deficiency
          is a claim that is not true. */}
      {report.action_verbs_generic?.length > 0 && (
        <details data-ats-generic className="ats-fold">
          <summary>Generic — not a gap ({generic.length})</summary>
          {/* ○ Generic Language: never claimable, never counted. */}
          <div className="ats-sec__sub">This job uses these, but almost any candidate could claim them — they are not a gap.</div>
          <div className="ats-chips">
            <TermChips items={generic} kind="action_verb" />
          </div>
        </details>
      )}

      {/* The verdict, the experience line and (LLM reports only) strengths and improvements — folded,
          printed once. A52 follow-up: the experience summary is often the verdict itself, and printing it
          twice was the "renders twice" defect. */}
      {more && (
        <details data-ats-more className="ats-fold">
          <summary>More about this match</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {verdict && <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic", lineHeight: 1.6 }}>{verdict}</div>}
            {report.experience && report.experience.summary !== (report.verdict || report.experience.summary) && (
              <ListSection title="Experience Fit" items={[report.experience.summary]} color={report.experience.fit ? C.SUCCESS : "var(--color-warning)"}/>
            )}
            {!isLocalReport && report.strengths?.length > 0 && (
              <ListSection title="💪 Strengths" items={report.strengths} color={C.SUCCESS}/>
            )}
            {!isLocalReport && report.improvements?.length > 0 && (
              <ListSection title="🔧 Improvements" items={report.improvements} color={"var(--color-primary)"}/>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * A row of terms. With `onToggleClaim` they are CLAIM CHIPS (AG2) — a control, with the + affordance
 * and D1's depth; without it they are read-only labels, flat.
 *
 * THE COPY IS THE FEATURE. Clicking one of these asserts "I have this" — a claim the candidate will
 * have to defend in an interview. So the chip never reads as "add this to improve your score".
 * CC4: a claim DOES count toward this score and toward where the job ranks, and the copy says so;
 * the scorer reports every match that rested on a claim alone, so the number is never silently
 * inflated. NOTHING IS PRE-SELECTED: `claimedLookup` holds only what the person actually claimed.
 */
function TermChips({
  items, onToggleClaim = null, pendingItems = new Set(),
  claimedLookup = { skillKeys: new Set(), verbKeys: new Set() },
  lockedLookup = new Set(), evidencedLookup = new Set(), kind = "skill",
}) {
  const claimedKeys = (kind === "action_verb" ? claimedLookup?.verbKeys : claimedLookup?.skillKeys) || new Set();
  return items.map(k => {
    const itemKey = profileSignalKey(k);
    const locked = (lockedLookup || new Set()).has(itemKey);
    const claimed = locked || claimedKeys.has(itemKey) || (pendingItems || new Set()).has(`${kind}:${k}`);
    const evidenced = evidencedLookup.has(itemKey);
    const interactive = !!onToggleClaim && !locked;
    const provenance = evidenced
      ? "Your resume already shows this"
      : claimed ? "You claimed this — the job description asked for it" : "This job asked for it. Your resume does not show it.";
    if (!interactive) {
      return (
        <span key={`${kind}:${k}`} className="ats-chip" title={provenance}
          style={claimed ? { background: C.SUCCESS_QUIET, color: C.SUCCESS } : undefined}>
          {claimed ? `✓ ${k}` : k}
        </span>
      );
    }
    return (
      <button key={`${kind}:${k}`} type="button" className="ats-chip ats-chip--claim" data-claim-chip={kind}
        onClick={() => onToggleClaim(k, !claimed)}
        aria-pressed={claimed}
        title={claimed ? `You claimed "${k}". Click to withdraw it.`
                       : `Claim "${k}" — only if it is true of you. It counts toward this score and toward where this job ranks, and it is used in future resumes.`}
        style={{
          background: claimed ? C.SUCCESS_QUIET : C.SURFACE_SOLID,
          color: claimed ? C.SUCCESS : C.INK,
          borderColor: claimed ? C.SUCCESS : undefined,
        }}>
        {!claimed && <span className="ats-chip__plus" aria-hidden="true">+</span>}
        {claimed ? `✓ ${k}` : k}
      </button>
    );
  });
}

function ListSection({ title, items, color }) {
  return (
    <div>
      <div className="rm-section-label" style={{ color }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
            <span style={{ color, flexShrink: 0, fontWeight: 700 }}>·</span>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
