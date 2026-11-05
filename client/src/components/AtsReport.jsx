// client/src/components/AtsReport.jsx — THE ATS REPORT IN THE WEB APP: a THIN React wrapper (T9).
//
// ⛔ THIS FILE DRAWS NOTHING ITSELF. The report is ONE framework-agnostic component, `<draft-ats-report>`
// (shared/atsReportElement.js — its structure, copy and classes; shared/atsReportStyles.js — its look, the old
// AtsReport.css rule for rule; shared/atsReportModel.js — the report's shape and the two adapters). The web app and
// the extension (its popup and its on-page panel) draw THAT component from the same JSON — owner 10-14: "the same
// ATS panel we use on the website — same design and everything". Every web surface still renders from here: the
// posting's match (ATSPanel inside JobDetailPanel, D152 (8) — the old AtsReportPanel overlay is retired), the deck's left panel and the phone's sheet (DeckView, through
// ATSPanel), the deck's collapsed score, the free public tool (/tools/ats) and the signup hook (AtsBandCard).
// test/atsReportOneImplementation.test.js refuses a second copy, in the client or the extension.
//
// What the wrapper does, and only this:
//   · hands the element its inputs as PROPERTIES (report, band, claims, linkable) and ATTRIBUTES (mode, compact, and
//     the live theme + shape cues from the theme registry — so the card is the theme the page is in);
//   · turns the element's events back into the callers' callbacks: `draft-ats-claim` → claims.onToggle(kind, term,
//     claimed) (AG2's reversible call, made by ATSPanel), and `draft-ats-term` → D32's hover link (lib/pairLink.js).
// Fetching, caching and claiming stay with the caller, as before (A52).
//   · ⭐ D105 P5: resolves the report's terms to their PUBLISHED Atlas pages (lib/atlasLinks.js, cached per page) and
//     hands the element `atlas` { base: "/atlas/", slugs } — a term with no published page draws no link.
import { createElement, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useAtlasSlugs } from "../lib/atlasLinks.js";
import { reportBand, fromDeckReport, fromStandaloneResult, reportAsks, atlasTerms, TERM_KINDS } from "../../../shared/atsReportModel.js";
import { defineAtsReportElement, ATS_REPORT_TAG, ATS_CLAIM_EVENT, ATS_TERM_EVENT } from "../../../shared/atsReportElement.js";
import { ACTIVE_THEME, CUES } from "../themes/index.js";
import { usePairLink } from "../lib/pairLink.js";

export { reportBand, fromDeckReport, fromStandaloneResult, reportAsks, TERM_KINDS };

defineAtsReportElement();

// useLayoutEffect warns under a server render; the element only exists in a browser anyway.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function AtsReportHost({ report, band = null, mode = "full", compact = false, claims = null, history = null, bare = false }) {
  const ref = useRef(null);
  const link = usePairLink();
  // The latest callbacks, read at event time — so a re-render never re-binds listeners or redraws the card.
  const latest = useRef({ claims, link });
  latest.current = { claims, link };
  // The skill / quality terms the full report draws as boxes (generic language never links).
  const terms = useMemo(() => {
    if (mode !== "full" || !report) return [];
    try { return atlasTerms(report); } catch { return []; }
  }, [report, mode]);
  const slugs = useAtlasSlugs(terms);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.report = report ?? null;
    el.band = band ?? null;
    // The element reads only the claim STATE; the toggle stays here.
    el.claims = claims?.onToggle ? { pending: claims.pending, claimedLookup: claims.claimedLookup,
      lockedSkills: claims.lockedSkills, lockedVerbs: claims.lockedVerbs } : null;
    el.linkable = !!link;
    el.atlas = Object.keys(slugs).length ? { base: "/atlas/", slugs } : null;
    el.render?.();   // draw now, so the first paint already holds the card (the element also batches on its own)
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onClaim = (e) => { const { kind, term, claimed } = e.detail || {}; latest.current.claims?.onToggle?.(kind, term, claimed); };
    const onTerm = (e) => latest.current.link?.light(e.detail?.term || null);
    el.addEventListener(ATS_CLAIM_EVENT, onClaim);
    el.addEventListener(ATS_TERM_EVENT, onTerm);
    return () => { el.removeEventListener(ATS_CLAIM_EVENT, onClaim); el.removeEventListener(ATS_TERM_EVENT, onTerm); };
  }, []);

  // ⭐ D152 (8): `history` is the host's own content for the report's History switch — light DOM, in the element's
  // `history` slot (the posting's résumé versions); `bare` lets the posting's match block be the card.
  return createElement(ATS_REPORT_TAG, {
    ref, mode, ...(compact ? { compact: "" } : {}), ...(history ? { history: "" } : {}), ...(bare ? { bare: "" } : {}),
    theme: ACTIVE_THEME.id, ...(CUES ? { cues: "shape" } : {}),
  }, history ? createElement("div", { slot: "history" }, history) : null);
}

/**
 * THE FULL REPORT.
 *
 * @param report  the scorer's report shape (see fromDeckReport / fromStandaloneResult for the others)
 * @param band    a band the caller already holds (the deck), else derived from report.score
 * @param claims  optional — { onToggle(kind, label, claimed), pending:Set, claimedLookup, lockedSkills:Set,
 *                lockedVerbs:Set } — present only where the candidate can claim a term (a profile)
 * @param history optional — a React node: the History switch's content (D152 (8), the posting's résumé versions)
 * @param bare    true where the host's surface is the card (the posting's match block)
 */
export function AtsReport({ report, band = null, claims = null, history = null, bare = false }) {
  if (!report) return null;
  return createElement(AtsReportHost, { report, band, claims, history, bare });
}

/** The header alone — "9 of 12 things this posting asks for", the number or the band in words, the bar (the signup hook, the deck's collapsed score). */
export function AtsBandCard({ report, band = null, compact = false }) {
  // A caller holding only the band (no report yet) still gets the band heading, as before.
  return createElement(AtsReportHost, { report: report ?? {}, band, mode: "band", compact });
}
