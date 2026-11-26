// client/src/components/AtsReport.jsx — THE ATS REPORT IN THE WEB APP: a THIN React wrapper (T9).
//
// ⛔ THIS FILE DRAWS NOTHING ITSELF. The report is ONE framework-agnostic component, `<draft-ats-report>`
// (shared/atsReportElement.js — its structure, copy and classes; shared/atsReportStyles.js — its look;
// shared/atsReportModel.js — the report's shape and the two adapters). The web app and the extension draw THAT component
// from the same JSON. Web surfaces that render from here: the deck's collapsed score, the free public tool (/tools/ats)
// and the signup hook (AtsBandCard). ⭐ 46x (owner 11-19): the posting's match is the ATS card — since D202 (47h) FitCard (plate/FitCard.jsx) — not this.
// test/atsReportOneImplementation.test.js refuses a second copy, in the client or the extension.
//
// What the wrapper does, and only this:
//   · hands the element its inputs as PROPERTIES (report, band, linkable, atlas) and ATTRIBUTES (mode, compact, and the
//     live theme + shape cues from the theme registry — so the card is the theme the page is in);
//   · turns the element's `draft-ats-term` event into D32's hover link (lib/pairLink.js);
//   · ⭐ D105 P5: resolves the report's terms to their PUBLISHED Atlas pages (lib/atlasLinks.js, cached per page) and
//     hands the element `atlas` { base: "/atlas/", slugs } — a term with no published page draws no link.
// ⛔ No claims (46x, owner 11-19: "ditch the whole prove it and claim it gimmick", "do the clean up"): every row is read-only.
import { createElement, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useAtlasSlugs } from "../lib/atlasLinks.js";
import { reportBand, fromDeckReport, fromStandaloneResult, reportAsks, atlasTerms, TERM_KINDS } from "../../../shared/atsReportModel.js";
import { defineAtsReportElement, ATS_REPORT_TAG, ATS_TERM_EVENT } from "../../../shared/atsReportElement.js";
import { ACTIVE_THEME, CUES } from "../themes/index.js";
import { usePairLink } from "../lib/pairLink.js";

export { reportBand, fromDeckReport, fromStandaloneResult, reportAsks, TERM_KINDS };

defineAtsReportElement();

// useLayoutEffect warns under a server render; the element only exists in a browser anyway.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function AtsReportHost({ report, band = null, mode = "full", compact = false, bare = false }) {
  const ref = useRef(null);
  const link = usePairLink();
  // The latest callback, read at event time — so a re-render never re-binds listeners or redraws the card.
  const latest = useRef({ link });
  latest.current = { link };
  // The skill / quality terms the full report draws as rows (generic language never links).
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
    el.linkable = !!link;
    el.atlas = Object.keys(slugs).length ? { base: "/atlas/", slugs } : null;
    el.render?.();   // draw now, so the first paint already holds the card (the element also batches on its own)
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onTerm = (e) => latest.current.link?.light(e.detail?.term || null);
    el.addEventListener(ATS_TERM_EVENT, onTerm);
    return () => el.removeEventListener(ATS_TERM_EVENT, onTerm);
  }, []);

  // `bare` lets a host's own surface be the card.
  return createElement(ATS_REPORT_TAG, {
    ref, mode, ...(compact ? { compact: "" } : {}), ...(bare ? { bare: "" } : {}),
    theme: ACTIVE_THEME.id, ...(CUES ? { cues: "shape" } : {}),
  });
}

/**
 * THE FULL REPORT.
 *
 * @param report  the scorer's report shape (see fromDeckReport / fromStandaloneResult for the others)
 * @param band    a band the caller already holds (the deck), else derived from report.score
 * @param bare    true where the host's surface is the card
 */
export function AtsReport({ report, band = null, bare = false }) {
  if (!report) return null;
  return createElement(AtsReportHost, { report, band, bare });
}

/** The header alone — "9 of 12 things this posting asks for", the number or the band in words, the bar (the signup hook, the deck's collapsed score). */
export function AtsBandCard({ report, band = null, compact = false }) {
  // A caller holding only the band (no report yet) still gets the band heading, as before.
  return createElement(AtsReportHost, { report: report ?? {}, band, mode: "band", compact });
}
