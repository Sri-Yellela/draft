// D91 · THE THEME SCREENSHOT MATRIX — every route × theme × viewport, against a THROWAWAY server.
//
//   node scripts/d91ThemeShots.mjs <base> <label> [--prefs light,dark] [--viewports desktop,phone] [--cues off,on]
//                                                 [--sets public,user,admin]   (admin needs D91_ADMIN_PASSWORD)
//   node scripts/d91ThemeShots.mjs --compare <labelA> <labelB>
//
// P1 uses it as the IDENTITY PROOF: shoot "before" on the commit ahead of the module, rebuild, shoot
// "after", then --compare: every PNG must be byte-identical (Chrome encodes identical pixels to identical
// bytes; a byte difference is then located with a pixel count in a headless page). P6 reuses it for the
// matrix. Run it against a THROWAWAY server only (RM_DATA_DIR on a frozen copy, paid keys blanked — the
// recipe is in the WORKLOG's D91 row): a fixed synthetic user and a fixed database make two runs comparable.
// Every page request that leaves localhost is aborted. Output: ../draft-screenshots/d91/<label>/.
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const OUT_ROOT = path.resolve(ROOT, "..", "draft-screenshots", "d91");
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i > -1 ? args[i + 1].split(",") : dflt; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const PUBLIC = ["/", "/pricing", "/features", "/how-it-works", "/about", "/faq", "/extension", "/contact",
  "/privacy", "/terms", "/products", "/blog", "/tools/ats", "/tools/generate", "/tools/apply", "/docs/claude",
  "/login", "/register", "/admin/login", "/no-such-page"];
const APP = ["/app/today", "/app/jobs", "/app/auto-apply", "/app/database", "/app/profile", "/app/integrations",
  "/app/account", "/app/saved-answers", "/app/job-profiles", "/app/recruiter", "/app/customise"];
const ADMIN = ["/admin", "/admin/db"];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844, isMobile: true, hasTouch: true } };

async function compare(a, b) {
  const A = path.join(OUT_ROOT, a), B = path.join(OUT_ROOT, b);
  const names = [...new Set([...fs.readdirSync(A), ...fs.readdirSync(B)])].filter(n => n.endsWith(".png")).sort();
  const differ = [], missing = [];
  for (const n of names) {
    const pa = path.join(A, n), pb = path.join(B, n);
    if (!fs.existsSync(pa) || !fs.existsSync(pb)) { missing.push(n); continue; }
    if (!fs.readFileSync(pa).equals(fs.readFileSync(pb))) differ.push(n);
  }
  let detail = [];
  if (differ.length) {
    // Locate: count the differing pixels in a headless page (no image library needed).
    const browser = await puppeteer.launch({ executablePath: (await resolveBrowserExecutable()).path, headless: "new", pipe: true });
    const page = await browser.newPage();
    for (const n of differ) {
      const pa = path.join(A, n), pb = path.join(B, n);
      const uri = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
      const r = await page.evaluate(async (x, y) => {
        const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = s; });
        const [i1, i2] = await Promise.all([load(x), load(y)]);
        if (i1.width !== i2.width || i1.height !== i2.height) return { size: `${i1.width}x${i1.height} vs ${i2.width}x${i2.height}` };
        const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
          const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
        const d1 = px(i1), d2 = px(i2); let n = 0, minY = 1e9, maxY = -1;
        for (let k = 0; k < d1.length; k += 4) if (d1[k] !== d2[k] || d1[k + 1] !== d2[k + 1] || d1[k + 2] !== d2[k + 2]) {
          n++; const yy = Math.floor(k / 4 / i1.width); minY = Math.min(minY, yy); maxY = Math.max(maxY, yy); }
        return { pixels: n, rows: n ? `${minY}–${maxY}` : "" };
      }, uri(pa), uri(pb));
      detail.push(`${n}: ${r.size ? "size " + r.size : `${r.pixels} px differ (rows ${r.rows})`}`);
    }
    await browser.close();
  }
  console.log(`compared ${names.length} shots: ${names.length - differ.length - missing.length} identical, ${differ.length} differ, ${missing.length} missing`);
  for (const d of detail) console.log("  DIFF", d);
  for (const m of missing) console.log("  MISSING", m);
  process.exit(differ.length || missing.length ? 1 : 0);
}

if (args[0] === "--compare") await compare(args[1], args[2]);

const BASE = args[0] || "http://127.0.0.1:3191";
const LABEL = args[1] || "run";
const PREFS = opt("prefs", ["light", "dark"]);
const VPS = opt("viewports", ["desktop", "phone"]);
const CUES = opt("cues", ["off"]);
const SETS = opt("sets", ["public", "user", "admin"]);
// --fast (P6's matrix): wait for the DOM plus a short network settle, not for network idle — the app polls,
// so networkidle0 sits out its 60 s timeout on every signed-in page. The P1 identity runs use the default.
const FAST = args.includes("--fast");
// --scan (P6): after each shot, an in-page WCAG contrast walk and a keyboard focus walk (below).
const SCAN = args.includes("--scan");
const scans = [];

/**
 * Runs IN THE PAGE. Every visible element that owns text: its colour (with every ancestor's opacity) against
 * the background it actually sits on — ancestors' background colours composited up to the first opaque one,
 * the canvas-shade token (the worst substrate pixel, as colorTokens.test.js) where the chain runs out. Target
 * from <html data-contrast>: AA 4.5 / 3 (large), AAA 7 / 4.5. Skipped, as WCAG does: disabled controls,
 * hidden and aria-hidden text, documents (iframes — never themed), and text over an image or a gradient
 * (reported as "unmeasured", not passed).
 */
function contrastScan() {
  const aaa = document.documentElement.dataset.contrast === "aaa";
  const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ""); if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; };
  const over = (f, b) => [0, 1, 2].map(i => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
  const ch = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
  const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
  const tokenRgb = (name) => { const p = document.createElement("i"); p.style.color = `var(${name})`; document.body.appendChild(p);
    const v = parse(getComputedStyle(p).color); p.remove(); return v; };
  const floor = tokenRgb("--c-canvas-shade") || [255, 255, 255, 1];
  // The two grounds an AAA theme holds at AA (styles/colorTokens.js AA_HELD, owner 10-11): the brand orange fill
  // and third-party sign-in buttons. Text on them needs 4.5 (3 large), as the contract test requires.
  const held = ["--c-accent", "--c-accent-hover", "--c-provider-google", "--c-provider-linkedin", "--c-provider-github", "--c-provider-indeed"]
    .map(tokenRgb).filter(Boolean);
  const isHeld = (g) => held.some((h) => Math.abs(h[0] - g[0]) + Math.abs(h[1] - g[1]) + Math.abs(h[2] - g[2]) <= 6);
  const failures = []; let checked = 0, unmeasured = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || seen.has(el) || !n.textContent.trim()) continue;
    seen.add(el);
    if (el.closest("[aria-hidden='true'], iframe, script, style, noscript, [disabled], [data-doc-surface]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") continue;
    let fg = parse(cs.color); if (!fg) continue;
    let alpha = 1, layers = [], blocked = false;
    for (let a = el; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      alpha *= +s.opacity;
      if (s.backgroundImage && s.backgroundImage !== "none" && a !== document.documentElement && a !== document.body) { blocked = true; break; }
      const bg = parse(s.backgroundColor);
      if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 0.999) break; }
    }
    if (alpha < 0.05) continue;
    if (blocked) { unmeasured++; continue; }
    let ground = floor;
    for (let i = layers.length - 1; i >= 0; i--) ground = over(layers[i], ground);
    fg = [fg[0], fg[1], fg[2], fg[3] * alpha];
    const c = ratio(over(fg, ground), ground);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = aaa && !isHeld(ground) ? (large ? 4.5 : 7) : (large ? 3 : 4.5);
    checked++;
    if (c + 0.005 < need) failures.push({ ratio: +c.toFixed(2), need, text: n.textContent.trim().slice(0, 40),
      where: `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""}` });
  }
  return { checked, unmeasured, failures };
}

/** Tabs through the first 25 focus stops; a stop is visible if its outline or box-shadow differs from unfocused. */
async function focusScan(page) {
  const invisible = []; let checked = 0;
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const f = getComputedStyle(el); const focused = [f.outlineStyle, f.outlineWidth, f.outlineColor, f.boxShadow, f.borderColor, f.backgroundColor].join("|");
      el.blur(); const u = getComputedStyle(el); const rest = [u.outlineStyle, u.outlineWidth, u.outlineColor, u.boxShadow, u.borderColor, u.backgroundColor].join("|");
      el.focus({ preventScroll: true });
      return { visible: focused !== rest, label: `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label").slice(0, 24)}]` : ""}:${(el.textContent || "").trim().slice(0, 20)}` };
    });
    if (!r) break;
    checked++;
    if (!r.visible) invisible.push(r.label);
  }
  return { checked, invisible };
}
const OUT = path.join(OUT_ROOT, LABEL);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

async function call(method, p, body, token) {
  const r = await fetch(`${BASE}${p}`, { method, headers: { "Content-Type": "application/json", ...(token ? { "X-RM-Auth-Context": token, Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
}

// A FIXED synthetic user: the database is restored from the same frozen copy before every run, so the
// second run registers the same id and the screens match. Register, or log in if this copy already has it.
const U = "d91shots", PW = "Synthetic-Pass-91!";
let token = (await call("POST", "/api/auth/register", { username: U, password: PW,
  profile: { email: `${U}@example.invalid`, first_name: "Ada", last_name: "Synthetic", city: "Boston", state: "MA" } })).json?.authContext;
if (!token) token = (await call("POST", "/api/auth/login", { username: U, password: PW })).json?.authContext;
if (!token) throw new Error("could not register or log in the synthetic user");
const profiles = (await call("GET", "/api/domain-profiles", null, token)).json;
if (!(Array.isArray(profiles) ? profiles : profiles?.profiles || []).length) {
  const dp = await call("POST", "/api/domain-profiles", { profile_name: "Platform", role_family: "engineering", domain: "general", seniority: "mid", target_titles: ["Software Engineer"] }, token);
  await call("POST", `/api/domain-profiles/${dp.json?.id || dp.json?.profile?.id}/activate`, null, token);
  await call("POST", "/api/base-resume", { content: "Ada Synthetic\nSoftware Engineer\nAcme — Software Engineer, 2020–2024\n- Built services in Node.js\nSkills: JavaScript, Python, SQL", name: "base.txt" }, token);
}
const adminToken = process.env.D91_ADMIN_PASSWORD
  ? (await call("POST", "/api/auth/login", { username: process.env.D91_ADMIN_USER || "admin", password: process.env.D91_ADMIN_PASSWORD })).json?.authContext
  : null;

const browser = await puppeteer.launch({ executablePath: (await resolveBrowserExecutable()).path, headless: "new", pipe: true,
  protocolTimeout: 180000, args: ["--no-first-run", "--font-render-hinting=none", "--disable-lcd-text"] });
const errors = [];
let aborted = 0, shots = 0;

async function shootSet(routes, who, pref, vp, cues) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", req => { const h = new URL(req.url()).hostname;
    if (["localhost", "127.0.0.1"].includes(h) || /^(data|blob):/.test(req.url())) req.continue(); else { aborted++; req.abort(); } });
  page.on("pageerror", e => errors.push(`${who} ${pref} ${vp}: ${String(e.message || e).slice(0, 160)}`));
  page.on("dialog", d => d.dismiss());
  const t = who === "user" ? token : who === "admin" ? adminToken : null;
  await page.evaluateOnNewDocument((tok, p, c) => {
    try { if (tok) sessionStorage.setItem("rm_auth_context", tok); localStorage.setItem("draft-theme", p);
          if (c === "on") localStorage.setItem("draft-cues", "shape"); } catch {}
    // Freeze the caret and every animation/transition so two runs paint the same frame.
    document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style");
      s.textContent = "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important}";
      document.head.appendChild(s); });
  }, t, pref, cues);
  await page.setViewport({ ...VIEWPORTS[vp], deviceScaleFactor: 1 });
  for (const r of routes) {
    const name = `${who}-${pref}-${vp}${cues === "on" ? "-cues" : ""}${r.replace(/[\/?=&]+/g, "_")}`;
    try {
      await page.goto(`${BASE}${r}`, { waitUntil: FAST ? "domcontentloaded" : "networkidle0", timeout: 60000 }).catch(() => {});
      if (FAST) await page.waitForNetworkIdle({ idleTime: 400, timeout: 6000 }).catch(() => {});
      await sleep(r.startsWith("/app/jobs") || r === "/app/today" ? 3500 : 1500);
      await page.evaluate(() => document.fonts?.ready);
      await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
      shots++;
      if (SCAN) {
        scans.push({ name, ...(await page.evaluate(contrastScan)), focus: await focusScan(page) });
        // Written after EVERY shot: a run stopped part-way (10-11: reaped for low memory at 278 / 512) keeps its findings.
        fs.writeFileSync(path.join(OUT, "_scan.partial.json"), JSON.stringify(scans, null, 2));
      }
    } catch (e) { errors.push(`${name}: ${String(e.message).slice(0, 100)}`); }
  }
  await page.close();
}

for (const cues of CUES) for (const pref of PREFS) for (const vp of VPS) {
  if (SETS.includes("public")) await shootSet(PUBLIC, "public", pref, vp, cues);
  if (SETS.includes("user")) await shootSet(APP, "user", pref, vp, cues);
  if (SETS.includes("admin")) {
    if (adminToken) await shootSet(ADMIN, "admin", pref, vp, cues);
    else errors.push("admin set skipped: no D91_ADMIN_PASSWORD, or the admin login failed");
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, "_run.json"), JSON.stringify({ base: BASE, prefs: PREFS, viewports: VPS, cues: CUES, shots, aborted, errors }, null, 2));
if (SCAN) {
  fs.writeFileSync(path.join(OUT, "_scan.json"), JSON.stringify(scans, null, 2));
  const bad = scans.filter(s => s.failures.length), unfocused = scans.filter(s => s.focus.invisible.length);
  console.log(`contrast scan: ${scans.reduce((n, s) => n + s.checked, 0)} text runs on ${scans.length} screens — ` +
    `${scans.reduce((n, s) => n + s.failures.length, 0)} below target on ${bad.length} screen(s)`);
  for (const s of bad.slice(0, 30)) console.log("  CONTRAST", s.name, s.failures.slice(0, 3).map(f => `${f.ratio} < ${f.need} "${f.text}" (${f.where})`).join(" | "));
  console.log(`focus scan: ${scans.reduce((n, s) => n + s.focus.checked, 0)} focus stops — ${scans.reduce((n, s) => n + s.focus.invisible.length, 0)} with no visible focus on ${unfocused.length} screen(s)`);
  for (const s of unfocused.slice(0, 30)) console.log("  FOCUS", s.name, s.focus.invisible.slice(0, 3).join(" | "));
}
console.log(`${shots} shots → ${OUT} · aborted ${aborted} off-localhost requests · ${errors.length} page error(s)`);
for (const e of errors.slice(0, 20)) console.log("  ERR", e);
