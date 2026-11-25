// ⭐ D197 Wave 1 #3 / #4 (47h) · the F5 build side for the ledger and the survey sheet — each fixture runs the page's own
// component on the final boards' example data (docs/sketches/final/project/Ledger.dc.html, Survey.dc.html), shaped as the
// API returns it, so the diff checks the real mapping (plate/surveySheet.js, plate/ledgerModel.js) as well as the look.
// A fixture is never tuned to pass (D196 F5): every value below is the board's own.
import { MemoryRouter } from "react-router-dom";
import SurveySheet from "./SurveySheet.jsx";
import { LedgerPage, LedgerHeader, LedgerRun, LedgerNeeds, LedgerRegister, LedgerBanner, LedgerTickets } from "./Ledger.jsx";
import { QuestionTicket } from "./Tickets.jsx";
import { Register } from "./Lists.jsx";
import { FilterChips } from "./Marks.jsx";
import { runStops, countCells, ledgerTickets } from "./ledgerModel.js";

const DAY = 86400;
const now = Math.floor(Date.now() / 1000);
const tech = (t, postings, teams, extra = {}) => ({ tech: t, postings, of: 38, teams, firstSeen: now - 300 * DAY, lastSeen: now - 2 * DAY, newThisQuarter: false, ...extra });
const fresh = { newThisQuarter: true, firstSeen: now - 40 * DAY };

/** Kestrel Payments, as GET /api/public/companies/kestrel-payments?job=… would answer for the board's page. */
export const KESTREL_PAGE = Object.freeze({
  company: { slug: "kestrel-payments", name: "Kestrel Payments", domain: "kestrelpayments.example", ats: "Greenhouse", careersUrl: "https://boards.greenhouse.io/kestrel", parent: null, subsidiaries: [] },
  openJobs: 38,
  byCategory: [
    { id: "software", name: "Software engineering", count: 20, subcategories: [{ id: "software.backend", name: "Backend", count: 12 }, { id: "software.frontend", name: "Frontend", count: 5 }, { id: "software.security", name: "Security", count: 3 }] },
    { id: "data", name: "Data and AI", count: 6, subcategories: [{ id: "data.engineering", name: "Data engineering", count: 6 }] },
    { id: "product", name: "Product", count: 4, subcategories: [{ id: "product.management", name: "Product", count: 4 }] },
    { id: "infra", name: "Infrastructure", count: 4, subcategories: [{ id: "infra.sre", name: "SRE", count: 4 }] },
    { id: "business", name: "Business", count: 4, subcategories: [{ id: "business.sales", name: "Sales", count: 4 }] },
  ],
  locations: [{ location: "Boston, MA", count: 24 }, { location: "Remote (US)", count: 14 }],
  hiringTrend: [["2026-06", 14], ["2026-07", 19], ["2026-08", 22], ["2026-09", 27], ["2026-10", 31], ["2026-11", 38]].map(([month, postings]) => ({ month, postings })),
  stack: { ofPostings: 38, groups: {
    languages: [tech("Go", 21, ["Platform", "Backend"]), tech("TypeScript", 9, ["Checkout", "Frontend"]), tech("Python", 14, ["Data"])],
    frameworks: [tech("React", 8, ["Checkout"]), tech("Next.js", 5, ["Checkout"]), tech("Datadog RUM", 4, ["Checkout"], { ...fresh, atlasSlug: "datadog-rum" })],
    data: [tech("PostgreSQL", 18, ["Backend", "Data"]), tech("Kafka", 12, ["Backend", "Data"], { ...fresh, atlasSlug: "kafka" })],
    cloud: [tech("AWS", 24, ["Platform", "Backend", "Data", "Checkout"])],
  } },
  sponsorship: { text: "Filed 214 certified LCAs in FY2025", filings: 214, fiscalYear: 2025, wage: { medianUsd: 152000, cases: 214, fiscalYear: 2025 },
    uscis: { approvals: 31, denials: 1, fiscalYear: 2025 },
    source: { name: "U.S. Department of Labor, OFLC LCA disclosure data", url: "https://www.dol.gov/agencies/eta/foreign-labor/performance", through: "FY2026 Q1" },
    parts: [{ kind: "uscis", source: { name: "USCIS H-1B Employer Data Hub", url: "https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub" } }],
    note: "A record of the employer's past filings — not a promise to sponsor you." },
  jobs: [
    { id: 1, jobId: "kp-fe2", title: "Frontend Engineer II, Checkout", location: "Boston, hybrid", postedAt: new Date(Date.now() - 2 * 3600e3).toISOString(), subcategory: "software.frontend", path: "/jobs/kestrel-payments/kp-fe2", applyUrl: null },
    { id: 2, jobId: "kp-be3", title: "Senior Backend Engineer, Payouts", location: "Boston, MA", postedAt: null, subcategory: "software.backend", path: "/jobs/kestrel-payments/kp-be3", applyUrl: null },
  ],
  about: { line: "Payment infrastructure for online marketplaces: taking payments, paying out sellers, and the compliance in between.",
    facts: { industry: "Fintech", hq: "Boston, MA", founded: 2016, employees: 750 }, sources: [{ name: "Wikidata (CC0)", url: "https://www.wikidata.org/wiki/Q0" }] },
  github: { org: "kestrel", url: "https://github.com/kestrel", languages: [{ language: "Go", repos: 61 }, { language: "TypeScript", repos: 22 }, { language: "Python", repos: 11 }, { language: "Shell", repos: 6 }] },
  website: null,
  focus: { id: 1, jobId: "kp-fe2", title: "Frontend Engineer II, Checkout", location: "Boston, hybrid", subcategory: "software.frontend", path: "/jobs/kestrel-payments/kp-fe2", applyUrl: null,
    postedAt: new Date(Date.now() - 2 * 3600e3).toISOString() },
});
/** Maya Chen's match (GET /api/companies/kestrel-payments/match): four of the top twelve on her résumé. */
export const KESTREL_MATCH = Object.freeze({ of: 12, proven: [], listed: ["React", "TypeScript", "Next.js", "Python"],
  missing: [{ tech: "Kafka", atlasSlug: "kafka" }, { tech: "Datadog RUM", atlasSlug: "datadog-rum" }, { tech: "Go", atlasSlug: null }], following: false });
const PEOPLE = { count: 1, people: [{ handle: "divya", name: "Divya Rao", title: "Data engineer at Kestrel since 2024." }] };

/** The survey sheet as the board draws it — in the shell, signed in, opened from Kestrel's Frontend Engineer II posting. */
export function SurveyBoard() {
  return (
    <MemoryRouter>
      <div style={{ width: 1182 }}>
        <SurveySheet data={KESTREL_PAGE} match={KESTREL_MATCH} inApp base="/app/companies" resumeName="Maya_Chen.pdf" people={PEOPLE}
          onBack={() => {}} onFollow={() => {}} onSend={() => {}}/>
      </div>
    </MemoryRouter>
  );
}

// ── the ledger: Maya Chen's week 47 (the board's five applications; Sailor Health waits on her answers) ──
// Sailor Health's run as runSteps reports it (lib/heldApplication.js): read, tailored 71 → 80, attached, 22 of 24 filled, you.
const SAILOR_STEPS = [
  { id: "posting", state: "done", meta: "" }, { id: "resume", state: "done", meta: "ATS 71 → 80" }, { id: "attached", state: "done", meta: "Maya_Chen.pdf" },
  { id: "filled", state: "done", meta: "22 of 24" }, { id: "you", state: "now", meta: "" }, { id: "ready", state: "", meta: "" }, { id: "sent", state: "", meta: "" },
];
const LEDGER_APPS = [
  { id: "sailor", company: "Sailor Health", role: "Frontend Engineer", region: "VI", steps: ["d", "d", "d", "u", "y", "-"], where: "Filled 22 of 24 · 2 answers left", status: "NEEDS YOU", action: { label: "Cancel" } },
  { id: "brightline", company: "Brightline Health", role: "Software Engineer, Design Systems", region: "V", steps: ["d", "d", "d", "d", "d", "d"], where: "Sent Nov 21 · confirmation captured", status: "SENT", action: { label: "View" } },
  { id: "orbital", company: "Orbital Works", role: "Web Engineer, Growth", region: "VII", steps: ["d", "d", "d", "d", "d", "d"], where: "Sent Nov 22 · confirmation captured", status: "SENT", action: { label: "View" } },
  { id: "kestrel", company: "Kestrel Payments", role: "Frontend Engineer II, Checkout", region: "IV", steps: ["d", "d", "u", "-", "-", "-"], where: "Tailoring now · 1 min", status: "IN PROGRESS", action: { label: "Cancel" } },
  { id: "clera", company: "Clera", role: "Frontend Engineer", region: "VIII", steps: ["d", "d", "-", "-", "-", "-"], where: "Held: the form couldn’t be read — fixed since", status: "HELD · FIXED", action: { label: "Re-run · free" } },
];
const FILLED = [["Name", "Maya Chen"], ["Email", "maya.chen@example.com"], ["Current company", "Toast"], ["Current role", "Software Engineer II"], ["Alma mater", "Northeastern University"], ["LinkedIn", "/in/maya-chen-sample"]];

/** Home as the ledger board draws it (D200 Rule 3's one-line header in place of the board's title). */
export function LedgerBoard() {
  const counts = { needs: 1, progress: 2, sent: 2, replied: 0, interview: 0 };
  const tickets = ledgerTickets({ newToday: 179, best: { match: "91%", company: "Kestrel Payments" }, front: { company: "Sailor Health" }, sent: 2,
    sentCompanies: ["Brightline Health", "Orbital Works"], gap: { tech: "Webhooks", company: "Sailor Health", href: "#atlas" },
    paths: { market: "#market", interview: "#interview", company: () => "#survey" } });
  return (
    <div style={{ width: 1182 }}>
      <LedgerPage>
        <LedgerHeader week={47} summary="5 this month" cells={countCells(counts, { filter: "all", onFilter: () => {} })}
          actions={<><a className="pl-lg-daily" href="#q">Today’s question · 2 minutes</a><span className="pl-grow"/><button type="button" className="pl-btn">Import</button>
            <button type="button" className="pl-btn">Export</button><button type="button" className="pl-btn pl-btn--ink">Send all ready (0)</button></>}
          run={<LedgerRun stops={runStops(SAILOR_STEPS, { answers: 2 })} kicker="THE RUN · SAILOR HEALTH · FRONTEND ENGINEER" onOpen={() => {}}
            runNow={{ kicker: "APPLY FOR ME · 2 OF 10 SENT TODAY · NEXT 6:30 PM", line: "3 of 10 new drafts left today · re-runs are free", onClick: () => {} }}
            worker={{ state: "running", line: "Running · 2 of 10 today", sub: "If it stops, this turns red and drafts say so." }}/>}/>
        <LedgerNeeds meta="NEEDS YOU · SAILOR HEALTH · FRONTEND ENGINEER" title="Two answers only you can give"
          lead="Everything else is filled. One question at a time; each one goes away once you’ve answered it."
          ask={<QuestionTicket kicker="ONLY YOU CAN ANSWER THIS" n="QUESTION 1 OF 4" text="Are you legally authorized to work in the country of employment?" kind="yesno"
            options={["Yes", "No"]} pressed={null} progress={["today", null, null, null]} saved onSaved={() => {}} onAnswer={() => {}} onBack={() => {}}
            more={<><button type="button" className="pl-q-link">Ask draft</button><span aria-hidden="true"> · </span><button type="button" className="pl-q-link">See all 4</button></>}/>}
          filled={{ kicker: "FILLED FOR YOU · 22 OF 24", label: "What draft filled for you", foot: "From your résumé and profile. Nothing here is guessed.", rows: FILLED.map(([label, value]) => ({ label, value })) }}/>
        <LedgerRegister count={5} lead="Each line says what really happened. Re-running a draft is free; cancelling one gives the day’s credit back."
          banner={<LedgerBanner action={<button type="button" className="pl-btn pl-btn--ink">Re-run all 3</button>}>
            <b>3 drafts were held by a problem we’ve fixed.</b> Re-run them with the fix, free.{" "}<button type="button" className="pl-q-link pl-lg-notnow">Not now</button></LedgerBanner>}
          controls={<div className="pl-lg-controls"><FilterChips label="Show" chips={[{ id: "apps", label: "Applications", count: 5, on: true }, { id: "inbox", label: "Inbox", count: 0 }]}/></div>}
          register={<Register label="Your applications" rows={LEDGER_APPS} onRowOpen={() => {}} barExtra={<select className="pl-register__sort" aria-label="Sort the register" defaultValue="status:asc"><option value="status:asc">Sort · status</option></select>}/>}/>
        <LedgerTickets tickets={tickets}/>
      </LedgerPage>
    </div>
  );
}

export const SHEET_FIXTURES = { SurveyBoard, LedgerBoard };
