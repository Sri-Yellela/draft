import fs from "node:fs";
import { head, foot, mono, MONO, SERIF, card, btn, squares } from "./common.mjs";
import { areaPage, rampStrip, RAMP } from "./common2.mjs";
const OUT = process.argv[2];
const H = 2700;
const R = RAMP.VI;

// ── the hero: the proving ground, a hill with five rounds as benches ──
const bands = [0, 1, 2, 3, 4, 5].map((k) => {
  const top = 380 - k * 52;
  return `<path d="M0 ${top + 60} C 90 ${top + 40}, 160 ${top - 4 + k * 4}, 300 ${top - 30 + k * 6} C 420 ${top - 52 + k * 8}, 520 ${top + 6}, 620 ${top + 30} L620 440 L0 440 Z" fill="${R[k + 1]}" stroke="#1B1B1B" stroke-opacity=".35" stroke-width="1"></path>`;
}).join("");
const BENCH = [[70, 382, "Recruiter screen", 1], [175, 322, "Hiring manager", 1], [282, 262, "Coding", 0], [390, 208, "System design", 0], [498, 160, "AI-enabled coding", 0]];
const benches = BENCH.map(([x, y, n, done], i) => `<g><rect x="${x - 26}" y="${y - 7}" width="52" height="9" rx="2" fill="${done ? "#3E6B5A" : "#FFFFFF"}" stroke="#1B1B1B" stroke-width="1.6"></rect><path d="M${x - 20} ${y + 2} l0 10 M${x + 20} ${y + 2} l0 10" stroke="#1B1B1B" stroke-width="1.6"></path><text x="${x}" y="${y + 28}" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="15" fill="#1B1B1B">${n}</text><text x="${x}" y="${y + 41}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8" font-weight="700" fill="#183C45">ROUND ${i + 1}</text></g>`).join("");
const path = `M70 382 C 120 382, 130 322, 175 322 C 225 322, 240 262, 282 262 C 330 262, 345 208, 390 208 C 440 208, 455 160, 498 160`;
const hero = `<svg role="img" aria-label="The proving ground: a hill with five rounds as benches from Recruiter screen at the foot to AI-enabled coding at the top. The first two rounds are done; you are preparing for Coding, the third; Kestrel’s coding round on Friday is flagged." viewBox="0 0 620 440" width="100%" style="display: block">
<rect width="620" height="440" fill="${R[0]}"></rect>${bands}
<path d="${path}" fill="none" stroke="#1B1B1B" stroke-width="3" stroke-dasharray="7 6"></path>
<path d="M70 382 C 120 382, 130 322, 175 322 C 225 322, 240 262, 282 262" fill="none" stroke="#3E6B5A" stroke-width="4"></path>
${benches}
<g class="at-bob1"><circle cx="282" cy="236" r="11" fill="${R[7]}" stroke="#1B1B1B" stroke-width="2"></circle><circle cx="282" cy="236" r="18" fill="none" stroke="${R[7]}" stroke-width="1.5" class="at-tick"></circle><text x="282" y="210" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" fill="#1B1B1B">YOU · PREPARING</text></g>
<g><path d="M300 262 L300 180" stroke="#1B1B1B" stroke-width="2"></path><path d="M300 180 L346 192 L300 204 Z" fill="#C2593A" stroke="#1B1B1B" stroke-width="1.5"></path><rect x="352" y="170" width="120" height="32" rx="6" fill="#FFFFFF" stroke="#1B1B1B" stroke-width="1.5"></rect><text x="412" y="184" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700" fill="#8A3A22">KESTREL · CODING</text><text x="412" y="196" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700" fill="#1B1B1B">FRI · 2:00 PM</text></g>
<text x="20" y="30" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" letter-spacing="1.4" fill="${R[8]}">REGION VI · THE PROVING GROUND</text>
</svg>`;

const stat = (k, n, href) => `<a href="${href}" style="flex: 1 1 110px; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; text-decoration: none; color: #1B1B1B; border-right: 1px solid #E6DED8">${mono(k, "#55504C", 9)}<span style="${SERIF}; font-size: 32px; line-height: 1">${n}</span></a>`;

const iticket = (company, round, when, len, primary) => `<div style="display: flex; align-items: stretch; border: 1.5px solid #1B1B1B; border-radius: 14px; background: #FFFFFF; box-shadow: 4px 4px 0 ${primary ? "#C2593A" : "#1B1B1B"}; overflow: hidden">
<div style="flex: 1 1 auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; min-width: 0">${mono(when, primary ? "#8A3A22" : "#55504C", 9.5)}<span style="${SERIF}; font-size: 26px; line-height: 1.05"><a href="Survey.dc.html" style="color: #1B1B1B">${company}</a> · ${round}</span><span style="font-size: 13.5px; color: #3F3A36">${len}</span></div>
<span aria-hidden="true" style="flex: 0 0 auto; width: 0; border-left: 2px dashed #1B1B1B; margin: 10px 0"></span>
<div style="flex: 0 0 auto; display: flex; align-items: center; padding: 0 14px">${primary ? `<button type="button" style="all: unset; cursor: pointer; box-sizing: border-box; min-height: 44px; padding: 0 16px; border-radius: 10px; border: 1.5px solid #1B1B1B; background: #C2593A; color: #FFFFFF; font-weight: 800; font-size: 14px; box-shadow: 3px 3px 0 #1B1B1B">Prepare →</button>` : btn("Prepare →")}</div></div>`;

const chair = `<svg role="img" aria-label="The interviewer's chair across the table" viewBox="0 0 300 150" width="100%" style="display: block"><rect width="300" height="150" fill="${R[0]}"></rect>
<path d="M120 24 h60 a6 6 0 0 1 6 6 v44 h-72 v-44 a6 6 0 0 1 6 -6 z" fill="${R[3]}" stroke="#1B1B1B" stroke-width="1.8"></path><path d="M108 74 h84 v14 h-84 z" fill="${R[5]}" stroke="#1B1B1B" stroke-width="1.8"></path><path d="M116 88 l-6 28 M184 88 l6 28" stroke="#1B1B1B" stroke-width="2"></path>
<path d="M20 104 h260 v12 h-260 z" fill="#FFFFFF" stroke="#1B1B1B" stroke-width="1.8"></path><path d="M40 116 v30 M260 116 v30" stroke="#1B1B1B" stroke-width="2"></path>
<rect x="130" y="92" width="40" height="12" rx="2" fill="#FBF8F4" stroke="#1B1B1B" stroke-width="1.2"></rect><text x="150" y="101" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6" font-weight="700" fill="#1B1B1B">RÉSUMÉ</text></svg>`;

const defend = card("PRACTISE · 01 · DEFEND YOUR RÉSUMÉ", `<div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start">
<div style="flex: 1 1 220px; min-width: 0; border: 1.5px solid #1B1B1B; border-radius: 12px; overflow: hidden">${chair}</div>
<div style="flex: 2 1 320px; min-width: 0; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap">${mono("BULLET 2 OF 5 · FOLLOW-UP 2 OF 3", "#55504C", 9.5)}${squares(1)}</div>
<p style="margin: 0; font-size: 13.5px; color: #3F3A36; line-height: 1.5; border-left: 0; background: #FBF8F4; border: 1px solid #E0D6CF; border-radius: 10px; padding: 8px 10px">“Cut p95 latency on the orders API by 40% by moving hot reads to a cache.”</p>
<p aria-live="polite" style="margin: 0; ${SERIF}; font-size: 24px; line-height: 1.2">How did you know the cache wasn’t serving stale orders?</p>
<div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center"><button type="button" style="all: unset; cursor: pointer; box-sizing: border-box; min-height: 44px; padding: 0 14px; border-radius: 10px; border: 1.5px solid #1B1B1B; background: #1B1B1B; color: #F4EFE9; font-weight: 800; font-size: 14px">Answer out loud · 2:00</button>${btn("Type it")}${btn("Harder →")}</div>
<p style="margin: 0; ${MONO}; font-size: 9.5px; font-weight: 700; color: #55504C">NOTHING IS RECORDED · A SQUARE LIGHTS WHEN YOU REACH THE HARDER QUESTION</p></div></div>`, { shadow: R[7] });

const debrief = card("AFTER · 01 · DEBRIEF · ONE QUESTION AT A TIME", `<div style="background-color: #FFFFFF; background-image: repeating-linear-gradient(180deg, transparent 0 31px, ${R[2]} 31px 32px); border-left: 3px double #C2593A; padding: 6px 14px 10px">
<p style="margin: 0; ${MONO}; font-size: 9.5px; font-weight: 700; color: #55504C; line-height: 32px">NORTHWIND · RECRUITER SCREEN · 11-20 · QUESTION 2 OF 5</p>
<p style="margin: 0; ${SERIF}; font-size: 22px; line-height: 32px">What did they ask that you didn’t expect?</p>
<label style="display: block"><span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Your answer</span><textarea rows="3" style="width: 100%; box-sizing: border-box; border: 0; background: transparent; font: inherit; font-size: 15px; line-height: 32px; resize: none; outline: none">Whether I’d moved a service between clouds. I hadn’t, and said what I’d check first.</textarea></label></div>
<div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px">${btn("Next question", { ink: true })}${btn("Skip")}</div>`);

const rounds = `<ol style="list-style: none; margin: 0; padding: 0">${BENCH.map(([, , n, done], i) => `<li style="display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; padding: 9px 0; border-top: ${i ? "1px solid #E6DED8" : "0"}"><span style="flex: 0 0 30px; ${SERIF}; font-size: 26px; color: transparent; -webkit-text-stroke: 1.1px #1B1B1B">0${i + 1}</span><a href="Gazetteer.dc.html" style="flex: 1 1 160px; ${SERIF}; font-size: 20px; color: #1B1B1B; text-decoration: none">${n}</a><span style="${MONO}; font-size: 9.5px; font-weight: 700; color: ${done ? "#3E6B5A" : i === 2 ? "#8A3A22" : "#55504C"}">${done ? "DONE · 2 SESSIONS" : i === 2 ? "PREPARING · 12 QUESTIONS" : `${[0, 0, 0, 9, 7][i]} QUESTIONS`}</span></li>`).join("")}</ol>`;

const onward = [["Prepare for Kestrel", "the job workspace’s Prep", "#top"], ["How Kestrel interviews", "the survey sheet", "Survey.dc.html"], ["Drill hash maps", "its Gazetteer entry", "Gazetteer.dc.html"], ["Log the round", "Debrief", "#top"]].map(([t, s, h]) => `<a href="${h}" style="flex: 1 1 200px; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1.5px solid #1B1B1B; border-radius: 12px; background: #FFFFFF; text-decoration: none; color: #1B1B1B"><b style="font-size: 14.5px">${t} →</b><span style="${MONO}; font-size: 9.5px; font-weight: 700; color: #55504C">${s.toUpperCase()}</span></a>`).join("");

const views = [["Coming up", "ProvingGround.dc.html"], ["Prepare", "#top"], ["Practise", "#top"], ["After", "#top"]];
const body = `<div style="max-width: 1180px; margin: 0 auto; padding: 22px 24px 0; box-sizing: border-box"><p style="margin: 0; font-size: 13px; color: #55504C">${mono("D197 #13 · INTERVIEW AS THE PROVING GROUND · REGION VI · EXAMPLE DATA", "#55504C")} Interview in Region VI’s colours: the hero drawing, Coming up, and one section from each other view.</p></div>
<div style="max-width: 1180px; margin: 0 auto; padding: 18px 24px 64px; box-sizing: border-box; display: flex; flex-direction: column; gap: 26px">
<div style="display: flex; flex-wrap: wrap; gap: 28px; align-items: center">
<div style="flex: 1 1 520px; min-width: 0; border: 1.5px solid #1B1B1B; border-radius: 20px; box-shadow: 6px 6px 0 ${R[7]}; overflow: hidden">${hero}</div>
<div style="flex: 1 1 380px; min-width: 0; display: flex; flex-direction: column; gap: 14px">
${mono("PROVING GROUND · WEEK 48", R[7])}
<h1 style="margin: 0; ${SERIF}; font-weight: 400; font-size: 44px; line-height: 1">Two interviews ahead</h1>
<div style="display: flex; flex-wrap: wrap; border: 1.5px solid #1B1B1B; border-radius: 12px; background: #FFFFFF; overflow: hidden">${stat("AHEAD", "2", "#coming")}${stat("IN YOUR BANK", "38", "#top")}${stat("STORIES", "6", "#top")}${stat("DEBRIEFS", "3", "#after")}</div>
<section id="coming" aria-label="Coming up" style="display: flex; flex-direction: column; gap: 12px">${iticket("Kestrel", "Coding", "FRI 11-27 · 2:00 PM · TOMORROW", "45 min · two problems, one on hash maps (from your debrief notes)", true)}${iticket("Northwind", "System design", "MON 11-30 · 11:00 AM", "60 min · a design round with the platform team", false)}</section>
</div></div>
<div style="display: flex; flex-wrap: wrap; gap: 22px; align-items: flex-start">
<div style="flex: 1 1 380px; min-width: 0; display: flex; flex-direction: column; gap: 22px">${card("PREPARE · 01 · THE ROUNDS", rounds, { right: "A ROUND OPENS ITS ENTRY" })}<div id="after">${debrief}</div></div>
<div style="flex: 1.4 1 460px; min-width: 0; display: flex; flex-direction: column; gap: 22px">${defend}<section aria-label="Onward" style="display: flex; flex-direction: column; gap: 10px">${mono("ONWARD")}<div style="display: flex; flex-wrap: wrap; gap: 10px">${onward}</div></section></div></div>
${rampStrip("VI", ["page and drawing ground", "the foot of the hill", "debrief rules · lower slopes", "the chair · slopes", "slopes", "the seat · the high slope", "the top band", "you · the area accent · shadows", "the region label", ""])}
</div>`;

fs.writeFileSync(OUT, `${head("Proving ground · Region VI")}\n${areaPage({ dockCurrent: "Interview", label: "Interview", views, current: 0, search: "Company or round…" })}${body}\n${foot(H)}`);
console.log("wrote", OUT, fs.statSync(OUT).size);
