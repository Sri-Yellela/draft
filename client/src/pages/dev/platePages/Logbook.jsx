// ⭐ D197 Wave 2 #11 · M3 (47j, lane w2-practice) — THE LOGBOOK on Your map (D203 (1), (2), (7), (11)): Your run, League
// standing and Challenges (as timed runs over a route) as one section of Your map, a mock made only from the plate library
// and the --pl-* tokens, with fixture data (synthetic people). Brief + M1: docs/revamp/atlas-extras.md. Served at
// /dev/plate?page=logbook (&w=390; &compete=0 hides what the Compete switch hides). Nothing reads the server. Region IV;
// clay = the next waypoint and today's square.
import { useState } from "react";
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { AreaNav, Dock } from "../../../plate/Shell.jsx";
import { Kickers, LitSquares, Stamp, LogbookDays, FilterChips } from "../../../plate/Marks.jsx";
import { StatsStrip, LegHeader } from "../../../plate/Plates.jsx";
import { Ticket } from "../../../plate/Tickets.jsx";
import { Gazetteer, RouteLine } from "../../../plate/Lists.jsx";
import { CompassDial, DrawingToCome } from "../../../plate/Drawings.jsx";
import { DOCK_ITEMS } from "../../../plate/registry.js";

// ── fixture data (synthetic) — Monday 2 Nov → Thursday 26 Nov 2026 ─────────────────────────────────────────────────────
const PATTERN = "LL.LLLr.LLL.LLr.LLL.LLrLLLT";   // L lit · r the week's rest day · T today · . nothing that day
const dayOf = (i) => `2026-11-${String(i + 2).padStart(2, "0")}`;
const isWeekend = (i) => i % 7 >= 5;
function logDays(weekdaysOnly) {
  return PATTERN.slice(0, 25).split("").map((c, i) => {
    if (c === "T") return { day: dayOf(i), s: "today" };
    if (weekdaysOnly && isWeekend(i)) return { day: dayOf(i), s: "off" };
    return { day: dayOf(i), s: c === "L" ? "lit" : c === "r" ? "rest" : null };
  });
}
const WHAT_LIT = { lit: "A check passed on Webhooks · +40 points", rest: "The week's rest day — it doesn't break your streak", off: "A weekend — not counted (weekdays only is on)",
  today: "Today — nothing proven yet. One real thing lights it.", none: "Nothing proven that day." };
const QUESTS = [
  { id: "explain", title: "Explain idempotency in your own words", detail: "Systems & networks · Webhooks", pts: "+30 points", done: false, href: "#entry-idempotency" },
  { id: "prove", title: "Check Kafka · 1 minute", detail: "On your résumé, not yet checked", pts: "+40 points", done: false, href: "#check-kafka" },
  { id: "today", title: "Today's question", detail: "About two minutes", pts: "about 2 min", done: true, href: "#today" },
];
const PRACTICE = [
  { id: "1", skill: "Webhooks", right: "7 of 9 right", last: "LAST 20" },
  { id: "2", skill: "Hash maps", right: "11 of 12 right", last: "LAST 20" },
  { id: "3", skill: "SQL joins", right: "3 of 6 right", last: "LAST 20" },
];
const STANDINGS = [
  { id: "1", place: "1", handle: "quietfox", move: "▲ 2", points: "410" },
  { id: "2", place: "2", handle: "maya.c (you)", move: "–", points: "340", you: true },
  { id: "3", place: "3", handle: "lighthouse", move: "▼ 1", points: "320" },
  { id: "4", place: "4", handle: "bytebarn", move: "▲ 1", points: "210" },
  { id: "5", place: "5", handle: "northpaw", move: "–", points: "140" },
];
const FEED = [["quietfox", "checked PostgreSQL", "+40"], ["lighthouse", "explained consistent hashing in their own words", "+30"], ["bytebarn", "linked a build: a rate limiter", "+60"]];

function LogbookSections({ compete }) {
  const [weekdays, setWeekdays] = useState(false);
  const [picked, setPicked] = useState(null);
  const [mode, setMode] = useState("timed");
  const days = logDays(weekdays);
  const lit = days.filter((d) => d.s === "lit").length;
  return (
    <>
      <section className="pl-section" aria-labelledby="lb-1" id="logbook">
        <LegHeader n={1} meta="THE LOGBOOK · POINTS COME ONLY FROM PROOF" title="Level 2: Building blocks" id="lb-1"/>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
          <CompassDial lit={6} total={10} label="Level 2: 340 of 530 points to Level 3 — six of ten ticks lit"/>
          <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <p className="pl-lead" style={{ margin: 0 }}>340 of 530 points to Level 3</p>
            <StatsStrip label="Your run" cells={[{ value: 4, label: "DAY STREAK", onClick: () => setPicked(days.length - 2) }, { value: 9, label: "BEST", onClick: () => {} },
              { value: "+60", label: "THIS WEEK", href: "#waypoints" }, { value: 340, label: "POINTS" }]}/>
            <p className="pl-label pl-muted" style={{ margin: 0 }}>AN IDEA EXPLAINED IN YOUR OWN WORDS, A BUILD, A SKILL CHECKED OR BUILT</p>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 28, marginTop: 26, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="pl-label">LIT DAYS · NOVEMBER</span>
            {/* the operable model: a day says what lit it */}
            <LogbookDays days={days} label={`Your run: ${lit} of the last ${days.length} days lit`} onPick={setPicked} picked={picked}/>
            <label style={{ display: "inline-flex", gap: 10, alignItems: "center", minHeight: 44 }}>
              <input type="checkbox" className="pl-check" checked={weekdays} onChange={(e) => setWeekdays(e.target.checked)}/> Weekdays only — weekends never break it
            </label>
          </div>
          <div style={{ flex: "1 1 280px", minWidth: 0, maxWidth: 420, display: "flex", flexDirection: "column", gap: 10 }}>
            <p className="pl-body" aria-live="polite" style={{ margin: 0 }}>
              <b>{picked == null ? "Tap a day" : days[picked]?.day}</b>{" — "}{picked == null ? "to see what lit it." : WHAT_LIT[days[picked]?.s || "none"]}
            </p>
            <p className="pl-muted" style={{ margin: 0, fontSize: "var(--pl-t-meta)" }}>One real thing a day: a check passed, an idea explained in your own words, today's question answered, or something you built and linked. One rest day a week doesn't break your streak.</p>
          </div>
        </div>
      </section>

      <section className="pl-section" aria-labelledby="lb-2" id="waypoints">
        <LegHeader n={2} meta="TODAY · ABOUT 3 MINUTES" title="Waypoints" id="lb-2"/>
        <RouteLine label="Today's waypoints" stops={QUESTS.map((q, i) => ({ name: q.title, state: q.done ? "lit" : i === 0 ? "next" : "ahead", stage: "build" }))}/>
        <div className="pl-tickets">
          {QUESTS.map((q, i) => (
            <Ticket key={q.id} kicker={q.done ? "✓ DONE TODAY" : i === 0 ? `NEXT WAYPOINT · ${q.pts.toUpperCase()}` : q.pts.toUpperCase()} title={q.title} line={q.detail}
              go={q.done ? null : "Start →"} href={q.done ? undefined : q.href} tone={!q.done && i === 0 ? "clay" : "plain"}/>
          ))}
        </div>
      </section>

      <section className="pl-section" aria-labelledby="lb-3">
        <LegHeader n={3} meta="A STAMP WHEN A ROUTE IS COMPLETE · LATER ON YOUR PASSPORT" title="Stamps" id="lb-3"/>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center" }}>
          <Stamp tone="lit" rotate={-6}>ROUTE COMPLETE · I · FOUNDATIONS</Stamp>
          <Stamp tone="lit" rotate={4}>ROUTE COMPLETE · HASH MAPS, ACTED OUT</Stamp>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="pl-label pl-muted">NEXT · IV · SYSTEMS &amp; NETWORKS · 4 OF 15</span>
            <LitSquares squares={Array.from({ length: 15 }, (_, i) => (i < 4 ? "lit" : null))} size={12} label="Systems and networks: 4 of 15 places lit"/>
          </div>
        </div>
      </section>

      <section className="pl-section" aria-labelledby="lb-4">
        <LegHeader n={4} meta="THREE OR MORE ANSWERS · THE LAST 20 · NO CURVE" title="Practice by skill" id="lb-4"/>
        <Gazetteer label="Practice by skill" cols={[{ key: "skill", label: "SKILL", kind: "title" }, { key: "right", label: "RIGHT" }, { key: "last", label: "OF" }]} rows={PRACTICE}/>
        <p className="pl-muted" style={{ fontSize: "var(--pl-t-meta)" }}>Your level rises when you prove a skill with a quick check or something you built — answering more never raises it.</p>
      </section>

      {compete ? (
        <>
          <section className="pl-section" aria-labelledby="lb-5" id="standings">
            <LegHeader n={5} meta="COMPETE · OPT-IN · A HANDLE IS ALL ANYONE SEES · RESETS IN 4 DAYS" title="Standings" id="lb-5"/>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
              <div style={{ flex: "999 1 480px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <Kickers parts={["NORTHEASTERN · SOFTWARE", "POD OF 18", "12 PRACTISING NOW"]}/>
                <Gazetteer label="This week's league" cols={[{ key: "place", label: "#" }, { key: "handle", label: "HANDLE", kind: "title" }, { key: "move", label: "SINCE YESTERDAY" }, { key: "points", label: "POINTS" }]}
                  rows={STANDINGS} rowProps={(r) => (r.you ? { "aria-current": "true", style: { background: "var(--pl-region-tint)" } } : {})}/>
                <p className="pl-muted" style={{ margin: 0, fontSize: "var(--pl-t-meta)" }}>The line sits under place 3: everyone above it moves up to Gold on Monday.</p>
                <p className="pl-body" style={{ margin: 0 }}><b>70 points to first.</b> One check closes most of it.</p>
                <ul className="pl-body" style={{ margin: 0, paddingLeft: 18 }} aria-label="Proof in your pod">
                  {FEED.map(([h, w, p]) => <li key={h}><b>{h}</b> {w} <span className="pl-label pl-tone-lit">{p}</span></li>)}
                </ul>
                <div className="pl-actions"><button type="button" className="pl-btn">Leave the league</button></div>
              </div>
              <div style={{ flex: "1 1 240px", minWidth: 0, maxWidth: 340, display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
                <Stamp tone="ink" rotate={-5}>SILVER TIER</Stamp>
                <DrawingToCome what="The pod's summit cairn: this week's top three on the ledge, you a step below" aspect="1 / 1" note="OPTIONAL · THE GAZETTEER CARRIES THE DATA"/>
              </div>
            </div>
          </section>

          <section className="pl-section" aria-labelledby="lb-6" id="challenges">
            <LegHeader n={6} meta="COMPETE · TIMED RUNS OVER A ROUTE · THEY EARN NO POINTS" title="Runs" id="lb-6"/>
            <FilterChips label="Time" chips={[{ id: "timed", label: "Timed" }, { id: "extended", label: "Extended time" }, { id: "untimed", label: "Untimed" }].map((c) => ({ ...c, on: c.id === mode }))}
              onToggle={setMode}/>
            <div style={{ marginTop: 18 }}>
              <span className="pl-label pl-muted">THE ROUTE THIS RUN GOES OVER · FRONTEND ENGINEER</span>
              <RouteLine label="The run's route" stops={[{ name: "HTTP", state: "lit", stage: "start" }, { name: "Webhooks", state: "lit", stage: "build" },
                { name: "Caching", state: "ahead", stage: "build" }, { name: "Rendering", state: "ahead", stage: "deepen" }, { name: "Accessibility", state: "ahead", stage: "master" }]}/>
            </div>
            <div className="pl-tickets">
              <Ticket kicker="BEAT THE BAR · A ROUTE'S 3-MINUTE AUDIT" title="Beat the bar" line="Your score: 5 of 6 on Frontend Engineer · the link shows the score and the route, nothing about you." go="Share the score →" href="#share"/>
              <Ticket kicker="TIME ATTACK · 5 QUESTIONS · 20 SECONDS EACH" title="Time attack" line="Your best this week: 4 of 5 (timed)." go="Start the run →" href="#run"/>
              <Ticket kicker="FRIDAY DUEL · YOUR POD" title="Friday duel" line="The same five questions as everyone in your pod this week. Opens on Friday." go="Opens Friday" href="#duel"/>
            </div>
          </section>
        </>
      ) : (
        <p className="pl-section pl-label pl-muted">COMPETE IS OFF — STANDINGS AND RUNS ARE NOT DRAWN.</p>
      )}

      <section className="pl-section pl-section--last" aria-labelledby="lb-7">
        <LegHeader n={compete ? 7 : 5} meta="ONWARD" title="Where this proof goes" id="lb-7"/>
        <div className="pl-tickets">
          <Ticket kicker="YOUR SURVEY · 3 PROVEN" title="3 proven skills aren't on your résumé" line="Add Webhooks, Hash maps and PostgreSQL — 41 open jobs in your role ask for Webhooks." go="Add them on Your survey →" href="#survey"/>
          <Ticket kicker="YOUR PASSPORT · /IN/MAYA-CHEN-SAMPLE" title="What you've proven, with dates" line="Your public profile lists it; link it from an application." go="Open your profile →" href="#passport"/>
        </div>
      </section>
    </>
  );
}

export default function LogbookMock({ width = 1280 }) {
  const phone = width < 600;
  const compete = typeof window === "undefined" || new URLSearchParams(window.location.search).get("compete") !== "0";
  const views = [
    { id: "map", label: "Your map", href: "#map", icon: "map" }, { id: "gazetteer", label: "Gazetteer", href: "#gz", icon: "list" },
    { id: "routes", label: "Routes", href: "#routes", icon: "next" }, { id: "library", label: "Library", href: "#lib", icon: "library" },
    { id: "survey", label: "Your survey", href: "#survey", icon: "progress" },
  ];
  const run = logDays(false).slice(-4).map((d) => (d.s === "lit" ? "lit" : d.s === "today" ? "today" : null));
  const nav = (
    <AreaNav area="Atlas" pill={{ tag: "VOL. I", name: "Computing", panel: <p className="pl-body" style={{ padding: 14, margin: 0 }}>The volumes panel (Wave 1 #5).</p> }}
      views={views} current="map" phone={phone} home={{ href: "#home", label: "draft — the market" }}
      search={{ placeholder: "Make sense of…", onOpen: () => {} }} chip={{ kind: "run", days: [...run, null, null, null].slice(0, 7), href: "#logbook", label: "Your run: 3 of 7 days lit this week" }}/>
  );
  const body = (
    <div style={{ paddingBottom: phone ? 96 : 0 }}>
      <section className="pl-hero" aria-label="Your map">
        <div className="pl-hero__main">
          <Kickers parts={["MOCK · D197 WAVE 2 #11", "EXAMPLE DATA", "NOTHING HERE IS LIVE"]}/>
          <LegHeader meta="ATLAS · YOUR MAP · WEEK 48" title="Your map" level={1}/>
          <p className="pl-label pl-muted" style={{ margin: 0 }}>YOUR SURVEY'S KEPT SKILL MAP SITS ABOVE THIS (WAVE 1) — NOT DRAWN IN THIS MOCK</p>
        </div>
      </section>
      <LogbookSections compete={compete}/>
    </div>
  );
  const dock = DOCK_ITEMS.map((d) => ({ ...d, href: "#" }));
  return (
    <PlateRoot region="IV" style={{ minHeight: "100vh" }} data-plate-page="logbook">
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
