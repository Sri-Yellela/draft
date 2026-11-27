import fs from "node:fs";
import { head, shell, foot, mono, MONO, SERIF, card, REG, plChip, btn } from "./common.mjs";
const OUT = process.argv[2];
const H = 2000;

// the answer's route, drawn small: the question = a start flag, 3 entries = stops on the physical map, the next step = the waypoint
const miniRoute = (w = 380, id = "a") => {
  const pts = [[34, 120], [130, 92], [228, 70], [326, 44]];
  const d = `M${pts[0][0]} ${pts[0][1]} C 80 120, 90 92, 130 92 C 175 92, 190 70, 228 70 C 270 70, 290 44, 326 44`;
  const contours = [0, 1, 2, 3, 4].map((k) => `<path d="M0 ${150 - k * 26} C 80 ${140 - k * 28}, 170 ${156 - k * 26}, 250 ${138 - k * 27} S 340 ${126 - k * 26}, 380 ${130 - k * 27}" fill="none" stroke="#1F3A63" stroke-opacity="${0.16 + k * 0.04}" stroke-width="1.1"></path>`).join("");
  return `<svg role="img" aria-label="The answer as a route: your question is the start flag; HTTP is already lit; retries and idempotency are the stops; the waypoint is idempotency's Build question" viewBox="0 0 380 170" width="100%" style="display: block">
<rect width="380" height="170" fill="#EDF1F7"></rect>${contours}
<path d="${d}" fill="none" stroke="#1B1B1B" stroke-width="11" stroke-linecap="round"></path><path d="${d}" fill="none" stroke="#F4EFE9" stroke-width="6" stroke-linecap="round"></path>
<path d="M34 120 C 80 120, 90 92, 130 92" fill="none" stroke="#3E6B5A" stroke-width="6" stroke-linecap="round"></path>
<g><path d="M28 132 L28 92" stroke="#1B1B1B" stroke-width="2"></path><path d="M28 92 L50 99 L28 106 Z" fill="#C2593A" stroke="#1B1B1B" stroke-width="1.5"></path><text x="22" y="150" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700" fill="#1B1B1B">YOUR QUESTION</text></g>
<g><circle cx="130" cy="92" r="10" fill="#3E6B5A" stroke="#1B1B1B" stroke-width="2"></circle><path d="M125 92 l3 3 7-7" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"></path><text x="130" y="122" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="15" fill="#1B1B1B">HTTP</text></g>
<g><circle cx="228" cy="70" r="10" fill="#FFFFFF" stroke="#1B1B1B" stroke-width="2"></circle><text x="228" y="100" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="15" fill="#1B1B1B">retries</text></g>
<g><circle cx="326" cy="44" r="13" fill="#C2593A" stroke="#1B1B1B" stroke-width="2"></circle><circle cx="326" cy="44" r="4" fill="#FFFFFF"></circle><text x="326" y="78" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="15" fill="#1B1B1B">idempotency</text></g>
<text x="372" y="162" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="8" font-weight="700" fill="#1F3A63">PL. IV</text>
</svg>`;
};

const ticket = `<a href="Gazetteer.dc.html" style="display: flex; align-items: stretch; text-decoration: none; color: #1B1B1B; border: 1.5px solid #1B1B1B; border-radius: 10px; background: #FFFFFF; overflow: hidden">
<span style="flex: 1 1 auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px">${mono("WAYPOINT · NEXT", "#8A3A22", 9)}<span style="font-size: 13.5px; line-height: 1.4"><b>idempotency</b> · its BUILD question, about 4 min</span></span>
<span aria-hidden="true" style="flex: 0 0 auto; width: 0; border-left: 2px dashed #1B1B1B; margin: 6px 0"></span>
<span style="flex: 0 0 auto; display: flex; align-items: center; padding: 0 12px; ${MONO}; font-size: 10px; font-weight: 800">GO →</span></a>`;

const turn = (who, inner, extra = "") => {
  const st = who === "you" ? "background: #FFFFFF; border: 1.5px solid #1B1B1B; margin-left: 24px;" : "background: #FBF8F4; border: 1px solid #E0D6CF;";
  return `<li style="display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 12px; ${st} ${extra}">${inner}</li>`;
};

const askCard = (width, { sheet = false } = {}) => `<aside aria-label="Ask draft" style="width: ${width}; max-width: 100%; box-sizing: border-box; background: #FFFFFF; border: 1.5px solid #1B1B1B; border-radius: ${sheet ? "20px 20px 0 0" : "18px"}; box-shadow: ${sheet ? "0 -4px 0 #1B1B1B" : "6px 6px 0 #1B1B1B"}; overflow: hidden; display: flex; flex-direction: column">
<div style="padding: 10px 14px; border-bottom: 1.5px solid #1B1B1B; background: #EDF1F7; display: flex; justify-content: space-between; align-items: center; gap: 8px">
<span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><b style="${SERIF}; font-weight: 400; font-size: 24px; line-height: 1.05">Ask draft</b>${mono("DRAFT’S HELPER — NO AI FOR ANYTHING DRAFT ALREADY HOLDS", "#55504C", 8.5)}</span>
${btn("Close")}</div>
<div style="padding: 12px 14px; display: flex; flex-direction: column; gap: 12px">
<ol style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px">
${turn("you", `<p style="margin: 0; font-size: 14px; line-height: 1.5"><b>You:</b> why would my API need idempotency keys?</p>`)}
${turn("draft", `${mono("T2 · FROM ATLAS", "#1B1B1B", 9)}<p style="margin: 0; font-size: 14px; line-height: 1.5">Because clients retry. If a payment request times out and the app sends it again, an <a href="Gazetteer.dc.html" style="color: #1B1B1B; text-decoration: underline; text-decoration-style: dotted; text-decoration-thickness: 1.5px; text-underline-offset: 3px">idempotency key</a> lets the server see it’s the same request and answer once, not charge twice.</p>
<div style="border: 1.5px solid #1B1B1B; border-radius: 12px; overflow: hidden; background: #FFFFFF">
<div style="padding: 6px 10px; border-bottom: 1.5px solid #1B1B1B; background: #FBF8F4; display: flex; justify-content: space-between; gap: 6px; flex-wrap: wrap">${mono("THIS ANSWER AS A ROUTE · 3 STOPS", "#1B1B1B", 9)}${mono("1 LIT", "#3E6B5A", 9)}</div>
${miniRoute()}
<div style="padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 8px">${ticket}<div style="display: flex; flex-wrap: wrap; gap: 8px">${btn("Save to my routes")}${btn("Open on Your map", { href: "Map.dc.html" })}</div></div></div>`)}
</ol></div>
<form style="border-top: 1.5px solid #1B1B1B; padding: 10px 14px 12px; display: flex; flex-direction: column; gap: 8px; background: #FBF8F4">
<label style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)" for="ask-${sheet ? "s" : "d"}">Ask draft</label>
<textarea id="ask-${sheet ? "s" : "d"}" rows="2" placeholder="Ask draft" style="box-sizing: border-box; width: 100%; min-height: 56px; resize: none; border: 1.5px solid #1B1B1B; border-radius: 10px; padding: 8px 10px; font: inherit; font-size: 14px; background: #FFFFFF"></textarea>
<div style="display: flex; gap: 8px; justify-content: flex-end">${btn("Speak")}<button type="submit" style="all: unset; cursor: pointer; display: inline-flex; align-items: center; box-sizing: border-box; min-height: 40px; padding: 0 16px; border-radius: 10px; border: 1.5px solid #1B1B1B; background: #C2593A; color: #FFFFFF; font-weight: 800; font-size: 13.5px; box-shadow: 3px 3px 0 #1B1B1B">Ask</button></div></form></aside>`;

const behind = `<div aria-hidden="true" style="flex: 1 1 560px; min-width: 0; opacity: .5; display: flex; flex-direction: column; gap: 16px">
<div style="display: flex; gap: 10px; align-items: center">${plChip("IV")}${mono("REGION · TERRAIN · ROUTE · INDEX")}</div>
<span style="${SERIF}; font-size: 56px; line-height: .95">Systems &amp; networks</span>
<div style="height: 300px; border: 1.5px solid #1B1B1B; border-radius: 18px; background-color: #EDF1F7; background-image: repeating-radial-gradient(circle at 60% 60%, transparent 0 26px, #1F3A6333 26px 27.5px)"></div>
<div style="display: flex; gap: 12px; flex-wrap: wrap">${["HTTP", "TCP handshake", "retries", "load balancer"].map((p) => `<span style="flex: 1 1 120px; height: 70px; border: 1.5px solid #1B1B1B; border-radius: 12px; background: #FFFFFF; padding: 10px; box-sizing: border-box; ${SERIF}; font-size: 18px">${p}</span>`).join("")}</div></div>`;

const variant = (k, title, body) => `<div style="flex: 1 1 240px; min-width: 0; border: 1.5px solid #1B1B1B; border-radius: 14px; background: #FFFFFF; box-shadow: 4px 4px 0 #1B1B1B; overflow: hidden"><div style="padding: 8px 12px; border-bottom: 1.5px solid #1B1B1B; background: #FBF8F4">${mono(k, "#1B1B1B", 9.5)}</div><div style="padding: 12px; display: flex; flex-direction: column; gap: 8px"><b style="${SERIF}; font-weight: 400; font-size: 21px; line-height: 1.15">${title}</b>${body}</div></div>`;

const v1 = variant("ONE ENTRY · NO ROUTE", "A single lesson stays a link", `<div style="border: 1px solid #E0D6CF; border-radius: 10px; background: #FBF8F4; padding: 10px; font-size: 13.5px; line-height: 1.5">${mono("T2 · FROM ATLAS", "#1B1B1B", 8.5)}<br>A <b>hash map</b> finds a value from its key in one step. <a href="Gazetteer.dc.html" style="color: #1B1B1B; font-weight: 700">hash map →</a></div>`);
const v2 = variant("TWO OR THREE ENTRIES", "The answer is drawn as a route", `<span style="font-size: 13.5px; color: #3F3A36; line-height: 1.45">As in the card above: start flag, stops on the map, the waypoint ticket. Lit stops show green.</span>`);
const v3 = variant("SAVED", "It joins Routes, flagged with its question", `<a href="Route.dc.html" style="display: flex; flex-direction: column; gap: 4px; text-decoration: none; color: #1B1B1B; border: 1.5px solid #1B1B1B; border-radius: 10px; padding: 8px 10px"><span style="display: flex; gap: 6px; align-items: center"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24"><path d="M5 21V4 M5 4l12 4-12 4" fill="#C2593A" stroke="#1B1B1B" stroke-width="2"></path></svg><b style="font-size: 14px">Why idempotency keys?</b></span><span style="${MONO}; font-size: 9.5px; font-weight: 700; color: #55504C">MADE FROM A QUESTION · 3 STOPS · 1 / 3</span></a>`);
const v4 = variant("MORE THAN THREE", "Point to an existing route instead", `<span style="font-size: 13.5px; color: #3F3A36; line-height: 1.45">“This is a bigger topic: <a href="Route.dc.html" style="color: #1B1B1B; font-weight: 700">System design basics</a> covers it in 14 stops; you’re at stop 6.”</span>`);

const phone = `<div style="flex: 0 0 auto; width: 390px; max-width: 100%; height: 844px; box-sizing: border-box; border: 1.5px solid #1B1B1B; border-radius: 28px; overflow: hidden; background: #F4EFE9; display: flex; flex-direction: column; justify-content: flex-end; position: relative">
<div aria-hidden="true" style="position: absolute; inset: 0; padding: 22px 16px; opacity: .4; display: flex; flex-direction: column; gap: 10px">${plChip("IV")}<span style="${SERIF}; font-size: 38px; line-height: 1">Systems &amp; networks</span><span style="height: 160px; border: 1.5px solid #1B1B1B; border-radius: 14px; background: #EDF1F7"></span></div>
<div aria-hidden="true" style="position: absolute; inset: 0; background: #1B1B1B; opacity: .18"></div>
<div style="position: relative; display: flex; flex-direction: column"><span aria-hidden="true" style="align-self: center; width: 44px; height: 5px; border-radius: 3px; background: #1B1B1B; margin-bottom: 6px"></span>${askCard("100%", { sheet: true })}</div></div>`;

const body = `<div style="max-width: 1180px; margin: 0 auto; padding: 22px 24px 0; box-sizing: border-box"><p style="margin: 0; font-size: 13px; color: #55504C">${mono("D197 #12 · ASK DRAFT · AN ANSWER AS A ROUTE (U1) · EXAMPLE DATA", "#55504C")} A learning answer that names two or three entries is drawn as a small route, made on the spot.</p></div>
<div style="max-width: 1180px; margin: 0 auto; padding: 18px 24px 64px; box-sizing: border-box; display: flex; flex-direction: column; gap: 30px">
<div style="display: flex; flex-wrap: wrap; gap: 26px; align-items: flex-end">${behind}${askCard("430px")}</div>
<section aria-label="Which answers get a route" style="display: flex; flex-direction: column; gap: 12px">${mono("WHICH ANSWERS GET A ROUTE")}<div style="display: flex; flex-wrap: wrap; gap: 16px">${v1}${v2}${v3}${v4}</div></section>
<section aria-label="On a phone" style="display: flex; flex-wrap: wrap; gap: 26px; align-items: flex-start">${phone}<div style="flex: 1 1 300px; min-width: 0; display: flex; flex-direction: column; gap: 10px">${mono("ON A PHONE · 390")}<b style="${SERIF}; font-weight: 400; font-size: 30px; line-height: 1.1">The card becomes a bottom sheet; the route keeps its full width.</b><span style="font-size: 14.5px; line-height: 1.5; color: #3F3A36">The page behind dims; drag the handle down to close. The waypoint ticket is the one thing to tap.</span></div></section>
</div>`;

fs.writeFileSync(OUT, `${head("Ask draft · an answer as a route")}\n${shell({ tab: null })}${body}\n${foot(H)}`);
console.log("wrote", OUT, fs.statSync(OUT).size);
