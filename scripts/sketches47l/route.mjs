import fs from "node:fs";
import { head, shell, foot, mono, MONO, SERIF, card, REG, plChip, squares, btn } from "./common.mjs";
const OUT = process.argv[2];
const H = 3200;

// stops: word, region, stage (0 start … 3 master), state: walked | here | ahead | elsewhere
const STOPS = [
  ["array", "I", 0, "walked"], ["two pointers", "III", 0, "walked"], ["binary search", "III", 1, "elsewhere"], ["hash map", "III", 1, "here"],
  ["sliding window", "III", 1, "ahead"], ["stack", "III", 1, "ahead"], ["tree", "III", 2, "ahead"], ["heap", "III", 2, "elsewhere"],
  ["graph", "III", 2, "ahead"], ["dynamic programming", "III", 3, "ahead"], ["a mock round", "III", 3, "ahead"],
];
const STAGE = ["START", "BUILD", "DEEPEN", "MASTER"];
const STAGECOL = ["#3E6B5A", "#1F3A63", "#C2593A", "#6A3E73"];

// ── the drawn map: x along the route, y by stage (height = what you prove) ──
const W = 1120, Hm = 470;
const xs = STOPS.map((_, i) => 70 + i * ((W - 140) / (STOPS.length - 1)));
const yOf = (st, i) => [385, 290, 195, 105][st] + ((i % 2) ? -14 : 12);
const pts = STOPS.map((s, i) => [Math.round(xs[i]), yOf(s[2], i)]);
const pathD = pts.map((p, i) => {
  if (!i) return `M${p[0]} ${p[1]}`;
  const q = pts[i - 1], mx = (q[0] + p[0]) / 2;
  return `C ${mx} ${q[1]}, ${mx} ${p[1]}, ${p[0]} ${p[1]}`;
}).join(" ");
const hereIdx = 3;
const walkedD = pts.slice(0, hereIdx + 1).map((p, i, a) => { if (!i) return `M${p[0]} ${p[1]}`; const q = a[i - 1], mx = (q[0] + p[0]) / 2; return `C ${mx} ${q[1]}, ${mx} ${p[1]}, ${p[0]} ${p[1]}`; }).join(" ");
const contours = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
  const y = 430 - k * 50;
  return `<path d="M0 ${y} C 160 ${y - 22 - k * 3}, 300 ${y + 18}, 470 ${y - 10} S 760 ${y - 30 - k * 4}, 900 ${y - 6} S 1060 ${y - 26}, 1120 ${y - 14}" fill="none" stroke="#B4532A" stroke-opacity="${0.18 + k * 0.03}" stroke-width="1.2"></path>`;
}).join("");
const bands = [["LOWLANDS · START", 410], ["FOOTHILLS · BUILD", 318], ["HIGHLANDS · DEEPEN", 222], ["SUMMIT · MASTER", 130]].map(([t, y]) => `<text x="${W - 14}" y="${y}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" letter-spacing="1.2" fill="#55504C">${t}</text>`).join("");
const stations = STOPS.map(([w, r, st, state], i) => {
  const [x, y] = pts[i];
  const ly = y + (i % 2 ? -26 : 34);
  let mark;
  if (state === "walked") mark = `<circle cx="${x}" cy="${y}" r="13" fill="#3E6B5A" stroke="#1B1B1B" stroke-width="2"></circle><path d="M${x - 6} ${y} l4 4 8-9" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"></path>`;
  else if (state === "elsewhere") mark = `<circle cx="${x}" cy="${y}" r="17" fill="none" stroke="#3E6B5A" stroke-width="2" stroke-dasharray="3 3"></circle><circle cx="${x}" cy="${y}" r="13" fill="#3E6B5A" stroke="#1B1B1B" stroke-width="2"></circle><path d="M${x - 6} ${y} l4 4 8-9" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"></path>`;
  else if (state === "here") mark = `<circle cx="${x}" cy="${y}" r="20" fill="#C2593A" stroke="#1B1B1B" stroke-width="2.4"></circle><circle cx="${x}" cy="${y}" r="6" fill="#FFFFFF" stroke="#1B1B1B" stroke-width="1.5"></circle>`;
  else mark = i === STOPS.length - 1
    ? `<rect x="${x - 14}" y="${y - 14}" width="28" height="28" rx="5" fill="#FFFFFF" stroke="#1B1B1B" stroke-width="2"></rect><path d="M${x - 6} ${y + 6} l6-12 6 12z" fill="#1B1B1B"></path>`
    : `<circle cx="${x}" cy="${y}" r="13" fill="#FFFFFF" stroke="#1B1B1B" stroke-width="2"></circle>`;
  return `<g>${mark}<text x="${x}" y="${ly}" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="17" fill="#1B1B1B">${w}</text><text x="${x}" y="${ly + (i % 2 ? -16 : 15)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700" fill="${REG[r][1]}">PL. ${r} · ${String(i + 1).padStart(2, "0")}</text></g>`;
}).join("");
const [hx, hy] = pts[hereIdx];
const svg = `<svg role="img" aria-label="The Coding interview patterns route drawn on the physical map: it starts in the lowlands of Plate I at array, crosses into Plate III, and climbs to the summit at a mock round. Array and two pointers are walked, binary search and heap are already lit from other routes, and you are at hash map, stop 4." viewBox="0 0 ${W} ${Hm}" width="100%" style="display: block; min-width: 860px">
<rect width="${W}" height="${Hm}" fill="#FBF8F4"></rect>
<rect x="0" y="0" width="150" height="${Hm}" fill="${REG.I[2]}"></rect><rect x="150" y="0" width="${W - 150}" height="${Hm}" fill="${REG.III[2]}" opacity=".7"></rect>
${contours}
<text x="18" y="34" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="700" letter-spacing="1.4" fill="${REG.I[1]}">PL. I · FOUNDATIONS</text>
<text x="176" y="34" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="700" letter-spacing="1.4" fill="${REG.III[1]}">PL. III · ALGORITHMS</text>
${bands}
<path d="${pathD}" fill="none" stroke="#1B1B1B" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"></path>
<path d="${pathD}" fill="none" stroke="#F4EFE9" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"></path>
<path class="at-draw" d="${walkedD}" fill="none" stroke="#3E6B5A" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"></path>
<path d="M${pts[4][0]} ${pts[4][1]} L${pts[4][0] + 18} ${pts[4][1] - 70}" stroke="#1F3A63" stroke-width="3" stroke-dasharray="5 5"></path>
<g><rect x="${pts[4][0] - 52}" y="${pts[4][1] - 98}" width="140" height="26" rx="6" fill="#FFFFFF" stroke="#1B1B1B" stroke-width="1.5"></rect><text x="${pts[4][0] + 18}" y="${pts[4][1] - 81}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" fill="#1F3A63">⇄ SYSTEM DESIGN ROUTE</text></g>
${stations}
<g class="at-bob1"><rect x="${hx - 64}" y="${hy - 78}" width="128" height="34" rx="6" fill="#1B1B1B"></rect><text x="${hx}" y="${hy - 56}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="700" fill="#F4EFE9" letter-spacing="1">YOU ARE HERE</text><path d="M${hx - 6} ${hy - 44} l6 8 6-8z" fill="#1B1B1B"></path></g>
<g transform="translate(${W - 70} 52)" aria-hidden="true"><circle r="24" fill="#FFFFFF" stroke="#1B1B1B" stroke-width="1.5"></circle><path d="M0 -20 L5 0 L0 20 L-5 0 Z" fill="#1B1B1B"></path><text y="-28" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" fill="#1B1B1B">N</text></g>
</svg>`;

const legend = `<div style="display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 10px 16px 14px; align-items: center; font-size: 13px">
<span style="display: inline-flex; gap: 6px; align-items: center"><span aria-hidden="true" style="width: 14px; height: 14px; border-radius: 50%; background: #3E6B5A; border: 1.5px solid #1B1B1B"></span>Walked on this route</span>
<span style="display: inline-flex; gap: 6px; align-items: center"><span aria-hidden="true" style="width: 14px; height: 14px; border-radius: 50%; background: #3E6B5A; border: 1.5px solid #1B1B1B; outline: 1.5px dashed #3E6B5A; outline-offset: 2px"></span>Already lit on another route — it counts here</span>
<span style="display: inline-flex; gap: 6px; align-items: center"><span aria-hidden="true" style="width: 14px; height: 14px; border-radius: 50%; background: #C2593A; border: 1.5px solid #1B1B1B"></span>You are here</span>
<span style="display: inline-flex; gap: 6px; align-items: center"><span aria-hidden="true" style="width: 14px; height: 14px; border-radius: 50%; background: #FFFFFF; border: 1.5px solid #1B1B1B"></span>Ahead</span>
<span style="display: inline-flex; gap: 6px; align-items: center"><span aria-hidden="true" style="width: 14px; height: 14px; border-radius: 3px; background: #FFFFFF; border: 1.5px solid #1B1B1B"></span>The last stop: a practice round</span>
<span style="flex: 1 1 auto"></span><span style="font-size: 12.5px; color: #55504C">Higher on the map = a harder stage. Tap any stop to open its entry.</span></div>`;

const lit = (s) => (s === "walked" || s === "elsewhere") ? 3 : 0;
const stopRow = ([w, r, st, state], i) => {
  const isHere = state === "here";
  const status = { walked: ["LIT HERE", "#3E6B5A"], elsewhere: ["LIT ON ANOTHER ROUTE", "#3E6B5A"], here: ["YOU ARE HERE", "#C2593A"], ahead: ["AHEAD", "#55504C"] }[state];
  const q = [4, 3, 5, 4, 3, 4, 6, 5, 6, 8, 1][i];
  const main = `<div style="display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center">
<span style="flex: 0 0 34px; ${SERIF}; font-size: 30px; line-height: 1; color: transparent; -webkit-text-stroke: 1.2px ${isHere ? "#C2593A" : "#1B1B1B"}">${String(i + 1).padStart(2, "0")}</span>
<a href="Gazetteer.dc.html" style="flex: 1 1 200px; ${SERIF}; font-size: ${isHere ? 28 : 22}px; color: #1B1B1B; text-decoration: none; line-height: 1.1">${w}</a>
${plChip(r)}<span style="${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: .1em; color: ${STAGECOL[st]}">${STAGE[st]}</span>
${squares(isHere ? 1 : lit(state))}
<span style="flex: 0 0 150px; ${MONO}; font-size: 9.5px; font-weight: 700; color: ${status[1]}">${status[0]}</span>
<span style="${MONO}; font-size: 9.5px; font-weight: 700; color: #55504C">${i === STOPS.length - 1 ? "45 MIN · 3 QUESTIONS" : `${q} QUESTIONS`}</span></div>`;
  const more = isHere ? `<div style="margin: 12px 0 2px 48px; display: flex; flex-wrap: wrap; gap: 12px">
<div style="flex: 2 1 300px; min-width: 0; border: 1.5px solid #1B1B1B; border-radius: 12px; background: #FFFFFF; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px">${mono("UP NEXT IN THIS ENTRY · BUILD", "#8A3A22", 9.5)}<span style="font-size: 15px; line-height: 1.45">Find two numbers in a list that add to a target, in one pass.</span><span style="display: flex; flex-wrap: wrap; gap: 8px">${btn("Try it", { ink: true })}${btn("Open the entry", { href: "Gazetteer.dc.html" })}</span></div>
<a href="Explainer.dc.html" style="flex: 1 1 200px; min-width: 0; border: 1.5px solid #1B1B1B; border-radius: 12px; background: #FFFFFF; padding: 10px 12px; text-decoration: none; color: #1B1B1B; display: flex; flex-direction: column; gap: 4px">${mono("WATCH IT · 58 S", "#1B1B1B", 9.5)}<span style="${SERIF}; font-size: 20px">Big O, acted out</span><span style="font-size: 13px; color: #3F3A36">the key “cat” drops into its bucket at beat 4</span></a></div>` : "";
  return `<li style="padding: ${isHere ? "14px 16px" : "10px 16px"}; border-top: ${i ? "1px solid #E6DED8" : "0"}; ${isHere ? "background: #FAEEE6; box-shadow: inset 4px 0 0 #C2593A;" : ""}">${main}${more}</li>`;
};
const stopsList = `<section aria-label="The stops" style="background: #FFFFFF; border: 1.5px solid #1B1B1B; border-radius: 18px; box-shadow: 5px 5px 0 #1B1B1B; overflow: hidden"><div style="padding: 9px 16px; border-bottom: 1.5px solid #1B1B1B; background: #FBF8F4; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px">${mono("THE STOPS · 11 ENTRIES IN ORDER")}${mono("JOIN, LEAVE OR SKIP AT ANY STOP", "#55504C")}</div><ol style="list-style: none; margin: 0; padding: 0">${STOPS.map(stopRow).join("")}</ol></section>`;

// a project route: ends in a build, crosses plates III → IV → V
const P = [["hash map", "III"], ["HTTP", "IV"], ["REST API", "IV"], ["database index", "IV"], ["hashing (passwords)", "V"], ["rate limiting", "V"]];
const px = (i) => 60 + i * 150;
const proj = `<svg role="img" aria-label="A project route: hash map, HTTP, REST API, database index, hashing passwords and rate limiting, ending in a build: a URL shortener" viewBox="0 0 1060 150" width="100%" style="display: block; min-width: 820px">
<rect width="1060" height="150" fill="#FBF8F4"></rect>
<path d="M60 60 L960 60" stroke="#1B1B1B" stroke-width="15" stroke-linecap="round"></path>
${P.map(([, r], i) => i < P.length ? `<path d="M${px(i)} 60 L${i === P.length - 1 ? 960 : px(i + 1)} 60" stroke="${REG[r][1]}" stroke-width="9"></path>` : "").join("")}
<path d="M60 60 L${px(0)} 60" stroke="${REG.III[1]}" stroke-width="9" stroke-linecap="round"></path>
${P.map(([w, r], i) => `<g><circle cx="${px(i)}" cy="60" r="13" fill="${i === 0 ? "#3E6B5A" : "#FFFFFF"}" stroke="#1B1B1B" stroke-width="2"></circle>${i === 0 ? `<path d="M${px(i) - 6} 60 l4 4 8-9" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"></path>` : ""}<text x="${px(i)}" y="104" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="16" fill="#1B1B1B">${w}</text><text x="${px(i)}" y="122" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700" fill="${REG[r][1]}">PL. ${r}</text></g>`).join("")}
<g><rect x="930" y="28" width="64" height="64" rx="8" fill="#FFFFFF" stroke="#1B1B1B" stroke-width="2"></rect><path d="M946 76 L962 44 L978 76 Z M954 76 L954 64 L970 64 L970 76" fill="none" stroke="#1B1B1B" stroke-width="2" stroke-linejoin="round"></path><text x="962" y="114" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="16" fill="#1B1B1B">build it</text><text x="962" y="132" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700" fill="#55504C">A URL SHORTENER</text></g>
</svg>`;

const stamp = `<div style="display: flex; gap: 14px; align-items: center"><span aria-hidden="true" style="flex: 0 0 auto; width: 92px; height: 92px; border-radius: 50%; border: 3px double #6F6964; display: inline-flex; align-items: center; justify-content: center; text-align: center; transform: rotate(-8deg); ${MONO}; font-size: 8.5px; font-weight: 700; letter-spacing: .08em; color: #6F6964; line-height: 1.5">ROUTE<br>COMPLETE<br>· NOT YET ·</span><span style="font-size: 13.5px; line-height: 1.45; color: #3F3A36">Light all 11 stops and the stamp goes in your <a href="Map.dc.html">Logbook</a>, and later on your passport.</span></div>`;

const challenges = ["Beat the bar · answer each stop’s BUILD question under the shared bar", "Time attack · the route’s 11 questions against the clock", "Friday duel · the same route as one person you follow"].map((t, i) => { const [a, b] = t.split(" · "); return `<div style="display: flex; flex-direction: column; gap: 2px; padding: 8px 0; border-top: ${i ? "1px solid #E6DED8" : "0"}"><span style="font-weight: 800; font-size: 14px">${a}</span><span style="font-size: 13px; color: #3F3A36">${b}</span></div>`; }).join("");

const crosses = [["Software engineering", "at hash map · stop 12 of 46"], ["System design basics", "at sliding window → consistent hashing"], ["From silicon to software", "at array · stop 3 of 60"]].map(([n, at], i) => `<a href="Route.dc.html" style="display: flex; flex-direction: column; gap: 2px; padding: 8px 0; border-top: ${i ? "1px solid #E6DED8" : "0"}; text-decoration: none; color: #1B1B1B"><span style="font-weight: 800; font-size: 14px">⇄ ${n}</span><span style="${MONO}; font-size: 9.5px; font-weight: 700; color: #55504C">${at.toUpperCase()}</span></a>`).join("");

const rail = `<aside aria-label="About this route" style="flex: 1 1 290px; min-width: 0; max-width: 360px; display: flex; flex-direction: column; gap: 18px">
${card("THIS ROUTE", `<dl style="margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 13.5px"><dt style="${MONO}; font-size: 9.5px; font-weight: 700; color: #55504C; padding-top: 3px">MADE BY</dt><dd style="margin: 0">draft (a starter route)</dd><dt style="${MONO}; font-size: 9.5px; font-weight: 700; color: #55504C; padding-top: 3px">CROSSES</dt><dd style="margin: 0">Plate I → Plate III</dd><dt style="${MONO}; font-size: 9.5px; font-weight: 700; color: #55504C; padding-top: 3px">ABOUT</dt><dd style="margin: 0">9 hours of practice, 49 questions</dd><dt style="${MONO}; font-size: 9.5px; font-weight: 700; color: #55504C; padding-top: 3px">ON IT</dt><dd style="margin: 0">[N] people</dd></dl><div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px">${btn("Copy as my route")}${btn("Leave")}</div><p style="margin: 10px 0 0; font-size: 12.5px; color: #55504C; line-height: 1.45">A copy is yours to reorder, add or drop stops. Your progress stays on the entries either way.</p>`)}
${card("THE STAMP AT THE END", stamp, { shadow: "#6A3E73" })}
${card("CHALLENGES OVER THIS ROUTE", `${challenges}<p style="margin: 8px 0 0; ${MONO}; font-size: 9.5px; font-weight: 700; color: #55504C">ONLY WITH COMPETE TURNED ON · SETTINGS</p>`, { right: "OFF" })}
${card("ROUTES THAT CROSS THIS ONE", crosses)}
</aside>`;

const progress = `<div aria-label="4 of 11 stops lit" style="display: flex; gap: 4px; flex-wrap: wrap">${STOPS.map(([, , , s]) => `<span style="width: 26px; height: 12px; border-radius: 3px; border: 1.5px ${s === "ahead" ? "dashed" : "solid"} #1B1B1B; background: ${s === "here" ? "#C2593A" : s === "ahead" ? "#FFFFFF" : "#3E6B5A"}"></span>`).join("")}</div>`;

const body = `<div style="max-width: 1180px; margin: 0 auto; padding: 22px 24px 0; box-sizing: border-box"><p style="margin: 0; font-size: 13px; color: #55504C">${mono("D201 · A FULL ROUTE · EXAMPLE DATA", "#55504C")} A route is a saved order of entries drawn on the map. Progress lives on the entries, so a stop you lit on another route is already lit here.</p></div>
<div style="max-width: 1180px; margin: 0 auto; padding: 16px 24px 64px; box-sizing: border-box; display: flex; flex-direction: column; gap: 22px">
<nav aria-label="Breadcrumb" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 13.5px"><a href="GazetteerIndex.dc.html" style="color: #1B1B1B">Routes</a><span aria-hidden="true">/</span><span>Coding interview patterns</span></nav>
<header style="display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: flex-end; padding-bottom: 18px; border-bottom: 1.5px solid #1B1B1B">
<div style="flex: 1 1 520px; min-width: 0; display: flex; flex-direction: column; gap: 10px">
${mono("ROUTE · 11 STOPS · PL. I → PL. III · LOWLANDS TO SUMMIT")}
<h1 style="margin: 0; ${SERIF}; font-weight: 400; font-size: 56px; line-height: .98">Coding interview patterns</h1>
<p style="margin: 0; font-size: 17px; line-height: 1.45; max-width: 640px">4 of 11 stops lit — two of them you lit on other routes. Next: <b>hash map</b>.</p>
${progress}</div>
<div style="display: flex; flex-wrap: wrap; gap: 8px">${btn("Continue at hash map →", { ink: true, shadow: "#C2593A" })}${btn("Show on Your map", { href: "Map.dc.html" })}</div>
</header>
<section aria-label="The route on the map" style="background: #FFFFFF; border: 1.5px solid #1B1B1B; border-radius: 18px; box-shadow: 5px 5px 0 #1B1B1B; overflow: hidden"><div style="padding: 9px 16px; border-bottom: 1.5px solid #1B1B1B; background: #FBF8F4; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px">${mono("THE ROUTE ON THE PHYSICAL MAP")}${mono("HEIGHT = STAGE · NO BORDERS ON ATLAS’S MAP", "#55504C")}</div><div style="overflow-x: auto">${svg}</div>${legend}</section>
<div style="display: flex; flex-wrap: wrap; gap: 26px; align-items: flex-start">
<div style="flex: 3 1 600px; min-width: 0; display: flex; flex-direction: column; gap: 22px">
${stopsList}
${card("ANOTHER KIND · A PROJECT ROUTE ENDS IN A BUILD", `<div style="overflow-x: auto; margin: -4px -8px 0">${proj}</div><p style="margin: 10px 0 0; font-size: 14px; line-height: 1.5">Six entries across three plates, then a build brief: make a URL shortener that hashes, stores, serves and limits. The brief checks the build against the six stops.</p><div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px">${btn("Open the build brief")}${btn("Join this route")}</div>`, { right: "PL. III → IV → V" })}
</div>
${rail}
</div></div>`;

fs.writeFileSync(OUT, `${head("Route · Coding interview patterns")}\n${shell({ tab: "Routes" })}${body}\n${foot(H)}`);
console.log("wrote", OUT, fs.statSync(OUT).size);
