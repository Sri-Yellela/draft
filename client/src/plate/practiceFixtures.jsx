// ⭐ D196 F5 (47m, lane practice) · the regression run's build side for the practice pages — the LIVE components drawn on
// the approved boards' example data (docs/sketches/final/project/ProvingGround.dc.html, AskRoute.dc.html): the Proving
// ground's Coming up (pages/interview/ProvingGround.jsx ComingUp, Kestrel · coding tomorrow, Northwind · system design) and
// Ask draft's route card (plate/RouteMap.jsx: HTTP lit, retries, idempotency the waypoint). Fixtures only, never the app.
import { MemoryRouter } from "react-router-dom";
import PlateRoot from "./PlateRoot.jsx";
import { AskRouteCard } from "./RouteMap.jsx";
import { ComingUp } from "../pages/interview/ProvingGround.jsx";

const PG_UP = { status: "ready", error: "", data: { interviews: [
  { applicationId: 1, company: "Kestrel", title: "Coding", kind: "interview", daysLeft: 1, date: { ymd: "FRI 11-27", time: "2:00 PM" }, subject: "45 min · two problems, one on hash maps (from your debrief notes)" },
  { applicationId: 2, company: "Northwind", title: "System design", kind: "interview", daysLeft: 4, date: { ymd: "MON 11-30", time: "11:00 AM" }, subject: "60 min · a design round with the platform team" },
] } };

/** The board's Coming up: the week, two interviews ahead, 38 in the bank, 6 stories, 3 debriefs (#ox/#oy: its fraction). */
export function ProvingGroundBoard() {
  return (
    <MemoryRouter>
      <PlateRoot region="VI" className="pl-iv" data-plate-page="interview">
        <ComingUp up={PG_UP} reload={() => {}} counts={{ questions: 38, stories: 6, debriefs: 3 }} onView={() => {}} hill={{ lit: 2, you: 2 }}/>
      </PlateRoot>
    </MemoryRouter>
  );
}

/** The board's route card, in the card's 430 px column. */
export function AskRouteBoard() {
  const q = new URLSearchParams((globalThis.location?.hash || "").slice(1));   // the board's sub-pixel offset and width (#ox / #oy / #w)
  const stops = [
    { slug: "http", name: "HTTP", href: "#http", lit: true },
    { slug: "retries", name: "retries", href: "#retries", lit: false },
    { slug: "idempotency", name: "idempotency", href: "#idempotency", lit: false, practice: "its BUILD question, about 4 min" },
  ];
  return (
    <PlateRoot region="IV"><div style={{ width: Number(q.get("w")) || 374, marginLeft: Number(q.get("ox")) || 0, marginTop: Number(q.get("oy")) || 0 }}><AskRouteCard stops={stops} plate="PL. IV"/></div></PlateRoot>
  );
}

export const PRACTICE_FIXTURES = { ProvingGroundBoard, AskRouteBoard };
