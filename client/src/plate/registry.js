// ⭐ D196 F4 · THE GALLERY'S REGISTER — every plate component, in every state, with the sketch's example data
// (Maya Chen, Kestrel / Northwind / Halcyon, the boards' counts: synthetic people and companies, labelled EXAMPLE DATA on
// the canvas). /dev/plate renders this list; test/d196Gallery….test.js holds it to the code in both directions:
//   · every component a plate/*.jsx file exports is here (or the gallery cannot show it);
//   · every entry has the four states R1 asks for — ready, loading, empty, error (+ partial where a part can be missing)
//     and the component runs plateState() — or says why states do not apply (`stateless`);
//   · every entry with data has an `extremes` fixture (R2: 120-character names, no logo, no pay, 0 / 1 / 412 / 10,000).
// Plain data only (no JSX) so a node test can read it; the gallery supplies children and callbacks.

import PILOT_EXPLAINER from "../../../content/explainers/big-o-acted-out/script.json" with { type: "json" };   // D198 E1: the pilot is the gallery's data
const LONG = "Senior Staff Software Engineer, Frontend Platform and Design Systems Infrastructure (Payments, Checkout, Billing and Risk)";   // ≥ 120
const LONG_CO = "The Extremely Long Name Company of Massachusetts Holdings, Incorporated, a Wholly Owned Subsidiary of Another Long Parent";   // ≥ 120

export const LONG_TEXT = LONG;
export const LONG_COMPANY = LONG_CO;
export const LONG_DRAFT = ("Strongest in TypeScript and JavaScript (4 years, daily), with React and Next.js on production checkout flows at Toast. ").repeat(18).slice(0, 2000);

const errors = { state: "error", errorText: "The openings didn't load." };
const four = (ready, emptyText, extra = {}) => ({
  ready, loading: { ...ready, state: "loading" }, empty: { ...ready, state: "empty", emptyText }, error: { ...ready, ...errors }, ...extra,
});

const MARKET_VIEWS = [
  { id: "picks", label: "Today’s picks", href: "#picks", icon: "picks" },
  { id: "all", label: "All jobs", href: "#all", icon: "list" },
  { id: "starred", label: "Starred", href: "#starred", icon: "starred" },
  { id: "imported", label: "Imported", href: "#imported", icon: "imported" },
];
const LEDGER_VIEWS = [
  { id: "needs", label: "Needs you", href: "#needs", icon: "needs" },
  { id: "progress", label: "In progress", href: "#progress", icon: "progress" },
  { id: "sent", label: "Sent", href: "#sent", icon: "sent" },
  { id: "replies", label: "Replies", href: "#replies", icon: "replies" },
];
const ATLAS_VIEWS = [
  { id: "map", label: "Your map", href: "#map", icon: "map" },
  { id: "library", label: "Library", href: "#library", icon: "library" },
  { id: "question", label: "Today’s question", href: "#question", icon: "question" },
  { id: "league", label: "League", href: "#league", icon: "league" },
];
const RUN = ["lit", "lit", "lit", "lit", "today", null, null];
// D197 Wave 2 #16 (47j, w2-public): the signed-out nav's links (Pricing joins only while monetisation is on — the caller's)
const PUBLIC_LINKS = [
  { id: "jobs", label: "Jobs", href: "#jobs" }, { id: "atlas", label: "Atlas", href: "#atlas" },
  { id: "about", label: "About", href: "#about" }, { id: "blog", label: "Blog", href: "#blog" },
];
// 47j (lane w2-practice): Monday 2 Nov → Thursday 26 Nov 2026 — lit days, one rest day a week, today clay (LogbookDays)
const LOG_PATTERN = "LL.LLr.L.LLLr.LLL.Lr.LLLT";
const LOG_DAYS = LOG_PATTERN.split("").map((c, i) => ({ day: `2026-11-${String(i + 2).padStart(2, "0")}`, s: { L: "lit", r: "rest", T: "today" }[c] || null }));
export const DOCK_ITEMS = [
  { id: "auto-apply", label: "Home", href: "#home", icon: "home", badge: 1, badgeLabel: "1 needs you" },
  { id: "atlas", label: "Atlas", href: "#atlas", icon: "atlas" },
  { id: "interview", label: "Interview", href: "#interview", icon: "interview" },
  { id: "network", label: "Network", href: "#network", icon: "network", badge: 3, badgeLabel: "3 unread" },
  { id: "profile", label: "Profile", href: "#profile", initials: "MC", badge: 12, badgeLabel: "12 to finish" },
];

const KESTREL = {
  company: "Kestrel Payments", place: "Boston, MA", title: "Frontend Engineer II, Checkout", match: 91, pay: "$150k–$180k", type: "Full-time", mode: "Hybrid",
  posted: "POSTED 2 H AGO", live: "LIVE · CHECKED TODAY", sponsors: true, sponsorLabel: "FILED H-1B · FY25", region: "IV", companyHref: "#survey",
  stack: [{ name: "React", yours: true }, { name: "TypeScript", yours: true }, { name: "Next.js", yours: true }, { name: "Playwright", yours: true }, { name: "Datadog RUM", yours: false }],
};
const APPS = [
  { id: "s", company: "Sailor Health", role: "Frontend Engineer", region: "VI", steps: ["d", "d", "d", "u", "y", "-"], where: "Filled 22 of 24 · 2 answers left", status: "NEEDS YOU", action: { label: "Cancel" } },
  { id: "b", company: "Brightline Health", role: "Software Engineer, Design Systems", region: "V", steps: ["d", "d", "d", "d", "d", "d"], where: "Sent Nov 21 · confirmation captured", status: "SENT", action: { label: "View" } },
  { id: "o", company: "Orbital Works", role: "Web Engineer, Growth", region: "VII", steps: ["d", "d", "d", "d", "d", "d"], where: "Sent Nov 22 · confirmation captured", status: "SENT", action: { label: "View" } },
  { id: "k", company: "Kestrel Payments", role: "Frontend Engineer II, Checkout", region: "IV", steps: ["d", "d", "u", "-", "-", "-"], where: "Tailoring now · 1 min", status: "IN PROGRESS", action: { label: "Cancel" } },
  { id: "c", company: "Clera", role: "Frontend Engineer", region: "VIII", steps: ["d", "d", "-", "-", "-", "-"], where: "Held: the form couldn’t be read — fixed since", status: "HELD · FIXED", action: { label: "Re-run · free" } },
];
const manyApps = (n) => Array.from({ length: n }, (_, i) => ({ ...APPS[i % APPS.length], id: `x${i}`, company: i % 7 === 3 ? LONG_CO : `${APPS[i % APPS.length].company} ${i + 1}` }));
const INDEX_COLS = [
  { key: "n", label: "#", kind: "num" }, { key: "title", label: "OPENING", kind: "title" }, { key: "company", label: "COMPANY" },
  { key: "match", label: "MATCH", kind: "serif" }, { key: "stack", label: "STACK · YOURS", kind: "mono" }, { key: "sponsor", label: "H-1B", kind: "mono" }, { key: "status", label: "STATUS", kind: "status" },
];
const INDEX_ROWS = [
  ["1", "Frontend Engineer II, Checkout", "Kestrel Payments", "91%", "5 / 5 · 4 ✓", "FILED", "NEW"],
  ["2", "Software Engineer, Frontend (Dashboards)", "Northwind Analytics", "86%", "4 / 4 · 3 ✓", "—", "NEW"],
  ["3", "UI Engineer, Fleet Console", "Halcyon Robotics", "79%", "4 / 4 · 2 ✓", "FILED", "NEW"],
  ["4", "Software Engineer, Design Systems", "Brightline Health", "77%", "6 / 6 · 4 ✓", "FILED", "DRAFTED"],
  ["5", "Frontend Engineer", "Sailor Health", "74%", "5 / 5 · 3 ✓", "FILED", "NEEDS YOU"],
  ["6", "Web Engineer, Growth", "Orbital Works", "71%", "4 / 4 · 2 ✓", "—", "SENT"],
].map(([n, title, company, match, stack, sponsor, status]) => ({ id: n, n, title, company, match, stack, sponsor, status, href: `#opening-${n}` }));

/** name → { file, group, states, extremes?, stateless? }. Order = the gallery's order. */
// D202: a small fit-card read (the scorer's report, the contextual block, where the found words sit) — the gallery's FitCard
const FIT_SAMPLE = { score: 66, profileId: null, resumeTech: ["Storybook"],
  report: { score: 66, claimed_matches: [], tier1_matched: ["React", "TypeScript", "Playwright"], tier1_missing: ["Vue", "Datadog RUM"],
    action_verbs_matched: ["Rebuild the checkout"], action_verbs_missing: ["Run A/B experiments"], competencies_matched: ["Mid level"], competencies_missing: ["Led a team"] },
  where: { React: "Toast · bullet 1", TypeScript: "Toast · bullet 1", Playwright: "Toast · bullet 3", "Rebuild the checkout": "Toast · bullet 2", "Mid level": "Software Engineer II" },
  contextual: { score: 87, weights: { skill_match: 0.5, role_fit: 0.2, responsibility_overlap: 0.15, tech_stack: 0.15 },
    parts: { skill_match: { status: "ok", score: 86, weight: 0.5 }, role_fit: { status: "ok", score: 91, weight: 0.2 }, tech_stack: { status: "ok", score: 88, weight: 0.15, of: 9, exact: [{ tech: "React", postings: 8, of: 9 }], ecosystem: [], gaps: [{ tech: "Datadog RUM", postings: 4, of: 9 }] },
      responsibility_overlap: { status: "ok", score: 80, weight: 0.15, matched: [], missing: [] } }, similarities: {}, dissimilarities: [] } };

export const PLATE_REGISTRY = [
  // ── the shell ──
  { name: "PlateLogo", file: "Shell.jsx", group: "The shell", stateless: "a mark — it has no data", states: { ready: {}, favicon: { size: "favicon" } } },
  { name: "Wordmark", file: "Shell.jsx", group: "The shell", stateless: "a mark — it has no data", states: { ready: {} } },
  { name: "Ruler", file: "Shell.jsx", group: "The shell", stateless: "a rule — it has no data", states: { ready: {}, leg: { size: "leg" }, phone: { size: "phone" } } },
  { name: "Dock", file: "Shell.jsx", group: "The shell",
    states: four({ items: DOCK_ITEMS, ask: { href: "#ask" }, current: "home" }, "No places yet."),
    extremes: { items: DOCK_ITEMS.map((d) => ({ ...d, badge: 10000 })), ask: { href: "#ask" }, current: "atlas" } },
  { name: "Dock", variant: "bar", file: "Shell.jsx", group: "The shell", width: 390,
    states: four({ items: DOCK_ITEMS, current: "home", bar: true }, "No places yet.") },
  { name: "AreaNav", variant: "market", file: "Shell.jsx", group: "The shell",
    states: four({ area: "The market", views: MARKET_VIEWS, current: "picks", more: [{ label: "Companies", href: "#co" }], search: { placeholder: "Company, role, tech…" }, chip: { kind: "drafts", used: 7, of: 10, href: "#ledger" } }, "No views here yet."),
    extremes: { area: "The market", views: MARKET_VIEWS.map((v) => ({ ...v, label: v.label + " and more words" })), current: "all", search: { placeholder: "Company, role, tech…" }, chip: { kind: "drafts", used: 10, of: 10 } } },
  { name: "AreaNav", variant: "ledger", file: "Shell.jsx", group: "The shell",
    states: four({ area: "Ledger", pill: { tag: "LEDGER", name: "Week 47" }, views: LEDGER_VIEWS, current: "needs", more: [{ label: "Archive", href: "#archive" }], search: { placeholder: "Company or role…" }, chip: { kind: "run", days: RUN, href: "#ledger" } }, "No views here yet.") },
  { name: "AreaNav", variant: "atlas", file: "Shell.jsx", group: "The shell",
    states: four({ area: "Atlas", pill: { tag: "VOL. I", name: "Computing" }, views: ATLAS_VIEWS, current: "map", more: [{ label: "Interview prep", href: "#prep" }], search: { placeholder: "Make sense of…" }, chip: { kind: "run", days: RUN } }, "No views here yet.") },
  { name: "AreaNav", variant: "phone", file: "Shell.jsx", group: "The shell", width: 390,
    states: four({ area: "The market", views: MARKET_VIEWS, current: "picks", phone: true }, "No views here yet.") },
  { name: "NavChip", file: "Shell.jsx", group: "The shell", stateless: "drawn inside the area nav, which carries the states",
    states: { ready: { kind: "drafts", used: 7, of: 10 }, run: { kind: "run", days: RUN }, none_left: { kind: "drafts", used: 10, of: 10 } } },
  { name: "NavSearch", file: "Shell.jsx", group: "The shell", stateless: "an input — drawn inside the area nav", states: { ready: { placeholder: "Company, role, tech…" } } },

  // ── marks ──
  { name: "Kickers", file: "Marks.jsx", group: "Marks", stateless: "page print — its words come with the page", states: { ready: { parts: ["THE MARKET · MKT", "BOSTON & REMOTE", "WEEK 47"] } } },
  { name: "LitSquares", file: "Marks.jsx", group: "Marks",
    states: four({ squares: ["lit", "lit", "lit", "lit", null, null, null, null, null, null, null, null, null, null, null], size: 12, label: "4 of 15 lit" }, "No squares to light yet.",
      { partial: { squares: ["lit", "today", "underway", "needs", "ahead"], size: 14, label: "each square state", state: "partial" } }) },
  { name: "Stamp", file: "Marks.jsx", group: "Marks", states: four({ children: "FILED H-1B · FY25" }, "Nothing stamped yet.", { lit: { children: "READY", tone: "lit" }, lit2: { children: "LIT", tone: "lit", rotate: 6 } }) },
  { name: "StatusTag", file: "Marks.jsx", group: "Marks", states: four({ children: "NEEDS YOU" }, "No status yet.", { sent: { children: "SENT" }, held: { children: "HELD · FIXED" }, fresh: { children: "NEW" }, plain: { children: "IN PROGRESS" } }) },
  { name: "LetterTile", file: "Marks.jsx", group: "Marks", states: four({ name: "Kestrel Payments", region: "IV" }, "No company yet.", { small: { name: "Clera", region: "VIII", size: "sm" } }), extremes: { name: LONG_CO, region: "VII" } },
  { name: "StackChip", file: "Marks.jsx", group: "Marks", stateless: "one word — drawn inside an opening", states: { ready: { name: "React", yours: true }, yet: { name: "Datadog RUM", yours: false } } },
  { name: "Breadcrumb", file: "Marks.jsx", group: "Marks",
    states: four({ crumbs: [{ label: "VOL. I", href: "#vol" }, { label: "PL. IV", href: "#iv", region: "IV" }, { label: "D3 · WEBHOOKS" }] }, "Nowhere yet."),
    extremes: { crumbs: [{ label: "VOL. I", href: "#vol" }, { label: "PL. IV", href: "#iv", region: "IV" }, { label: LONG.toUpperCase() }] } },
  { name: "FilterChips", file: "Marks.jsx", group: "Marks",
    states: four({ chips: [{ id: "iv", tag: "IV", region: "IV", label: "Software engineering", count: 412, on: true }, { id: "viii", tag: "VIII", region: "VIII", label: "Data and AI", count: 1 }, { id: "vii", tag: "VII", region: "VII", label: "Project management", count: 0 }] }, "No filters yet."),
    extremes: { chips: [{ id: "a", tag: "IV", region: "IV", label: LONG, count: 10000, on: true }] } },
  // 47h (D197 #4): the final Survey board's legend — a column per group, each technology with its evidence and your square
  // 47j (D197 Wave 2 #11 · M3, lane w2-practice; D203 (1)): the Logbook's lit days — Your run's month grid as a plate piece
  { name: "LogbookDays", file: "Marks.jsx", group: "Marks",
    states: four({ label: "Your run: 15 of the last 25 days lit", days: LOG_DAYS }, "No days yet — prove something today to light the first one.",
      { partial: { state: "partial", label: "Your run: 3 days so far", days: LOG_DAYS.slice(-5) } }),
    extremes: { label: LONG, days: Array.from({ length: 42 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, s: "lit" })) } },
  { name: "Legend", file: "Marks.jsx", group: "Marks",
    states: four({ label: "Kestrel's stack", columns: [{ label: "LANGUAGES", rows: [{ name: "Go", n: 21, of: 38, teams: "Platform, Backend", mark: "not" }, { name: "TypeScript", n: 9, of: 38, teams: "Checkout, Frontend", mark: "yours" }] },
      { label: "DATA & CLOUD", rows: [{ name: "Kafka", n: 12, of: 38, teams: "Backend, Data", mark: "not", isNew: true }] }] }, "No stack found yet.",
      { partial: { label: "Kestrel's stack", state: "partial", columns: [{ label: "LANGUAGES", rows: [{ name: "Go", n: 21, of: 38, mark: null }] }] } }),
    extremes: { label: "Extremes", columns: [{ label: LONG.toUpperCase(), rows: [{ name: LONG, n: 10000, of: 10000, teams: LONG, mark: "yours", isNew: true }, { name: "One", n: 1, of: 10000, mark: "not" }] }] } },

  // ── plates ──
  { name: "PageTitle", file: "Plates.jsx", group: "Plates", stateless: "the page's name — never loading", states: { ready: { children: "The market" } }, extremes: { children: LONG } },
  { name: "TitleBlock", file: "Plates.jsx", group: "Plates", stateless: "composed of StatsStrip, which carries the states",
    states: { ready: { kickers: ["THE LEDGER", "YOUR APPLICATIONS", "WEEK 47"], title: "The ledger", lead: "Every application draft has started for you, and exactly where each one stands. Only what the worker reports gets ticked.",
      stats: { label: "Your applications", cells: [{ value: 1, label: "NEEDS YOU", tone: "clay" }, { value: 2, label: "IN PROGRESS" }, { value: 2, label: "SENT" }, { value: 0, label: "REPLIED" }] } } } },
  { name: "StatsStrip", file: "Plates.jsx", group: "Plates",
    states: four({ label: "This week in your sectors", cells: [{ value: 412, label: "FIT YOUR BEARING" }, { value: 179, label: "NEW TODAY" }, { value: 167, label: "FILED H-1B" }, { value: 23, label: "MATCH ≥ 85%" }] }, "No figures yet.",
      { partial: { state: "partial", label: "Partial", cells: [{ value: 412, label: "FIT YOUR BEARING" }, { value: null, label: "FILED H-1B" }] } }),
    extremes: { label: "Extremes", cells: [{ value: 0, label: "ZERO" }, { value: 1, label: "ONE" }, { value: 412, label: "MANY" }, { value: 10000, label: "TEN THOUSAND" }] } },
  { name: "PlateHero", file: "Plates.jsx", group: "Plates", drawing: "MarketSurveyPlate",
    states: four({ aspect: "640 / 520", tags: [{ kicker: "YOU ARE HERE", line: "Software engineering · Frontend", x: 6, y: 8, kind: "here" }, { kicker: "BEST MATCH", line: "Kestrel Payments · 91%", x: 64, y: 70, kind: "next" }] }, "The plate is drawn once your résumé is placed.") },
  { name: "CalloutTag", file: "Plates.jsx", group: "Plates", inline: true, states: four({ kicker: "NEXT", line: "Kestrel Payments · 91%", kind: "next" }, "No tag."), extremes: { kicker: "AHEAD", line: LONG } },
  { name: "LabelTape", file: "Plates.jsx", group: "Plates", states: four({ words: [{ text: "computers.", region: "IV" }, { text: "money.", region: "V" }, { text: "machines.", region: "VII" }] }, "No words.") },
  { name: "LegHeader", file: "Plates.jsx", group: "Plates", stateless: "a heading — its words come with the page", states: { ready: { n: 1, meta: "THE BEARING · SET FROM YOUR RÉSUMÉ · YOURS TO CHANGE", title: "Where you’re headed" } }, extremes: { n: 3, meta: LONG.toUpperCase(), title: LONG } },
  { name: "BinderTabs", file: "Plates.jsx", group: "Plates", stateless: "switches the view below; the view carries the states",
    states: { ready: { label: "View openings", selected: "deck", tabs: [{ id: "deck", label: "Deck", sub: "ONE AT A TIME" }, { id: "terrain", label: "Terrain", sub: "BY SKILLS MATCHED" }, { id: "index", label: "Index", sub: "EVERY OPENING" }] } } },

  // ── tickets ──
  { name: "Ticket", file: "Tickets.jsx", group: "Tickets",
    states: four({ kicker: "SURVEY SHEET · KESTREL PAYMENTS", title: "Who you’d be joining", line: "Their stack, their hiring, their H-1B history.", go: "Open the survey sheet →", href: "#survey" }, "No onward ticket yet.",
      { primary: { kicker: "THE LEDGER · 1 NEEDS YOU · 2 SENT", title: "Sailor Health is waiting", line: "Two answers only you can give, then it’s ready to send.", go: "Open the ledger →", href: "#ledger", tone: "clay-tint" },
        run: { kicker: "APPLY FOR ME · CAP 2 · 06:30 TONIGHT", title: "Run now", line: "3 of 10 new drafts left today · re-runs are free", href: "#run", tone: "clay" } }),
    extremes: { kicker: LONG.toUpperCase(), title: LONG, line: LONG, go: "Open →", href: "#x" } },
  { name: "Opening", file: "Tickets.jsx", group: "Tickets",
    states: four({ opening: KESTREL }, "No openings fit your bearing yet. Change the bearing to widen it.", { partial: { state: "partial", opening: { ...KESTREL, stack: [], sponsors: false } } }),
    extremes: { opening: { ...KESTREL, company: LONG_CO, title: LONG, pay: null, sponsors: false, logo: null, match: 100, place: LONG } } },
  { name: "DeckPile", file: "Tickets.jsx", group: "Tickets", stateless: "the two backs behind an opening, which carries the states", states: { ready: {} } },
  { name: "QuestionTicket", file: "Tickets.jsx", group: "Tickets",
    states: four({ kicker: "ONLY YOU CAN ANSWER THIS", n: "QUESTION 1 OF 4", text: "Are you legally authorized to work in the country of employment?", kind: "yesno", progress: ["today", null, null, null] }, "Nothing needs you. Every answer is in.",
      { draft: { kicker: "A DRAFT FOR YOU TO CHECK", n: "QUESTION 3 OF 4", kind: "draft", text: "Please share your proficiency across programming languages.", progress: ["lit", "lit", "today", null],
        draft: "Strongest in TypeScript and JavaScript (4 years, daily), with React and Next.js on production checkout flows at Toast. Comfortable in Python and SQL for tooling and data checks; working knowledge of Node.js." } }),
    extremes: { kicker: "A DRAFT FOR YOU TO CHECK", n: "QUESTION 4 OF 4", kind: "draft", text: LONG + "?", progress: ["lit", "lit", "lit", "today"], draft: LONG_DRAFT } },
  { name: "Cartouche", file: "Tickets.jsx", group: "Tickets",
    states: four({ source: "FROM MAYA_CHEN.PDF · NOV 8", parts: ["discovering ", { id: "role", text: "frontend software engineering", label: "Role: frontend software engineering. Change it" }, " roles at ", { id: "level", text: "mid", label: "Level: mid. Change it" },
      " levels and ", { id: "ws", text: "all", label: "Workstyles: all. Change them" }, " workstyles in ", { id: "loc", text: "Boston", label: "Location: Boston. Change it" }, ", using ", { id: "tech", text: "React", label: "Technology: React. Change it" },
      ", at companies that ", { id: "spon", text: "have sponsored H-1B", label: "Sponsorship: have sponsored H-1B. Change it" }, "."] }, "Upload a résumé and the bearing sets itself.") },

  // ── cards ──
  { name: "FieldCard", file: "Cards.jsx", group: "Cards",
    states: four({ alike: ["Role and level: frontend, mid — same as yours", "Their stack: React, TypeScript, Next.js — all on your résumé", "Checkout work, as at Toast"],
      gaps: [{ text: "Datadog RUM is in 4 of their postings.", link: { label: "Learn it →", href: "#atlas" } }], figures: { label: "ROLE FIT · STACK · DUTIES", value: "92 · 88 · 84" } }, "Open an opening to see why it fits.",
      { partial: { state: "partial", alike: [], gaps: [], figures: { label: "ROLE FIT · STACK · DUTIES", value: null } } }),
    extremes: { alike: [LONG, LONG], gaps: [{ text: LONG, link: { label: "Learn it →", href: "#x" } }], figures: { label: "ROLE FIT · STACK · DUTIES", value: "100 · 0 · 100" } } },
  // ⭐ D202 · the field card ⇄ the ATS card — one card, two faces (FitCard.jsx); the front here, the back by Turn over
  { name: "FitCard", file: "FitCard.jsx", group: "Cards",
    // 47i: atlasSlugs given (the gallery has no server — it asked /api/atlas/resolve from a file:// page)
    states: four({ data: FIT_SAMPLE, atlasSlugs: {}, alike: ["Role and level: frontend, mid — the same as yours"], gaps: [{ text: "They watch the front end with Datadog RUM.", link: { label: "Learn it →", href: "#atlas" } }],
      figures: { label: "ROLE FIT · STACK · DUTIES", value: "91 · 88 · 80", items: [{ label: "ROLE FIT", key: "role", value: 91 }, { label: "STACK", key: "stack", value: 88 }, { label: "DUTIES", key: "duties", value: 80 }] } },
      "Open an opening to see why it fits.", { back: { data: FIT_SAMPLE, atlasSlugs: {}, face: "back", tab: "words" }, context: { data: FIT_SAMPLE, atlasSlugs: {}, face: "back", tab: "context", plausibility: { entries: [] } } }),
    extremes: { data: { ...FIT_SAMPLE, report: { ...FIT_SAMPLE.report, tier1_missing: [LONG] } }, atlasSlugs: {}, face: "back", tab: "words", alike: [LONG] } },
  { name: "FactSheet", file: "Cards.jsx", group: "Cards",
    states: four({ kicker: "FILLED FOR YOU · 22 OF 24", label: "What draft filled for you", foot: "From your résumé and profile. Nothing here is guessed.",
      rows: [{ label: "Name", value: "Maya Chen" }, { label: "Email", value: "maya.chen@example.com" }, { label: "Current company", value: "Toast" }, { label: "Alma mater", value: "Northeastern University" }] }, "Nothing filled yet.",
      { partial: { state: "partial", kicker: "FILLED FOR YOU · 1 OF 2", rows: [{ label: "Name", value: "Maya Chen" }, { label: "LinkedIn", value: null }] } }) },
  { name: "CatalogueCard", file: "Cards.jsx", group: "Cards", states: four({ call: "IV.1 LAM", title: "Time, Clocks, and the Ordering of Events in a Distributed System", authors: "LESLIE LAMPORT · 1978", explained: true }, "No primary source yet."), extremes: { call: "IV.9 XYZ", title: LONG, authors: LONG.toUpperCase() } },
  { name: "FieldNoteCard", file: "Cards.jsx", group: "Cards", states: four({ code: "FN-IV.1", kicker: "FIELD NOTE", duration: "0:48", text: "A webhook is the same news, pushed to you.", highlight: "pushed to you", progress: 0.4, views: "12K VIEWS" }, "No field notes yet.") },
  // 47j (D197 Wave 2 #12 · M3, lane w2-practice): D190's Ask draft panel as a plate card — the four tiers, Undo, ask-back, Confirm
  { name: "AskDraftCard", file: "Cards.jsx", group: "Cards",
    states: four({ intro: "Tell me what to do — “find data analyst jobs”, “draft this job”, “how many need me?” — or ask about a skill.", canSpeak: true, improve: { on: true },
      turns: [{ who: "you", text: "how many need me?" }, { who: "draft", tier: "T2", text: "2 need you: 1 question to answer, 1 ready to approve." },
        { who: "you", text: "draft this job" }, { who: "draft", tier: "T1", text: "Drafting Frontend Engineer II at Kestrel Payments.", undo: true },
        { who: "you", text: "what is a webhook?" }, { who: "draft", tier: "T2", text: "The same news, pushed to you when it happens.", lessons: [{ name: "Webhooks", href: "#webhooks", kind: "PLACE · IV" }], next: "Walk the place: about 12 minutes." }] },
      "Ask anything — nothing yet.", { askback: { turns: [{ who: "you", text: "pass" }, { who: "draft", tier: "ask", text: "Pass on Kestrel Payments? It leaves your deck.", confirm: true }] },
        t3: { turns: [{ who: "you", text: "write a cover letter opening for this job" }, { who: "draft", tier: "T3", text: "A first line, from your résumé — edit it before you use it.", action: { summary: "Save it to this job’s notes" } }] } }),
    extremes: { turns: [{ who: "you", text: LONG }, { who: "draft", tier: "T2", text: LONG, lessons: [{ name: LONG, href: "#x", kind: "PLACE" }], next: LONG }, { who: "draft", tier: "T1", text: "x", undo: true, undone: "Undone." }], busy: true, value: LONG } },

  // ── lists ──
  { name: "Gazetteer", file: "Lists.jsx", group: "Lists", states: four({ label: "Every opening", cols: INDEX_COLS, rows: INDEX_ROWS }, "No openings fit your bearing yet."),
    extremes: { label: "Extremes", cols: INDEX_COLS, rows: [{ ...INDEX_ROWS[0], title: LONG, company: LONG_CO }] } },
  { name: "Register", file: "Lists.jsx", group: "Lists", states: four({ rows: APPS }, "No applications yet. Draft one from the market."),
    extremes: { rows: manyApps(500) } },
  { name: "RegisterKey", file: "Lists.jsx", group: "Lists", stateless: "the register's key line", states: { ready: {} } },
  { name: "TrailRail", file: "Lists.jsx", group: "Lists",
    states: four({ legs: [{ name: "Two ways to hear news", state: "done" }, { name: "Who calls whom", state: "done" }, { name: "Read the code", state: "current" }, { name: "What breaks", state: "ahead" }, { name: "The register", state: "ahead" }] }, "No legs yet."),
    extremes: { legs: [{ name: LONG, state: "done" }, { name: LONG, state: "current" }] } },
  { name: "RouteLine", file: "Lists.jsx", group: "Lists",
    states: four({ stops: [{ name: "Read the posting", state: "lit", stage: "start" }, { name: "Tailor", state: "lit", stage: "build" }, { name: "Fill", state: "next", stage: "deepen" }, { name: "Send", state: "ahead", stage: "master", interchange: { label: "VIII", href: "#viii", region: "VIII" } }] }, "No route yet.") },
  { name: "CodePlate", file: "Lists.jsx", group: "Lists",
    states: four({ file: "webhook.js", lang: "JS", code: "app.post('/hooks/stripe', (req, res) => {\n  const event = verify(req);\n  queue.add(event.id, event);\n  res.sendStatus(200);\n});", pins: [{ title: "Why verify first?", text: "Anyone can post to this address; the signature says it was Stripe.", lines: [2] }, { title: "Why answer at once?", text: "Stripe retries if it waits too long; do the work later.", lines: [4] }] }, "No code on this leg.") },

  // ── drawings ──
  { name: "CompassDial", file: "Drawings.jsx", group: "Drawings", states: four({ lit: 4, total: 12, label: "Compass dial: you have 4 of their top 12 technologies on your résumé" }, "No technologies found yet."), extremes: { lit: 412, total: 10000 } },
  { name: "RegionEmblem", file: "Drawings.jsx", group: "Drawings", states: four({ kind: "net", region: "IV" }, "No region.", { partial: { eight: true } }), extremes: { kind: "no-such-kind", label: LONG } },
  { name: "IsometricTile", file: "Drawings.jsx", group: "Drawings", states: four({}, "No walk-through.", { partial: { arcOp: 1, beaconR: 7, beaconFill: "var(--pl-clay)", beaconOp: 1, queueOp: 1, serverLed: "var(--pl-lit)", tallyOp: 0 } }), extremes: { label: LONG, arcOp: 1, tallyOp: 1, queueOp: 1 } },
  { name: "ElevationProfile", file: "Drawings.jsx", group: "Drawings", states: four({}, "No profile."), extremes: { label: LONG } },
  // 47j (D197 Wave 2 · M3, lane w2-practice): the labelled placeholder a page mock shows where its brief says "drawing needed"
  { name: "DrawingToCome", file: "Drawings.jsx", group: "Drawings",
    states: four({ what: "the proving ground: five rounds as benches up a hill, you beaconed", aspect: "640 / 360", note: "VI’S RAMP · FROM THE DESIGN DOC" }, "No drawing planned here."),
    extremes: { what: LONG, aspect: "1 / 1", note: LONG.toUpperCase() } },

  // ── dispatches (D197 Wave 2 #18, 47j lane w2-outside): the email form — a 600 px table, inline token styles ──
  { name: "DispatchFrame", file: "Dispatch.jsx", group: "Dispatches", width: 640,
    states: four({ kicker: "DISPATCH · DIGEST · NOV 26", title: "4 new jobs fit you", lead: "New jobs that fit your résumé — companies with an H-1B filing record first.",
      stats: [{ value: 4, label: "NEW TODAY" }, { value: 3, label: "FILED H-1B" }, { value: 1, label: "SENT", tone: "lit" }], action: { label: "See them on the market →", href: "#market" },
      smallPrint: ["A filing record is history, not a promise — confirm with the employer. Not legal advice."], foot: ["You chose to get this by email. Change it in draft → Account → Notifications."] }, "No dispatch to show."),
    extremes: { kicker: LONG.toUpperCase(), title: LONG, lead: LONG, stats: [{ value: 0, label: "ZERO" }, { value: 10000, label: "TEN THOUSAND" }], action: { label: LONG, href: "#x" }, smallPrint: [LONG], foot: [LONG] } },
  { name: "DispatchEntry", file: "Dispatch.jsx", group: "Dispatches", width: 600,
    states: four({ n: 1, title: "Frontend Engineer II, Checkout", company: "Kestrel Payments", facts: ["posted 2 hours ago", "asks for 4 of your 5 top skills", "has filed H-1B petitions before"],
      squares: { of: 5, lit: 4 }, links: [{ label: "Open on the market", href: "#opening" }] }, "No entries in this dispatch.",
      { picks: { n: 2, title: "Software Engineer, Design Systems", company: "Brightline Health", facts: ["74% match"], links: [{ label: "Apply", href: "#apply" }, { label: "Pass", href: "#pass" }] } }),
    extremes: { n: 412, title: LONG, company: LONG_CO, facts: [LONG], squares: { of: 12, lit: 0 }, links: [{ label: LONG, href: "#x" }] } },
  { name: "DispatchButton", file: "Dispatch.jsx", group: "Dispatches",
    states: four({ label: "Open in draft →", href: "#open" }, "No action.", { ink: { label: "Open on the market", href: "#open", tone: "ink" } }),
    extremes: { label: LONG, href: "#x" } },

  // ── panels (D197 Wave 2 #19, 47j lane w2-outside): the extension's one floating panel (D191) and its /d square ──
  { name: "FloatingPanel", file: "Panels.jsx", group: "Panels", width: 380,
    states: four({ status: { text: "86% MATCH · FILED H-1B", tone: "ok" } }, "Nothing on this page yet.", { arriving: { status: { text: "CHECKING DRAFT…", tone: "busy" } } }),
    extremes: { status: { text: LONG.toUpperCase(), tone: "quiet" }, label: LONG } },
  { name: "ReopenTab", file: "Panels.jsx", group: "Panels", width: 120,
    states: four({ words: "1 needs you", need: true }, "Nothing to reopen.", { quiet: { words: "" } }),
    extremes: { words: LONG, need: true } },

  // ── the person (47j, lane w2-person: D197 Wave 2 #9 Your passport · #15 Setting out · #17 settings / sign-in) ──
  { name: "PassportIdentity", file: "Person.jsx", group: "Person",
    states: four({ name: "Maya Chen", headline: "Frontend engineer · checkout flows and design systems", region: "V", level: "only_me", open: "Open to work · referrals welcome",
      fields: [{ label: "HANDLE", value: "/in/maya-chen" }, { label: "FITS", value: "Frontend · mid · also Design systems" }, { label: "LOCATION · YEARS", value: "Boston, MA · 4 years" }] },
      "Upload your résumé and your passport fills itself.", { partial: { state: "partial", name: "Maya Chen", level: "public", fields: [{ label: "HANDLE", value: null }] } }),
    extremes: { name: LONG, headline: LONG, level: "public", fields: [{ label: "FITS", value: LONG }] } },
  { name: "VisibilityControl", file: "Person.jsx", group: "Person",
    states: four({ value: "only_me" }, "Nothing to show yet.", { section_eye: { value: "only_me", cap: "connections", compact: true, label: "Who can see Experience" } }),
    extremes: { value: "public", label: LONG } },
  { name: "PassportStamps", file: "Person.jsx", group: "Person",
    states: four({ proven: [{ name: "React", how: "built", at: "Nov 12", href: "#proof" }, { name: "TypeScript", how: "passed a check", at: "Nov 18" }],
      listed: [{ name: "Playwright", href: "#prove" }, { name: "Datadog RUM", href: "#prove" }] }, "No skills read yet. Upload your résumé.",
      { partial: { state: "partial", proven: [], listed: [{ name: "Next.js", href: "#prove" }] } }),
    extremes: { proven: [{ name: LONG, how: "built", at: "Nov 12" }], listed: [{ name: LONG_COMPANY, href: "#prove" }] } },
  { name: "LabelledField", file: "Person.jsx", group: "Person",
    states: four({ label: "Email", id: "g-email", value: "maya.chen@example.com", type: "email" }, "No field here.",
      { error: { label: "Password", id: "g-pw", value: "short", type: "password", error: "Use at least 8 characters." }, note: { label: "Headline", id: "g-hl", value: "", note: "Up to 160 characters." } }),
    extremes: { label: LONG, id: "g-x", value: LONG, multiline: true, note: LONG } },
  { name: "SettingsSheet", file: "Person.jsx", group: "Person",
    states: four({ kicker: "YOUR DATA", title: "What draft keeps for you", lead: "A copy of everything, as JSON.",
      rows: [{ label: "Download my data", note: "draft-account-2026-11-26.json", value: "Download" }, { label: "Base résumé only", value: "Off" }] }, "Nothing to set here yet.",
      { danger: { kicker: "DELETE ACCOUNT", title: "Delete your account", tone: "danger", lead: "Deletes everything. Download your data first.", rows: [] } }),
    extremes: { kicker: LONG.toUpperCase(), title: LONG, lead: LONG, rows: [{ label: LONG, note: LONG, value: LONG }] } },
  { name: "SettingOutDrop", file: "Person.jsx", group: "Person",
    states: four({}, "Nothing to hand over yet.", { reading: { busy: true, status: "Reading maya_chen.pdf…" }, read: { status: "Set up as Frontend · mid level · Frontend Engineer, UI Engineer. You can refine it any time." } }),
    extremes: { title: LONG, line: LONG, status: LONG } },

  // ── the explainer (D198 E1) ──
  { name: "Explainer", file: "explainer/Explainer.jsx", group: "Explainer", width: 405,
    states: four({ script: PILOT_EXPLAINER, openings: 412 }, "No explainer here yet.", { at_beat_7: { script: PILOT_EXPLAINER, openings: 412, at: 40000 }, unknown_count: { script: PILOT_EXPLAINER, at: 40000 } }),
    extremes: { script: { ...PILOT_EXPLAINER, title: { text: LONG, tape: LONG } }, openings: 10000 } },

  // ── D197 Wave 2 (47j, lane w2-public): the signed-out chrome, correspondence ──
  { name: "PublicNav", file: "PublicPages.jsx", group: "Public pages",
    states: four({ links: PUBLIC_LINKS, current: "jobs" }, "No links yet.",
      { signed_in: { links: PUBLIC_LINKS, current: "atlas", user: { admin: false } }, ink_start: { links: PUBLIC_LINKS, clay: false } }),
    extremes: { links: PUBLIC_LINKS.map((l) => ({ ...l, label: `${l.label} and a great many more words` })), current: "about" } },
  { name: "PublicNav", variant: "phone", file: "PublicPages.jsx", group: "Public pages", width: 390,
    states: four({ links: PUBLIC_LINKS, current: "jobs", phone: true }, "No links yet.", { menu_open: { links: PUBLIC_LINKS, current: "jobs", phone: true, menuOpen: true } }) },
  { name: "CorrespondenceLetter", file: "Correspondence.jsx", group: "Public pages",
    states: four({ kind: "letter", from: { name: "Priya Raman", href: "#in-priya" }, when: "NOV 24 · 9:12", text: "Saw Kestrel is hiring for checkout — your Toast work is exactly it. Want an intro?", job: { title: "Frontend Engineer II, Checkout", company: "Kestrel Payments", place: "Boston, MA", href: "#opening" } }, "No letters yet.",
      { mine: { kind: "letter", mine: true, when: "NOV 24 · 9:40", text: "Yes please — thank you!" },
        dispatch: { kind: "dispatch", from: { name: "Diego Alvarez", href: "#in-diego" }, when: "NOV 23", proof: { label: "PASSED · WEBHOOKS" }, text: "Finally get why retries need idempotency keys.", link: "https://example.com/notes/idempotency" },
        removed: { kind: "letter", from: { name: "Sam Okafor" }, when: "NOV 20", removed: true },
        closed_job: { kind: "letter", from: { name: "Priya Raman" }, when: "NOV 19", text: "This one?", job: false } }),
    extremes: { kind: "dispatch", from: { name: LONG_CO }, when: "NOV 1", text: LONG_DRAFT, link: `https://example.com/${"a".repeat(130)}`, note: "UNREAD" } },
];

/** The drawings ported path for path (scripts/d196PortDrawings.mjs): the v3 boards' eight, then v2's fifteen (47e) — the
 *  eight region emblems, Home's volume plate and the Place page's six. */
export const PORTED_DRAWINGS = ["MarketSurveyPlate", "MarketBoardOrder", "MarketTerrain", "LedgerRunRoute", "SurveyTeamDiorama", "SurveyHiringProfile", "SurveyRoleLine", "SurveyMatchDial",
  "EmblemFound", "EmblemBits", "EmblemTree", "EmblemNet", "EmblemLock", "EmblemCode", "EmblemWorld", "EmblemMind", "AtlasVolumePlate",
  "PlaceElevationProfile", "PlaceSignpost", "PlaceIsometricTile", "PlaceHazardSeal", "PlaceHazardTimeout", "PlaceHazardDuplicate",
  // 47m (D197 #13 / #11): the row-4 boards ProvingGround and DrawingsAtlas 1-4, read from docs/sketches/final/project/
  "ProvingGroundHill", "ProvingGroundChair", "LogbookDaysLeg", "LogbookSummitCairn", "TodaySquareInset", "LogbookTierStamp",
  // 47m (lane person): the final canvas's Passport board and the Drawings sheets' person / jobs / sign-in plates
  "PassportIdentityPage", "PassportRoad", "NotificationsLamp", "ProfileFieldBook", "ProfileSpecimenDrawer", "ProfileSchoolhouse", "SettingOutCounter",
  "BearingsCompassRose", "VoyageClipboard", "VoyagePostRack", "SignInMarketBehind"];

/** The states every entry with data must have (R1). */
export const REQUIRED_STATES = Object.freeze(["ready", "loading", "empty", "error"]);
