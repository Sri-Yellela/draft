// A77 (owner, 10-03) — company logos resolved per company during enrichment, STORED, served first-party.
// ⛔ The precedent: logo.clearbit.com died and its fallback for "unreachable" was Clearbit itself, so
// 1,290 / 1,296 rows held a dead URL while the code looked fine. These tests run the chain against an
// INJECTED network, including dead providers, so the fallback is proven rather than assumed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import {
  companyKey, candidateDomains, homepageNamesCompany, declaredIcons, sniffImage,
  resolveCompanyLogo, resolveCompanyLogos, storedLogo, logoPath, PROVIDERS,
} from "../services/jobs/companyLogoStore.js";
import { MIGRATIONS } from "../scripts/migrations.js";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);
const ICO = Buffer.concat([Buffer.from([0, 0, 1, 0, 1, 0]), Buffer.alloc(40, 2)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

/** A fake fetch over a map of url → { status, body } | "dead" (the DNS-gone case: it throws). */
function net(routes) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const r = routes[url];
    if (!r || r === "dead") throw new TypeError("fetch failed");
    const body = Buffer.isBuffer(r.body) ? r.body : Buffer.from(String(r.body ?? ""));
    return { ok: r.status === 200, status: r.status, url, arrayBuffer: async () => body };
  };
  return { fetchImpl, calls };
}
const page = (title, extra = "") => ({ status: 200, body: `<html><head><title>${title}</title>${extra}</head><body></body></html>` });

test("⛔ DEAD PROVIDERS FALL THROUGH TO A DIFFERENT SOURCE — and when all are dead, NOTHING is stored", async () => {
  // The site declares no icon and its favicon host is gone; DuckDuckGo answers.
  const a = net({ "https://ramp.com/": page("Ramp"), "https://ramp.com/favicon.ico": "dead",
                  "https://icons.duckduckgo.com/ip3/ramp.com.ico": { status: 200, body: ICO } });
  const r = await resolveCompanyLogo("Ramp", [], { fetchImpl: a.fetchImpl });
  assert.equal(r.status, "ok");
  assert.equal(r.provider, "duckduckgo", "google-favicon has no route here (dead) → the next source");
  // Every provider dead → none, and no URL anywhere in the result.
  const b = net({ "https://ramp.com/": page("Ramp"), "https://ramp.com/favicon.ico": "dead",
                  "https://icons.duckduckgo.com/ip3/ramp.com.ico": "dead" });
  const r2 = await resolveCompanyLogo("Ramp", [], { fetchImpl: b.fetchImpl });
  assert.equal(r2.status, "none");
  assert.ok(!("bytes" in r2) && !("url" in r2), "a result for 'nothing served a logo' carries no address");
  // The providers are three DIFFERENT sources — never the same host twice.
  assert.deepEqual(PROVIDERS.map(p => p.name), ["site-declared", "site-favicon", "google-favicon", "duckduckgo"]);
});

// D170 (5), 11-06 — production: "site-favicon, duckduckgo" named dead, 13 of 40 companies without a logo. Measured:
// both alive; they only ever saw SVG-only sites (<link rel=icon type=image/svg+xml>, /favicon.ico 404), and DuckDuckGo
// mirrors that same /favicon.ico. Google's favicon service rasterises the site's icon to PNG.
const gfav = (d) => `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(`https://${d}`)}&size=128`;
test("d170LogosSvgOnlySiteGetsARasterisedIcon — an SVG-only site's logo comes from the rasterising provider", async () => {
  const n = net({ "https://findigs.com/": page("Findigs", '<link rel="icon" href="/icon.svg" type="image/svg+xml">'),
                  "https://findigs.com/favicon.ico": { status: 404, body: "<html>nope</html>" },
                  [gfav("findigs.com")]: { status: 200, body: PNG } });
  const r = await resolveCompanyLogo("Findigs", [], { fetchImpl: n.fetchImpl });
  assert.equal(r.status, "ok");
  assert.equal(r.provider, "google-favicon");
  assert.equal(r.mime, "image/png");
  assert.ok(!n.calls.includes("https://findigs.com/icon.svg"), "the SVG itself is never fetched");
  // Google answers 404 with a placeholder globe (a real PNG) when it has no icon: refused, not stored.
  const g = net({ "https://findigs.com/": page("Findigs"), [gfav("findigs.com")]: { status: 404, body: PNG } });
  assert.equal((await resolveCompanyLogo("Findigs", [], { fetchImpl: g.fetchImpl })).status, "none");
});

test("d170LogosLateProviderZeroIsNotDeath — a provider failing only the hard companies is asked the canary sites first", async () => {
  const db = new Database(":memory:");
  db.exec(MIGRATIONS.find(m => m.id === "124_company_logos").sql);
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, company TEXT, url TEXT, apply_url TEXT, company_icon_url TEXT, is_active INTEGER)`);
  for (const [i, c] of ["Brex", "Figma", "Notion", "Linear", "Vercel", "Plaid"].entries()) {
    db.prepare("INSERT INTO scraped_jobs VALUES (?,?,NULL,NULL,NULL,1)").run(`j${i}`, c);
  }
  // Every board company is SVG-only and unknown to every provider; the canary sites have icons everywhere.
  const canary = ["github.com", "stripe.com", "wikipedia.org"];
  const fetchImpl = async (url) => {
    const isCanary = canary.some(d => url.includes(d)) && !/(brex|figma|notion|linear|vercel|plaid)/.test(url);
    if (url.endsWith("/")) return { ok: true, status: 200, url, arrayBuffer: async () => Buffer.from(`<title>${url.match(/\/\/([a-z]+)/)[1]}</title>${isCanary ? '<link rel="icon" href="/i.png">' : ""}`) };
    if (isCanary && !url.startsWith("https://stripe.com/")) return { ok: true, status: 200, url, arrayBuffer: async () => PNG };
    return { ok: false, status: 404, url, arrayBuffer: async () => Buffer.alloc(0) };
  };
  const r = await resolveCompanyLogos(db, { fetchImpl });
  assert.deepEqual(r.dead, [], JSON.stringify(r.providers));
  assert.equal(r.providers["site-favicon"].canary, "ok");
  assert.equal(r.providers.duckduckgo.canary, "ok");
  assert.equal(r.providers["google-favicon"].canary, "ok");
});

test("d170LogosNameIsADomain — 'Oscilar.com' is its own site, not oscilarcom.com", () => {
  assert.deepEqual(candidateDomains("Oscilar.com", [])[0], { domain: "oscilar.com", evidence: "named" });
  assert.deepEqual(candidateDomains("Acme Robotics", []).map(c => c.domain), ["acmerobotics.com"]);
});

test("⛔ A GUESS IS NOT A LOGO: a guessed domain counts only when its own homepage names the company", async () => {
  // ramp.app is a different company; the guess is ONLY <name>.com now.
  assert.deepEqual(candidateDomains("Acme Robotics", []).map(c => c.domain), ["acmerobotics.com"]);
  const n = net({ "https://acmerobotics.com/": page("Totally Different Corp — Home"),
                  "https://acmerobotics.com/favicon.ico": { status: 200, body: ICO } });
  const r = await resolveCompanyLogo("Acme Robotics", [], { fetchImpl: n.fetchImpl });
  assert.equal(r.status, "none");
  assert.ok(!n.calls.includes("https://acmerobotics.com/favicon.ico"), "no icon is fetched for an unconfirmed domain");
  assert.equal(homepageNamesCompany("<title>Acme Robotics | Robots</title>", "Acme Robotics"), true);
  assert.equal(homepageNamesCompany("<title>Ramp.app | AI Agents</title>", "Ramp Network"), false);
  assert.equal(homepageNamesCompany('<meta property="og:site_name" content="Mercury">', "Mercury"), true);
});

test("the curated table and the company's own careers host are trusted; ATS hosts never are", () => {
  assert.deepEqual(candidateDomains("Ramp", ["https://jobs.ashbyhq.com/ramp/1"])[0], { domain: "ramp.com", evidence: "known" });
  const d = candidateDomains("Lingo Co", ["https://careers.lingoapp.io/jobs/1", "https://boards.greenhouse.io/lingo/2"]);
  assert.deepEqual(d.map(c => c.evidence), ["careers", "guess"]);
  assert.equal(d[0].domain, "lingoapp.io");
  assert.equal(companyKey("Match Group, Inc."), "match-group", "group stays part of the name; the legal form goes");
});

test("⛔ RASTER ONLY — SVG (a document that can run script on our origin) and HTML are refused", async () => {
  assert.equal(sniffImage(PNG), "image/png");
  assert.equal(sniffImage(ICO), "image/x-icon");
  assert.equal(sniffImage(SVG), null);
  assert.equal(sniffImage(Buffer.from("<html>not found</html>")), null);
  const n = net({ "https://stripe.com/": page("Stripe", '<link rel="icon" href="/i.png">'),
                  "https://stripe.com/i.png": { status: 200, body: SVG },               // lies about its type
                  "https://stripe.com/favicon.ico": { status: 200, body: ICO } });
  const r = await resolveCompanyLogo("Stripe", [], { fetchImpl: n.fetchImpl });
  assert.equal(r.provider, "site-favicon");
  assert.equal(r.mime, "image/x-icon");
  // SVG links are not even tried.
  assert.deepEqual(declaredIcons('<link rel="icon" type="image/svg+xml" href="/a.svg"><link rel="apple-touch-icon" href="/t.png">', "https://x.com/"),
                   ["https://x.com/t.png"]);
});

function boardDb() {
  const db = new Database(":memory:");
  db.exec(MIGRATIONS.find(m => m.id === "124_company_logos").sql);
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, company TEXT, url TEXT, apply_url TEXT, company_icon_url TEXT, is_active INTEGER)`);
  const ins = db.prepare("INSERT INTO scraped_jobs VALUES (?,?,?,?,?,1)");
  ins.run("r1", "Ramp", "https://jobs.ashbyhq.com/ramp/1", null, null);
  ins.run("r2", "Ramp", "https://jobs.ashbyhq.com/ramp/2", null, "https://icons.duckduckgo.com/ip3/ramp.com.ico");
  ins.run("r3", "Ramp", "https://jobs.ashbyhq.com/ramp/3", null, "https://media.licdn.com/feed-logo.png");   // a FEED logo
  ins.run("u1", "Nowhere Labs", "https://boards.greenhouse.io/nowhere/1", null, null);
  return db;
}

test("⭐ ONE row per COMPANY; its jobs point at the first-party path; a feed logo is left alone", async () => {
  const db = boardDb();
  const n = net({ "https://ramp.com/": page("Ramp", '<link rel="apple-touch-icon" href="/apple.png">'),
                  "https://ramp.com/apple.png": { status: 200, body: PNG } });
  const r = await resolveCompanyLogos(db, { fetchImpl: n.fetchImpl, now: 1_000_000 });
  assert.equal(r.scanned, 2);
  assert.equal(r.ok, 1);
  assert.equal(r.none, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM company_logos").get().n, 2);
  const icons = Object.fromEntries(db.prepare("SELECT job_id, company_icon_url u FROM scraped_jobs").all().map(x => [x.job_id, x.u]));
  assert.equal(icons.r1, logoPath("ramp"));
  assert.equal(icons.r2, logoPath("ramp"), "a derived third-party URL is repointed at the stored logo");
  assert.equal(icons.r3, "https://media.licdn.com/feed-logo.png", "a feed logo is better than ours and stays");
  assert.equal(icons.u1, null, "no logo → no URL: the card keeps its letter");
  assert.deepEqual([...storedLogo(db, "ramp").bytes], [...PNG]);
  assert.equal(storedLogo(db, "nowhere-labs"), null);
  // Resolved companies are not re-fetched; a 'none' is re-tried only after 30 days.
  const again = await resolveCompanyLogos(db, { fetchImpl: n.fetchImpl, now: 1_000_000 + 86400 });
  assert.equal(again.scanned, 0);
  assert.equal((await resolveCompanyLogos(db, { fetchImpl: n.fetchImpl, now: 1_000_000 + 31 * 86400 })).scanned, 1);
});

test("⛔ a provider with attempts and no success is NAMED — the line that would have caught Clearbit", async () => {
  const db = new Database(":memory:");
  db.exec(MIGRATIONS.find(m => m.id === "124_company_logos").sql);
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, company TEXT, url TEXT, apply_url TEXT, company_icon_url TEXT, is_active INTEGER)`);
  for (const [i, c] of ["Stripe", "Figma", "Notion", "Linear", "Vercel", "Plaid"].entries()) {
    db.prepare("INSERT INTO scraped_jobs VALUES (?,?,NULL,NULL,NULL,1)").run(`j${i}`, c);
  }
  // Every site is up but serves no icon, and DuckDuckGo is GONE.
  const fetchImpl = async (url) => {
    if (url.includes("duckduckgo")) throw new TypeError("fetch failed");
    if (url.endsWith("/")) return { ok: true, status: 200, url, arrayBuffer: async () => Buffer.from("<title>x</title>") };
    return { ok: false, status: 404, url, arrayBuffer: async () => Buffer.alloc(0) };
  };
  const r = await resolveCompanyLogos(db, { fetchImpl });
  assert.ok(r.dead.includes("duckduckgo"), JSON.stringify(r.providers));
  const src = fs.readFileSync("server.js", "utf8");
  assert.match(src, /if \(r\.dead\.length\) console\.error\(`\[logos\] ⛔ provider\(s\) with attempts and NO success/);
});

test("the route serves stored bytes first-party, as an image only", () => {
  const src = fs.readFileSync("server.js", "utf8");
  assert.match(src, /app\.get\("\/api\/company-logo\/:key", \(req, res\) => \{/);
  assert.match(src, /"X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'"/);
  assert.match(src, /if \(process\.env\.COMPANY_LOGOS !== "off"\) \{/);
});
