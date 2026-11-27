// 47l: generators for the canvas boards added in 47l (run: node scripts/sketches47l/<board>.mjs <out file or dir>).
// Shared pieces for the 47l boards: the shell is lifted verbatim from the approved Gazetteer sample.
import fs from "node:fs";
const SRC = new URL("../../docs/sketches/final/project/Gazetteer.dc.html", import.meta.url);
const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/);
export const HEAD = lines.slice(0, 39).join("\n"); // doctype … </style>
// lines 40..63 (1-based) = <div id="top"> … </header>
const shellRaw = lines.slice(39, 64).join("\n").replace(/<\/header>[\s\S]*$/, "</header>");

const CUR = 'aria-current="page" style="display: inline-flex; align-items: center; gap: 8px; min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 10px; text-decoration: none; color: #1B1B1B; font-size: 14.5px; background: #FFFFFF; border: 1.5px solid #1B1B1B; box-shadow: 3px 3px 0 #1B1B1B; font-weight: 700;"';
const OFF = 'style="display: inline-flex; align-items: center; gap: 8px; min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 10px; text-decoration: none; color: #1B1B1B; font-size: 14.5px; border: 1.5px solid transparent; font-weight: 500;"';

/** The shell with one Atlas tab current: "Gazetteer" | "Routes" | null; dockCurrent: "Atlas" | "Ask draft" | "Profile" | "Interview" */
export function shell({ tab = "Gazetteer", title } = {}) {
  let s = shellRaw.replace('href="#top" class="at-link" ' + CUR, 'href="GazetteerIndex.dc.html" class="at-link" ' + OFF);
  s = s.replace('href="Shelves.dc.html"', 'href="Library.dc.html"');
  if (tab === "Gazetteer") s = s.replace('href="GazetteerIndex.dc.html" class="at-link" ' + OFF, 'href="GazetteerIndex.dc.html" class="at-link" ' + CUR);
  if (tab === "Routes") s = s.replace('href="#routes" class="at-link" ' + OFF, 'href="Route.dc.html" class="at-link" ' + CUR);
  else s = s.replace('href="#routes"', 'href="Route.dc.html"');
  if (title) s = s.replace("<title>", "<title>");
  return s;
}
export function head(title) { return HEAD.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`); }
export function foot(h) {
  return `</div></div></div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1280,"height":${h}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;
}
export const MONO = "font-family: 'JetBrains Mono', ui-monospace, monospace";
export const SERIF = "font-family: 'Instrument Serif', Georgia, serif";
export const mono = (t, c = "#1B1B1B", sz = 10, extra = "") => `<span style="${MONO}; font-size: ${sz}px; font-weight: 700; letter-spacing: .12em; color: ${c}; ${extra}">${t}</span>`;
export const dotted = (t, href = "GazetteerEntry") => `<a href="${href === "GazetteerEntry" ? "Gazetteer.dc.html" : href}" style="color: #1B1B1B; text-decoration: underline; text-decoration-style: dotted; text-decoration-thickness: 1.5px; text-underline-offset: 3px">${t}</a>`;
export function card(title, body, { shadow = "#1B1B1B", right = "", id = "", pad = "14px 16px 16px", label = "" } = {}) {
  return `<section${id ? ` id="${id}"` : ""}${label ? ` aria-label="${label}"` : ""} style="background: #FFFFFF; border: 1.5px solid #1B1B1B; border-radius: 18px; box-shadow: 5px 5px 0 ${shadow}; overflow: hidden"><div style="padding: 9px 16px; border-bottom: 1.5px solid #1B1B1B; background: #FBF8F4; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px">${mono(title)}${right ? mono(right, "#55504C") : ""}</div><div style="padding: ${pad}">${body}</div></section>`;
}
export const REG = {
  I: ["Foundations", "#C2593A", "#FBEFEA"], II: ["[Part 2 name]", "#4B3FA8", "#F0EEFA"], III: ["Algorithms", "#B4532A", "#FAEEE6"],
  IV: ["Systems & networks", "#1F3A63", "#EDF1F7"], V: ["Security & money", "#6A3E73", "#F4EDF5"], VI: ["Languages & media", "#2F6B7A", "#EAF3F5"],
  VII: ["The physical world", "#7A5A2A", "#F5EFE5"], VIII: ["Intelligence", "#5A5F2E", "#F1F2E8"],
};
export const plChip = (r, href = "Map.dc.html") => `<a href="${href}" style="display: inline-flex; align-items: center; height: 24px; padding: 0 7px; border-radius: 7px; border: 1.5px solid #1B1B1B; background: ${REG[r][1]}; color: #FFFFFF; text-decoration: none; ${MONO}; font-size: 9.5px; font-weight: 700">PL. ${r}</a>`;
/** n lit of 3 squares (lit green, dashed = not yet) */
export const squares = (n, label = true) => `<span${label ? ` aria-label="${n} of 3 squares lit"` : ' aria-hidden="true"'} style="display: inline-flex; gap: 3px">${[0, 1, 2].map((i) => `<span style="width: 12px; height: 12px; border-radius: 3px; border: 1.5px ${i < n ? "solid" : "dashed"} #1B1B1B; background: ${i < n ? "#3E6B5A" : "#FFFFFF"}"></span>`).join("")}</span>`;
export const btn = (t, { ink = false, href = "", shadow = "" } = {}) => {
  const st = `display: inline-flex; align-items: center; gap: 8px; box-sizing: border-box; min-height: 40px; padding: 0 12px; border-radius: 10px; border: 1.5px solid #1B1B1B; background: ${ink ? "#1B1B1B" : "#FFFFFF"}; color: ${ink ? "#F4EFE9" : "#1B1B1B"}; font-weight: 800; font-size: 13.5px; text-decoration: none;${shadow ? ` box-shadow: 3px 3px 0 ${shadow};` : ""}`;
  return href ? `<a href="${href}" style="${st}">${t}</a>` : `<button type="button" style="all: unset; cursor: pointer; ${st}">${t}</button>`;
};
export const chip = (t, { on = false, count = "", href = "" } = {}) => {
  const st = `display: inline-flex; align-items: center; gap: 7px; min-height: 36px; box-sizing: border-box; padding: 0 11px; border-radius: 9px; border: 1.5px solid #1B1B1B; background: ${on ? "#1B1B1B" : "#FFFFFF"}; color: ${on ? "#F4EFE9" : "#1B1B1B"}; text-decoration: none; font-size: 13px; font-weight: 700;${on ? " box-shadow: 3px 3px 0 #C2593A;" : ""}`;
  const inner = `${t}${count !== "" ? ` <span style="${MONO}; font-size: 10px; opacity: .85">${count}</span>` : ""}`;
  return href ? `<a href="${href}" style="${st}">${inner}</a>` : `<button type="button" aria-pressed="${on}" style="all: unset; cursor: pointer; ${st}">${inner}</button>`;
};
export const kicker = (k, lead) => `<div style="max-width: 1180px; margin: 0 auto; padding: 22px 24px 0; box-sizing: border-box"><p style="margin: 0; font-size: 13px; color: #55504C">${mono(k, "#55504C")} ${lead}</p></div>`;
