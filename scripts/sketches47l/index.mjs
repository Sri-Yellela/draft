import fs from "node:fs";
import { head, shell, foot, mono, MONO, SERIF, dotted, card, REG, plChip, squares, btn, chip, kicker } from "./common.mjs";
const OUT = process.argv[2];
const H = 3000;

const entry = (w, r, lit, meaning, meta) => `<div style="padding: 12px 0; border-top: 1px solid #E6DED8; break-inside: avoid">
<div style="display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px"><a href="Gazetteer.dc.html" style="${SERIF}; font-size: 24px; color: #1B1B1B; text-decoration: none; line-height: 1.1">${w}</a>${plChip(r)}<span style="flex: 1 1 auto"></span>${squares(lit)}</div>
<p style="margin: 4px 0 0; font-size: 14px; line-height: 1.5; color: #1B1B1B">${meaning}</p>
<p style="margin: 4px 0 0; ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: .06em; color: #55504C">${meta}</p></div>`;

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((L) => `<a href="#az" style="width: 30px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 7px; text-decoration: none; ${MONO}; font-size: 12px; font-weight: 700; ${L === "H" ? "background: #1B1B1B; color: #F4EFE9;" : "color: #1B1B1B; border: 1px solid #E0D6CF;"}"${L === "H" ? ' aria-current="true"' : ""}>${L}</a>`).join("");

const colA = [
  entry("graph", "III", 1, `Things joined by ${dotted("edges")}: a map of who links to whom, from roads to friendships to package imports.`, "ON 2 ROUTES · 6 QUESTIONS"),
  entry("greedy algorithm", "III", 0, `Take the best-looking step every time and never go back; right for some problems, quietly wrong for others.`, "ON 1 ROUTE · 4 QUESTIONS"),
  entry("gRPC", "IV", 0, `A way for one program to call a function on another machine as if it were local, over ${dotted("HTTP/2")}.`, "ON 1 ROUTE · ASKED AT NORTHWIND"),
  `<div style="margin: 18px 0 2px; display: flex; align-items: baseline; gap: 10px; border-bottom: 1.5px solid #1B1B1B; padding-bottom: 4px"><span style="${SERIF}; font-size: 44px; line-height: 1">H</span>${mono("214 ENTRIES", "#55504C")}</div>`,
  entry("hash function", "III", 1, `Turns any input into a fixed-size number; the same input always gives the same number.`, "ON 2 ROUTES · 3 QUESTIONS"),
  entry("hash map", "III", 1, `A table that finds any value from its ${dotted("key")} in one step, at any size.`, "ON 3 ROUTES · 4 QUESTIONS · YOU ARE HERE ON A ROUTE"),
  entry("hash set", "III", 0, `A ${dotted("hash map")} with keys and no values: is this thing in the set, yes or no.`, "ON 1 ROUTE · 2 QUESTIONS"),
];
const colB = [
  entry("hashing (passwords)", "V", 0, `Storing a password as a slow, ${dotted("salted")} hash, so a stolen table can’t be read back.`, "ON 1 ROUTE · ASKED IN SECURITY ROUNDS"),
  entry("heap", "III", 2, `A tree that always keeps the smallest (or largest) item on top, ready to take.`, "ON 2 ROUTES · 5 QUESTIONS"),
  entry("heuristic", "VIII", 0, `A rule of thumb that is usually good enough and much faster than being sure.`, "ON 1 ROUTE"),
  entry("HTTP", "IV", 3, `The request-and-response language browsers and servers speak: a verb, a path, headers, a body.`, "ON 2 ROUTES · LIT 11-18"),
  entry("HTTP/2", "IV", 0, `HTTP over one connection with many streams at once, so slow requests stop blocking fast ones.`, "ON 1 ROUTE"),
  entry("HTTPS", "IV", 1, `HTTP inside ${dotted("TLS")}: the same conversation, encrypted and checked for who is on the other end.`, "ON 2 ROUTES · 3 QUESTIONS"),
  entry("Huffman coding", "I", 0, `Give common letters short codes and rare ones long codes, and the whole message shrinks.`, "NOT ON A ROUTE YET"),
];

const search = `<div style="position: relative; max-width: 760px">
<label style="display: flex; align-items: center; gap: 10px; height: 58px; box-sizing: border-box; padding: 0 14px; border-radius: 14px; border: 1.5px solid #1B1B1B; background: #FFFFFF; box-shadow: 4px 4px 0 #1B1B1B"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B1B1B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4"></path></svg><span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Make sense of a word, a question or a skill</span><input type="search" value="consis" style="flex: 1 1 auto; min-width: 0; border: 0; background: transparent; font: inherit; font-size: 19px; outline: none; color: #1B1B1B"><span style="${MONO}; font-size: 10.5px; font-weight: 700; background: #F4EFE9; border: 1px solid #1B1B1B; border-radius: 6px; padding: 2px 6px">Ctrl K</span></label>
<div class="at-drop" role="listbox" aria-label="Suggestions" style="margin-top: 8px; background: #FFFFFF; border: 1.5px solid #1B1B1B; border-radius: 14px; box-shadow: 5px 5px 0 #1B1B1B; overflow: hidden">
<div style="padding: 7px 14px; background: #FBF8F4; border-bottom: 1px solid #E6DED8">${mono("ENTRIES", "#1B1B1B", 9.5)}</div>
<a href="Gazetteer.dc.html" role="option" aria-selected="true" style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 10px 14px; text-decoration: none; color: #1B1B1B; background: #FAEEE6; box-shadow: inset 3px 0 0 #B4532A"><span style="${SERIF}; font-size: 21px"><b style="font-weight: 400; text-decoration: underline; text-underline-offset: 3px">consis</b>tent hashing</span>${plChip("IV", "Map.dc.html")}<span style="font-size: 13.5px; color: #3F3A36; flex: 1 1 240px">Spread keys over servers so adding one moves the fewest.</span>${squares(0)}</a>
<a href="Gazetteer.dc.html" role="option" aria-selected="false" style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 10px 14px; text-decoration: none; color: #1B1B1B; border-top: 1px solid #E6DED8"><span style="${SERIF}; font-size: 21px"><b style="font-weight: 400; text-decoration: underline; text-underline-offset: 3px">consis</b>tency (databases)</span>${plChip("IV", "Map.dc.html")}<span style="font-size: 13.5px; color: #3F3A36; flex: 1 1 240px">Whether every reader sees the latest write, and when.</span>${squares(1)}</a>
<div style="padding: 7px 14px; background: #FBF8F4; border-top: 1px solid #E6DED8; border-bottom: 1px solid #E6DED8">${mono("ALSO MATCHES", "#1B1B1B", 9.5)}</div>
<div style="display: flex; flex-direction: column">
<a href="Gazetteer.dc.html" role="option" aria-selected="false" style="display: flex; gap: 10px; align-items: center; min-height: 44px; padding: 6px 14px; text-decoration: none; color: #1B1B1B; font-size: 14px">${mono("QUESTION", "#6A3E73", 9)} “Spread a cache across 10 servers so adding one moves the fewest keys.” <span style="color: #55504C">→ consistent hashing · MASTER</span></a>
<a href="Route.dc.html" role="option" aria-selected="false" style="display: flex; gap: 10px; align-items: center; min-height: 44px; padding: 6px 14px; text-decoration: none; color: #1B1B1B; font-size: 14px; border-top: 1px solid #E6DED8">${mono("ROUTE", "#3E6B5A", 9)} System design basics <span style="color: #55504C">· stop 6 of 14</span></a>
<a href="Market.dc.html" role="option" aria-selected="false" style="display: flex; gap: 10px; align-items: center; min-height: 44px; padding: 6px 14px; text-decoration: none; color: #1B1B1B; font-size: 14px; border-top: 1px solid #E6DED8">${mono("⇄ MARKET", "#C2593A", 9)} [N] openings ask for consistent hashing</a>
</div></div></div>`;

const filters = `<div style="display: flex; flex-wrap: wrap; gap: 14px 22px; align-items: center">
<div role="group" aria-label="Show" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center">${mono("SHOW", "#55504C", 9.5)}${chip("All", { on: true, count: "1,284" })}${chip("Due", { count: "6" })}${chip("Lit", { count: "41" })}${chip("Started", { count: "17" })}${chip("Not yet")}</div>
<div role="group" aria-label="Browse by" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center">${mono("BROWSE BY", "#55504C", 9.5)}${chip("A–Z", { on: true })}${chip("Region", { href: "#regions" })}${chip("Role", { href: "#roles" })}${chip("Stage", { href: "#stages" })}${chip("Interview", { href: "#interview" })}</div></div>`;

const az = `<section id="az" aria-label="A to Z" style="background: #FFFFFF; border: 1.5px solid #1B1B1B; border-radius: 18px; box-shadow: 5px 5px 0 #1B1B1B; overflow: hidden">
<div style="padding: 10px 16px; border-bottom: 1.5px solid #1B1B1B; background: #FBF8F4; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; align-items: center">${mono("A – Z · THE DICTIONARY PAGE")}<span style="${SERIF}; font-style: italic; font-size: 17px; color: #3F3A36">graph — Huffman coding</span></div>
<nav aria-label="Letters" style="display: flex; flex-wrap: wrap; gap: 3px; padding: 10px 16px; border-bottom: 1px solid #E6DED8">${letters}</nav>
<div style="padding: 4px 20px 14px; display: flex; flex-wrap: wrap; gap: 0 36px"><div style="flex: 1 1 320px; min-width: 0">${colA.join("")}</div><div style="flex: 1 1 320px; min-width: 0; border-left: 1px solid #E6DED8; padding-left: 20px">${colB.join("")}</div></div>
<div style="padding: 10px 16px 14px; border-top: 1px solid #E6DED8; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between"><span style="font-size: 13px; color: #55504C">Each row: the word, its plate, your three squares, one line, and where it’s used.</span><span style="display: flex; gap: 8px">${btn("← G")}${btn("I →")}</span></div></section>`;

const regionCards = Object.entries(REG).map(([r, [name, col, tint]], i) => {
  const counts = [[132, 9], [118, 0], [214, 21], [196, 11], [140, 0], [158, 0], [87, 0], [139, 0]][i];
  return `<a href="Map.dc.html" class="at-plate" style="flex: 1 1 200px; min-width: 0; display: flex; flex-direction: column; text-decoration: none; color: #1B1B1B; background: #FFFFFF; border: 1.5px solid #1B1B1B; border-radius: 14px; box-shadow: 4px 4px 0 #1B1B1B; overflow: hidden">
<span aria-hidden="true" style="height: 54px; background-color: ${tint}; background-image: repeating-radial-gradient(circle at 70% 60%, transparent 0 12px, ${col}33 12px 13.5px); border-bottom: 1.5px solid #1B1B1B; position: relative"><span style="position: absolute; left: 10px; top: 10px; ${MONO}; font-size: 10px; font-weight: 700; background: ${col}; color: #FFFFFF; border: 1.5px solid #1B1B1B; border-radius: 6px; padding: 2px 6px">PL. ${r}</span></span>
<span style="padding: 9px 12px 11px; display: flex; flex-direction: column; gap: 3px"><span style="${SERIF}; font-size: 21px; line-height: 1.1">${name}</span><span style="${MONO}; font-size: 9.5px; font-weight: 700; color: #55504C">${counts[0]} ENTRIES · ${counts[1]} LIT</span></span></a>`;
}).join("");

const roles = [["Backend engineer", 64, 58], ["Data engineer", 51, 41], ["Frontend engineer", 47, 22], ["ML engineer", 72, 12], ["Site reliability", 55, 30]].map(([r, n, pct]) => `<div style="display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; padding: 10px 0; border-top: 1px solid #E6DED8">
<a href="GazetteerIndex.dc.html" style="flex: 1 1 200px; ${SERIF}; font-size: 21px; color: #1B1B1B; text-decoration: none">${r}</a>
<span style="flex: 0 0 auto; ${MONO}; font-size: 10px; font-weight: 700; color: #55504C">${n} ENTRIES THE MARKET ASKS FOR</span>
<span style="flex: 0 1 160px; min-width: 110px; height: 10px; border: 1.5px solid #1B1B1B; border-radius: 3px; background: #FFFFFF; position: relative; overflow: hidden"><span style="position: absolute; inset: 0 auto 0 0; width: ${pct}%; background: #3E6B5A"></span></span>
<a href="YourSurvey.dc.html" style="flex: 0 0 auto; ${MONO}; font-size: 10.5px; font-weight: 700; color: #1B1B1B">${pct}% PROVEN → YOUR SURVEY</a></div>`).join("");

const stages = [["START", "Lowlands", "#3E6B5A", 312, 28], ["BUILD", "Foothills", "#1F3A63", 441, 11], ["DEEPEN", "Highlands", "#C2593A", 356, 2], ["MASTER", "Summit", "#6A3E73", 175, 0]].map(([s, band, col, n, lit], i) => `<a href="GazetteerIndex.dc.html" style="flex: 1 1 180px; min-width: 0; text-decoration: none; color: #1B1B1B; border: 1.5px solid #1B1B1B; border-radius: 12px; background: #FFFFFF; overflow: hidden; display: flex; flex-direction: column">
<svg aria-hidden="true" viewBox="0 0 200 50" width="100%" height="50" preserveAspectRatio="none" style="display: block; background: #FBF8F4; border-bottom: 1.5px solid #1B1B1B"><path d="M0 ${46 - i * 9} C 40 ${40 - i * 10}, 80 ${44 - i * 11}, 120 ${36 - i * 9} S 180 ${30 - i * 8}, 200 ${34 - i * 9} L200 50 L0 50 Z" fill="${col}" opacity=".85"></path><path d="M0 ${46 - i * 9} C 40 ${40 - i * 10}, 80 ${44 - i * 11}, 120 ${36 - i * 9} S 180 ${30 - i * 8}, 200 ${34 - i * 9}" fill="none" stroke="#1B1B1B" stroke-width="1.5"></path></svg>
<span style="padding: 9px 12px 11px; display: flex; flex-direction: column; gap: 3px">${mono(s, col, 10)}<span style="${SERIF}; font-size: 20px">${band}</span><span style="${MONO}; font-size: 9.5px; font-weight: 700; color: #55504C">${n} ENTRIES · ${lit} LIT</span></span></a>`).join("");

const interview = [["Coding rounds", "arrays · hash maps · two pointers · graphs", 38], ["System design", "caching · consistent hashing · queues · load balancers", 26], ["Data rounds", "joins · window functions · partitions", 19], ["Asked at companies you applied to", "Kestrel · Northwind · Halcyon — 14 entries", 14]].map(([t, sub, n]) => `<a href="GazetteerIndex.dc.html" style="display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: baseline; padding: 11px 0; border-top: 1px solid #E6DED8; text-decoration: none; color: #1B1B1B"><span style="flex: 1 1 220px; ${SERIF}; font-size: 21px">${t}</span><span style="flex: 2 1 260px; font-size: 13.5px; color: #3F3A36">${sub}</span><span style="${MONO}; font-size: 10px; font-weight: 700">${n} ENTRIES →</span></a>`).join("");

const due = [["heap", "III", "BUILD", "due today"], ["TCP handshake", "IV", "START", "due today"], ["idempotency", "IV", "BUILD", "2 days over"], ["binary search", "III", "DEEPEN", "due tomorrow"]].map(([w, r, st, when]) => `<a href="Gazetteer.dc.html" style="display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; min-height: 44px; padding: 6px 0; border-top: 1px solid #E6DED8; text-decoration: none; color: #1B1B1B"><span style="${SERIF}; font-size: 19px; flex: 1 1 auto">${w}</span>${plChip(r)}<span style="flex: 0 0 100%; ${MONO}; font-size: 9.5px; font-weight: 700; color: ${when.includes("over") ? "#8A3A22" : "#55504C"}">${st} · ${when.toUpperCase()}</span></a>`).join("");

const doors = [["A JOB’S MISSING SKILL", "Kafka is missing on 3 of your saved openings", "Market.dc.html", "#C2593A"], ["AN INTERVIEW QUESTION", "“Why is my hash map slow when it’s full?”", "Gazetteer.dc.html", "#6A3E73"], ["A PLOT ON YOUR SURVEY", "Networking · 2 of 9 proven", "YourSurvey.dc.html", "#3E6B5A"], ["A PLACE ON THE MAP", "Region IV · the transport layer", "Map.dc.html", "#1F3A63"]].map(([k, t, href, col]) => `<a href="${href}" style="display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border: 1.5px solid #1B1B1B; border-radius: 12px; background: #FFFFFF; box-shadow: 3px 3px 0 ${col}; text-decoration: none; color: #1B1B1B">${mono(k, col, 9)}<span style="font-size: 14px; line-height: 1.4">${t}</span></a>`).join("");

const routes = [["Coding interview patterns", 4, 11], ["Software engineering", 12, 46], ["From silicon to software", 19, 60]].map(([n, a, b], i) => `<a href="Route.dc.html" style="display: flex; flex-direction: column; gap: 6px; padding: 9px 0; border-top: ${i ? "1px solid #E6DED8" : "0"}; text-decoration: none; color: #1B1B1B"><span style="display: flex; justify-content: space-between; gap: 8px"><span style="font-weight: 700; font-size: 14px">${n}</span><span style="${MONO}; font-size: 10px; font-weight: 700; color: #55504C">${a} / ${b}</span></span><span aria-hidden="true" style="height: 8px; border: 1.5px solid #1B1B1B; border-radius: 3px; background: #F4EFE9; position: relative; overflow: hidden"><span style="position: absolute; inset: 0 auto 0 0; width: ${Math.round((a / b) * 100)}%; background: #3E6B5A"></span></span></a>`).join("");

const rail = `<aside aria-label="Your way in" style="flex: 1 1 290px; min-width: 0; max-width: 360px; display: flex; flex-direction: column; gap: 18px">
${card("DUE FOR REVIEW · 6", `<p style="margin: 0 0 4px; font-size: 13.5px; color: #3F3A36; line-height: 1.45">Entries you lit a while ago come back so they stay lit.</p>${due}<div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px">${btn("Review 4 · about 6 min", { ink: true })}${btn("Show all 6")}</div>`, { shadow: "#C2593A" })}
${card("START ANYWHERE", `<div style="display: flex; flex-direction: column; gap: 9px">${doors}</div>`)}
${card("YOUR ROUTES", `${routes}<div style="margin-top: 8px">${btn("All routes →", { href: "Route.dc.html" })}</div>`)}
${card("RECENTLY LOOKED UP", `<div style="display: flex; flex-wrap: wrap; gap: 6px">${["hash map", "TCP handshake", "idempotency", "load balancer"].map((w) => `<a href="Gazetteer.dc.html" style="display: inline-flex; align-items: center; min-height: 34px; padding: 0 10px; border-radius: 9px; border: 1.5px solid #1B1B1B; background: #FFFFFF; text-decoration: none; color: #1B1B1B; ${SERIF}; font-size: 16px">${w}</a>`).join("")}</div>`)}
</aside>`;

const body = `${kicker("D201 · THE GAZETTEER’S INDEX · EXAMPLE DATA", "Every concept is one entry. Start from a word, a region, a role, a stage, an interview, or whatever is due.")}
<div style="max-width: 1180px; margin: 0 auto; padding: 16px 24px 64px; box-sizing: border-box; display: flex; flex-direction: column; gap: 22px">
<header style="display: flex; flex-direction: column; gap: 14px; padding-bottom: 18px; border-bottom: 1.5px solid #1B1B1B">
<div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center">${mono("VOL. I · GAZETTEER · 1,284 ENTRIES · YOU’VE LIT 41")}</div>
<h1 style="margin: 0; ${SERIF}; font-weight: 400; font-size: 44px; line-height: 1">Look anything up</h1>
${search}
${filters}
</header>
<div style="display: flex; flex-wrap: wrap; gap: 26px; align-items: flex-start">
<div style="flex: 3 1 600px; min-width: 0; display: flex; flex-direction: column; gap: 22px">
${az}
${card("BROWSE BY REGION · THE EIGHT PLATES OF VOL. I", `<div style="display: flex; flex-wrap: wrap; gap: 12px">${regionCards}</div>`, { id: "regions", right: "TAP A PLATE = ITS ENTRIES" })}
${card("BROWSE BY ROLE · WHAT THE MARKET ASKS, AND WHAT YOU’VE PROVEN", `<div style="margin-top: -10px">${roles}</div><p style="margin: 10px 0 0; font-size: 12.5px; color: #55504C">The counts come from the openings on the market this week; the % counts only lit squares.</p>`, { id: "roles", right: "⇄ THE MARKET · YOUR SURVEY" })}
${card("BROWSE BY STAGE · ONE SCALE FOR EVERYTHING", `<div style="display: flex; flex-wrap: wrap; gap: 12px">${stages}</div>`, { id: "stages", right: "HEIGHT = WHAT YOU’VE PROVEN" })}
${card("BROWSE BY INTERVIEW", `<div style="margin-top: -10px">${interview}</div>`, { id: "interview" })}
</div>
${rail}
</div></div>`;

fs.writeFileSync(OUT, `${head("Gazetteer · the index")}\n${shell({ tab: "Gazetteer" })}${body}\n${foot(H)}`);
console.log("wrote", OUT, fs.statSync(OUT).size);
