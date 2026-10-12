// D92 · THE SURFACE PROBE — measures the five surface findings on a RUNNING app (a throwaway server only).
//
//   node scripts/d92SurfaceProbe.mjs <base> <label> [--themes paper-light,charcoal-dark,contrast-light,contrast-dark]
//        [--viewports desktop,phone] [--nav ghost,track] [--sentence marked,calm]
//
// P0 ran it BEFORE the fixes (the layer behind the seam, the stuck band, the clipped tab shadows, the nested
// surfaces in the bar, the deck's sideways scroll); P4 re-runs it across every variant. For each combination:
//   ① SEAM — every region boundary on Full House (header ↔ bar, bar ↔ list; at rest and stuck): the page's
//      luminance in a 4 px strip just above and just below, sampled OUTSIDE the content column (where only the
//      page itself paints) and in it; plus document.elementsFromPoint(x, y∓2) with each element's computed
//      background, backdrop-filter and box-shadow — the element whose paint changes is the layer.
//   ② STUCK — the stuck bar's painted width against the window's.
//   ③ CLIP — every element with overflow ≠ visible that has a descendant whose box-shadow reaches past it.
//   ④ NESTING — the deepest chain of nested painted surfaces (own border + fill or shadow) in the bar.
//   ⑤ DECK — the page's scrollWidth on /app/today at 390 · 768 · 1100 · 1440, vertical layout.
// Writes ../draft-screenshots/d92/<label>/_probe.json (after every combination) and a few PNGs.
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i > -1 ? args[i + 1].split(",") : dflt; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const BASE = args[0] || "http://127.0.0.1:3192";
const OUT = path.resolve(ROOT, "..", "draft-screenshots", "d92", args[1] || "probe");
const THEMES = opt("themes", ["paper-light", "charcoal-dark", "contrast-light", "contrast-dark"]);
const VPS = opt("viewports", ["desktop", "phone"]);
const NAVS = opt("nav", [null]);
const SENTS = opt("sentence", [null]);
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844, isMobile: true, hasTouch: true } };
fs.mkdirSync(OUT, { recursive: true });

async function call(method, p, body, token) {
  const r = await fetch(`${BASE}${p}`, { method, headers: { "Content-Type": "application/json", ...(token ? { "X-RM-Auth-Context": token, Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
const U = "d91shots", PW = "Synthetic-Pass-91!";
let token = (await call("POST", "/api/auth/login", { username: U, password: PW })).json?.authContext;
if (!token) token = (await call("POST", "/api/auth/register", { username: U, password: PW,
  profile: { email: `${U}@example.invalid`, first_name: "Ada", last_name: "Synthetic" } })).json?.authContext;
if (!token) throw new Error("could not sign in the synthetic user");
// The board needs an ACTIVE job profile, or Full House shows "Create a job profile" and no list.
{ const list = (await call("GET", "/api/domain-profiles", null, token)).json; const rows = Array.isArray(list) ? list : list?.profiles || [];
  if (rows.length && !rows.some(r => r.is_active)) await call("POST", `/api/domain-profiles/${rows[0].id}/activate`, null, token);
  if (!rows.length) { const dp = await call("POST", "/api/domain-profiles", { profile_name: "Platform", role_family: "engineering", domain: "general", seniority: "mid", target_titles: ["Software Engineer"] }, token);
    await call("POST", `/api/domain-profiles/${dp.json?.id || dp.json?.profile?.id}/activate`, null, token); } }

/** IN THE PAGE: the boundaries, the layers either side, the stuck band, clipped shadows, nesting depth. */
function inPage() {
  const paint = (el) => { const s = getComputedStyle(el);
    return { el: `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : ""}`,
      background: s.backgroundColor + (s.backgroundImage !== "none" ? " + image" : ""), backdrop: s.backdropFilter || s.webkitBackdropFilter || "none", shadow: s.boxShadow }; };
  // Not elementsFromPoint: it skips pointer-events:none layers (the paper substrate is one). Every box under the point.
  const all = [...document.querySelectorAll("body, body *")];
  const stack = (x, y) => all.filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && x >= r.left && x < r.right && y >= r.top && y < r.bottom; }).map(paint)
    .filter(p => p.background !== "rgba(0, 0, 0, 0)" || p.backdrop !== "none" || p.shadow !== "none");
  const header = document.querySelector("header.fh"), bar = document.querySelector("[data-board-sticky]");
  const list = bar?.nextElementSibling ? bar.parentElement : null;
  const out = { boundaries: [] };
  const at = (name, y) => {
    const xs = [12, Math.round(innerWidth / 2)];
    out.boundaries.push({ name, y: Math.round(y), stacks: xs.map(x => ({ x, above: stack(x, y - 2), below: stack(x, y + 2) })) });
  };
  if (header) at("header ↔ bar", header.getBoundingClientRect().bottom);
  if (bar) at("bar ↔ list", bar.getBoundingClientRect().bottom);
  if (bar) { const r = bar.getBoundingClientRect(); out.bar = { left: Math.round(r.left), width: Math.round(r.width), window: innerWidth, stuck: bar.dataset.stuck }; }
  // ③ clipped shadows: an ancestor with overflow ≠ visible whose box a descendant's shadow reaches past.
  out.clipped = [];
  for (const el of document.querySelectorAll("[data-app-chrome] *, .fh *, [data-board-sticky] *")) {
    const s = getComputedStyle(el); if (s.boxShadow === "none") continue;
    const blur = Math.max(...[...s.boxShadow.matchAll(/(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px/g)].map(m => Math.abs(+m[2]) + +m[3]), 0);
    if (!blur) continue;
    const r = el.getBoundingClientRect();
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const as = getComputedStyle(a);
      if (as.overflowX === "visible" && as.overflowY === "visible" && as.clipPath === "none") continue;
      if (as.clipPath !== "none" && as.overflowX === "visible" && as.overflowY === "visible") break;   // clip-path inset(-N 0) gives room
      const ar = a.getBoundingClientRect();
      if (r.top - blur < ar.top || r.bottom + blur > ar.bottom) out.clipped.push({ el: paint(el).el, by: paint(a).el, reach: blur });
      break;
    }
  }
  // ④ nesting: painted surfaces nested inside the bar (own border AND (fill or shadow)).
  const surface = (el) => { const s = getComputedStyle(el); const fill = s.backgroundColor !== "rgba(0, 0, 0, 0)";
    return parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== "none" && s.borderTopColor !== "rgba(0, 0, 0, 0)" && (fill || s.boxShadow !== "none"); };
  const depth = (el) => { let best = 0; for (const c of el.children) best = Math.max(best, depth(c)); return best + (surface(el) ? 1 : 0); };
  const fhBar = document.querySelector(".fh-bar"); out.barNesting = fhBar ? depth(fhBar) : null;
  const nav = document.querySelector('[data-app-chrome] nav[aria-label="Main"]'); out.navNesting = nav ? depth(nav) : null;
  out.root = { nav: document.documentElement.dataset.nav || null, sentence: document.documentElement.dataset.sentence || null, theme: document.documentElement.dataset.theme };
  return out;
}

/** Luminance of a 4 px strip above and below y at x (from a screenshot, decoded in the page). */
async function strips(page, y, xs) {
  const res = [];
  for (const x of xs) {
    const grab = async (top) => (await page.screenshot({ clip: { x: Math.max(0, x - 20), y: Math.max(0, top), width: 40, height: 4 }, encoding: "base64" }));
    const [a, b] = [await grab(y - 6), await grab(y + 2)];
    const lum = await page.evaluate(async (pa, pb) => {
      const one = async (src) => { const i = new Image(); await new Promise(ok => { i.onload = ok; i.src = "data:image/png;base64," + src; });
        const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0);
        const d = g.getImageData(0, 0, i.width, i.height).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
        return s / (d.length / 4); };
      return [await one(pa), await one(pb)];
    }, a, b);
    res.push({ x, above: +lum[0].toFixed(1), below: +lum[1].toFixed(1), delta: +(lum[1] - lum[0]).toFixed(1) });
  }
  return res;
}

/** ① the seam, found rather than assumed: the page's luminance down a narrow column at x (outside the content),
 *  row by row; every step larger than `min` is a boundary, and the boxes under it either side are reported. */
async function columnSteps(page, x, min = 2.5) {
  const vh = await page.evaluate(() => innerHeight);
  const shot = await page.screenshot({ clip: { x, y: 0, width: 8, height: vh }, encoding: "base64" });
  const rows = await page.evaluate(async (src) => { const i = new Image(); await new Promise(ok => { i.onload = ok; i.src = "data:image/png;base64," + src; });
    const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, i.width, i.height).data, out = [];
    for (let y = 0; y < i.height; y++) { let s = 0; for (let k = 0; k < i.width; k++) { const o = (y * i.width + k) * 4; s += 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]; } out.push(s / i.width); }
    return out; }, shot);
  // a 6-row mean either side smooths the grain; a step is where the two means differ by more than `min`
  const mean = (a, b) => { let s = 0; for (let y = a; y < b; y++) s += rows[y]; return s / (b - a); };
  const steps = [];
  for (let y = 80; y < rows.length - 8; y++) { const d = mean(y + 1, y + 7) - mean(y - 6, y); if (Math.abs(d) > min && (!steps.length || y - steps.at(-1).y > 10)) steps.push({ y, delta: +d.toFixed(1) }); }
  for (const st of steps) st.layers = await page.evaluate((x, y) => { const all = [...document.querySelectorAll("body, body *")];
    const hit = (yy) => all.filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && x >= r.left && x < r.right && yy >= r.top && yy < r.bottom; })
      .map(e => { const cs = getComputedStyle(e); return { el: `${e.tagName.toLowerCase()}${typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/).slice(0, 3).join(".") : ""}${[...e.attributes].filter(a => a.name.startsWith("data-")).map(a => "[" + a.name + "]").join("")}`,
        bg: cs.backgroundColor, img: cs.backgroundImage !== "none", backdrop: cs.backdropFilter, shadow: cs.boxShadow !== "none" }; })
      .filter(p => p.bg !== "rgba(0, 0, 0, 0)" || p.img || (p.backdrop && p.backdrop !== "none") || p.shadow);
    const a = hit(y - 3), b = hit(y + 4); const key = (p) => p.el + p.bg;
    return { onlyAbove: a.filter(p => !b.some(q => key(q) === key(p))), onlyBelow: b.filter(p => !a.some(q => key(q) === key(p))) }; }, x + 4, st.y);
  return steps;
}

const browser = await puppeteer.launch({ executablePath: (await resolveBrowserExecutable()).path, headless: "new", pipe: true,
  protocolTimeout: 120000, args: ["--no-first-run", "--font-render-hinting=none"] });
const results = [];
for (const theme of THEMES) for (const vp of VPS) for (const nav of NAVS) for (const sentence of SENTS) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", req => { const h = new URL(req.url()).hostname; if (["localhost", "127.0.0.1"].includes(h) || /^(data|blob):/.test(req.url())) req.continue(); else req.abort(); });
  const raw = [theme, nav && nav !== "ghost" ? `nav=${nav}` : null, sentence && sentence !== "marked" ? `sentence=${sentence}` : null].filter(Boolean).join(";");
  await page.evaluateOnNewDocument((tok, r) => { try { sessionStorage.setItem("rm_auth_context", tok); localStorage.setItem("draft-theme", r); } catch {}
    document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style");
      s.textContent = "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}"; document.head.appendChild(s); }); }, token, raw);
  await page.setViewport({ ...VIEWPORTS[vp], deviceScaleFactor: 1 });
  const tag = `${theme}-${vp}${nav ? "-" + nav : ""}${sentence ? "-" + sentence : ""}`;
  const r = { tag, theme, vp, nav, sentence };
  try {
    await page.goto(`${BASE}/app/jobs`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("[data-board-sticky]", { timeout: 20000 }).catch(() => {});
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 8000 }).catch(() => {});
    await sleep(1500);
    r.rest = await page.evaluate(inPage);
    r.rest.strips = [];
    for (const b of r.rest.boundaries) r.rest.strips.push({ name: b.name, samples: await strips(page, b.y, [12, Math.round(VIEWPORTS[vp].width / 2) - 260 > 20 ? Math.round(VIEWPORTS[vp].width / 2) - 330 : 30]) });
    r.rest.steps = await columnSteps(page, 6);
    await page.screenshot({ path: path.join(OUT, `${tag}-rest.png`) });
    r.scroll = await page.evaluate(() => { const se = document.scrollingElement; window.scrollTo(0, 900); se.scrollTop = 900;
      return { scrollHeight: se.scrollHeight, scrollTop: se.scrollTop, inner: innerHeight }; }); await sleep(900);
    r.stuck = await page.evaluate(inPage);
    r.stuck.steps = await columnSteps(page, 6);
    r.stuck.strips = [];
    if (r.stuck.bar) r.stuck.strips.push({ name: "stuck bar ↔ list", samples: await strips(page, r.stuck.boundaries.find(b => b.name === "bar ↔ list")?.y || 0, [12, 60]) });
    await page.screenshot({ path: path.join(OUT, `${tag}-stuck.png`) });
    if (vp === "desktop" && !sentence || sentence === SENTS[0]) {
      // ⑤ the deck at four widths (vertical below FAN_SWITCH_PX — lib/fanGeometry.js decides by width)
      r.deck = [];
      for (const w of [390, 768, 1100, 1440]) {
        await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
        await page.goto(`${BASE}/app/today`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 8000 }).catch(() => {}); await sleep(1500);
        r.deck.push(await page.evaluate((w) => ({ width: w, scrollWidth: document.documentElement.scrollWidth,
          orientation: document.querySelector("[data-deck-orientation]")?.dataset.deckOrientation || null,
          columnOverflowX: (() => { const c = document.querySelector("[data-deck-orientation]"); return c ? getComputedStyle(c).overflowX : null; })() }), w));
        if (w === 1440) await page.screenshot({ path: path.join(OUT, `${tag}-deck-1440.png`) });
      }
    }
  } catch (e) { r.error = String(e.message || e).slice(0, 200); }
  results.push(r);
  fs.writeFileSync(path.join(OUT, "_probe.json"), JSON.stringify(results, null, 2));
  await page.close();
  console.log(tag, r.error ? `ERROR ${r.error}` : `steps rest ${JSON.stringify(r.rest?.steps?.map(x => [x.y, x.delta]))} stuck ${JSON.stringify(r.stuck?.steps?.map(x => [x.y, x.delta]))} strips ${JSON.stringify(r.rest?.strips?.map(s => s.samples.map(x => x.delta)))} stuck ${r.stuck?.bar?.width}/${r.stuck?.bar?.window} clipped ${r.rest?.clipped?.length} barNest ${r.rest?.barNesting} navNest ${r.rest?.navNesting} deck ${JSON.stringify(r.deck?.map(d => d.scrollWidth - d.width))}`);
}
await browser.close();
console.log(`→ ${OUT}/_probe.json`);
