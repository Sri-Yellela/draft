// ⭐ D196 F5 (47m, lane practice) · the regression run's build side for the practice pages — the LIVE components drawn on
// the approved boards' example data (docs/sketches/final/project/ProvingGround.dc.html, AskRoute.dc.html): the Proving
// ground's Coming up (pages/interview/ProvingGround.jsx ComingUp, Kestrel · coding tomorrow, Northwind · system design) and
// Ask draft's route card (plate/AskRouteMap.jsx: HTTP lit, retries, idempotency the waypoint). Fixtures only, never the app.
import { MemoryRouter } from "react-router-dom";
import PlateRoot from "./PlateRoot.jsx";
import { AskRouteCard } from "./AskRouteMap.jsx";
import { ComingUp } from "../pages/interview/ProvingGround.jsx";

const PG_UP = { status: "ready", error: "", data: { interviews: [
  { applicationId: 1, company: "Kestrel", title: "Coding", kind: "interview", daysLeft: 1, date: { ymd: "FRI 11-27", time: "2:00 PM" }, subject: "45 min · two problems, one on hash maps" },
  { applicationId: 2, company: "Northwind", title: "System design", kind: "interview", daysLeft: 4, date: { ymd: "MON 11-30", time: "11:00 AM" }, subject: "60 min · a design round with the platform team" },
] } };

/** The board's Coming up: the week, two interviews ahead, 38 in the bank, 6 stories, 3 debriefs (#ox/#oy: its fraction). */
export function ProvingGroundBoard() {
  return (
    <MemoryRouter>
      <PlateRoot region="VI" className="pl-iv" data-plate-page="interview">
        <ComingUp up={PG_UP} reload={() => {}} counts={{ questions: 38, stories: 6, debriefs: 3 }} onView={() => {}}/>
      </PlateRoot>
    </MemoryRouter>
  );
}

/** The board's route card, in the card's 430 px column. */
export function AskRouteBoard() {
  const stops = [
    { slug: "http", name: "HTTP", href: "#http", lit: true },
    { slug: "retries", name: "retries", href: "#retries", lit: false },
    { slug: "idempotency", name: "idempotency", href: "#idempotency", lit: false },
  ];
  return (
    <PlateRoot region="IV"><div style={{ width: 402, padding: 14 }}><AskRouteCard stops={stops}/></div></PlateRoot>
  );
}

export const PRACTICE_FIXTURES = { ProvingGroundBoard, AskRouteBoard };
