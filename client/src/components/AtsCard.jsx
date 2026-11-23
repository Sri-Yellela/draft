// client/src/components/AtsCard.jsx — ⭐ THE ATS CARD in the posting's match panel. The owner's pick (11-19): option C of
// https://claude.ai/artifact/Fx8EDAEByAkLuBcADt7v2W — the number, the four things it is made of (one bar and one plain line
// each), and the single biggest gain. It REPLACES the old report (its claims — "That's true of me" — and the quick check they
// opened; owner: "ditch the whole prove it and claim it gimmick … definitely from the jd panel") and the In context section.
// Numbers are painted by band (AtsInk — no band word). "Learn" only to a published Atlas page (lib/atlasLinks.js). The words
// are shared/contextualView.js atsCardView (pure, tested). The contextual block is GET /api/jobs/:id/contextual; the skill
// report is the one ATSPanel already loads. The job's résumé versions (`history`) stay, behind one quiet toggle.
// D60: the bars are 6 px with a 2 px corner — no capsule.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { atsCardView } from "../../../shared/contextualView.js";
import { atsInk } from "./AtsInk.jsx";
import { PlausibilityFlags } from "./PlausibilityFlags.jsx";   // D192 (4d): does the résumé add up
import { useAtlasSlugs, atlasHref } from "../lib/atlasLinks.js";
import { ts } from "../themes/shapes.js";

// ⭐ 47b (owner 11-22: "we can have a detailed analysis on demand") — the card opens SHORT: the number, each part's name, bar
// and number, the biggest gain. The analysis (the score's facts line, each part's line and figures) waits behind one quiet
// toggle; the choice is remembered per viewer (a convenience — the card reads right without it).
const DETAIL_KEY = "draft:ats-card-detail";
const readDetail = () => { try { return localStorage.getItem(DETAIL_KEY) === "1"; } catch { return false; } };

export function AtsCard({ report = null, jobId = null, history = null, contextual: given = null }) {
  const [contextual, setContextual] = useState(given);
  const [showHistory, setShowHistory] = useState(false);
  const [detail, setDetail] = useState(readDetail);
  const toggleDetail = () => setDetail(v => { const next = !v; try { localStorage.setItem(DETAIL_KEY, next ? "1" : "0"); } catch { /* this visit only */ } return next; });
  useEffect(() => {
    if (given || !jobId) return undefined;
    let live = true;
    setContextual(null);
    api(`/api/jobs/${encodeURIComponent(jobId)}/contextual`).then(r => { if (live) setContextual(r?.contextual || null); }).catch(() => { if (live) setContextual(null); });
    return () => { live = false; };
  }, [jobId, given]);
  const view = useMemo(() => atsCardView({ report, contextual }), [report, contextual]);
  const slugs = useAtlasSlugs(useMemo(() => (view?.gain?.tech ? [view.gain.tech] : []), [view]));
  if (!view) return null;

  return (
    <section data-ats-card aria-label="Your résumé against this job" style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--color-text)" }}>
      {view.declined ? (
        <div data-ats-card-declined style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: ts(18), fontWeight: 700 }}>Not enough signal</div>
          <div style={{ fontSize: ts(13), color: "var(--color-text-muted)" }}>{view.reason}</div>
        </div>
      ) : (
        <>
          <div data-ats-card-score style={{ fontSize: ts(44), fontWeight: 700, lineHeight: 1, color: atsInk(view.score) }}>{view.score}%</div>
          {detail && view.facts?.length > 0 && <div data-ats-card-facts="card" style={{ fontSize: ts(12.5), color: "var(--color-text-muted)", marginTop: -8, overflowWrap: "anywhere" }}>{view.facts.join(" · ")}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {view.parts.map(p => (
              <div key={p.id} data-ats-card-part={p.id} style={{ display: "grid", gridTemplateColumns: "minmax(84px, 110px) minmax(0, 1fr) 36px", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: ts(14) }}>{p.name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                  <div aria-hidden="true" style={{ height: 6, borderRadius: 2, background: "var(--color-border)", overflow: "hidden" }}>
                    <div style={{ height: 6, width: `${p.score}%`, background: atsInk(p.score) }} />
                  </div>
                  {detail && p.line && <div data-ats-card-line={p.id} style={{ fontSize: ts(12.5), color: "var(--color-text-muted)", overflowWrap: "anywhere" }}>{p.line}</div>}
                  {/* ⭐ 46z (owner 11-20): the part's figures, stated — counts, shares, its weight */}
                  {detail && p.facts?.length > 0 && <div data-ats-card-facts={p.id} style={{ fontSize: ts(11.5), color: "var(--color-text-muted)", opacity: 0.85, overflowWrap: "anywhere" }}>{p.facts.join(" · ")}</div>}
                </div>
                <div style={{ fontSize: ts(14), fontWeight: 700, textAlign: "right", color: atsInk(p.score) }}>{p.score}</div>
              </div>
            ))}
          </div>
          {view.gain && (
            <div data-ats-card-gain style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
              borderTop: "1px solid var(--color-border)", paddingTop: 12, fontSize: ts(14) }}>
              <span style={{ minWidth: 0 }}>Biggest gain: {view.gain.text}</span>
              {view.gain.tech && slugs[view.gain.tech] && (
                <Link to={atlasHref(slugs[view.gain.tech])} style={{ fontWeight: 600, color: "var(--color-primary-text)", textDecoration: "none", flex: "none" }}>Learn</Link>
              )}
            </div>
          )}
          {view.parts.some(p => p.line || p.facts?.length) && (
            <button type="button" data-ats-card-detail aria-expanded={detail} onClick={toggleDetail}
              style={{ alignSelf: "flex-start", font: "inherit", fontSize: ts(12.5), color: "var(--color-text-muted)", background: "none", border: 0, padding: 0, cursor: "pointer" }}>
              {detail ? "Hide the analysis" : "Show the analysis"}
            </button>
          )}
        </>
      )}
      {/* ⭐ D192 (4d): the base résumé's bullets that don't line up with what draft knows about their employers — warnings, never in the number */}
      <PlausibilityFlags src="/api/resume/plausibility" />
      {history && (
        <div data-ats-card-history>
          <button type="button" aria-expanded={showHistory} onClick={() => setShowHistory(v => !v)}
            style={{ font: "inherit", fontSize: ts(12.5), color: "var(--color-text-muted)", background: "none", border: 0, padding: 0, cursor: "pointer" }}>
            {showHistory ? "Hide your résumés for this job" : "Your résumés for this job"}
          </button>
          {showHistory && <div style={{ marginTop: 8 }}>{history}</div>}
        </div>
      )}
    </section>
  );
}

export default AtsCard;
