// ⭐ D196 F2 · PORT, DON'T REDRAW — every SVG drawing on the canvas export's boards becomes a component,
// path for path: the same elements, coordinates, stroke widths, dashes and the one live detail, generated
// from docs/sketches/Atlas plate system.html, never re-drawn by hand.
//
// What the port changes, and only this:
//   · every colour → its plate token (client/src/styles/plate.css), written as an inline CSS property
//     (`style={{ fill: "var(--pl-ink)" }}`) because SVG presentation attributes do not resolve var();
//     a colour with no token stops the port (add the token first — D196 F1);
//   · every font-family → var(--pl-serif / --pl-sans / --pl-mono);
//   · ids are made unique per instance (React useId), url(#…) references follow;
//   · SMIL <animate> is left out under prefers-reduced-motion (the CSS classes stop themselves);
//   · `label` replaces the aria-label (the board's text is the default) — the data props arrive with each
//     phase's page (P1 the market, P2 the ledger, P3 the survey sheet).
//
// Usage: node scripts/d196PortDrawings.mjs          write client/src/plate/drawings/*.jsx
//        node scripts/d196PortDrawings.mjs --check  exit 1 if any generated file differs (test/d196Drawings…)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unpackCanvas, DEFAULT_OUT, DEFAULT_EXPORT } from "./d196UnpackCanvas.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const OUT_DIR = path.join(ROOT, "client", "src", "plate", "drawings");
const TOKENS = path.join(ROOT, "client", "src", "styles", "plate.css");

// The two exports: v3 (the market, the ledger, the survey sheet) and v2 (the owner's 11-24 file: Atlas's Home, Region IV,
// Library, the Region emblem, Place · Webhooks, How the drafts come in).
export const SOURCES = {
  v3: { file: DEFAULT_EXPORT, out: DEFAULT_OUT, name: "docs/sketches/Atlas plate system.html" },
  v2: { file: path.join(ROOT, "docs", "sketches", "Atlas plate system v2.html"), out: path.join(ROOT, "tmp", "d196-canvas-v2"), name: "docs/sketches/Atlas plate system v2.html" },
};

// The boards and their drawings, in document order. `name` is the drawing's atlas name (D196 vocabulary). A board's
// drawings are its role="img" SVGs, in order; `source` is its export (v3 when not given).
export const BOARDS = [
  { title: "The market · draft", drawings: ["MarketSurveyPlate", "MarketBoardOrder", "MarketTerrain"] },
  { title: "The ledger · draft", drawings: ["LedgerRunRoute"] },
  { title: "Survey sheet · Kestrel Payments · draft", drawings: ["SurveyTeamDiorama", "SurveyHiringProfile", "SurveyRoleLine", "SurveyMatchDial"] },
  // v2 (order item 4, 47e): the eight region emblems (the emblem board's `kind` order), Home's volume plate, and the
  // Place page's six drawings — the elevation profile, the signpost, the isometric tile and the three hazard plates.
  { source: "v2", title: "Region emblem", drawings: ["EmblemFound", "EmblemBits", "EmblemTree", "EmblemNet", "EmblemLock", "EmblemCode", "EmblemWorld", "EmblemMind"] },
  { source: "v2", title: "Atlas home: Volume I, Computing", drawings: ["AtlasVolumePlate"] },
  { source: "v2", title: "Atlas place: Webhooks, Region IV grid D3", drawings: ["PlaceElevationProfile", "PlaceSignpost", "PlaceIsometricTile", "PlaceHazardSeal", "PlaceHazardTimeout", "PlaceHazardDuplicate"] },
  // ⭐ 47m (lane practice, D197 Wave 2 #11 / #13): the approved row-4 boards read straight from the canvas's own files
  // (`dc` = docs/sketches/final/project/<dc>.dc.html, A244). `pick` = which of the board's drawings (in order) this entry
  // ports — a board shared between pages names only its own (DrawingsAtlas 5–8 are Profile's / Setting out's).
  { dc: "ProvingGround", title: "Proving ground · Region VI", drawings: ["ProvingGroundHill", "ProvingGroundChair"] },
  { dc: "DrawingsAtlas", title: "Drawings I · Atlas, the passport, setting out", pick: [0, 1, 2, 3],
    drawings: ["LogbookDaysLeg", "LogbookSummitCairn", "TodaySquareInset", "LogbookTierStamp"] },
  // ⭐ 47m (lane person) · the FINAL canvas's row-4 boards, read straight from docs/sketches/final/project/<file> (each board is
  // its own file; its generator is scripts/sketches47l/). `null` = a drawing on the board that belongs to another page — left
  // for that page's port (the svgs still count, so the order is checked). Passport: the hero (the passport open at its
  // identity page), the road so far, the notifications lamp. The three Drawings sheets: only Your passport's, Setting out's,
  // Your bearings', The voyage's and Sign in's.
  { file: "Passport.dc.html", title: "Your passport · Region V", drawings: ["PassportIdentityPage", "PassportRoad", "NotificationsLamp"] },
  { file: "DrawingsAtlas.dc.html", title: "Drawings · Atlas, the passport, setting out", drawings: [null, null, null, null, "ProfileFieldBook", "ProfileSpecimenDrawer", "ProfileSchoolhouse", "SettingOutCounter"] },
  { file: "DrawingsJobs.dc.html", title: "Drawings · jobs and the network", drawings: ["BearingsCompassRose", "VoyageClipboard", "VoyagePostRack", null, null, null, null] },
  { file: "DrawingsPublic.dc.html", title: "Drawings · public pages", drawings: [null, null, null, null, "SignInMarketBehind", null, null, null, null, null] },
  // ⭐ 47m (lane public, D197 Wave 2 M5): the approved Drawings sheets' drawings for the public pages, Off the map and
  // Correspondence. `null` = a drawing on the sheet that another page's lane ports (the sign-in plate, the résumé tool's desk,
  // the email plates; the jobs lane's compass and clipboard) — skipped here, in place, so the order stays the sheet's.
  { file: "DrawingsPublic.dc.html", title: "Drawings · public pages (lane public)", drawings: ["RoadmapRoute", "GazetteerGridPage", "SurveyChartExplain", "OffTheMapEdge", null, null, "AtlasTitlePage", null, null, null] },
  { file: "DrawingsJobs.dc.html", title: "Drawings · jobs and the network (lane public)", drawings: [null, null, "LettersPostRack", "DispatchRiderRoute", "SealedLetterDoorstep", "CampsGazetteer", "NoticeBoardReports"] },
];
export const DC_DIR = path.join(ROOT, "docs", "sketches", "final", "project");
const FINAL_DIR = DC_DIR;

// ⭐ A drawing's TEMPLATE BINDINGS ({{ name }} on the canvas — the live detail a page drives) become props, each with the
// value it takes at rest. A binding with no default here stops the port. Colour values are plate tokens.
//   PlaceIsometricTile — the Place page's two-way walk-through moves these (the arc, the beacon, the queue, the tally, the
//   server's light); at rest nothing has happened yet: no arc, the beacon small and unlit, no queue, no tally, the light off.
export const BINDINGS = {
  PlaceIsometricTile: { arcOp: 0, beaconR: 4, beaconFill: "var(--pl-iv-0)", beaconOp: 0, queueOp: 0, serverLed: "var(--pl-card)", tallyOp: 0 },
};

// ⭐ D196 P1 · THE LIVE PARTS — a drawing's data, made props AFTER the port, by exact substitution on the generated JSX
// (each `from` must occur exactly once, or the port stops). The paths stay the canvas's; only the named coordinates move,
// and each prop's DEFAULT is the board's value, so with no props the drawing is the board's, byte for byte in the SVG.
//   MarketSurveyPlate: `you` = the beacon's centre [x, y] in the viewBox (the page puts it in the person's sector);
//   `best` = the best match's pin, or null (no route, no pin — nothing drawn that the page can't back with data).
//   The route keeps the board's curve: its control points sit at you + (58, −16) and best + (−52, 18), which at the
//   defaults is the board's "M192 166 C 250 150, 300 120, 352 102".
export const LIVE = {
  MarketSurveyPlate: {
    props: "you = [192, 166], best = [352, 102]",
    pre: "const route = best ? `M${you[0]} ${you[1]} C ${you[0] + 58} ${you[1] - 16}, ${best[0] - 52} ${best[1] + 18}, ${best[0]} ${best[1]}` : null;",
    subs: [
      ['<path className="at-march" d="M192 166 C 250 150, 300 120, 352 102"', '<path className="at-march" d={route || undefined} visibility={route ? undefined : "hidden"}'],
      ['<g transform="translate(352 102)">', '<g transform={`translate(${(best || you)[0]} ${(best || you)[1]})`} visibility={best ? undefined : "hidden"}>'],
      ['<g transform="translate(192 166)">', '<g transform={`translate(${you[0]} ${you[1]})`}>'],
    ],
  },
  // ⭐ 47m (D197 #13) · the proving ground's hill: `names` = the five rounds (the benches' words); `lit` = how many benches
  // are proven (green), from the foot; `you` = the bench you're preparing for (the beacon, and the green trail up to it), or
  // null (no beacon); `flag` = [line 1, line 2] of the next interview's flag, or null (no flag). Defaults = the board.
  ProvingGroundHill: {
    props: 'names = ["Recruiter screen", "Hiring manager", "Coding", "System design", "AI-enabled coding"], lit = 2, you = 2, flag = ["KESTREL · CODING", "FRI · 2:00 PM"]',
    pre: 'const BENCH = [[70, 382], [175, 322], [282, 262], [390, 208], [498, 160]]; const SEG = ["C 120 382, 130 322, 175 322", "C 225 322, 240 262, 282 262", "C 330 262, 345 208, 390 208", "C 440 208, 455 160, 498 160"]; const upTo = you != null ? you : lit - 1; const greenD = upTo > 0 ? `M70 382 ${SEG.slice(0, upTo).join(" ")}` : null; const at = you != null ? BENCH[Math.max(0, Math.min(4, you))] : BENCH[2]; const benchFill = (k) => (lit > k ? "var(--pl-lit)" : "var(--pl-card)"); const flagVis = flag ? undefined : "hidden";',
    subs: [
      ['<path d="M70 382 C 120 382, 130 322, 175 322 C 225 322, 240 262, 282 262" fill="none" strokeWidth="4"', '<path d={greenD || undefined} visibility={greenD ? undefined : "hidden"} fill="none" strokeWidth="4"'],
      ['<rect x="44" y="375" width="52" height="9" rx="2" strokeWidth="1.6" style={{"fill":"var(--pl-lit)"', '<rect x="44" y="375" width="52" height="9" rx="2" strokeWidth="1.6" style={{"fill":benchFill(0)'],
      ['<rect x="149" y="315" width="52" height="9" rx="2" strokeWidth="1.6" style={{"fill":"var(--pl-lit)"', '<rect x="149" y="315" width="52" height="9" rx="2" strokeWidth="1.6" style={{"fill":benchFill(1)'],
      ['<rect x="256" y="255" width="52" height="9" rx="2" strokeWidth="1.6" style={{"fill":"var(--pl-card)"', '<rect x="256" y="255" width="52" height="9" rx="2" strokeWidth="1.6" style={{"fill":benchFill(2)'],
      ['<rect x="364" y="201" width="52" height="9" rx="2" strokeWidth="1.6" style={{"fill":"var(--pl-card)"', '<rect x="364" y="201" width="52" height="9" rx="2" strokeWidth="1.6" style={{"fill":benchFill(3)'],
      ['<rect x="472" y="153" width="52" height="9" rx="2" strokeWidth="1.6" style={{"fill":"var(--pl-card)"', '<rect x="472" y="153" width="52" height="9" rx="2" strokeWidth="1.6" style={{"fill":benchFill(4)'],
      ['{"Recruiter screen"}', "{names[0]}"], ['{"Hiring manager"}', "{names[1]}"], ['{"Coding"}', "{names[2]}"], ['{"System design"}', "{names[3]}"], ['{"AI-enabled coding"}', "{names[4]}"],
      ['<g className="at-bob1">', '<g transform={`translate(${at[0] - 282} ${at[1] - 262})`} visibility={you != null ? undefined : "hidden"}><g className="at-bob1">'],
      ['{"YOU · PREPARING"}\n        </text>\n      </g>', '{"YOU · PREPARING"}\n        </text>\n      </g></g>'],
      ['<path d="M300 262 L300 180"', '<path visibility={flagVis} d="M300 262 L300 180"'],
      ['<path d="M300 180 L346 192 L300 204 Z"', '<path visibility={flagVis} d="M300 180 L346 192 L300 204 Z"'],
      ['<rect x="352" y="170"', '<rect visibility={flagVis} x="352" y="170"'],
      ['{"KESTREL · CODING"}', '{flag ? flag[0] : ""}'], ['{"FRI · 2:00 PM"}', '{flag ? flag[1] : ""}'],
    ],
  },
  // ⭐ 47m (D197 #11) · the Logbook's and the Today card's drawings (DrawingsAtlas 1–4): their words become props, each
  // defaulting to the board's.
  //   LogbookDaysLeg — `stops` = today's three waypoints (the trail's words); `kicker`; `firstDone` = the first stop lit.
  LogbookDaysLeg: {
    props: 'stops = ["one review", "a Build question", "watch 58 s"], kicker = "TODAY · 1 OF 3", firstDone = true',
    subs: [
      ['<path d="M40 170 C 100 170, 110 120, 170 120" fill="none" strokeWidth="7"', '<path visibility={firstDone ? undefined : "hidden"} d="M40 170 C 100 170, 110 120, 170 120" fill="none" strokeWidth="7"'],
      ['<circle cx="40" cy="170" r="11" strokeWidth="2" style={{"fill":"var(--pl-lit)"', '<circle cx="40" cy="170" r="11" strokeWidth="2" style={{"fill":firstDone ? "var(--pl-lit)" : "var(--pl-card)"'],
      ['{"one review"}', "{stops[0] || \"\"}"], ['{"a Build question"}', "{stops[1] || \"\"}"], ['{"watch 58 s"}', "{stops[2] || \"\"}"], ['{"TODAY · 1 OF 3"}', "{kicker}"],
    ],
  },
  //   LogbookSummitCairn — `initials` = the pod's four on the cairn; `kicker` = the line under it.
  LogbookSummitCairn: {
    props: 'initials = ["AK", "MC", "JR", "LS"], kicker = "POD · WEEK 48 · YOU ARE 2ND"',
    subs: [['{"AK"}', "{initials[0] || \"\"}"], ['{"MC"}', "{initials[1] || \"\"}"], ['{"JR"}', "{initials[2] || \"\"}"], ['{"LS"}', "{initials[3] || \"\"}"], ['{"POD · WEEK 48 · YOU ARE 2ND"}', "{kicker}"]],
  },
  //   TodaySquareInset — `entry` = the entry today's pick came from; `plate` = its region's plate tag; `mark` = the square's word.
  TodaySquareInset: {
    props: 'entry = "hash map", plate = "PL. III", mark = "?"',
    subs: [['{"hash map"}', "{entry}"], ['{"PL. III"}', "{plate}"], ['{"?"}', "{mark}"]],
  },
  //   LogbookTierStamp — the league tier as a stamp (U5): `tier`, `name`, `foot`.
  LogbookTierStamp: {
    props: 'tier = "LEAGUE · TIER II", name = "Foothills", foot = "WEEK 48 · 214 SQUARES"',
    subs: [['{"LEAGUE · TIER II"}', "{tier}"], ['{"Foothills"}', "{name}"], ['{"WEEK 48 · 214 SQUARES"}', "{foot}"]],
  },
};

// ⭐ 47m (lane person) · the passport's two drawings carry the person's own data — the board's example values are the
// defaults (with no props the drawing is the board's). PassportIdentityPage: the printed fields, the two machine-readable
// lines, up to three proven stamps + one "not yet" (a missing stamp is hidden, never invented) and who sees the page.
// PassportRoad: up to three employers — the first, the one before now, and now (a missing stop is hidden).
const txt = (s) => `{${JSON.stringify(s)}}`;
const PASSPORT_STAMPS = [["translate(400 112) rotate(-8)", "SQL", "11-12 · 3 SQUARES"], ["translate(520 150) rotate(6)", "Python", "10-30 · 3 SQUARES"], ["translate(420 226) rotate(4)", "HTTP", "11-18 · 3 SQUARES"]];
LIVE.PassportIdentityPage = {
  props: 'name = "CHEN, MAYA", handle = "@mayachen", fits = "BACKEND · DATA", place = "BOSTON & REMOTE", years = "4", openTo = "FULL-TIME", mrz = ["P\\u003CDRAFT\\u003CCHEN\\u003C\\u003CMAYA\\u003C\\u003C\\u003C\\u003C\\u003C\\u003C\\u003C", "3PROVEN\\u003C\\u003C14LISTED\\u003C\\u003C\\u003C\\u003C\\u003C\\u003C\\u003C"], stamps = [{ name: "SQL", sub: "11-12 · 3 SQUARES" }, { name: "Python", sub: "10-30 · 3 SQUARES" }, { name: "HTTP", sub: "11-18 · 3 SQUARES" }], notYet = "TypeScript", seenBy = "your connections"',
  pre: "const st = (i) => stamps[i] || null;",
  subs: [
    [txt("CHEN, MAYA"), "{name}"], [txt("@mayachen"), "{handle}"], [txt("BACKEND · DATA"), "{fits}"], [txt("BOSTON & REMOTE"), "{place}"],
    [txt("4"), "{years}"], [txt("FULL-TIME"), "{openTo}"], [txt("P<DRAFT<CHEN<<MAYA<<<<<<<"), "{mrz[0]}"], [txt("3PROVEN<<14LISTED<<<<<<<"), "{mrz[1]}"],
    ...PASSPORT_STAMPS.flatMap(([t, n, sub], i) => [[`<g transform="${t}">`, `<g transform="${t}" visibility={st(${i}) ? undefined : "hidden"}>`], [txt(n), `{st(${i})?.name}`], [txt(sub), `{st(${i})?.sub}`]]),
    ['<g transform="translate(520 300) rotate(-5)">', '<g transform="translate(520 300) rotate(-5)" visibility={notYet ? undefined : "hidden"}>'], [txt("TypeScript"), "{notYet}"],
    [txt("your connections"), "{seenBy}"],
  ],
};
LIVE.PassportRoad = {
  props: 'stops = [{ name: "Larkspur Analytics", when: "2021–22" }, { name: "Fennel Health", when: "2022–24" }, { name: "Halcyon Data", when: "2024 → now" }]',
  pre: "const at = (i) => stops[i] || null;",
  subs: [["40", "Larkspur Analytics", "2021–22", 11], ["240", "Fennel Health", "2022–24", 11], ["480", "Halcyon Data", "2024 → now", 15]].flatMap(([x, n, w, r], i) => [
    [`<circle cx="${x}" cy="64" r="${r}"`, `<circle visibility={at(${i}) ? undefined : "hidden"} cx="${x}" cy="64" r="${r}"`],
    [txt(n), `{at(${i})?.name}`], [txt(w), `{at(${i})?.when}`]]),
};

// The other ported plates' printed words, made props the same way (each board word is its prop's default), so a real page
// prints the person's own words — never the board's example person.
const textLive = (props) => ({
  props: Object.entries(props).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(", "),
  subs: Object.entries(props).map(([k, v]) => [txt(v), `{${k}}`]),
});
Object.assign(LIVE, {
  ProfileFieldBook: textLive({ line1: "Backend engineer who likes the", line2: "boring parts: queues, retries,", line3: "the ledger that has to add up." }),
  ProfileSpecimenDrawer: textLive({ p1: "ledger-svc", s1: "GO · POSTGRES", p2: "retry-lab", s2: "PYTHON", p3: "orders-cache", s3: "REDIS", p4: "pdf-parse", s4: "RUST", p5: "talk · idempotency", s5: "SLIDES" }),
  ProfileSchoolhouse: textLive({ caption: "NORTHEASTERN · M.S. · 2021" }),
  SettingOutCounter: textLive({ name: "Maya Chen", caption: "YOUR RÉSUMÉ · READ IN 6 S · NO AI" }),
  BearingsCompassRose: textLive({ needle1: "Data", needle2: "Platform", active: "Backend" }),
  VoyageClipboard: textLive({ name: "Maya Chen", email: "maya@example.com", why: "WHY KESTREL?", start: "January" }),
  VoyagePostRack: textLive({ caption: "KESTREL · 3 LETTERS · 1 NEW" }),
});

export function applyLive(name, jsx) {
  const live = LIVE[name];
  if (!live) return jsx;
  let out = jsx;
  for (const [from, to] of live.subs) {
    const n = out.split(from).length - 1;
    if (n !== 1) throw new Error(`${name}: a live substitution matched ${n} times (expected 1): ${from.slice(0, 60)}`);
    out = out.replace(from, () => to);
  }
  return out;
}

/** hex (upper-case, #RRGGBB) → `--pl-*`, the FIRST token in plate.css that holds it (core before regions). */
export function tokenMap(css = fs.readFileSync(TOKENS, "utf8")) {
  const map = new Map();
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--pl-[\w-]+):\s*(#[0-9A-Fa-f]{6})\b/g)) {
    const hex = m[2].toUpperCase();
    if (!map.has(hex)) map.set(hex, m[1]);
  }
  return map;
}

const FONT = { "instrument serif": "var(--pl-serif)", "inter tight": "var(--pl-sans)", "jetbrains mono": "var(--pl-mono)" };
const fontToken = (v) => {
  const first = v.split(",")[0].trim().replace(/['"]/g, "").toLowerCase();
  if (!FONT[first]) throw new Error(`no font token for "${v}"`);
  return FONT[first];
};
const COLOUR_PROPS = new Set(["fill", "stroke", "stop-color"]);
const KEEP = new Set(["none", "transparent", "currentColor"]);

function colour(v, map, where) {
  const t = v.trim();
  if (KEEP.has(t) || /^url\(#/.test(t)) return null;
  const hex = t.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!hex) throw new Error(`a colour that is not a hex in ${where}: "${v}" — add a token and map it`);
  const full = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
  const tok = map.get(("#" + full).toUpperCase());
  if (!tok) throw new Error(`no plate token holds ${t} (${where}) — add it to client/src/styles/plate.css first`);
  return `var(${tok})`;
}

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const jsxAttr = (name) => {
  if (name.startsWith("sc-camel-")) return camel(name.slice(9));
  if (name === "class") return "className";
  if (name.startsWith("aria-") || name === "role") return name;
  return camel(name);
};

function parseStyle(s) {
  const out = {};
  for (const d of s.split(";")) {
    const i = d.indexOf(":");
    if (i < 0) continue;
    const k = d.slice(0, i).trim(), v = d.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

/** A tiny SVG tokenizer: tags, attributes, text. The export's SVG is well-formed (it is React output). */
function tokens(svg) {
  const out = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(svg))) {
    if (m[5] !== undefined) { if (m[5].trim()) out.push({ text: m[5] }); continue; }
    const attrs = [...m[3].matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]);
    out.push({ close: !!m[1], tag: m[2], attrs, self: !!m[4] });
  }
  return out;
}

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const jsString = (s) => JSON.stringify(decode(s));

/** One drawing → the body of a component. Returns { jsx, ids, label, viewBox, animates }. */
export function portSvg(svg, map, where) {
  const toks = tokens(svg);
  const ids = new Set();
  for (const t of toks) for (const [k, v] of t.attrs || []) if (k === "id") ids.add(v);
  const idExpr = (v) => "`${uid}" + v + "`";
  const refExpr = (v) => {
    const m = v.match(/^url\(#([^)]+)\)$/);
    return m && ids.has(m[1]) ? "`url(#${uid}" + m[1] + ")`" : null;
  };
  let depth = 0, label = null, viewBox = null, animates = 0;
  const bindings = new Set();
  const lines = [];
  const openAt = [];   // the line index of each open tag, innermost last
  let skipClose = 0;   // a colour <animate> folded into its parent: its closing tag is dropped too
  const pad = () => "  ".repeat(depth + 2);
  for (const t of toks) {
    if (t.text !== undefined) { lines.push(pad() + "{" + jsString(t.text) + "}"); continue; }
    if (t.close) {
      if (t.tag === "animate" && skipClose) { skipClose--; continue; }
      depth--; openAt.pop(); lines.push(pad() + `</${t.tag}>`); if (t.tag === "animate") lines.push(pad() + "</>)}"); continue;
    }
    // ⭐ A COLOUR <animate> (fill A → B → A): SMIL animates the presentation ATTRIBUTE, which the port's inline style (where
    // every colour token must live) outranks — the blink would never show, and its values are raw hexes. It becomes the same
    // blink as a CSS animation on its parent: plFillBlink in plate/plate.css, its two colours as tokens in custom properties,
    // the same duration, and nothing under reduced motion (the `motion` flag the SMIL used).
    const attrName = t.tag === "animate" ? (t.attrs.find(([k]) => k === "attributeName" || k === "sc-camel-attribute-name") || [])[1] : null;
    if (attrName && COLOUR_PROPS.has(attrName)) {
      const get = (k) => (t.attrs.find(([a]) => a === k || a === `sc-camel-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`) || [])[1];
      const vals = String(get("values") || "").split(";").map((x) => x.trim()).filter(Boolean);
      if (attrName !== "fill" || vals.length !== 3 || vals[0].toUpperCase() !== vals[2].toUpperCase() || get("repeatCount") !== "indefinite") {
        throw new Error(`a colour animation the port can't fold in ${where}: ${attrName} ${vals.join(";")}`);
      }
      const a = colour(vals[0], map, where), b2 = colour(vals[1], map, where);
      const pi = openAt[openAt.length - 1];
      if (pi == null || !/style=\{\{/.test(lines[pi])) throw new Error(`a colour animation with no styled parent in ${where}`);
      lines[pi] = lines[pi].replace(/style=\{\{/, `style={{...(motion ? {"--pl-blink-a":${JSON.stringify(a)},"--pl-blink-b":${JSON.stringify(b2)},"animation":${JSON.stringify(`plFillBlink ${get("dur")} infinite`)}} : {}),`);
      animates++;
      if (!t.self) skipClose++;
      continue;
    }
    const props = [];
    const style = {};
    const styleExpr = {};
    for (const [k, raw] of t.attrs) {
      const v = decode(raw);
      const bound = v.match(/^\{\{\s*(\w+)\s*\}\}$/);
      if (bound) {
        bindings.add(bound[1]);
        if (COLOUR_PROPS.has(k)) styleExpr[camel(k)] = bound[1]; else props.push(`${jsxAttr(k)}={${bound[1]}}`);
        continue;
      }
      if (/\{\{/.test(v)) throw new Error(`a template expression the port can't read in ${where}: "${v}"`);
      if (t.tag === "svg" && k === "aria-label") { label = v; props.push("aria-label={label}"); continue; }
      if (t.tag === "svg" && (k === "sc-camel-view-box" || k === "viewBox")) viewBox = v;   // 47m: the final boards write viewBox plainly
      if (k === "style") {
        for (const [sk, sv] of Object.entries(parseStyle(v))) {
          if (sk === "font-family") style.fontFamily = fontToken(sv);
          else if (/color|fill|stroke|background/.test(sk) && !/width|dash|linecap|linejoin|opacity/.test(sk)) style[camel(sk)] = colour(sv, map, where) ?? sv;
          else style[camel(sk)] = sv;
        }
        continue;
      }
      if (COLOUR_PROPS.has(k)) {
        const ref = refExpr(v);
        if (ref) { props.push(`${jsxAttr(k)}={${ref}}`); continue; }
        const tok = colour(v, map, where);
        if (tok) { style[camel(k)] = tok; continue; }
        props.push(`${jsxAttr(k)}=${JSON.stringify(v)}`);
        continue;
      }
      if (k === "font-family") { style.fontFamily = fontToken(v); continue; }
      if (k === "id") { props.push(`id={${idExpr(v)}}`); continue; }
      const ref = refExpr(v);
      if (ref) { props.push(`${jsxAttr(k)}={${ref}}`); continue; }
      props.push(`${jsxAttr(k)}=${JSON.stringify(v)}`);
    }
    if (t.tag === "svg") props.push("className={className}");
    if (Object.keys(style).length || Object.keys(styleExpr).length) {
      const parts = [...Object.entries(style).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`), ...Object.entries(styleExpr).map(([k, e]) => `${JSON.stringify(k)}:${e}`)];
      props.push(`style={{${parts.join(",")}}}`);
    }
    if (t.tag === "animate") { animates++; lines.push(pad() + "{motion && (<>"); }
    const open = `<${t.tag}${props.length ? " " + props.join(" ") : ""}${t.self ? " />" : ">"}`;
    lines.push(pad() + open);
    if (t.self) { if (t.tag === "animate") lines.push(pad() + "</>)}"); continue; }
    openAt.push(lines.length - 1);
    depth++;
  }
  if (depth !== 0) throw new Error(`unbalanced SVG in ${where}`);
  return { jsx: lines.join("\n"), ids: [...ids], label, viewBox, animates, bindings: [...bindings] };
}

const HEADER = (name, board, viewBox, src = SOURCES.v3.name) => `// ⛔ GENERATED by scripts/d196PortDrawings.mjs from ${src} — do not edit.
// D196 F2: "${board}", the drawing ${name} (viewBox ${viewBox}), ported path for path; colours are plate tokens.
// To change the drawing, change the canvas, re-export it and re-run the script (test/d196DrawingsPorted… holds this).
`;

export function render(name, board, ported, src) {
  const bound = ported.bindings || [];
  for (const b of bound) if (!BINDINGS[name] || !(b in BINDINGS[name])) throw new Error(`${name}: the binding {{ ${b} }} has no default in BINDINGS`);
  const boundProps = bound.length ? ", " + bound.map((b) => `${b} = ${JSON.stringify(BINDINGS[name][b])}`).join(", ") : "";
  return HEADER(name, board, ported.viewBox, src) + `import { useId } from "react";
import { usePlateMotion } from "../motion.js";

export const ${name}Label = ${JSON.stringify(ported.label || name)};

/** ${(ported.label || name).replace(/\*\//g, "")} */
export default function ${name}({ label = ${name}Label, className${LIVE[name] ? ", " + LIVE[name].props : ""}${boundProps} }) {
  const uid = useId().replace(/:/g, "");
  const motion = usePlateMotion();
  void uid; void motion;${LIVE[name]?.pre ? "\n  " + LIVE[name].pre : ""}
  return (
${applyLive(name, ported.jsx)}
  );
}
`;
}

export function boardDrawings(indexes) {
  const out = [];
  for (const b of BOARDS) {
    if (b.dc) {
      const name = `docs/sketches/final/project/${b.dc}.dc.html`;
      const html = fs.readFileSync(path.join(DC_DIR, `${b.dc}.dc.html`), "utf8");
      const body = html.slice(html.indexOf("<x-dc>"));
      const all = [...body.matchAll(/<svg[^>]*role="img"[\s\S]*?<\/svg>/g)].map((m) => m[0]);
      const svgs = b.pick ? b.pick.map((i) => all[i]) : all;
      if (svgs.some((s) => !s) || svgs.length !== b.drawings.length) throw new Error(`"${b.title}" has ${all.length} drawings, the port expects ${b.drawings.length}${b.pick ? ` (picked ${b.pick.join(", ")})` : ""}`);
      svgs.forEach((svg, i) => out.push({ name: b.drawings[i], board: b.title, svg, src: name }));
      continue;
    }
    let tpl, srcName;
    if (b.file) {
      srcName = `docs/sketches/final/project/${b.file}`;
      tpl = fs.readFileSync(path.join(FINAL_DIR, b.file), "utf8");
    } else {
      const src = SOURCES[b.source || "v3"];
      const index = indexes[b.source || "v3"];
      const row = index.find((r) => r.title === b.title);
      if (!row) throw new Error(`the export ${src.name} has no board "${b.title}"`);
      tpl = fs.readFileSync(path.join(src.out, row.id, "template.html"), "utf8");
      srcName = src.name;
    }
    const body = tpl.slice(tpl.indexOf("<x-dc>"));
    const svgs = [...body.matchAll(/<svg[^>]*role="img"[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    if (svgs.length !== b.drawings.length) throw new Error(`"${b.title}" has ${svgs.length} drawings, the port expects ${b.drawings.length}`);
    svgs.forEach((svg, i) => { if (b.drawings[i]) out.push({ name: b.drawings[i], board: b.title, svg, src: srcName }); });
  }
  return out;
}

export function generate() {
  const indexes = Object.fromEntries(Object.entries(SOURCES).filter(([, v]) => !v.sheet).map(([k, v]) => [k, unpackCanvas(v.file, v.out)]));
  const map = tokenMap();
  const files = boardDrawings(indexes).map((d) => ({ ...d, source: render(d.name, d.board, portSvg(d.svg, map, `${d.board} / ${d.name}`), d.src) }));
  const names = files.map((f) => f.name);
  files.push({ name: "index", ext: ".js", source: `// ⛔ GENERATED with the drawings by scripts/d196PortDrawings.mjs — the v3 drawings by name.\n`
    + names.map((n) => `import ${n} from "./${n}.jsx";`).join("\n") + `\n\nexport const DRAWINGS = { ${names.join(", ")} };\n` });
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const files = generate();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let stale = 0;
  for (const f of files) {
    const p = path.join(OUT_DIR, f.name + (f.ext || ".jsx"));
    if (check) {
      const cur = fs.existsSync(p) ? fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n") : null;
      if (cur !== f.source) { stale++; console.log(`STALE ${f.name}`); }
    } else { fs.writeFileSync(p, f.source); console.log(`wrote ${path.relative(ROOT, p)} (${f.source.length} bytes)`); }
  }
  if (check && stale) process.exit(1);
}
