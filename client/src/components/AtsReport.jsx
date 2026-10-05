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
// ── D32 (owner, 10-04) · THE SCORE HALF OF THE INK PAIR — narrows D31 ────────────────────────────
//
//   HEADER     band · "you cover 9 of 12 things this posting asks for" · (the score in serif accent,
//              once A76 earns it) · ONE THREE-SEGMENT bar: matched · missing · generic.
//   OPEN       "You could claim" — ONE block. Skills, verbs and qualities were three sections with the
//              claim note under each; now each RECTANGULAR DEPTH BOX carries a small `kind` label
//              (skill · verb · quality) and the claim note appears ONCE. ⛔ The distinction survives
//              — the kind is the scorer's own bucket, carried, never flattened — the fragmentation does not.
//   ROW        Experience — its own row, because it is the one requirement that is genuinely pass/fail.
//   FOLDED     "Already yours" and "Generic — not a gap".
//
// ⭐ It sits on the pair's surface (styles/inkPair.css — cream in light, ink in dark, decided by the
// theme and nowhere else). Nothing in it moves and nothing in it needs a width, so it renders the same
// in the deck's panel, the board's panel, the phone's sheet and /tools/ats — A52's one component holds.
//
// Behaviour kept from every surface it replaces:
//   · BAND-FIRST (G5). `band` may be passed by a caller that holds only the band (the deck);
//     otherwise it is derived from report.score with shared/atsBands.js. The number is the largest
//     element when it is shown, and ⛔ it is shown only when ATS_NUMBER_SHOWN — A76's corpus is the
//     condition (A75), not a follow-up.
//   · "Not enough signal" is the scorer DECLINING — the band heading in a dashed, hue-less outline (the
//     band-unknown tokens), "no judgement" beside it, a dashed hue-less bar, and the decline reasons —
//     never a low grade, and rendered for every report, including a declined one.
//
// ── A86 (10-05) · FIDELITY WITH THE SKETCH (pair2.html) ────────────────────────────────────────────
//   The band is the sketch's HEADING (the logo face, 800 italic), not a chip; the bar is 6px, flush and
//   square under the header; each section opens with a ruled label and a monospace count; boxes are
//   toned — green for what the résumé shows, grey for generic language, the claim red with a FILLED +
//   square for an ask it does not show. Every value is a token; test/pairFidelityA86.test.js pins them.
//   · Generic language is separated from real gaps, folded, labelled NOT A GAP, never claimable, and
//     never counted: its bar segment is drawn (blue, so it never reads as a gap) but it is in neither
//     side of "9 of 12".
//   · Claim boxes are interactive only when the caller passes `claims` (the board and the deck, on
//     a profile); the public tool passes none and the boxes are read-only. Nothing is pre-selected.
//   · D1's depth on every control (the pair's own --c-pair-lift / -lift2 / -press); tokens only.
//   · D32's hover link: inside a pair (lib/pairLink.js), pointing at a box lights its term in the
//     posting — on request only, never standing, never animated.
import { atsBandFor, atsBandLabel, ATS_BAND, ATS_NUMBER_SHOWN } from "../../../shared/atsBands.js";
import { profileSignalKey } from "../../../shared/profileSignals.js";
import { experienceState } from "../../../shared/postingFacts.js";
import { usePairLink } from "../lib/pairLink.js";
import "../styles/inkPair.css";
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
    experience: r.experience ? { summary: r.experience, fit: r.experienceFit !== false, state: r.experienceState ?? null } : null,
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
    experience: r.experience ? { summary: r.experience, fit: r.experience_state !== "short", state: r.experience_state ?? null } : null,
    // No profile on the public tool, so the board's "…against this profile" fallback would be untrue.
    verdict: r.experience ? null : "Deterministic local ATS match against this posting.",
    seniority_cap: r.seniority ? { applied: true, reason: r.seniority } : { applied: false },
    resume_depth: r.resume_depth ? { headline: r.resume_depth.headline, detail: r.resume_depth.detail || "" } : null,
  };
}

// ⛔ THE KIND IS THE SCORER'S BUCKET, CARRIED — never re-derived from the word. The scorer keeps
// skills (tier1_*), competencies (competencies_*) and verbs (action_verbs_*) apart; each box says which
// one it came from. `claim` is the route a claim goes through: a competency is claimed as a skill (the
// same reversible call D31 used), a verb as a verb.
export const TERM_KINDS = Object.freeze({
  skill:   { label: "skill",   claim: "skill" },
  quality: { label: "quality", claim: "skill" },
  verb:    { label: "verb",    claim: "action_verb" },
});
const asTerms = (list, kind) => (Array.isArray(list) ? list : []).filter(t => typeof t === "string" && t).map(term => ({ term, kind }));

/**
 * D32: what the card counts. Every real ask the posting makes — skills, competencies (qualities) and
 * its job-specific verbs — is either already on the résumé or something the candidate could claim.
 * Generic language is in NEITHER: it is not a gap, so it is not in the denominator either; the bar
 * draws it as its own third segment so the reader sees it was read and set aside.
 */
export function reportAsks(report) {
  const onResume = [
    ...(report?.tier1_matched || []).map(term => ({ term, kind: "skill" })),
    ...(report?.competencies_matched || []).map(term => ({ term, kind: "quality" })),
    ...(report?.action_verbs_matched || []).map(term => ({ term, kind: "verb" })),
  ];
  const couldClaim = [
    ...(report?.tier1_missing || []).map(term => ({ term, kind: "skill" })),
    ...(report?.action_verbs_missing || []).map(term => ({ term, kind: "verb" })),
    ...(report?.competencies_missing || []).map(term => ({ term, kind: "quality" })),
  ];
  const generic = asTerms(report?.action_verbs_generic, "verb");
  const missing = couldClaim.length;
  return { onResume, couldClaim, generic, matched: onResume.length, missing, total: onResume.length + missing };
}

/**
 * The one THREE-segment bar: matched · missing · generic. Not enough signal is a dashed, hue-less
 * outline whose segments carry no hue at all — never a short Weak bar.
 */
function AskBar({ band, matched, missing, generic }) {
  const unknown = band === ATS_BAND.NOT_ENOUGH_SIGNAL;
  const all = matched + missing + generic;
  const share = (n) => `${all > 0 ? (n / all) * 100 : 0}%`;
  return (
    <div className="ats-bar" data-ats-bar data-unknown={unknown ? "true" : "false"} role="img"
      aria-label={`${matched} of ${matched + missing} asks already on your résumé; ${generic} generic, not a gap`}>
      <div className="ats-bar__seg ats-bar__seg--matched" style={{ width: share(matched) }} />
      <div className="ats-bar__seg ats-bar__seg--missing" style={{ width: share(missing) }} />
      <div className="ats-bar__seg ats-bar__seg--generic" style={{ width: share(generic) }} />
    </div>
  );
}

/**
 * The band card — THE HEADER: the band, "you cover 9 of 12", the score (only once A76 earns it), the
 * three-segment bar. Below it, only when they exist, the reasons the band is what it is: why the scorer
 * declined, the seniority note, the profile facts the posting requires. The full report opens with it;
 * the signup hook shows only this.
 */
export function AtsBandCard({ report, band: knownBand = null, compact = false, children = null }) {
  const band = reportBand(report, knownBand);
  const meta = atsBandLabel(band);
  const isUnknown = band === ATS_BAND.NOT_ENOUGH_SIGNAL;
  const declineReasons = Array.isArray(report?.decline_reasons) ? report.decline_reasons : [];
  const seniority = report?.seniority_cap?.applied ? report.seniority_cap : null;
  const hardMisses = Array.isArray(report?.hard_constraint_misses) ? report.hard_constraint_misses : [];
  const { matched, missing, total, generic } = reportAsks(report);
  return (
    <div data-ats-band-card className="ats-sum ink-pair" data-compact={compact ? "true" : "false"}>
      <div className="ats-sum__head">
        <div>
          {/* BAND-FIRST: the band is the heading, read first (pair2.html's .bd). ⛔ "Not enough signal" is
              the scorer declining — dashed and hue-less (data-unknown), with "no judgement" beside it. */}
          <div data-ats-band className="ats-sum__band" data-unknown={isUnknown ? "true" : "false"}>{meta.label}</div>
          {isUnknown && <span className="ats-sum__cap">no judgement</span>}
          {total > 0 && (
            <p data-ats-count className="ats-sum__count">You cover {matched} of the {total} things this posting asks for.</p>
          )}
        </div>
        {/* ⛔ A75/A76: the number only once A76 has earned it (ATS_NUMBER_SHOWN). Static — nothing counts up. */}
        {ATS_NUMBER_SHOWN && !isUnknown && Number.isFinite(report?.score) && (
          <div data-ats-score className="ats-sum__score">{Math.round(report.score)}<small>ats</small></div>
        )}
      </div>
      {(declineReasons.length > 0 || seniority || hardMisses.length > 0 || children) && (
        <div className="ats-sum__notes">
          {declineReasons.length > 0 && (
            <ul className="ats-notes">{declineReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          )}
          {seniority && <div className="ats-note">{seniority.reason}</div>}
          {hardMisses.length > 0 && (
            <div data-ats-hard className="ats-note ats-note--hard">
              Required by this posting, not on your profile: {hardMisses.join(" · ")}
            </div>
          )}
          {children}
        </div>
      )}
      {/* The bar runs flush across the card, under the header (pair2.html's .bar). */}
      {total > 0 && <AskBar band={band} matched={matched} missing={missing} generic={generic.length} />}
    </div>
  );
}

const EXPERIENCE_MARK = {
  met:     { mark: "✓", word: "Met" },
  short:   { mark: "✕", word: "Short" },
  unknown: { mark: "?", word: "Can't compare" },
  none:    { mark: "–", word: "Not asked" },
};

/** Experience — its own row: the one requirement that is genuinely pass/fail. */
function ExperienceRow({ experience }) {
  const state = experienceState(experience);
  const m = EXPERIENCE_MARK[state] || null;
  return (
    <section className="ats-sec">
      <div className="ats-gh"><span className="ats-gh__label">Experience</span></div>
      <div data-ats-experience className="ats-exp" data-state={state || "stated"}>
        {m && <b className="ats-exp__mark"><span aria-hidden="true">{m.mark}</span> {m.word}</b>}
        <span className="ats-exp__text">{experience.summary}</span>
      </div>
    </section>
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
  const { onResume, couldClaim, generic } = reportAsks(report);
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
  // The verdict is printed once: when it is only the experience summary again (the A52 "renders twice"
  // defect), the Experience row already said it.
  const verdict = report.verdict && report.verdict !== report.experience?.summary ? report.verdict : null;
  const more = verdict || (!isLocalReport && (report.strengths?.length || report.improvements?.length));
  const hasBody = !!(depth || couldClaim.length || report.experience?.summary || onResume.length
    || report.action_verbs_generic?.length || more);

  return (
    <div data-ats-report className="ats-card ink-pair">
      {/* Band card. Renders for EVERY report, including a declined one. */}
      <AtsBandCard report={report} band={knownBand}>
        {report.best_possible_score != null && (
          <div className="ats-note" data-best={pct === report.best_possible_score ? "reached" : "short"}>
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

      {hasBody && (
      <div className="ats-sb">
      {/* The résumé-depth warning sits under the band it qualifies, never above it (band-first). */}
      {depth && (
        <div className="ats-note ats-sec">
          <div className="ats-note__head">{depth.headline}</div>
          <div>{depth.detail}</div>
        </div>
      )}

      {/* ⭐ D32: "YOU COULD CLAIM" IS ONE BLOCK, AND THE ONLY OPEN SECTION — skills, verbs and qualities
          together, each box labelled with the scorer's bucket. */}
      {couldClaim.length > 0 && (
        <section data-ats-could-claim className="ats-sec">
          <div className="ats-gh"><span className="ats-gh__label">You could claim</span><span className="ats-gh__ct">{couldClaim.length}</span></div>
          <div className="ats-sec__sub">
            {canClaim ? "This posting asks for these and your résumé does not show them. Claim the ones that are true of you."
                      : "This posting asks for these and your résumé does not show them."}
          </div>
          <div className="ats-boxes">
            {couldClaim.map(({ term, kind }) => (
              <TermBox key={`${kind}:${term}`} term={term} kind={kind} evidencedLookup={evidencedLookup}
                {...claimable(TERM_KINDS[kind].claim)} />
            ))}
          </div>
          {/* ⛔ THE CLAIM COPY APPEARS ONCE — beneath the boxes, where the action is. */}
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

      {/* ⭐ D32: Experience gets its own row — pass/fail, not a footnote. */}
      {report.experience?.summary && <ExperienceRow experience={report.experience} />}

      {/* FOLDED: what the résumé already shows. Read-only — there is nothing to do here. */}
      {onResume.length > 0 && (
        <details data-ats-on-resume className="ats-fold ats-sec">
          <summary className="ats-gh"><span className="ats-gh__label">Already yours</span><span className="ats-gh__ct">{onResume.length}</span></summary>
          <div className="ats-boxes">
            {onResume.map(({ term, kind }) => (
              <TermBox key={`${kind}:${term}`} term={term} kind={kind} evidencedLookup={evidencedLookup} />
            ))}
          </div>
        </details>
      )}

      {/* Generic language — AH3. NOT a gap, and deliberately not claimable. */}
      {/* ⛔ FOLDED AWAY and labelled NOT A GAP — surfacing "Managed" or "collaboration" as a deficiency
          is a claim that is not true. */}
      {report.action_verbs_generic?.length > 0 && (
        <details data-ats-generic className="ats-fold ats-sec">
          <summary className="ats-gh"><span className="ats-gh__label">Generic — not a gap</span><span className="ats-gh__ct">{generic.length}</span></summary>
          {/* ○ Generic Language: never claimable, never counted. */}
          <div className="ats-sec__sub">This job uses these, but almost any candidate could claim them — they are not a gap.</div>
          <div className="ats-boxes">
            {generic.map(({ term, kind }) => <TermBox key={`g:${term}`} term={term} kind={kind} generic />)}
          </div>
        </details>
      )}

      {/* The verdict and (LLM reports only) strengths and improvements — folded, printed once. */}
      {more && (
        <details data-ats-more className="ats-fold ats-sec">
          <summary className="ats-gh"><span className="ats-gh__label">More about this match</span></summary>
          <div className="ats-more">
            {verdict && <div className="ats-more__verdict">{verdict}</div>}
            {!isLocalReport && report.strengths?.length > 0 && (
              <ListSection title="💪 Strengths" items={report.strengths} />
            )}
            {!isLocalReport && report.improvements?.length > 0 && (
              <ListSection title="🔧 Improvements" items={report.improvements} />
            )}
          </div>
        </details>
      )}
      </div>
      )}
    </div>
  );
}

/**
 * One term, as a RECTANGULAR DEPTH BOX (D32 — the pills are gone), with the scorer's `kind` beside it.
 * With `onToggleClaim` it is a CLAIM BOX (AG2) — a control, with the + affordance and D1's lift / hover
 * / press; without it, a read-only box.
 *
 * THE COPY IS THE FEATURE. Clicking one of these asserts "I have this" — a claim the candidate will
 * have to defend in an interview. So the box never reads as "add this to improve your score".
 * CC4: a claim DOES count toward this score and toward where the job ranks, and the copy says so;
 * the scorer reports every match that rested on a claim alone, so the number is never silently
 * inflated. NOTHING IS PRE-SELECTED: `claimedLookup` holds only what the person actually claimed.
 */
function TermBox({
  term: k, kind, generic = false, onToggleClaim = null, pendingItems = new Set(),
  claimedLookup = { skillKeys: new Set(), verbKeys: new Set() },
  lockedLookup = new Set(), evidencedLookup = new Set(),
}) {
  const link = usePairLink();
  const claimKind = TERM_KINDS[kind]?.claim || "skill";
  const claimedKeys = (claimKind === "action_verb" ? claimedLookup?.verbKeys : claimedLookup?.skillKeys) || new Set();
  const itemKey = profileSignalKey(k);
  const locked = (lockedLookup || new Set()).has(itemKey);
  const claimed = locked || claimedKeys.has(itemKey) || (pendingItems || new Set()).has(`${claimKind}:${k}`);
  const evidenced = evidencedLookup.has(itemKey);
  const interactive = !!onToggleClaim && !locked;
  // D32's hover link — only inside a pair, only while pointed at or focused.
  const linkProps = link
    ? { onMouseEnter: () => link.light(k), onMouseLeave: () => link.light(null),
        onFocus: () => link.light(k), onBlur: () => link.light(null), "data-pair-term": k }
    : {};
  const provenance = generic
    ? "Generic language — almost any candidate could claim this. Not a gap."
    : evidenced
      ? "Your resume already shows this"
      : claimed ? "You claimed this — the job description asked for it" : "This job asked for it. Your resume does not show it.";
  const kindLabel = <span className="ats-box__kind">{TERM_KINDS[kind]?.label || kind}</span>;
  // The box's tone (pair2.html): green for what the résumé shows or the candidate claimed, grey for
  // generic language, the claim red for an ask the résumé does not show.
  const tone = generic ? "gen" : (evidenced || claimed) ? "ok" : "claim";
  if (!interactive) {
    return (
      <span className="ats-box" data-kind={kind} data-tone={tone} data-claimed={claimed ? "true" : "false"} title={provenance}
        tabIndex={link ? 0 : undefined} {...linkProps}>
        {/* Generic language carries no kind — the sketch's grey boxes are the word alone. */}
        <span className="ats-box__term">{claimed ? `✓ ${k}` : k}</span>{!generic && kindLabel}
      </span>
    );
  }
  return (
    <button type="button" className="ats-box ats-box--claim" data-kind={kind} data-tone="claim" data-claim-chip={claimKind}
      onClick={() => onToggleClaim(k, !claimed)}
      aria-pressed={claimed}
      title={claimed ? `You claimed "${k}". Click to withdraw it.`
                     : `Claim "${k}" — only if it is true of you. It counts toward this score and toward where this job ranks, and it is used in future resumes.`}
      {...linkProps}>
      {/* The FILLED square: + to claim, ✓ once claimed (pair2.html's .p). aria-pressed carries the state. */}
      <span className="ats-box__plus" aria-hidden="true">{claimed ? "✓" : "+"}</span>
      <span className="ats-box__term">{k}</span>{kindLabel}
    </button>
  );
}

function ListSection({ title, items }) {
  return (
    <div>
      <div className="ats-sec__label">{title}</div>
      <div className="ats-list">
        {items.map((t, i) => (
          <div key={i} className="ats-list__item"><span aria-hidden="true">·</span><span>{t}</span></div>
        ))}
      </div>
    </div>
  );
}
