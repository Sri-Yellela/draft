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
// Behaviour kept from every surface it replaces:
//   · A BAND, NEVER A NUMBER (G5). `band` may be passed by a caller that holds only the band (the
//     deck); otherwise it is derived from report.score with shared/atsBands.js.
//   · "Not enough signal" is the scorer DECLINING — the dashed, hue-less chip (bandStyle), "no
//     judgement" under it, and the decline reasons — never a low grade, and rendered for every
//     report, including a declined one.
//   · Claim chips are interactive only when the caller passes `claims` (the board and the deck, on
//     a profile); the public tool passes none and the chips are read-only.
import { atsBandFor, atsBandLabel, ATS_BAND } from "../../../shared/atsBands.js";
import { profileSignalKey } from "../../../shared/profileSignals.js";
import { bandChipStyle } from "../styles/bandStyle.js";
import { C } from "../styles/colorTokens.js";

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
 * The band card alone: the band, what it means, why the scorer declined (if it did), the seniority
 * note and the verdict. The full report opens with it; the signup hook shows only this.
 */
export function AtsBandCard({ report, band: knownBand = null, compact = false, children = null }) {
  const band = reportBand(report, knownBand);
  const meta = atsBandLabel(band);
  const isUnknown = band === ATS_BAND.NOT_ENOUGH_SIGNAL;
  const declineReasons = Array.isArray(report?.decline_reasons) ? report.decline_reasons : [];
  const seniority = report?.seniority_cap?.applied ? report.seniority_cap : null;
  const verdict = report?.verdict || report?.experience?.summary || null;
  return (
    <div data-ats-band-card style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)",
                  borderRadius: 16, padding: compact ? "12px 14px" : 16, display: "flex", alignItems: "center",
                  gap: compact ? 12 : 16, flexWrap: "wrap" }}>
      <div style={{ flexShrink: 0, minWidth: 104, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ ...bandChipStyle(band, { edgeAlpha: "33" }), padding: "10px 14px", borderRadius: 12,
                      fontWeight: 900, fontSize: 15, textAlign: "center", lineHeight: 1.2, width: "100%" }}>
          {meta.label}
        </div>
        <div style={{ fontSize: 10, color: "var(--color-text-muted)", textAlign: "center" }}>
          {isUnknown ? "no judgement" : "fit band"}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6, marginBottom: 8 }}>{meta.blurb}</div>
        {declineReasons.length > 0 && (
          <ul style={{ margin: "0 0 8px 0", paddingLeft: 16, fontSize: 11.5, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
            {declineReasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
        {seniority && (
          <div style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 8, marginBottom: 8,
                        background: "var(--color-surface-offset)", color: "var(--color-text-muted)",
                        border: "1px solid var(--color-border)" }}>
            {seniority.reason}
          </div>
        )}
        {!compact && (
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic", lineHeight: 1.6, marginBottom: 8 }}>
            {verdict || "Deterministic local ATS match against this profile."}
          </div>
        )}
        {children}
      </div>
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

  return (
    <div data-ats-report style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
      {depth && (
        <div style={{ background: "var(--color-surface-offset)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--color-text)", marginBottom: 4 }}>{depth.headline}</div>
          <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", lineHeight: 1.6 }}>{depth.detail}</div>
        </div>
      )}

      {/* Band card. Renders for EVERY report, including a declined one. */}
      <AtsBandCard report={report} band={knownBand}>
        {report.best_possible_score != null && (
          <div style={{ fontSize: 11, padding: "6px 10px", borderRadius: 8,
                        background: pct === report.best_possible_score ? C.SUCCESS_QUIET : "var(--color-surface-offset)",
                        color: pct === report.best_possible_score ? C.SUCCESS : "var(--color-text-muted)",
                        border: `1px solid ${pct === report.best_possible_score ? `color-mix(in srgb, ${C.SUCCESS} 20%, transparent)` : "var(--color-border)"}` }}>
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

      {report.tier1_matched?.length > 0 && (
        <TagSection title="✓ Skills Matched" subtitle="This job asked for these, and your resume already evidences them."
          bg={C.SUCCESS_QUIET} fg={C.SUCCESS} border={`color-mix(in srgb, ${C.SUCCESS} 20%, transparent)`}
          items={report.tier1_matched} evidencedLookup={evidencedLookup}/>
      )}
      {report.tier1_missing?.length > 0 && (
        <TagSection title="✗ Skills Missing"
          subtitle={claims?.onToggle ? "This job asked for these and your resume does not show them. Claim any that are true of you."
                                     : "This job asked for these and your resume does not show them."}
          bg={C.DANGER_QUIET} fg={C.DANGER} border={`color-mix(in srgb, ${C.DANGER} 20%, transparent)`}
          items={report.tier1_missing} evidencedLookup={evidencedLookup} kind="skill" {...claimable("skill")}/>
      )}
      {/* Competencies — AH3's third bucket: qualities, not technologies. Still claimable. */}
      {report.competencies_matched?.length > 0 && (
        <TagSection title="✓ Competencies Matched" subtitle="Qualities this job asked for that your resume already shows."
          bg={C.SUCCESS_QUIET} fg={C.SUCCESS} border={`color-mix(in srgb, ${C.SUCCESS} 20%, transparent)`}
          items={report.competencies_matched} evidencedLookup={evidencedLookup}/>
      )}
      {report.competencies_missing?.length > 0 && (
        <TagSection title="◇ Competencies Missing"
          subtitle={claims?.onToggle ? "Ways of working this job asked for. These are qualities, not technologies — claim the ones that are true of you."
                                     : "Ways of working this job asked for. These are qualities, not technologies."}
          bg={C.VIOLET_QUIET} fg={C.VIOLET} border={`color-mix(in srgb, ${C.VIOLET} 20%, transparent)`}
          items={report.competencies_missing} evidencedLookup={evidencedLookup} kind="skill" {...claimable("skill")}/>
      )}
      {report.action_verbs_matched?.length > 0 && (
        <TagSection title="⚡ Verbs Matched" subtitle="Your resume already uses this job's language for these."
          bg={C.INFO_QUIET} fg={C.INFO} border={`color-mix(in srgb, ${C.INFO} 20%, transparent)`}
          items={report.action_verbs_matched} kind="action_verb" evidencedLookup={evidencedLookup}/>
      )}
      {report.action_verbs_missing?.length > 0 && (
        <TagSection title="⚠ Verbs Missing"
          subtitle={claims?.onToggle ? "This job's language for work you may already have done. Claim the ones that describe you."
                                     : "This job's language for work you may already have done."}
          bg={C.WARNING_QUIET} fg={"var(--color-warning)"} border={"color-mix(in srgb, var(--color-warning) 20%, transparent)"}
          items={report.action_verbs_missing} evidencedLookup={evidencedLookup} kind="action_verb" {...claimable("action_verb")}/>
      )}
      {/* Generic language — AH3. NOT a gap, and deliberately not claimable. */}
      {report.action_verbs_generic?.length > 0 && (
        <TagSection title="○ Generic Language" subtitle="This job uses these, but almost any candidate could claim them — they are not a gap."
          bg={"var(--color-surface-offset)"} fg={"var(--color-text-muted)"} border={"var(--color-border)"}
          items={report.action_verbs_generic}/>
      )}
      {report.experience && (
        <ListSection title="Experience Fit" items={[report.experience.summary]} color={report.experience.fit ? C.SUCCESS : "var(--color-warning)"}/>
      )}
      {report.hard_constraint_misses?.length > 0 && (
        <TagSection title="Profile Facts Missing" bg={C.DANGER_QUIET} fg={C.DANGER}
          border={`color-mix(in srgb, ${C.DANGER} 20%, transparent)`} items={report.hard_constraint_misses}/>
      )}
      {!isLocalReport && report.strengths?.length > 0 && (
        <ListSection title="💪 Strengths" items={report.strengths} color={C.SUCCESS}/>
      )}
      {!isLocalReport && report.improvements?.length > 0 && (
        <ListSection title="🔧 Improvements" items={report.improvements} color={"var(--color-primary)"}/>
      )}
    </div>
  );
}

/**
 * A row of terms, each of which the candidate may CLAIM (AG2).
 *
 * THE COPY IS THE FEATURE. Clicking one of these asserts "I have this" — a claim the candidate will
 * have to defend in an interview. So the chip never reads as "add this to improve your score".
 * CC4: a claim DOES count toward this score and toward where the job ranks, and the copy says so;
 * the scorer reports every match that rested on a claim alone, so the number is never silently
 * inflated. NOTHING IS PRE-SELECTED: `claimedLookup` holds only what the person actually claimed.
 */
function TagSection({
  title, subtitle = null, bg, fg, border, items,
  onToggleClaim = null, pendingItems = new Set(),
  claimedLookup = { skillKeys: new Set(), verbKeys: new Set() },
  lockedLookup = new Set(), evidencedLookup = new Set(), kind = "skill",
}) {
  const claimedKeys = (kind === "action_verb" ? claimedLookup?.verbKeys : claimedLookup?.skillKeys) || new Set();
  return (
    <div>
      <div className="rm-section-label" style={{ color: fg }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 6, lineHeight: 1.5 }}>{subtitle}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {items.map(k => {
          const itemKey = profileSignalKey(k);
          const locked = (lockedLookup || new Set()).has(itemKey);
          const claimed = locked || claimedKeys.has(itemKey) || (pendingItems || new Set()).has(`${kind}:${k}`);
          const evidenced = evidencedLookup.has(itemKey);
          const interactive = !!onToggleClaim && !locked;
          const provenance = evidenced
            ? "Your resume already shows this"
            : claimed ? "You claimed this — the job description asked for it" : "This job asked for it. Your resume does not show it.";
          return (
            <button key={k} type="button" className="rm-badge"
              onClick={interactive ? () => onToggleClaim(k, !claimed) : undefined}
              disabled={!interactive}
              aria-pressed={interactive ? claimed : undefined}
              title={interactive
                ? (claimed ? `You claimed "${k}". Click to withdraw it.`
                           : `Claim "${k}" — only if it is true of you. It counts toward this score and toward where this job ranks, and it is used in future resumes.`)
                : provenance}
              style={{
                background: claimed ? C.SUCCESS_QUIET : bg,
                color: claimed ? C.SUCCESS : fg,
                border: `1px solid ${claimed ? `color-mix(in srgb, ${C.SUCCESS} 20%, transparent)` : border}`,
                cursor: interactive ? "pointer" : "default",
              }}>
              {claimed ? `✓ ${k}` : k}
            </button>
          );
        })}
      </div>
      {onToggleClaim && (
        <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 6, fontStyle: "italic" }}>
          Claiming a term says it is true of you — claim it only if it is. It counts toward this
          score and toward where jobs rank on your board, and it is used in resumes generated from
          now on; it never rewrites one you already have. Withdraw it at any time and all three go
          back.
        </div>
      )}
    </div>
  );
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
