// ⭐ D197 Wave 2 #14 · M5 (47m, lane public) · CORRESPONDENCE — the frame the three network pages share (the approved mock
// `network`, docs/revamp/network.md §6): Region VI (Languages & media — the region of language and messages), the one-line
// header ("Your correspondence" under CORRESPONDENCE · <VIEW>, the page's own sentence kept, the status line as the plate's
// caption, aria-live), the hero plate (the dispatch rider's route between camps — ported from the approved Drawings sheet),
// the page, and the onward tickets (Send a job from the market · Who works where you're applying). The area nav (People ·
// Dispatches · Letters) is the shell's (App.jsx CorrespondenceAreaNav); the three addresses are unchanged.
import { useNavigate } from "react-router-dom";
import PlateRoot from "../../plate/PlateRoot.jsx";
import { Kickers } from "../../plate/Marks.jsx";
import { Ticket } from "../../plate/Tickets.jsx";
import { Skeleton } from "../../plate/PlateState.jsx";
import DispatchRiderRoute from "../../plate/drawings/DispatchRiderRoute.jsx";

export function CorrespondenceFrame({ view, line, said = "", children, onward = true, ...data }) {
  const navigate = useNavigate();
  const go = (href) => (e) => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); navigate(href); };
  return (
    <PlateRoot region="VI" className="pl-sheetpage" {...data}>
      <main className="pl-page" style={{ display: "flex", flexDirection: "column", gap: 40, paddingTop: 24, paddingBottom: 72 }}>
        <section style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }} aria-labelledby="nw-title">
          <div style={{ flex: "999 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <Kickers parts={["CORRESPONDENCE", String(view).toUpperCase()]}/>
            <h1 id="nw-title" className="pl-mk-hero__title">Your correspondence</h1>
            {line ? <p className="pl-mk-hero__line">{line}</p> : null}
            <p className="pl-label pl-muted" role="status" aria-live="polite" data-net-said="" style={{ minHeight: "1em", margin: 0 }}>{said ? said.toUpperCase() : ""}</p>
          </div>
          <div style={{ flex: "1 1 300px", minWidth: 0 }} className="pl-platehero">
            <div className="pl-platehero__frame" style={{ "--pl-aspect": "360 / 220" }}><DispatchRiderRoute/></div>
          </div>
        </section>
        {children}
        {onward ? (
          <section aria-label="Where to go next" className="pl-tickets">
            <Ticket kicker="THE MARKET" title="Send a job to someone" line="Every opening has Send — it arrives as a job card in their letters." go="Open the market →" href="/app/jobs" onClick={go("/app/jobs")}/>
            <Ticket kicker="SURVEY SHEETS" title="Who works where you're applying" line="A connection who shows their experience there can be asked for a referral." go="Open the market →" href="/app/jobs" onClick={go("/app/jobs")}/>
          </section>
        ) : null}
      </main>
    </PlateRoot>
  );
}

/** The loading state of a Correspondence page: the frame's paper skeleton (never a spinner), the words kept for assistive tech. */
export function CorrespondenceLoading({ view, words }) {
  return (
    <PlateRoot region="VI" className="pl-sheetpage">
      <main className="pl-page" style={{ paddingTop: 24 }}>
        <Kickers parts={["CORRESPONDENCE", String(view).toUpperCase()]}/>
        <p className="pl-body" role="status" style={{ marginTop: 10 }}>{words}</p>
        <div style={{ marginTop: 16 }}><Skeleton label={words} height={220} lines={4}/></div>
      </main>
    </PlateRoot>
  );
}
