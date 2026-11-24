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
];

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
};

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
      if (t.tag === "svg" && k === "sc-camel-view-box") viewBox = v;
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
    const src = SOURCES[b.source || "v3"];
    const index = indexes[b.source || "v3"];
    const row = index.find((r) => r.title === b.title);
    if (!row) throw new Error(`the export ${src.name} has no board "${b.title}"`);
    const tpl = fs.readFileSync(path.join(src.out, row.id, "template.html"), "utf8");
    const body = tpl.slice(tpl.indexOf("<x-dc>"));
    const svgs = [...body.matchAll(/<svg[^>]*role="img"[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    if (svgs.length !== b.drawings.length) throw new Error(`"${b.title}" has ${svgs.length} drawings, the port expects ${b.drawings.length}`);
    svgs.forEach((svg, i) => out.push({ name: b.drawings[i], board: b.title, svg, src: src.name }));
  }
  return out;
}

export function generate() {
  const indexes = Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, unpackCanvas(v.file, v.out)]));
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
