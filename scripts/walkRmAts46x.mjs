// scripts/walkRmAts46x.mjs — ⭐ 46x · D192 (4d) on the tools service's own ATS check, in real Chrome: boots the sibling checkout
// (../resume-master) on a free port with no store and no model key, fills the check with a SYNTHETIC résumé and posting
// (company "Stripe", so the service asks draft's public company-stack — a public read), and reads the result: the number
// painted by its band with no band word, the four parts as one bar and line each, the biggest gain (option C). Shots: docs/fidelity-shots/walk46x-rm-ats-*.png.
//   node scripts/walkRmAts46x.mjs
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const RM = path.resolve("..", "resume-master");
const PORT = 4471, BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = path.resolve("docs", "fidelity-shots");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
const env = { ...process.env, PORT: String(PORT), ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", RM_CLIENT_TOKENS: "", RM_DATA_DIR: "",
  RM_COMPANY_STACK_URL: "https://jobsviadraft.com/api/public/company-stack", DOTENV_CONFIG_PATH: "./.no-dotenv-walkRmAts46x" };
const server = spawn(process.execPath, ["server.js"], { cwd: RM, env, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; server.stdout.on("data", d => { log += d; }); server.stderr.on("data", d => { log += d; });
const kill = () => { try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ } };
process.on("exit", kill);

const RESUME = `Ada Synthetic
Experience
Senior Software Engineer, Backend — Northwind Systems
- Built payment infrastructure for merchants in Ruby and Java, processing card transactions
- Designed APIs and data pipelines on Kafka and SQL; ran on-call for the ledger service
Skills
Ruby, Java, SQL, Kafka, Python, AWS`;
const POSTING = `What you'll do
- Build payment infrastructure that moves money for millions of businesses
- Design reliable APIs in Ruby and Java
- Lead a team of 5 engineers through design reviews
Requirements
- 5+ years building backend systems; Ruby, Java, SQL, AWS, Kafka`;

let browser = null;
try {
  for (let t = 0; ; t++) {
    if (server.exitCode != null) throw new Error(log.slice(-2000));
    if ((await fetch(`${BASE}/health`).then(r => r.status).catch(() => 0)) === 200) break;
    if (t > 120) throw new Error(`not up:\n${log.slice(-2000)}`);
    await sleep(500);
  }
  browser = await puppeteer.launch({ executablePath: (await resolveBrowserExecutable()).path, headless: "new", pipe: true, args: ["--no-first-run"] });
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  for (const [w, h] of [[1440, 1100], [400, 1400]]) {
    await page.setViewport({ width: w, height: h });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    await page.evaluate((r, d) => { const f = document.getElementById("ats-form"); f.resumeText.value = r; f.title.value = "Senior Backend Engineer"; f.company.value = "Stripe"; f.description.value = d; }, RESUME, POSTING);
    await page.evaluate(() => { const t = [...document.querySelectorAll("[data-tab], button")].find(b => /ats/i.test(b.dataset?.tab || "")); t?.click(); });
    await page.evaluate(() => document.querySelector("#ats-form button[type=submit]").click());
    await page.waitForFunction(() => !/Scoring…/.test(document.getElementById("ats-out")?.innerText || "Scoring…"), { timeout: 30000 });
    const r = await page.evaluate(() => {
      const out = document.getElementById("ats-out");
      const num = out.querySelector(".atsc-num .ats-num, .ats-head .ats-num");
      return { text: out.innerText, numCls: num?.className || null, numColor: num ? getComputedStyle(num).color : null,
        parts: [...out.querySelectorAll(".atsc-row > span:first-child")].map(s => s.textContent),
        heads: [...out.querySelectorAll("h3")].map(h => h.textContent), gain: out.querySelector(".atsc-gain")?.textContent || "", side: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    say(`${w}: the number, painted by its band`, !!r.numCls && /strong|moderate|weak/.test(r.numCls), `${r.numCls} · ${r.numColor}`);
    say(`${w}: no band word`, !/Strong match|Moderate match|Weak match|\bStrong\b|\bModerate\b|\bWeak\b/.test(r.text), "none");
    say(`${w}: the four parts`, r.parts.length >= 3, r.parts.join(" | "));
    say(`${w}: the biggest gain, and no lists of terms`, /^Biggest gain: /.test(r.gain) && r.heads.length === 0, `${r.gain} · headings: ${r.heads.join(" | ") || "none"}`);
    say(`${w}: their stack from draft's public record`, r.parts.includes("Their stack"), r.parts.includes("Their stack") ? "Stripe's stack read" : "no stack part");
    say(`${w}: no side-scroll, no page errors`, !r.side && errors.length === 0, errors.join(" | ") || "none");
    const out = await page.$("#ats-out"); await out.screenshot({ path: path.join(SHOTS, `walk46x-rm-ats-${w}.png`) });
  }
} catch (e) { say("the walk ran", false, e.message.slice(0, 500)); }
finally { try { await browser?.close(); } catch { /* closed */ } kill(); }
const failed = results.filter(x => !x).length;
console.log(`\n${results.length - failed} / ${results.length} passed`);
process.exit(failed ? 1 : 0);
