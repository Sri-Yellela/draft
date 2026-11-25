// client/src/pages/atlas/volumeModel.js — ⭐ D197 Wave 1 #5–#7 (47h, lane atlas) · VOLUME I AS DATA: the pure half of Atlas's
// front page (Home board), a region (Map board) and the Library (Library board).
//
// Everything comes from what Atlas already serves — nothing is invented:
//   · the volume = the course "From silicon to software" (GET /api/learn/course/silicon-to-software): its 8 modules are
//     the 8 REGIONS, its 108 lessons the PLACES, each lesson's curated links the Library's OUTSIDE RESOURCES (typed by
//     their kind: Video, Book, Article, Course, Playlist, Practice, Sandbox, Lab, Guide — Build / Project / Atlas items are
//     things the learner makes, not resources, so they stay out of the Library);
//   · what is LIT = the reader's earned marks (GET /api/learn/earned) read with the ONE rule (libraryModel.lessonState →
//     shared/learnStepState.js stepState): a place lights only when its links are opened, its checkpoints explained in the
//     reader's own words and its build linked — never a tick (D117 C8);
//   · a place's checks = its checkpoints (+ its build), the squares the board draws (explained / built = lit);
//   · the trails between places = the circle's "Before this" links (GET /api/learn/circle, D117) inside the region, the
//     lessons' own order where a region has none; an INTERCHANGE (⇄) = a "Before this" / "After this" link into another
//     region.
// The regions' short names, emblem kinds and one-line blurbs are the approved Home board's (docs/sketches/final/project/
// Home.dc.html); region II's board name is a placeholder ("[Part 2 name]"), so it keeps its module's own title.
import { lessonState } from "./libraryModel.js";
import { panelHref } from "./atlasPanels.js";

export const VOLUME = Object.freeze({ roman: "I", name: "Computing", course: "silicon-to-software", title: "From silicon to software" });

/** The board's eight regions, in the course's module order (I–VIII). `blurb` is the board's line; II has its own. */
export const REGION_META = Object.freeze([
  { roman: "I", kind: "found", name: "Foundations", blurb: "Signals, logic and the first machines." },
  { roman: "II", kind: "bits", name: null, blurb: "Electricity, silicon and the hardware inside." },
  { roman: "III", kind: "tree", name: "Algorithms", blurb: "Searching, sorting and the shapes of data." },
  { roman: "IV", kind: "net", name: "Systems & networks", blurb: "How machines talk, wait and scale." },
  { roman: "V", kind: "lock", name: "Security & money", blurb: "Trust, keys and how payments move." },
  { roman: "VI", kind: "code", name: "Languages & media", blurb: "Code, sound and pictures as data." },
  { roman: "VII", kind: "world", name: "The physical world", blurb: "Sensors, power and the stuff underneath." },
  { roman: "VIII", kind: "mind", name: "Intelligence", blurb: "Models that learn, predict and act." },
]);

/** The four stages (elevation bands) — Start · Build · Deepen · Master (the board's and D201's one scale). */
export const STAGES = Object.freeze([
  { id: "start", label: "Start", caps: "LOWLANDS · START" },
  { id: "build", label: "Build", caps: "FOOTHILLS · BUILD" },
  { id: "deepen", label: "Deepen", caps: "HIGHLANDS · DEEPEN" },
  { id: "master", label: "Master", caps: "SUMMIT · MASTER" },
]);

/** The Library's collections (the board's sidebar, in its order) and which link kinds file into each. `test` refines a kind. */
const PAPER = /\bpaper\b|\bPDF\b|\bRFC\b/i;
const LECTURE = /lecture|youtube\.com/i;
export const COLLECTIONS = Object.freeze([
  { id: "notes", label: "Field notes", icon: "notes", files: (x) => x.kind === "Video" },
  { id: "sources", label: "Primary sources", icon: "sources", files: (x) => x.kind === "Article" && PAPER.test(`${x.title} ${x.by || ""}`) },
  { id: "lectures", label: "Lectures", icon: "lectures", files: (x) => x.kind === "Playlist" || (x.kind === "Course" && LECTURE.test(`${x.title} ${x.url || ""}`)) },
  { id: "books", label: "Books", icon: "books", files: (x) => x.kind === "Book" },
  { id: "courses", label: "Courses elsewhere", icon: "courses", files: (x) => x.kind === "Course" && !LECTURE.test(`${x.title} ${x.url || ""}`) },
  { id: "essays", label: "Essays", icon: "essays", files: (x) => x.kind === "Article" && !PAPER.test(`${x.title} ${x.by || ""}`) },
  { id: "grounds", label: "Practice grounds", icon: "grounds", files: (x) => x.kind === "Practice" || x.kind === "Sandbox" || x.kind === "Lab" },
  { id: "guides", label: "Guides to follow", icon: "guides", files: (x) => x.kind === "Guide" },
  // the Glossary is Atlas's own (A10) — the drawer points there instead of holding outside items
  { id: "glossary", label: "Glossary", icon: "glossary", files: () => false, href: "glossary" },
]);
/** How a collection's items are drawn: field notes as posters, the rest as catalogue cards. */
export const collectionView = (id) => (id === "notes" ? "notes" : id === "glossary" ? "glossary" : "cards");

const lessonsOf = (course) => (course?.modules || []).flatMap((m) => m.lessons.map((l) => ({ ...l, module: m.n })));

/** A lesson's checks: its checkpoints (+ its build) — lit when explained / built. → { squares: bool[], done, total } */
export function placeChecks(lesson, marks = {}) {
  const ids = [...(lesson.checks || []), ...(lesson.build ? [lesson.build] : [])];
  const squares = ids.map((id) => !!marks[id]);
  return { squares, done: squares.filter(Boolean).length, total: squares.length };
}

/** The volume: { regions, lessons, notes, here, next } — `here` = the lesson you're on (started, or the first unlit). */
export function volumeOf(course, marks = {}) {
  const modules = course?.modules || [];
  let here = null, next = null;
  const regions = modules.map((m, i) => {
    const meta = REGION_META[i] || { roman: String(m.n), kind: "net", name: null, blurb: "" };
    const states = m.lessons.map((l) => lessonState(l, marks));
    const lit = states.filter((s) => s.complete).length;
    return { n: m.n, roman: meta.roman, kind: meta.kind, region: meta.roman, name: meta.name || m.title, title: m.title, blurb: meta.blurb,
      lit, total: m.lessons.length, squares: states.map((s) => (s.complete ? "lit" : null)) };
  });
  const all = lessonsOf(course);
  const st = all.map((l) => lessonState(l, marks));
  const started = all.findIndex((l, i) => st[i].started && !st[i].complete);
  const firstOpen = all.findIndex((l, i) => !st[i].complete);
  const hi = started >= 0 ? started : firstOpen;
  if (hi >= 0) {
    here = { ...all[hi], region: regions[all[hi].module - 1] };
    const ni = all.findIndex((l, i) => i > hi && !st[i].complete);
    if (ni >= 0) next = { ...all[ni], region: regions[all[ni].module - 1] };
  }
  const notes = all.reduce((a, l) => a + (l.links || []).filter((x) => x.kind === "Video").length, 0);
  return { regions, lessons: all.length, notes, here, next, lit: regions.reduce((a, r) => a + r.lit, 0) };
}

/** The volume's stats strip (the board's: 8 REGIONS · 108 LESSONS · 13 FIELD NOTES) — the course's own counts. */
export const volumeStats = (v) => [
  { value: v.regions.length, label: "REGIONS" },
  { value: v.lessons, label: "LESSONS" },
  { value: v.notes, label: "FIELD NOTES" },
];

/** The region's squares on its plate card / the run chip: one per place, lit = proven. */
export const regionSquares = (r) => r.squares;

/** The grid reference on the 1400 × 720 terrain (columns A… every 200 px, rows 1… every 140 px), as the board writes it. */
export const gridOf = (x, y) => `${"ABCDEFG".charAt(Math.floor(x / 200))}${1 + Math.floor(y / 140)}`;

// The terrain's climb: lowlands (bottom left) to the summit (top right, at the bands' centre, 1240 × 150), places spread
// along it in the region's order and staggered either side, so every label has room. Pure, so the same place lands on
// the same spot on every visit.
const CLIMB = [[150, 600], [520, 560], [820, 380], [1240, 140]];
function climbAt(t) {
  const [p0, p1, p2, p3] = CLIMB, u = 1 - t;
  const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
  const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
  return [x, y];
}

/**
 * A region's places: [{ id, name, stage, state: lit | next | open | later, x, y, grid, checks, notes, summit, interchange }].
 * `next` = the first unlit place in order (one per region); `open` = started, not lit; `later` = not started.
 * `circle` (optional) = /api/learn/circle → trails from its "Before this" links; `regions` = the volume's, for interchanges.
 */
export function regionPlaces(module, marks = {}, { circle = null, regions = [], course = null } = {}) {
  const lessons = module?.lessons || [];
  const n = lessons.length;
  const moduleOf = new Map(lessonsOf(course).map((l) => [l.id, l.module]));
  let nextSet = false;
  const places = lessons.map((l, i) => {
    const s = lessonState(l, marks);
    let state = s.complete ? "lit" : s.started ? "open" : "later";
    if (!s.complete && !nextSet) { state = "next"; nextSet = true; }
    const stage = STAGES[Math.min(3, Math.floor((4 * i) / Math.max(1, n)))].id;
    const t = n > 1 ? i / (n - 1) : 0;
    const [cx, cy] = climbAt(t);
    const off = i === n - 1 ? 0 : (i % 2 ? 1 : -1) * (40 + (i % 3) * 18);
    const x = Math.round(Math.min(1340, Math.max(70, cx + off * 0.45)));
    const y = Math.round(Math.min(680, Math.max(60, cy + off)));
    const checks = placeChecks(l, marks);
    const notes = (l.links || []).filter((x2) => x2.kind === "Video").length;
    const pc = circle?.pieces?.[l.id];
    const away = [...(pc?.needs || []).map((x2) => x2.id), ...(pc?.opens || [])].map((id) => moduleOf.get(id)).find((m) => m && m !== module.n);
    const ir = away ? regions[away - 1] : null;
    return { id: l.id, name: l.title, goal: l.goal || "", stage, state, x, y, grid: gridOf(x, y), checks, notes, summit: i === n - 1,
      interchange: ir ? { n: ir.n, roman: ir.roman, name: ir.name, region: ir.roman } : null };
  });
  return places;
}

/** The trails: the circle's "Before this" links inside the region (walked = both lit; to the next = clay, marching). */
export function regionTrails(places, circle = null) {
  const at = new Map(places.map((p) => [p.id, p]));
  const pairs = [];
  for (const p of places) for (const nd of circle?.pieces?.[p.id]?.needs || []) if (at.has(nd.id)) pairs.push([nd.id, p.id]);
  if (!pairs.length) for (let i = 1; i < places.length; i++) pairs.push([places[i - 1].id, places[i].id]);
  return pairs.map(([a, b]) => {
    const A = at.get(a), B = at.get(b);
    const walked = A.state === "lit" && B.state === "lit", toNext = A.state === "lit" && B.state === "next";
    return { id: `${a}>${b}`, d: `M${A.x} ${A.y} Q${(A.x + B.x) / 2} ${(A.y + B.y) / 2 - 30} ${B.x} ${B.y}`, kind: walked ? "walked" : toNext ? "next" : "ahead" };
  });
}

/** A place's status line on its field card (the board's four). `from` = the place the trail comes from. */
export function placeStatus(p, from = null) {
  if (p.state === "lit") return "Lit. You explained every checkpoint here.";
  if (p.state === "next") return from ? `Your next waypoint. The trail from ${from} leads here.` : "Your next waypoint.";
  if (p.state === "open") return "Underway. Finish the remaining checks to light it.";
  return "Ahead on the route. Reach it from the places before it.";
}
export const STATUS_WORD = Object.freeze({ lit: "LIT", next: "UP NEXT", open: "UNDERWAY", later: "AHEAD" });

/** The Library's items: every outside link of the course, filed by collection and region. */
export function libraryOf(course, marks = {}, volume = volumeOf(course, marks)) {
  const items = [];
  for (const m of course?.modules || []) {
    const r = volume.regions[m.n - 1];
    for (const l of m.lessons) {
      const explained = (l.checks || []).length > 0 && (l.checks || []).every((id) => marks[id]);
      for (const x of l.links || []) {
        if (!x.url) continue;
        const c = COLLECTIONS.find((k) => k.files(x));
        if (!c) continue;
        items.push({ id: x.id, collection: c.id, title: x.title, by: x.source?.name || x.by || null, url: x.url, kind: x.kind, optional: !!x.optional,
          region: r, lesson: { id: l.id, title: l.title, goal: l.goal || "" }, opened: !!marks[x.id], explained });
      }
    }
  }
  return items;
}

/** A catalogue card's call number: the region's numeral, its place in the drawer, the first three letters of who made it. */
export function callNumber(item, i) {
  const first = String(item.by || item.title || "").split(/,| and /)[0].replace(/\bet al\.?/i, "");
  const who = first.replace(/[^A-Za-z ]/g, " ").trim().split(/\s+/).filter((w) => w.length > 1).pop() || "";
  return `${item.region.roman}.${i + 1}${who ? ` ${who.slice(0, 3).toUpperCase()}` : ""}`;
}

/** Atlas's place list for the footer and More — every panel, so none is lost. `compete` = the switches. */
export function atlasPlaces(base, compete = null) {
  const p = (id, label) => ({ id, label, href: panelHref(base, id) });
  const groups = [
    { label: "You", links: [p("your-run", "Your run"), p("your-map", "Your survey"), p("your-skills", "Your skills")] },
    { label: "Grow", links: [p("library", "Library"), { id: "shelf", label: "Courses and guides", href: `${base}/library/shelf` }, p("todays-question", "Today’s question"), p("the-audit", "The audit"), p("how-it-works", "How it works")] },
    { label: "Compete", links: [...(compete?.league ? [p("league", "League")] : []), ...(compete?.challenges ? [p("challenges", "Challenges")] : [])] },
    { label: "Explore", links: [p("roles-and-skills", "Roles and skills"), p("this-weeks-market", "This week’s market"), p("glossary", "Glossary"), p("overview", "Overview")] },
  ];
  return groups.filter((g) => g.links.length);
}

