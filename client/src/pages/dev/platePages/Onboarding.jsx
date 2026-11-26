// ⭐ D197 Wave 2 · M3 (47j, lane w2-person) · #15 ONBOARDING → *SETTING OUT* — the mock (docs/revamp/onboarding.md).
// Plate library + --pl-* tokens only; fixture data (a synthetic person). Nothing reads the server: the drop pretends to
// read the file. Legs: 01 hand over your résumé · 02 your bearing (the cartouche — the one operable model: tap a dashed
// word and its wizard stop opens) · 03 four things only you know (one question at a time) · By hand (the five stops).
import { useState } from "react";
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { Kickers, FilterChips } from "../../../plate/Marks.jsx";
import { PageTitle, StatsStrip, LegHeader, PlateHero } from "../../../plate/Plates.jsx";
import { Ticket, Cartouche, QuestionTicket } from "../../../plate/Tickets.jsx";
import { RouteLine } from "../../../plate/Lists.jsx";
import { CompassDial } from "../../../plate/Drawings.jsx";
import { SettingOutDrop, DrawingToCome } from "../../../plate/Person.jsx";
import MarketSurveyPlate from "../../../plate/drawings/MarketSurveyPlate.jsx";

const FOUR = [
  { key: "work_authorization", text: "Are you authorised to work in the United States?", kind: "choice", options: ["Yes, without sponsorship", "Yes, with sponsorship", "No"] },
  { key: "willing_to_relocate", text: "Would you relocate for the right job?", kind: "choice", options: ["Yes", "No"] },
  { key: "desired_salary", text: "What salary should forms say you want?", kind: "text" },
  { key: "available_start_date", text: "When could you start?", kind: "text" },
];
const STOPS = ["Domain", "Level", "Titles", "Keywords", "Save"];
const LEVELS = [{ id: "junior", label: "Entry level" }, { id: "mid", label: "Mid level" }, { id: "senior", label: "Senior" }, { id: "executive", label: "Executive" }];
const row = { display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start", marginTop: 18 };
const main = { flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 };
const side = { flex: "1 1 240px", minWidth: 0, maxWidth: 420 };

export default function OnboardingMock({ width = 1280 }) {
  const phone = width <= 480;
  const [read, setRead] = useState(false);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [stop, setStop] = useState(null);   // the wizard stop a dashed word opened (null = the route closed)
  const [level, setLevel] = useState("mid");
  const [said, setSaid] = useState("");
  const take = (f) => { setStatus(`Reading ${f?.name || "maya_chen.pdf"}…`); setTimeout(() => { setRead(true); setStatus("Set up as Frontend · mid level · Frontend Engineer, UI Engineer. You can refine it any time."); }, 400); };
  const open = (id) => { const at = { role: 0, level: 1, titles: 2, tech: 3 }[id] ?? 0; setStop(at); setSaid(`Opened ${STOPS[at]} — change it and the bearing redraws.`); };
  const item = FOUR[q];
  const done = q >= FOUR.length;
  const progress = FOUR.map((_, i) => (i < q ? "lit" : i === q ? "today" : null));

  return (
    <PlateRoot region="IV" style={{ minHeight: "100vh", paddingBottom: 72 }} data-mock="onboarding">
      <div className="pl-page" style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 16 }} role="group" aria-label="Mock state">
        <span className="pl-label pl-muted" style={{ alignSelf: "center" }}>MOCK · SHOW</span>
        <button type="button" className="pl-btn" aria-pressed={!read} onClick={() => { setRead(false); setStatus(""); }}>Before the read</button>
        <button type="button" className="pl-btn" aria-pressed={read} onClick={() => take(null)}>After the read</button>
      </div>

      <header className="pl-hero">
        <div className="pl-hero__main">
          <Kickers parts={["A NEW ACCOUNT", "ONE RÉSUMÉ SETS UP EVERYTHING", "MANUAL ALWAYS AVAILABLE"]}/>
          <PageTitle>Setting out</PageTitle>
          <p className="pl-lead">Hand over one résumé. draft takes your bearing, draws your first job profile on the map, then asks only what a résumé can’t say.</p>
          {read ? (
            <StatsStrip label="What your résumé said" cells={[{ value: "Frontend", label: "FIELD", onClick: () => open("role") }, { value: "Mid", label: "LEVEL", onClick: () => open("level") },
              { value: 3, label: "TITLES", onClick: () => open("titles") }, { value: 412, label: "OPENINGS THAT FIT", href: "#market" }]}/>
          ) : null}
        </div>
        <div style={{ flex: "1 1 300px", minWidth: 0, maxWidth: 560 }}>
          <PlateHero aspect="640 / 520" caption={<span className="pl-label">{read ? "YOU ARE HERE · SOFTWARE ENGINEERING · FRONTEND" : "THE MARKET · YOUR PLACE ON IT COMES WITH THE RÉSUMÉ"}</span>}
            tags={read ? [{ kicker: "YOU ARE HERE", line: "Software engineering · Frontend", x: 6, y: 8, kind: "here" }] : []}>
            <MarketSurveyPlate label={read ? "The market as a survey plate: you placed in Software engineering, Frontend, from your résumé" : "The market as a survey plate, before your résumé places you"}/>
          </PlateHero>
        </div>
      </header>

      {/* 01 · hand over your résumé */}
      <section className="pl-section" aria-labelledby="so-01">
        <LegHeader n={1} meta="LEG 1 · ≈ 1 MIN · PDF, WORD OR TEXT" title={<span id="so-01">Hand over your résumé</span>}/>
        <div style={row}>
          <div style={main}>
            <SettingOutDrop onFile={take} status={status} busy={/^Reading/.test(status)}
              aside={<button type="button" className="pl-btn pl-btn--flat" onClick={() => open("role")}>Set it up by hand instead</button>}/>
          </div>
          <div style={side}>
            <Ticket kicker="THE AUDIT · 3 MINUTES" title="Or start with the audit" line="Either order leads to the map." go="Take the audit →" href="#audit"/>
            <div style={{ marginTop: 18 }}><DrawingToCome aspect="4 / 3" what="a résumé handed across a counter, a ticket stamped read"/></div>
          </div>
        </div>
      </section>

      {/* 02 · your bearing — the operable model */}
      <section className="pl-section" aria-labelledby="so-02">
        <LegHeader n={2} meta="LEG 2 · READ FROM YOUR RÉSUMÉ · YOURS TO CHANGE" title={<span id="so-02">Your bearing</span>}/>
        <div style={row}>
          <div style={main}>
            {read ? (
              <Cartouche source="FROM MAYA_CHEN.PDF · JUST NOW" onPart={open}
                parts={["discovering ", { id: "role", text: "frontend software engineering", label: "Field: frontend software engineering. Change it" }, " roles at ",
                  { id: "level", text: LEVELS.find((l) => l.id === level).label.toLowerCase(), label: "Level. Change it" }, " as ",
                  { id: "titles", text: "Frontend Engineer, UI Engineer", label: "Titles. Change them" }, ", using ", { id: "tech", text: "React and TypeScript", label: "Keywords. Change them" }, "."]}
                actions={<><button type="button" className="pl-btn pl-btn--ink">Looks right</button><button type="button" className="pl-btn" onClick={() => open("role")}>Check what it read</button></>}/>
            ) : <p className="pl-body pl-muted">Your bearing is drawn here once the résumé is read.</p>}
            <p className="pl-label pl-muted" aria-live="polite">{said}</p>
          </div>
          <div style={side}><p className="pl-body">The same plate as above: the beacon lands on the sector your résumé names.</p></div>
        </div>
      </section>

      {/* 03 · four things only you know */}
      <section className="pl-section" aria-labelledby="so-03">
        <LegHeader n={3} meta={`LEG 3 · ${FOUR.length - Math.min(q, FOUR.length)} LEFT · EACH SKIPPABLE · NEVER GUESSED`} title={<span id="so-03">Four things only you know</span>}/>
        <div style={row}>
          <div style={main}>
            {done ? <Ticket tone="clay-tint" kicker="ALL ANSWERED OR SKIPPED" title="See your first picks" line="Ten jobs dealt from your bearing." go="Open the market →" href="#market"/> : (
              <QuestionTicket kicker="ONLY YOU CAN ANSWER THIS" n={`THING ${q + 1} OF ${FOUR.length}`} text={item.text} kind={item.kind} options={item.options}
                value={answers[item.key] ?? ""} onChange={(v) => setAnswers({ ...answers, [item.key]: v })} saveLabel={null}
                onNext={() => setQ(q + 1)} nextLabel="Save" canNext={!!String(answers[item.key] ?? "").trim()} progress={progress}
                onBack={() => setQ(Math.max(0, q - 1))} backDisabled={q === 0}
                more={<button type="button" className="pl-btn pl-btn--flat" onClick={() => setQ(q + 1)}>Skip this one</button>}/>
            )}
          </div>
          <div style={side}><CompassDial lit={Math.min(q, FOUR.length)} total={FOUR.length} size={phone ? 112 : 128} label={`Compass dial: ${Math.min(q, FOUR.length)} of ${FOUR.length} answered or skipped`}/></div>
        </div>
      </section>

      {/* by hand — the five stops */}
      <section className="pl-section" aria-labelledby="so-hand">
        <LegHeader meta="ALWAYS ONE PRESS AWAY · EVERY STEP OPTIONAL WHEN REFINING" title={<span id="so-hand">By hand</span>}/>
        <div style={{ ...main, marginTop: 18 }}>
          <RouteLine label="The five stops" stops={STOPS.map((name, i) => ({ name, state: stop == null ? (i === 0 ? "next" : "ahead") : i < stop ? "lit" : i === stop ? "next" : "ahead" }))}/>
          {stop === 1 ? <FilterChips label="Level" chips={LEVELS.map((l) => ({ ...l, on: l.id === level }))} onToggle={(id) => setLevel(id)}/> : null}
          {stop != null ? <p className="pl-body">Stop {stop + 1} · {STOPS[stop]} — the wizard’s step, pre-filled from your résumé.</p> : null}
          <div className="pl-actions">
            <button type="button" className="pl-btn" disabled={!stop} onClick={() => setStop(Math.max(0, (stop || 0) - 1))}>← Back</button>
            <span className="pl-label pl-muted" style={{ alignSelf: "center" }}>{(stop ?? 0) + 1} OF {STOPS.length}</span>
            <button type="button" className="pl-btn pl-btn--ink" onClick={() => setStop(Math.min(STOPS.length - 1, (stop ?? -1) + 1))}>{stop === STOPS.length - 1 ? "Create profile" : "Next"}</button>
          </div>
        </div>
      </section>

      <section className="pl-section pl-section--last" aria-labelledby="so-onward">
        <LegHeader meta="ONWARD" title={<span id="so-onward">Tickets out</span>}/>
        <div className="pl-tickets">
          <Ticket kicker="THE MARKET" title="See your first picks" line="Ten a day, read against your résumé." go="Open →" href="#market"/>
          <Ticket kicker="YOUR PASSPORT" title="Your page, from your résumé" line="Only you can see it until you choose." go="Open →" href="#passport"/>
        </div>
      </section>
    </PlateRoot>
  );
}
