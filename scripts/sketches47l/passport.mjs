import fs from "node:fs";
import { head, foot, mono, MONO, SERIF, card, btn } from "./common.mjs";
import { areaPage, rampStrip, RAMP } from "./common2.mjs";
const OUT = process.argv[2];
const H = 2700;
const V = RAMP.V;

// ── the hero drawing: the passport, open at its identity page ──
const stamp = (x, y, rot, l1, l2, l3, col, dashed = false) => `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="-62" y="-34" width="124" height="68" rx="8" fill="${dashed ? "none" : "#FFFFFF"}" fill-opacity=".55" stroke="${col}" stroke-width="${dashed ? 1.6 : 2.6}" ${dashed ? 'stroke-dasharray="5 4"' : ""}></rect>${dashed ? "" : `<rect x="-56" y="-28" width="112" height="56" rx="5" fill="none" stroke="${col}" stroke-width="1"></rect>`}<text y="-8" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" letter-spacing="1.2" fill="${col}">${l1}</text><text y="10" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="19" fill="${col}">${l2}</text><text y="25" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8" font-weight="700" fill="${col}">${l3}</text></g>`;
const line = (x, y, label, val) => `<text x="${x}" y="${y}" font-family="JetBrains Mono, monospace" font-size="8" font-weight="700" letter-spacing="1" fill="${V[7]}">${label}</text><text x="${x}" y="${y + 15}" font-family="JetBrains Mono, monospace" font-size="11.5" font-weight="700" fill="#1B1B1B">${val}</text><path d="M${x} ${y + 20} L${x + 140} ${y + 20}" stroke="${V[3]}" stroke-width="1"></path>`;
const guilloche = [0, 1, 2, 3, 4, 5].map((k) => `<path d="M24 ${300 + k * 7} C 90 ${280 + k * 7}, 160 ${320 + k * 7}, 280 ${296 + k * 7}" fill="none" stroke="${V[2]}" stroke-width="1"></path>`).join("");
const hero = `<svg role="img" aria-label="The passport, open at its identity page: Maya Chen's photo square and printed fields on the left; on the facing visa page three green stamps for proven skills, one dashed stamp not yet earned, and a beacon saying connections can see this page" viewBox="0 0 620 440" width="100%" style="display: block">
<rect width="620" height="440" fill="${V[0]}"></rect>
<g class="at-bob2"><rect x="16" y="34" width="592" height="384" rx="18" fill="${V[7]}" stroke="#1B1B1B" stroke-width="2"></rect>
<rect x="24" y="26" width="286" height="384" rx="12" fill="#FBF8F4" stroke="#1B1B1B" stroke-width="1.5"></rect>
<rect x="310" y="26" width="290" height="384" rx="12" fill="#FFFFFF" stroke="#1B1B1B" stroke-width="1.5"></rect>
<path d="M310 30 L310 406" stroke="#1B1B1B" stroke-width="2"></path><path d="M304 30 L304 406 M316 30 L316 406" stroke="${V[3]}" stroke-width="1"></path>
${guilloche}
<text x="40" y="54" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" letter-spacing="1.6" fill="${V[7]}">PASSPORT · IDENTITY PAGE</text>
<rect x="40" y="70" width="92" height="112" rx="6" fill="${V[1]}" stroke="#1B1B1B" stroke-width="1.5"></rect><circle cx="86" cy="112" r="20" fill="${V[4]}" stroke="#1B1B1B" stroke-width="1.2"></circle><path d="M56 176 C 60 146, 112 146, 116 176" fill="${V[4]}" stroke="#1B1B1B" stroke-width="1.2"></path>
${line(146, 78, "NAME", "CHEN, MAYA")}${line(146, 118, "HANDLE", "@mayachen")}${line(146, 158, "FITS", "BACKEND · DATA")}
${line(40, 204, "LOCATION", "BOSTON & REMOTE")}${line(40, 244, "YEARS", "4")}
${line(146, 244, "OPEN TO", "FULL-TIME")}
<text x="40" y="368" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="700" letter-spacing="1.4" fill="#1B1B1B">P&lt;DRAFT&lt;CHEN&lt;&lt;MAYA&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
<text x="40" y="386" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="700" letter-spacing="1.4" fill="#1B1B1B">3PROVEN&lt;&lt;14LISTED&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
<text x="326" y="54" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" letter-spacing="1.6" fill="${V[7]}">VISAS · STAMPS</text>
${stamp(400, 112, -8, "PROVEN · ATLAS", "SQL", "11-12 · 3 SQUARES", "#3E6B5A")}
${stamp(520, 150, 6, "PROVEN · ATLAS", "Python", "10-30 · 3 SQUARES", "#3E6B5A")}
${stamp(420, 226, 4, "PROVEN · ATLAS", "HTTP", "11-18 · 3 SQUARES", "#3E6B5A")}
${stamp(520, 300, -5, "NOT YET", "TypeScript", "ON YOUR RÉSUMÉ", "#6F6964", true)}
<g><circle cx="388" cy="352" r="16" fill="${V[7]}" stroke="#1B1B1B" stroke-width="1.5"></circle><circle class="at-tick" cx="388" cy="352" r="24" fill="none" stroke="${V[7]}" stroke-width="1.5"></circle><path d="M381 352 a7 5 0 0 1 14 0 a7 5 0 0 1 -14 0 z" fill="#FFFFFF"></path><circle cx="388" cy="352" r="2.4" fill="${V[7]}"></circle><text x="414" y="349" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700" letter-spacing="1" fill="#1B1B1B">THIS PAGE IS SEEN BY</text><text x="414" y="364" font-family="Instrument Serif, Georgia, serif" font-size="15" fill="#1B1B1B">your connections</text></g>
</g></svg>`;

const stat = (k, n, href) => `<a href="${href}" style="flex: 1 1 120px; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; text-decoration: none; color: #1B1B1B; border-right: 1px solid #E6DED8">${mono(k, "#55504C", 9)}<span style="${SERIF}; font-size: 32px; line-height: 1">${n}</span></a>`;
const nextStamp = `<a href="Gazetteer.dc.html" style="display: flex; align-items: stretch; text-decoration: none; color: #1B1B1B; border: 1.5px solid #1B1B1B; border-radius: 12px; background: #FFFFFF; box-shadow: 4px 4px 0 #C2593A; overflow: hidden; max-width: 460px">
<span style="flex: 1 1 auto; padding: 10px 14px; display: flex; flex-direction: column; gap: 3px">${mono("YOUR NEXT STAMP", "#8A3A22", 9.5)}<span style="font-size: 16px; line-height: 1.35"><b>Prove TypeScript</b> · on your résumé, not yet proven · about 5 min</span></span>
<span aria-hidden="true" style="flex: 0 0 auto; width: 0; border-left: 2px dashed #1B1B1B; margin: 8px 0"></span>
<span style="flex: 0 0 auto; display: flex; align-items: center; padding: 0 16px; background: #C2593A; color: #FFFFFF; ${MONO}; font-size: 11px; font-weight: 800">GO →</span></a>`;

const visaRow = (sec, who) => `<div style="display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; padding: 9px 0; border-top: 1px solid #E6DED8"><span style="flex: 1 1 140px; font-weight: 700; font-size: 14.5px">${sec}</span><span role="radiogroup" aria-label="${sec}: who can see it" style="display: inline-flex; border: 1.5px solid #1B1B1B; border-radius: 10px; overflow: hidden">${["Only you", "Connections", "Public"].map((o) => `<button type="button" role="radio" aria-checked="${o === who}" style="all: unset; cursor: pointer; box-sizing: border-box; min-height: 36px; padding: 0 11px; font-size: 13px; font-weight: 700; ${o === who ? `background: ${V[7]}; color: #FFFFFF;` : "background: #FFFFFF; color: #1B1B1B;"} border-left: ${o === "Only you" ? "0" : "1.5px solid #1B1B1B"}">${o}</button>`).join("")}</span></div>`;

const road = `<svg role="img" aria-label="The road so far: Larkspur Analytics, then Fennel Health, then Halcyon Data, where you work now" viewBox="0 0 520 120" width="100%" style="display: block"><rect width="520" height="120" fill="${V[0]}"></rect>
<path d="M40 64 L480 64" stroke="#1B1B1B" stroke-width="14" stroke-linecap="round"></path><path d="M40 64 L480 64" stroke="${V[5]}" stroke-width="8" stroke-linecap="round"></path>
${[[40, "Larkspur Analytics", "2021–22"], [240, "Fennel Health", "2022–24"], [480, "Halcyon Data", "2024 → now"]].map(([x, n, y], i) => `<g><circle cx="${x}" cy="64" r="${i === 2 ? 15 : 11}" fill="${i === 2 ? V[7] : "#FFFFFF"}" stroke="#1B1B1B" stroke-width="2"></circle><text x="${x}" y="${i === 2 ? 30 : 100}" text-anchor="${i === 0 ? "start" : i === 2 ? "end" : "middle"}" font-family="Instrument Serif, Georgia, serif" font-size="17" fill="#1B1B1B">${n}</text><text x="${x}" y="${i === 2 ? 44 : 114}" text-anchor="${i === 0 ? "start" : i === 2 ? "end" : "middle"}" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700" fill="#55504C">${y}</text></g>`).join("")}</svg>`;

const stampTile = (w, when, proven) => `<div style="flex: 1 1 120px; min-width: 0; border: ${proven ? "2.5px double #3E6B5A" : "1.5px dashed #6F6964"}; border-radius: 10px; padding: 9px 10px; background: #FFFFFF; display: flex; flex-direction: column; gap: 3px">${mono(proven ? "PROVEN" : "NOT YET", proven ? "#3E6B5A" : "#6F6964", 9)}<span style="${SERIF}; font-size: 20px; color: ${proven ? "#1B1B1B" : "#55504C"}">${w}</span><span style="${MONO}; font-size: 9px; font-weight: 700; color: #55504C">${when}</span></div>`;
const stamps = [["SQL", "11-12 · HOW: 3 QUESTIONS", 1], ["Python", "10-30 · HOW: THE AUDIT", 1], ["HTTP", "11-18 · HOW: A ROUTE", 1], ["TypeScript", "ON YOUR RÉSUMÉ", 0], ["Kafka", "ON YOUR RÉSUMÉ", 0], ["Docker", "ON YOUR RÉSUMÉ", 0]].map(([w, d, p]) => stampTile(w, d, p)).join("");

// settings, in the passport's More menu: a plain working page
const notif = `<section aria-label="Notifications" style="background: #FFFFFF; border: 1.5px solid #1B1B1B; border-radius: 18px; box-shadow: 5px 5px 0 #1B1B1B; overflow: hidden">
<div style="padding: 9px 16px; border-bottom: 1.5px solid #1B1B1B; background: ${V[0]}; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; align-items: center">${mono("YOUR PASSPORT · MORE · NOTIFICATIONS")}<svg role="img" aria-label="A signal lamp, the notifications emblem" width="34" height="34" viewBox="0 0 34 34"><rect x="1" y="1" width="32" height="32" rx="7" fill="${V[1]}" stroke="#1B1B1B" stroke-width="1.5"></rect><path d="M12 24h10 M13 24l1-10h6l1 10 M14 14a3 3 0 0 1 6 0" fill="${V[5]}" stroke="#1B1B1B" stroke-width="1.5"></path><path d="M8 10l3 2 M26 10l-3 2 M17 5v3" stroke="#C2593A" stroke-width="1.8" stroke-linecap="round"></path></svg></div>
<div style="padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 12px">
<h2 style="margin: 0; ${SERIF}; font-weight: 400; font-size: 38px; line-height: 1">Notifications</h2>
<div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; border: 1.5px solid #1B1B1B; border-radius: 12px; padding: 10px 12px; background: #FBEFEA"><span style="flex: 1 1 240px; font-size: 14px">Push is off on this browser, so interview reminders only reach your email.</span><button type="button" style="all: unset; cursor: pointer; box-sizing: border-box; min-height: 40px; padding: 0 14px; border-radius: 10px; border: 1.5px solid #1B1B1B; background: #C2593A; color: #FFFFFF; font-weight: 800; font-size: 13.5px; box-shadow: 3px 3px 0 #1B1B1B">Turn on push</button></div>
<table style="width: 100%; border-collapse: collapse; font-size: 14px"><caption style="text-align: left; padding-bottom: 6px; font-size: 13px; color: #3F3A36" aria-live="polite">Interview scheduled: push on, email on.</caption><thead><tr><th scope="col" style="text-align: left; padding: 6px 0; ${MONO}; font-size: 9.5px; letter-spacing: .1em; border-bottom: 1.5px solid #1B1B1B">EVENT</th><th scope="col" style="padding: 6px 0; ${MONO}; font-size: 9.5px; letter-spacing: .1em; border-bottom: 1.5px solid #1B1B1B">PUSH</th><th scope="col" style="padding: 6px 0; ${MONO}; font-size: 9.5px; letter-spacing: .1em; border-bottom: 1.5px solid #1B1B1B">EMAIL</th></tr></thead><tbody>
${[["Interview scheduled", 1, 1], ["An application needs you", 1, 0], ["New openings that fit", 0, 1], ["A stamp is due for review", 0, 0]].map(([e, p, m]) => `<tr><th scope="row" style="text-align: left; font-weight: 600; padding: 9px 0; border-bottom: 1px solid #E6DED8">${e}</th>${[p, m].map((on, j) => `<td style="text-align: center; border-bottom: 1px solid #E6DED8"><button type="button" role="switch" aria-checked="${!!on}" aria-label="${e}: ${j ? "email" : "push"}" style="all: unset; cursor: pointer; display: inline-flex; width: 44px; height: 26px; box-sizing: border-box; border: 1.5px solid #1B1B1B; border-radius: 7px; background: ${on ? V[7] : "#FFFFFF"}; padding: 2px; justify-content: ${on ? "flex-end" : "flex-start"}"><span style="width: 18px; height: 18px; border-radius: 4px; background: ${on ? "#FFFFFF" : "#1B1B1B"}"></span></button></td>`).join("")}</tr>`).join("")}
</tbody></table></div></section>`;

const views = [["Your passport", "Passport.dc.html"], ["Saved answers", "#top"], ["Auto-apply", "#top"], ["Connections", "#top"]];
const chip = `<a href="#stamps" style="display: inline-flex; align-items: center; gap: 6px; height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 12px; border: 1.5px solid #1B1B1B; background: #FFFFFF; text-decoration: none; color: #1B1B1B; ${MONO}; font-size: 11px; font-weight: 700"><span style="width: 10px; height: 10px; border-radius: 2px; background: #3E6B5A; border: 1px solid #1B1B1B"></span>3 STAMPS</a>`;

const body = `<div style="max-width: 1180px; margin: 0 auto; padding: 22px 24px 0; box-sizing: border-box"><p style="margin: 0; font-size: 13px; color: #55504C">${mono("D197 #9 · PROFILE AS YOUR PASSPORT · REGION V · EXAMPLE DATA", "#55504C")} The person’s page in Region V’s colours, with its hero drawing and one settings panel from its More menu.</p></div>
<div style="max-width: 1180px; margin: 0 auto; padding: 18px 24px 64px; box-sizing: border-box; display: flex; flex-direction: column; gap: 26px">
<div style="display: flex; flex-wrap: wrap; gap: 28px; align-items: center">
<div style="flex: 1 1 520px; min-width: 0; border: 1.5px solid #1B1B1B; border-radius: 20px; box-shadow: 6px 6px 0 ${V[7]}; overflow: hidden; background: ${V[0]}">${hero}</div>
<div style="flex: 1 1 380px; min-width: 0; display: flex; flex-direction: column; gap: 14px">
${mono("YOUR PASSPORT · CONNECTIONS SEE THIS PAGE", V[7])}
<h1 style="margin: 0; ${SERIF}; font-weight: 400; font-size: 82px; line-height: .9">Maya Chen</h1>
<p style="margin: 0; font-size: 19px; line-height: 1.45; font-weight: 500">Backend engineer · Python, SQL and the systems between them.</p>
<div style="display: flex; flex-wrap: wrap; border: 1.5px solid #1B1B1B; border-radius: 12px; background: #FFFFFF; overflow: hidden">${stat("PROVEN", "3", "#stamps")}${stat("FROM YOUR RÉSUMÉ", "14", "#stamps")}${stat("SECTIONS SHOWN", "5 / 7", "#visa")}${stat("COMPLETE", "8 / 10", "#top")}</div>
<div style="display: flex; flex-wrap: wrap; gap: 8px">${btn("View as the public")}${btn("Share link")}${btn("Edit", { ink: true })}</div>
${nextStamp}</div></div>
<div style="display: flex; flex-wrap: wrap; gap: 22px; align-items: flex-start">
<div style="flex: 1 1 420px; min-width: 0; display: flex; flex-direction: column; gap: 22px">
${card("01 · WHO CAN SEE IT · THE VISA PAGE", `<p style="margin: 0 0 6px; font-size: 14px; color: #3F3A36">Each page of the passport has its own eye. Nothing is public until you open it.</p>${visaRow("Identity page", "Connections")}${visaRow("The road so far", "Connections")}${visaRow("Stamps", "Public")}${visaRow("Where you fit", "Only you")}`, { id: "visa", shadow: V[7] })}
${card("03 · THE ROAD SO FAR", `${road}<p style="margin: 10px 0 0; font-size: 13.5px; color: #3F3A36">Employers as stops on one route; the current one is the filled stop.</p>`)}
</div>
<div style="flex: 1 1 420px; min-width: 0; display: flex; flex-direction: column; gap: 22px">
${card("04 · STAMPS · ONE PER SKILL YOU PROVED", `<div style="display: flex; flex-wrap: wrap; gap: 10px">${stamps}</div><p style="margin: 10px 0 0; font-size: 13px; color: #3F3A36">Green only for proven skills. A dashed tile is a skill your résumé claims; proving it in Atlas stamps it.</p>`, { id: "stamps" })}
${notif}
</div></div>
${rampStrip("V", ["page and drawing ground", "photo square · guilloche", "lines · lamp ground", "rules on the identity page", "the portrait", "the road’s line", "", "the cover · the eye · switches on · shadows", "", ""])}
</div>`;

fs.writeFileSync(OUT, `${head("Your passport · Region V")}\n${areaPage({ dockCurrent: "Profile", label: "Your passport", views, current: 0, search: "Search your passport…", chip })}${body}\n${foot(H)}`);
console.log("wrote", OUT, fs.statSync(OUT).size);
