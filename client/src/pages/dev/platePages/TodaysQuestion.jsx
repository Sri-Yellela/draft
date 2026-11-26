// ⭐ D197 Wave 2 #11 · M3 (47j, lane w2-practice) — TODAY'S QUESTION as the Today card on Your map (D203 (3): the practice
// engine behind entries picks one due for review; the reminder lives in notifications; the Gazetteer gets a Due filter),
// a mock made only from the plate library and the --pl-* tokens, with fixture data. Brief + M1: docs/revamp/atlas-extras.md.
// Served at /dev/plate?page=todays-question (&w=390; &state=empty | signedout | error | loading). Answering is the model:
// right → LIT + today's square; wrong → struck through, the stronger move. Region IV; clay = today's square only.
import { useState } from "react";
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { AreaNav, Dock } from "../../../plate/Shell.jsx";
import { Kickers, LitSquares, Stamp, FilterChips } from "../../../plate/Marks.jsx";
import { LegHeader } from "../../../plate/Plates.jsx";
import { Ticket, QuestionTicket } from "../../../plate/Tickets.jsx";
import { DrawingToCome } from "../../../plate/Drawings.jsx";
import { Drawer } from "../../../plate/PlateState.jsx";
import { DOCK_ITEMS } from "../../../plate/registry.js";

// ── fixture (synthetic) ──
const Q = {
  skills: ["WEBHOOKS", "SYSTEMS & NETWORKS · IV"], reason: "DUE FOR REVIEW · MISSED 3 DAYS AGO",
  stem: "Stripe sends the same webhook twice. What keeps your server from charging the customer twice?",
  choices: ["Answer Stripe slower, so it stops retrying", "Store the event's id and skip one you've already handled", "Turn off retries in the dashboard", "Verify the signature again"],
  right: 1,
  why: { 0: "Waiting makes Stripe retry more, not less.", 1: "An idempotency key: the second delivery finds its id and does nothing.", 2: "Retries are how you hear about events you missed.", 3: "The duplicate is genuine — its signature checks out too." },
};
const stateFromAddress = () => (typeof window === "undefined" ? "ready" : new URLSearchParams(window.location.search).get("state") || "ready");

function TodayCard() {
  const [chosen, setChosen] = useState(null);
  const answered = chosen != null;
  const right = chosen === Q.right;
  const state = stateFromAddress();
  if (state === "signedout") return <Drawer text="Sign in to get a question a day, picked from your own gaps." action={{ label: "Get started", href: "#signin" }}/>;
  if (state === "empty") return <Drawer text="Nothing is due today — there's nothing new for you. Come back tomorrow, or open an entry and practise it." action={{ label: "Open the Gazetteer", href: "#gazetteer" }}/>;
  return (
    <QuestionTicket kicker={`TODAY · PICKED FOR YOU · ${Q.reason}`} n={Q.skills.join(" · ")} text={Q.stem} kind="yesno" options={Q.choices}
      pressed={answered ? Q.choices[chosen] : null} onAnswer={(o) => { if (!answered) setChosen(Q.choices.indexOf(o)); }} saveLabel={null}
      progress={[answered ? (right ? "lit" : "needs") : "today"]} state={state === "ready" ? undefined : state}
      errorText="Today's question couldn't load." onRetry={() => {}}
      more={<span className="pl-label pl-muted">ABOUT TWO MINUTES · A REVIEW COMES BACK WHEN YOU MISS ONE</span>}>
      {answered ? (
        <div role="status" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {right
            ? <p className="pl-body" style={{ margin: 0 }}><b>Right.</b> {Q.why[chosen]}</p>
            : <>
                <p className="pl-body" style={{ margin: 0 }}><b>Not quite.</b> <s>{Q.choices[chosen]}</s> — {Q.why[chosen]}</p>
                <p className="pl-body" style={{ margin: 0 }}><b>The stronger move:</b> {Q.choices[Q.right]} — {Q.why[Q.right]}</p>
              </>}
          <p className="pl-body" style={{ margin: 0 }}>Go to the entry: <a href="#entry-idempotency">Idempotency</a> · <a href="#entry-webhooks">Webhooks</a> · Watch it: <a href="#explainer">The same news, twice</a></p>
          {right ? <Stamp tone="lit" rotate={-6}>LIT</Stamp> : null}
          <p className="pl-label pl-muted" style={{ margin: 0 }}>COME BACK TOMORROW FOR THE NEXT ONE</p>
        </div>
      ) : null}
    </QuestionTicket>
  );
}

export default function TodaysQuestionMock({ width = 1280 }) {
  const phone = width < 600;
  const views = [
    { id: "map", label: "Your map", href: "#map", icon: "map" }, { id: "gazetteer", label: "Gazetteer", href: "#gz", icon: "list" },
    { id: "routes", label: "Routes", href: "#routes", icon: "next" }, { id: "library", label: "Library", href: "#lib", icon: "library" },
    { id: "survey", label: "Your survey", href: "#survey", icon: "progress" },
  ];
  const nav = (
    <AreaNav area="Atlas" pill={{ tag: "VOL. I", name: "Computing", panel: <p className="pl-body" style={{ padding: 14, margin: 0 }}>The volumes panel (Wave 1 #5).</p> }}
      views={views} current="map" phone={phone} home={{ href: "#home", label: "draft — the market" }}
      search={{ placeholder: "Make sense of…", onOpen: () => {} }} chip={{ kind: "run", days: ["lit", "lit", null, "today", null, null, null], href: "#logbook", label: "Your run: 2 of 7 days lit this week" }}/>
  );
  const body = (
    <div style={{ paddingBottom: phone ? 96 : 0 }}>
      <section className="pl-hero" aria-label="Your map">
        <div className="pl-hero__main">
          <Kickers parts={["MOCK · D197 WAVE 2 #11", "EXAMPLE DATA", "NOTHING HERE IS LIVE"]}/>
          <LegHeader meta="ATLAS · YOUR MAP · THURSDAY 26 NOVEMBER" title="Your map" level={1}/>
          <p className="pl-label pl-muted" style={{ margin: 0 }}>YOUR ATLAS STREAK: 4 DAYS — ANSWERING COUNTS FOR TODAY</p>
        </div>
      </section>
      <section className="pl-section" aria-labelledby="tq-1" id="today">
        <LegHeader n={1} meta="THE PRACTICE ENGINE · ONE ENTRY DUE FOR REVIEW" title="Today" id="tq-1"/>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
          <div style={{ flex: "999 1 520px", minWidth: 0 }}><TodayCard/></div>
          <div style={{ flex: "1 1 260px", minWidth: 0, maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
            <DrawingToCome what="Today's square on the map: the entry's region inset, today's beacon on Webhooks" aspect="4 / 3" note="REGION IV'S RAMP · FROM THE DESIGN DOC"/>
            <span className="pl-label">THIS WEEK · IN THE LOGBOOK</span>
            <LitSquares squares={["lit", "lit", null, "today", null, null, null]} size={16} label="This week: 2 days lit, today not yet"/>
          </div>
        </div>
      </section>
      <section className="pl-section pl-section--last" aria-labelledby="tq-2">
        <LegHeader n={2} meta="ONWARD" title="More to practise" id="tq-2"/>
        <FilterChips label="The Gazetteer's index" chips={[{ id: "due", label: "Due", count: 3, on: true }, { id: "all", label: "Every entry", count: 412 }]}/>
        <div className="pl-tickets">
          <Ticket kicker="GAZETTEER · DUE · 3" title="Three entries are due for review" line="Idempotency, Hash maps and SQL joins — each comes back on 1 → 3 → 7 → 21 days." go="Open the Due list →" href="#due"/>
          <Ticket kicker="NOTIFICATIONS" title="Remind me daily" line="At your hour, by notification or email — only on days you haven't answered. Off until you turn it on." go="Set the reminder →" href="#notifications"/>
          <Ticket kicker="THE LOGBOOK · PRACTICE BY SKILL" title="How you're doing on each skill" line="Three or more answers, the last 20, no curve." go="Open the Logbook →" href="#logbook"/>
        </div>
      </section>
    </div>
  );
  const dock = DOCK_ITEMS.map((d) => ({ ...d, href: "#" }));
  return (
    <PlateRoot region="IV" style={{ minHeight: "100vh" }} data-plate-page="todays-question">
      {phone ? (
        <>{nav}{body}<div style={{ position: "sticky", bottom: 0 }}><Dock items={dock} current="atlas" bar/></div></>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <div style={{ position: "sticky", top: 14, padding: 14 }}><Dock items={dock} ask={{ href: "#ask" }} current="atlas"/></div>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>{nav}{body}</div>
        </div>
      )}
    </PlateRoot>
  );
}
