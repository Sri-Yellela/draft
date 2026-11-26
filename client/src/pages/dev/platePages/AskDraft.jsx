// ⭐ D197 Wave 2 #12 · M3 (47j, lane w2-practice) — ASK DRAFT (D177 / D190, Tiny on draft) as a plate card, a mock made only
// from the plate library and the --pl-* tokens, with fixture data (synthetic). Brief + M1: docs/revamp/ask-draft.md. Served
// at /dev/plate?page=ask-draft (&w=390 = the phone's bottom sheet; &thread=1 shows a held application's thread above the
// turns). Nothing calls the server or a model: typing runs a three-phrase scripted matcher so the conversation is operable.
// "Answers plotted as a route" is still to design — a labelled placeholder under the answer with lessons.
import { useEffect, useRef, useState } from "react";
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { AreaNav } from "../../../plate/Shell.jsx";
import { Kickers } from "../../../plate/Marks.jsx";
import { LegHeader } from "../../../plate/Plates.jsx";
import { AskDraftCard } from "../../../plate/Cards.jsx";
import { QuestionTicket } from "../../../plate/Tickets.jsx";
import { DrawingToCome } from "../../../plate/Drawings.jsx";

const INTRO = "Tell me what to do — “show me senior remote jobs in Boston”, “find data analyst jobs”, “draft this job”, “open my profile”, “how many need me?” — or ask about a skill, a role or how draft works. Anything draft already holds is done without AI.";
const START = [
  { who: "you", text: "how many need me?" },
  { who: "draft", tier: "T2", text: "2 need you: Sailor Health has 1 question only you can answer, and Brightline Health is ready to approve.", next: "Open the ledger to answer it." },
  { who: "you", text: "draft this job" },
  { who: "draft", tier: "T1", text: "Drafting Frontend Engineer II, Checkout at Kestrel Payments. It's in your ledger.", undo: true },
  { who: "you", text: "pass on this one" },
  { who: "draft", tier: "ask", text: "Pass on Kestrel Payments? It leaves your deck.", confirm: true },
  { who: "you", text: "what is a webhook?" },
  { who: "draft", tier: "T2", text: "The same news, pushed to you when it happens — instead of you asking again and again.", route: true,
    lessons: [{ name: "Webhooks", href: "#entry-webhooks", kind: "ENTRY · IV" }, { name: "Idempotency", href: "#entry-idempotency", kind: "ENTRY · IV" }],
    next: "Walk the Webhooks entry: about 12 minutes." },
  { who: "you", text: "write a first line for my cover letter to Kestrel" },
  { who: "draft", tier: "T3", text: "“Checkout is where a product earns its keep, and I've spent two years making Toast's faster.” — from your résumé; edit it before you use it.",
    action: { summary: "Save it to this job's notes" } },
  { who: "question", text: "Why do you want to work at Sailor Health?" },
  { who: "draft", text: "I've built checkout flows patients use to pay for care at Toast's healthcare clients, and Sailor's scheduling work is the same problem one step earlier.", usable: true },
];
// the scripted matcher (the real engine is shared/assistantEngine.js — commands-v1.json's rows)
function reply(line) {
  const t = line.toLowerCase();
  if (/need me/.test(t)) return { who: "draft", tier: "T2", text: "2 need you: 1 question to answer, 1 ready to approve." };
  if (/open (my )?profile/.test(t)) return { who: "draft", tier: "T1", text: "Opened your Profile.", undo: true };
  if (/^write /.test(t)) return { who: "draft", tier: "T3", text: "This mock calls no model — the real T3 answers only an explicit ask, labelled written by the assistant." };
  return { who: "draft", tier: "ask", text: "I can do that from draft's own data if you say which: a job, a skill, or a place in draft?" };
}

/** A held application's questions as a thread (A199 (2)) — one at a time, the ledger's question ticket. */
function HeldThread() {
  const [i, setI] = useState(0);
  const qs = ["Are you legally authorized to work in the country of employment?", "Will you now or in the future require sponsorship?"];
  return (
    <QuestionTicket kicker="SAILOR HEALTH · 2 QUESTIONS ONLY YOU CAN ANSWER" n={`QUESTION ${Math.min(i + 1, 2)} OF 2`} text={qs[Math.min(i, 1)]} kind="yesno"
      options={["Yes", "No"]} pressed={null} onAnswer={() => setI(i + 1)} progress={[i > 0 ? "lit" : "today", i > 1 ? "lit" : i === 1 ? "today" : null]}
      saveLabel="Save this answer for next time" onBack={i ? () => setI(i - 1) : undefined} backDisabled={!i}
      more={<button type="button" className="pl-btn">Finish the form</button>}/>
  );
}

export default function AskDraftMock({ width = 1280 }) {
  const phone = width < 600;
  const thread = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("thread") === "1";
  const [turns, setTurns] = useState(START);
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [improve, setImprove] = useState(true);
  const bodyRef = useRef(null);
  useEffect(() => { const b = bodyRef.current; if (b) b.scrollTop = b.scrollHeight; }, [turns.length]);
  const patch = (i, p) => setTurns((ts) => ts.map((t, k) => (k === i ? { ...t, ...p } : t)));
  const card = (
    <AskDraftCard name="Ask draft" intro={INTRO} bodyRef={bodyRef} value={value} onChange={setValue} placeholder="Ask — e.g. find data analyst jobs · how many need me?"
      turns={turns} canSpeak listening={listening} onSpeak={() => setListening((l) => !l)}
      voiceNote={listening ? "Listening — on this device, nothing leaves the browser until you stop." : null}
      improve={{ on: improve, onToggle: () => setImprove((x) => !x) }} onClose={() => {}}
      onSend={(line) => { setValue(""); setTurns((ts) => [...ts, { who: "you", text: line }, reply(line)]); }}
      onUndo={(i) => patch(i, { undone: "Undone." })} onAnswerBack={(i, yes) => patch(i, { confirm: false, text: `${turns[i].text} — ${yes ? "Passed." : "Kept."}` })}
      onDecide={(i, ok) => patch(i, { decided: ok ? "Done." : "Cancelled." })} onUseAnswer={(i) => patch(i, { used: true })}>
      {thread ? <HeldThread/> : null}
    </AskDraftCard>
  );
  // the route placeholder: under the card, tied to the answer that has lessons (the card has no slot inside a turn yet)
  const route = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="pl-label pl-muted">“WHAT IS A WEBHOOK?” · ITS ROUTE — TO DESIGN</span>
      <DrawingToCome what="The answer's route: the question as a start flag, Webhooks and Idempotency as stops on Atlas's map, the next step as the waypoint"
        aspect="16 / 7" note="D201 ROUTES · TO DESIGN (PIVOTS · LEFT MIDWAY)"/>
    </div>
  );
  return (
    <PlateRoot region="IV" style={{ minHeight: "100vh", position: "relative" }} data-plate-page="ask-draft">
      <AreaNav area="The market" views={[{ id: "picks", label: "Today’s picks", href: "#picks", icon: "picks" }, { id: "all", label: "All jobs", href: "#all", icon: "list" }]}
        current="picks" phone={phone} home={{ href: "#home", label: "draft — the market" }} search={{ placeholder: "Company, role, tech…", onOpen: () => {} }}/>
      <section className="pl-hero" aria-label="The page behind">
        <div className="pl-hero__main">
          <Kickers parts={["MOCK · D197 WAVE 2 #12", "EXAMPLE DATA", "NOTHING HERE IS LIVE"]}/>
          <LegHeader meta="ANY PAGE · THE CARD FLOATS OVER IT" title="Ask draft, over the market" level={1}/>
          <p className="pl-body" style={{ maxWidth: 520 }}>The card opens from the fox bubble or the dock's Ask draft, floats bottom-right over the page (never over the dock), and on a phone becomes a bottom sheet. On Resume Master the same card is Tiny's side panel, which moves the page over.</p>
        </div>
      </section>
      {phone ? (
        <div style={{ position: "sticky", bottom: 0, marginTop: 24 }}>
          <div style={{ maxHeight: "72vh", display: "flex" }}>{card}</div>
          <div style={{ padding: 16, background: "var(--pl-paper)" }}>{route}</div>
        </div>
      ) : (
        <div className="pl-page" style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "flex-end", alignItems: "flex-end", paddingBottom: 24 }}>
          <div style={{ flex: "1 1 420px", minWidth: 0, maxWidth: 560 }}>{route}</div>
          <div style={{ flex: "0 0 400px", maxWidth: "100%", display: "flex" }}>{card}</div>
        </div>
      )}
    </PlateRoot>
  );
}
