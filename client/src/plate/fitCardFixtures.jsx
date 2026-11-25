// ⭐ D202 / D199 C7 · the F5 fixtures for the card lane — the ATSCard and Opening boards' example data, composed with the real
// components (FitCard, OpeningSheet) so scripts/d196Regress.mjs diffs the build against the boards. The fixture keeps the
// board's data; a failing diff is fixed in the component (D196 F5). Joined into fixtures.jsx's FIXTURES.
import { MemoryRouter } from "react-router-dom";
import PlateRoot from "./PlateRoot.jsx";
import FitCard from "./FitCard.jsx";
import { OpeningSheetView } from "./OpeningSheet.jsx";

// The board's 38 words (ATSCard.dc.html `this.W`), as the scorer's report carries them: skills (tier1), duties as the
// posting's verbs, level / years / education as qualities (competencies) — the board's own order inside each group.
const ON = [
  ["React", "Toast · bullet 1"], ["TypeScript", "Toast · bullet 1"], ["JavaScript", "Skills"], ["Next.js", "Toast · bullet 2"], ["GraphQL", "HubSpot · bullet 1"],
  ["HTML & CSS", "Skills"], ["Node.js", "HubSpot · bullet 3"], ["SQL", "Skills"],
  ["Playwright", "Toast · bullet 3"], ["Jest", "Skills"], ["Storybook", "HubSpot · bullet 2"], ["Webpack", "Skills"], ["GitHub Actions", "Toast · bullet 4"], ["Git", "Skills"],
  ["Conversion rates", "Toast · bullet 2"],
];
const MISS = ["Vue", "Rust (WebAssembly)", "Vite", "Datadog RUM", "LaunchDarkly", "AWS", "Payments", "Marketplaces", "PCI compliance"];
const DUTIES_ON = [["Rebuild the checkout", "Toast · bullet 2"], ["Improve Core Web Vitals", "Toast · bullet 2"], ["WCAG 2.1 AA accessibility", "HubSpot · bullet 4"],
  ["Design-system components", "HubSpot · bullet 2"], ["Server-side rendering", "Toast · bullet 2"], ["Performance budgets", "Toast · bullet 5"]];
const DUTIES_MISS = ["Run A/B experiments", "Mentor other engineers"];
const LEVEL_ON = [["3+ years with React", "4 years · Toast + HubSpot"], ["Mid level", "Software Engineer II"], ["BS in CS or equivalent", "Northeastern · BS CS"], ["Owns features end to end", "Toast · bullet 1"]];
const LEVEL_MISS = ["On-call rotation", "Led a team"];

export const BOARD_FIT = Object.freeze({
  score: 66, profileId: null,
  report: {
    score: 66, claimed_matches: [],
    tier1_matched: ON.map(([t]) => t), tier1_missing: MISS,
    action_verbs_matched: DUTIES_ON.map(([t]) => t), action_verbs_missing: DUTIES_MISS,
    competencies_matched: LEVEL_ON.map(([t]) => t), competencies_missing: LEVEL_MISS,
    action_verbs_generic: [],
  },
  where: Object.fromEntries([...ON, ...DUTIES_ON, ...LEVEL_ON]),
  contextual: {
    score: 87, weights: { skill_match: 0.5, role_fit: 0.2, responsibility_overlap: 0.15, tech_stack: 0.15 },
    parts: {
      skill_match: { status: "ok", score: 86, weight: 0.5 },
      role_fit: { status: "ok", score: 91, weight: 0.2, relation: "same_role", level_gap: 0, posting: { subcategory: "software-engineering.frontend", level: "mid" }, resume: { subcategory: "software-engineering.frontend", level: "mid" } },
      tech_stack: { status: "ok", score: 88, weight: 0.15, of: 9, exact: [{ tech: "React", postings: 8, of: 9 }, { tech: "Next.js", postings: 5, of: 9 }],
        ecosystem: [{ yours: "Webpack", theirs: "Vite", family: "bundler" }], gaps: [{ tech: "Datadog RUM", postings: 4, of: 9 }] },
      responsibility_overlap: { status: "ok", score: 80, weight: 0.15, matched: [], missing: [] },
    },
    similarities: { role: ["same_role"], domains: ["conversion (checkout)"], ecosystem: [{ yours: "Playwright", theirs: "Playwright" }], responsibilities: [] },
    dissimilarities: [{ kind: "domain", theirs: "payments", yours: ["restaurants"] }],
  },
  resumeTech: ["Storybook"],
});
const BOARD_FRONT = {
  alike: ["Role and level: frontend, mid — the same as yours", "Duties: “rebuild the checkout” ≈ your Toast rebuild"],
  gaps: [{ text: "They watch the front end with Datadog RUM.", link: { label: "Learn it →", href: "#top" } }],
  figures: { label: "ROLE FIT · STACK · DUTIES", value: "91 · 88 · 80", items: [{ label: "ROLE FIT", key: "role", value: 91 }, { label: "STACK", key: "stack", value: 88 }, { label: "DUTIES", key: "duties", value: 80 }] },
};
const BOARD_SLUGS = { "Datadog RUM": "datadog-rum" };
const BOARD_PLAUS = { entries: [{ employer: "Toast", status: "all_confirmed", flags: [] }, { employer: "HubSpot", status: "all_confirmed", flags: [] }] };
const BOARD_HIST = [{ label: "First posted", text: "2 hours ago. Not reposted." }, { label: "Your score", text: "went from 61 % to 66 % after you added Playwright on Nov 12." }, { label: "Live check", text: "today: the posting is up." }];

const at = () => { const q = new URLSearchParams((globalThis.location?.hash || "").slice(1)); return { paddingLeft: 24 + (Number(q.get("ox")) || 0), paddingTop: 24 + (Number(q.get("oy")) || 0) }; };   // 24: room for the crop's pad
const card = (face, tab) => function FitCardBoard() {
  return (
    <MemoryRouter><PlateRoot><div data-fit-fixture="" style={{ width: 600, boxSizing: "content-box", ...at() }}>
      <FitCard data={BOARD_FIT} {...BOARD_FRONT} face={face} tab={tab} plausibility={BOARD_PLAUS} historyLines={BOARD_HIST} atlasSlugs={BOARD_SLUGS} company="Kestrel Payments"/>
    </div></PlateRoot></MemoryRouter>
  );
};

/** The Opening board's sheet, at its 1180 px column — the same example data (Kestrel's Frontend Engineer II). */
export const BOARD_OPENING = Object.freeze({
  job: { jobId: "board-1", title: "Frontend Engineer II, Checkout", company: "Kestrel Payments", location: "Boston, MA · Hybrid", salary: "$150k–$180k",
    type: "Full-time", level: "Mid", postedWords: "POSTED 2 H AGO", liveWords: "LIVE · CHECKED TODAY", sector: "SOFTWARE ENG. › FRONTEND",
    companyHref: "#survey", match: 91, applyUrl: "#top",
    description: "About the team\nCheckout is the last thing a buyer sees before they pay. The team owns it end to end: the page, its speed, and its accessibility.\nWhat you’ll do\nRebuild checkout flows in React and Next.js with server rendering.\nImprove Core Web Vitals across every marketplace that uses Kestrel.\nWork with design on the components checkout shares.\nWhat you bring\n3+ years of React and TypeScript in production.\nA habit of testing: unit tests and end-to-end checks.\nNice to have\nPayments experience. Front-end monitoring such as Datadog RUM." },
});

export const FIT_FIXTURES = {
  FitCardFront: card("front", "words"), FitCardWords: card("back", "words"), FitCardContext: card("back", "context"),
  FitCardClaim: card("back", "claim"), FitCardHistory: card("back", "hist"),
  OpeningSheetBoard: function OpeningSheetBoard() {
    return <MemoryRouter><div style={{ width: 1180, ...at() }}><OpeningSheetView data={BOARD_OPENING} fit={BOARD_FIT} fitFront={BOARD_FRONT} fitPlausibility={BOARD_PLAUS} still/></div></MemoryRouter>;
  },
};
