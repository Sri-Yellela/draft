import fs from "node:fs";
import { head, MONO, SERIF } from "./common.mjs";
const OUT = process.argv[2];
const H = 2500;

// Two token sets, the same markup drawn twice.
const LIGHT = { name: "Plate · paper", ground: "#F4EFE9", warm: "#FBF8F4", card: "#FFFFFF", ink: "#1B1B1B", soft: "#3F3A36", muted: "#55504C", rule: "#E6DED8", shadow: "#1B1B1B", clay: "#C2593A", onClay: "#FFFFFF", clayText: "#8A3A22", clayTint: "#FBEFEA", green: "#3E6B5A", onGreen: "#FFFFFF", iv: "#1F3A63", ivTint: "#EDF1F7", iii: "#B4532A", iiiTint: "#FAEEE6", onRegion: "#FFFFFF" };
const DARK = { name: "Plate · night", ground: "#161412", warm: "#1F1C19", card: "#262220", ink: "#EFE8E0", soft: "#CFC6BC", muted: "#A39A90", rule: "#3A3430", shadow: "#000000", clay: "#E27A57", onClay: "#1B1B1B", clayText: "#F0A487", clayTint: "#3A2219", green: "#7DB39A", onGreen: "#10201A", iv: "#9FB3CE", ivTint: "#1A2433", iii: "#D99C78", iiiTint: "#33231A", onRegion: "#161412" };

const mono = (t, c, sz = 10) => `<span style="${MONO}; font-size: ${sz}px; font-weight: 700; letter-spacing: .12em; color: ${c}">${t}</span>`;

function panel(T) {
  const b = `1.5px solid ${T.ink}`;
  const sh = (c = T.shadow, n = 5) => T === DARK ? `${n}px ${n}px 0 ${c}, ${n}px ${n}px 0 1.5px ${T.rule}` : `${n}px ${n}px 0 ${c}`;
  const btnS = (ink) => `all: unset; cursor: pointer; box-sizing: border-box; display: inline-flex; align-items: center; min-height: 40px; padding: 0 13px; border-radius: 10px; border: ${b}; background: ${ink ? T.ink : T.card}; color: ${ink ? T.ground : T.ink}; font-weight: 800; font-size: 13.5px`;
  const sq = (on) => `<span style="width: 13px; height: 13px; border-radius: 3px; border: 1.5px ${on ? "solid" : "dashed"} ${T.ink}; background: ${on ? T.green : T.card}"></span>`;
  return `<section aria-label="${T.name}" style="flex: 1 1 520px; min-width: 0; background: ${T.ground}; color: ${T.ink}; border: 1.5px solid #1B1B1B; border-radius: 22px; padding: 22px; box-sizing: border-box; display: flex; flex-direction: column; gap: 20px; font-family: 'Inter Tight', system-ui, sans-serif">
<div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px"><span style="${SERIF}; font-size: 34px; line-height: 1">${T.name}</span>${mono(T === DARK ? "APPEARANCE · NIGHT" : "APPEARANCE · PAPER (TODAY)", T.muted, 9.5)}</div>

<div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center">
<button type="button" style="${btnS(false)}">Save</button><button type="button" style="${btnS(true)}">Draft it</button>
<button type="button" style="${btnS(false)}; background: ${T.clay}; color: ${T.onClay}; box-shadow: 3px 3px 0 ${T === DARK ? T.rule : T.ink}">Apply →</button>
<span style="${MONO}; font-size: 10px; font-weight: 700; background: ${T.iv}; color: ${T.onRegion}; border: ${b}; border-radius: 7px; padding: 3px 7px">PL. IV</span>
<span style="display: inline-flex; gap: 4px">${sq(1)}${sq(1)}${sq(0)}</span>
<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600"><span style="width: 6px; height: 6px; border-radius: 50%; background: ${T.green}"></span>Sent</span></div>

<article style="background: ${T.card}; border: ${b}; border-radius: 18px; box-shadow: ${sh()}; overflow: hidden">
<div style="padding: 9px 16px; border-bottom: ${b}; background: ${T.ivTint}; display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap">${mono("OPENING · KESTREL · BOSTON & REMOTE", T.ink, 9.5)}${mono("FITS 82", T.green, 9.5)}</div>
<div style="padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 8px">
<span style="${SERIF}; font-size: 30px; line-height: 1.05">Backend engineer, payments</span>
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${T.soft}">Python and Postgres; you’d own the ledger service. <a href="#" style="color: ${T.ink}; text-decoration: underline; text-decoration-style: dotted; text-decoration-thickness: 1.5px; text-underline-offset: 3px">idempotency</a> comes up twice.</p>
<div style="display: flex; gap: 6px; flex-wrap: wrap">${["Python", "Postgres", "Kafka"].map((w, i) => `<span style="display: inline-flex; align-items: center; min-height: 30px; padding: 0 9px; border-radius: 8px; border: 1.5px ${i === 2 ? "dashed" : "solid"} ${T.ink}; background: ${i === 2 ? T.card : T.ivTint}; font-size: 13px; font-weight: 700">${w}</span>`).join("")}</div>
<div style="display: flex; align-items: stretch; border: ${b}; border-radius: 12px; overflow: hidden; margin-top: 4px"><span style="flex: 1 1 auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px">${mono("UP NEXT", T.clayText, 9)}<span style="font-size: 14px">Prove Kafka · about 5 min</span></span><span aria-hidden="true" style="border-left: 2px dashed ${T.ink}; margin: 6px 0"></span><span style="display: flex; align-items: center; padding: 0 14px; background: ${T.clay}; color: ${T.onClay}; ${MONO}; font-size: 10.5px; font-weight: 800">GO →</span></div>
</div></article>

<div style="background: ${T.card}; border: ${b}; border-radius: 18px; box-shadow: ${sh(T.iii)}; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px">
${mono("GAZETTEER · ENTRY", T.ink, 9.5)}
<div style="display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap"><span style="${SERIF}; font-size: 48px; line-height: .95">hash map</span><span style="${MONO}; font-size: 10px; font-weight: 700; background: ${T.iii}; color: ${T.onRegion}; border: ${b}; border-radius: 7px; padding: 3px 7px">PL. III</span></div>
<svg role="img" aria-label="A route: two stops walked, you are at the third, two ahead" viewBox="0 0 440 60" width="100%" style="display: block"><path d="M20 30 L420 30" stroke="${T.ink}" stroke-width="13" stroke-linecap="round"></path><path d="M20 30 L420 30" stroke="${T.ground}" stroke-width="8" stroke-linecap="round"></path><path d="M20 30 L220 30" stroke="${T.green}" stroke-width="8" stroke-linecap="round"></path>${[20, 120, 220, 320, 420].map((x, i) => `<circle cx="${x}" cy="30" r="${i === 2 ? 13 : 10}" fill="${i < 2 ? T.green : i === 2 ? T.clay : T.card}" stroke="${T.ink}" stroke-width="2"></circle>`).join("")}</svg></div>

<div style="display: flex; flex-wrap: wrap; border: ${b}; border-radius: 14px; overflow: hidden; background: ${T.warm}">
<svg role="img" aria-label="A strip of terrain in Region IV's colours" viewBox="0 0 520 110" width="100%" preserveAspectRatio="none" style="display: block; height: 110px">${(T === DARK ? ["#0F1E36", "#16294A", "#1F3A63", "#2E4C7C", "#4A6794"] : ["#E9EEF4", "#CDD8E7", "#9FB3CE", "#5D79A3", "#1F3A63"]).map((c, k) => `<path d="M0 ${110 - k * 6} C 120 ${80 - k * 16}, 220 ${100 - k * 14}, 330 ${70 - k * 13} S 470 ${60 - k * 12}, 520 ${66 - k * 13} L520 110 L0 110 Z" fill="${c}" stroke="${T.ink}" stroke-opacity=".3" stroke-width="1"></path>`).join("")}</svg></div>
</section>`;
}

const tokenRow = (role, l, d, note) => `<tr><th scope="row" style="text-align: left; padding: 8px 10px 8px 0; font-weight: 600; border-bottom: 1px solid #E6DED8">${role}</th><td style="padding: 8px 10px; border-bottom: 1px solid #E6DED8"><span style="display: inline-flex; align-items: center; gap: 8px"><span style="width: 22px; height: 22px; border-radius: 5px; border: 1.5px solid #1B1B1B; background: ${l}"></span><span style="${MONO}; font-size: 11px">${l}</span></span></td><td style="padding: 8px 10px; border-bottom: 1px solid #E6DED8"><span style="display: inline-flex; align-items: center; gap: 8px"><span style="width: 22px; height: 22px; border-radius: 5px; border: 1.5px solid #1B1B1B; background: ${d}"></span><span style="${MONO}; font-size: 11px">${d}</span></span></td><td style="padding: 8px 0; border-bottom: 1px solid #E6DED8; font-size: 13px; color: #3F3A36">${note}</td></tr>`;
const table = `<section aria-label="The night tokens" style="background: #FFFFFF; border: 1.5px solid #1B1B1B; border-radius: 18px; box-shadow: 5px 5px 0 #1B1B1B; overflow: hidden"><div style="padding: 9px 16px; border-bottom: 1.5px solid #1B1B1B; background: #FBF8F4">${mono("THE TOKENS · PAPER → NIGHT", "#1B1B1B")}</div><div style="padding: 6px 16px 14px; overflow-x: auto"><table style="width: 100%; min-width: 640px; border-collapse: collapse; font-size: 14px"><thead><tr>${["ROLE", "PAPER", "NIGHT", "RULE"].map((h) => `<th scope="col" style="text-align: left; padding: 8px 10px 8px 0; ${MONO}; font-size: 9.5px; letter-spacing: .1em; border-bottom: 1.5px solid #1B1B1B">${h}</th>`).join("")}</tr></thead><tbody>
${tokenRow("Ground", LIGHT.ground, DARK.ground, "a warm near-black, never pure black; keeps the paper’s hue")}
${tokenRow("Card", LIGHT.card, DARK.card, "one step up from the ground, so a card still reads as a sheet")}
${tokenRow("Ink (text, every line)", LIGHT.ink, DARK.ink, "becomes paper: the 1.5 px lines stay, in the paper colour")}
${tokenRow("Hard shadow", LIGHT.shadow, DARK.rule, "black on black disappears, so the offset shadow gets a 1.5 px rule-coloured edge")}
${tokenRow("Clay (the one point)", LIGHT.clay, DARK.clay, "lifted to stay the brightest thing on screen; text on it turns ink")}
${tokenRow("Lit green", LIGHT.green, DARK.green, "lifted; squares keep their ink border")}
${tokenRow("Region colour (IV)", LIGHT.iv, DARK.iv, "each region uses its ramp step 4 for marks and step 0–1 of the deep tail for tints")}
${tokenRow("Region tint (IV)", LIGHT.ivTint, DARK.ivTint, "terrain bands run deep → mid instead of light → deep; height still reads as darker = higher")}
</tbody></table></div></section>`;

const html = `${head("The plate at night · a dark variant")}
<div style="background: #F4EFE9; color: #1B1B1B; font-family: 'Inter Tight', system-ui, sans-serif; min-height: 100%; padding: 28px 24px 64px; box-sizing: border-box">
<div style="max-width: 1180px; margin: 0 auto; display: flex; flex-direction: column; gap: 22px">
<p style="margin: 0; font-size: 13px; color: #55504C">${mono("D197 #17 · APPEARANCE · THE DARK PLATE VARIANT (NEVER SKETCHED UNTIL NOW) · EXAMPLE DATA", "#55504C")} The same pieces drawn twice: today’s paper and a night version. If it lands, Appearance offers Paper · Night, and Dusk / Plain retire.</p>
<h1 style="margin: 0; ${SERIF}; font-weight: 400; font-size: 44px; line-height: 1">The plate at night</h1>
<div style="display: flex; flex-wrap: wrap; gap: 22px; align-items: stretch">${panel(LIGHT)}${panel(DARK)}</div>
${table}
</div></div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1280,"height":${H}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;
fs.writeFileSync(OUT, html);
console.log("wrote", OUT, fs.statSync(OUT).size);
