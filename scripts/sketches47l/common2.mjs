// a dock with any item current, a plain area header (no volume pill), and a ramp strip
import { mono, MONO, REG } from "./common.mjs";
const ICON = {
  Home: '<path d="M4 11l8-7 8 7v9H4z M10 20v-5h4v5"></path>',
  Atlas: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18"></path>',
  Interview: '<path d="M9 4h6v8a3 3 0 0 1-6 0z M6 11a6 6 0 0 0 12 0 M12 17v3"></path>',
  Network: '<path d="M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M16.5 11a2.5 2.5 0 1 0 0-5 M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5 M14.5 15c2.6-.4 4.6.9 5.5 3.5"></path>',
  "Ask draft": '<path d="M5 5h14v10H10l-4 4v-4H5z"></path>',
};
const BADGE = (n) => `<span style="position: absolute; top: -7px; right: -11px; ${MONO}; font-size: 9.5px; font-weight: 700; background: #1B1B1B; color: #F4EFE9; border-radius: 6px; padding: 1px 5px; line-height: 1.4">${n}</span>`;
export function dock(current) {
  const item = (name, href, badge = "", avatar = false) => {
    const on = name === current;
    const glyph = avatar ? `<span style="width: 22px; height: 22px; box-sizing: border-box; border-radius: 7px; border: 1.5px solid #1B1B1B; background: #C2593A; color: #FFFFFF; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800">MC</span>` : `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1B1B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;
    return `<a href="${href}" class="at-link"${on ? ' aria-current="page"' : ""} style="display: flex; flex-direction: column; align-items: center; gap: 5px; min-height: 58px; box-sizing: border-box; padding: 8px 4px 7px; border-radius: 14px; text-decoration: none; color: #1B1B1B; ${on ? "background: #FFFFFF; border: 1.5px solid #1B1B1B; box-shadow: 3px 3px 0 #1B1B1B;" : "border: 1.5px solid transparent;"}"><span style="position: relative; display: inline-flex">${glyph}${badge ? BADGE(badge) : ""}</span><span style="font-size: 11.5px; font-weight: ${on ? 800 : 600}; line-height: 1">${name}</span></a>`;
  };
  return `<nav aria-label="Main" style="flex: 0 0 auto; width: 84px; align-self: flex-start; margin: 14px 0 0 14px; box-sizing: border-box; background: #F4EFE9; border: 1.5px solid #1B1B1B; border-radius: 20px; box-shadow: 4px 4px 0 #1B1B1B; padding: 8px 7px; display: flex; flex-direction: column; gap: 4px">
<a href="Market.dc.html" aria-label="draft — the market" style="display: flex; justify-content: center; padding: 6px 0 8px; text-decoration: none"><span aria-hidden="true" style="width: 44px; height: 44px; box-sizing: border-box; border-radius: 12px; border: 1.5px solid #1B1B1B; background: #FFFFFF; display: inline-flex; align-items: center; justify-content: center"><span style="font-family: 'Inter Tight', system-ui, sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.04em; color: #1B1B1B; line-height: 1"><span style="color: #C2593A">/</span>d</span></span></a><span aria-hidden="true" style="height: 1.5px; background: #1B1B1B; margin: 0 6px 4px"></span>
${item("Home", "Ledger.dc.html", "1")}${item("Atlas", "Home.dc.html")}${item("Interview", "ProvingGround.dc.html")}${item("Network", "#top", "3")}${item("Profile", "Passport.dc.html", "9+", true)}
<span aria-hidden="true" style="height: 1px; background: #E0D6CF; margin: 4px 6px"></span>
${item("Ask draft", "AskRoute.dc.html")}
</nav>`;
}
export function areaPage({ dockCurrent, label, views, current, search, chip = "" }) {
  const v = views.map(([t, href], i) => i === current
    ? `<a href="${href}" class="at-link" aria-current="page" style="display: inline-flex; align-items: center; min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 10px; text-decoration: none; color: #1B1B1B; font-size: 14.5px; background: #FFFFFF; border: 1.5px solid #1B1B1B; box-shadow: 3px 3px 0 #1B1B1B; font-weight: 700;">${t}</a>`
    : `<a href="${href}" class="at-link" style="display: inline-flex; align-items: center; min-height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 10px; text-decoration: none; color: #1B1B1B; font-size: 14.5px; border: 1.5px solid transparent; font-weight: 500;">${t}</a>`).join("");
  return `<div id="top" style="background: #F4EFE9; color: #1B1B1B; font-family: 'Inter Tight', system-ui, sans-serif; min-height: 100%">
<div style="display: flex; align-items: flex-start">${dock(dockCurrent)}<div style="flex: 1 1 auto; min-width: 0"><header style="position: relative; z-index: 30; background: #F4EFE9">
<div style="max-width: 1180px; margin: 0 auto; padding: 14px 24px 12px; box-sizing: border-box; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 6px">
<nav aria-label="${label}" style="display: flex; flex-wrap: wrap; gap: 2px">${v}<button type="button" aria-expanded="false" class="at-link" style="all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border-radius: 10px; color: #1B1B1B; font-size: 14.5px; font-weight: 500; box-sizing: border-box">More <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1B1B1B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg></button></nav>
<div style="flex: 1 1 200px; display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px">
<label style="display: inline-flex; align-items: center; gap: 8px; height: 44px; box-sizing: border-box; padding: 0 12px; border-radius: 12px; border: 1.5px solid #1B1B1B; background: #FFFFFF; cursor: text"><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1B1B1B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4"></path></svg><span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Search</span><input type="search" placeholder="${search}" style="border: 0; background: transparent; font: inherit; font-size: 14px; color: #1B1B1B; width: 170px; outline: none"></label>${chip}</div></div>
<div aria-hidden="true" style="height: 12px; border-top: 1.5px solid #1B1B1B; background-image: repeating-linear-gradient(90deg, #1B1B1B 0 1px, transparent 1px 80px), repeating-linear-gradient(90deg, #1B1B1B 0 1px, transparent 1px 16px); background-size: 100% 12px, 100% 5px; background-repeat: no-repeat"></div>
</header>`;
}
export const RAMP = {
  V: ["#F4EEF5", "#EBE1ED", "#E1D1E4", "#D3BDD7", "#C0A3C6", "#A986B0", "#8E6396", "#6A3E73", "#502D57", "#3B2140"],
  VI: ["#EBF1F3", "#DCE7EA", "#C9DBE0", "#B2CBD2", "#93B5BF", "#729CA7", "#497F8D", "#2F6B7A", "#20515D", "#183C45"],
};
export function rampStrip(r, uses) {
  return `<section aria-label="Region ${r} ramp and where each step is used" style="background: #FFFFFF; border: 1.5px solid #1B1B1B; border-radius: 18px; box-shadow: 5px 5px 0 #1B1B1B; overflow: hidden"><div style="padding: 9px 16px; border-bottom: 1.5px solid #1B1B1B; background: #FBF8F4; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px">${mono(`REGION ${r} · ${REG[r][0].toUpperCase()} · ITS 10-STEP RAMP ON THIS PAGE`)}${mono("--pl-" + r.toLowerCase() + "-0 … 9", "#55504C")}</div>
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr))">${RAMP[r].map((c, i) => `<div style="border-right: 1px solid #E6DED8; display: flex; flex-direction: column"><span style="height: 64px; background: ${c}; border-bottom: 1.5px solid #1B1B1B; display: flex; align-items: flex-end; padding: 6px 8px; box-sizing: border-box; ${MONO}; font-size: 10px; font-weight: 700; color: ${i < 6 ? "#1B1B1B" : "#FFFFFF"}">${i}</span><span style="padding: 7px 8px 9px; display: flex; flex-direction: column; gap: 3px"><span style="${MONO}; font-size: 9.5px; font-weight: 700">${c}</span><span style="font-size: 12px; line-height: 1.35; color: #3F3A36">${uses[i] || "not used here"}</span></span></div>`).join("")}</div></section>`;
}
