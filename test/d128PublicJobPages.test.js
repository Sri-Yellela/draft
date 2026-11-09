import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import { jobPath, idFromSlug, publicJobFor, renderPublicJobPage, renderMissingJobPage, jobPostingJsonLd, jobsSitemapRoutes, jsonLdScript }
  from "../services/jobs/publicJobPage.js";

// ⭐ D128 P1 (owner 11-01): "i couldn't find any of our postings showing up on any search engine". A public,
// server-rendered page per posting with JobPosting JSON-LD, in a jobs sitemap, allowed by robots.txt. Synthetic postings.

const BASE = "https://jobsviadraft.com";
const TEXT = "About the role\nYou will design brackets and housings.\n\nRequirements\n• 3+ years with SolidWorks\n• GD&T\n\nBenefits\nHealth insurance.";

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, description, board_category, is_active,
      location, salary_min, salary_max, employment_type, posted_at, skills_json, duplicate_of, level_read)
    VALUES (@job_id, 'q', @job_id, @title, @company, @url, @description, @cat, @active, @location, @lo, @hi, @et, @posted, @skills, @dup, @level)`);
  const row = (o) => ins.run({ title: "Mechanical Engineer II", company: "Forge & Co", url: "https://boards.example.com/forge/1",
    description: TEXT, cat: "engineering", active: 1, location: "Boston, MA", lo: 95000, hi: 125000, et: "Full-time",
    posted: "2026-10-20", skills: JSON.stringify(["SolidWorks", "GD&T"]), dup: null, level: "mid", ...o });
  row({ job_id: "gh::open" });
  row({ job_id: "gh::closed", active: 0 });
  row({ job_id: "gh::held", cat: "held", title: "Mystery role" });
  row({ job_id: "gh::unclassified", cat: null });
  row({ job_id: "gh::dup", dup: "gh::open" });
  row({ job_id: "gh::xss", title: "Engineer </script><script>alert(1)</script>", description: "Hello </script><img src=x onerror=alert(1)>" });
  db.prepare(`INSERT INTO atlas_nodes (slug, kind, name, term, status, source) VALUES ('solidworks', 'tool', 'SolidWorks', 'solidworks', 'published', 'test')`).run();
  db.prepare(`INSERT INTO atlas_nodes (slug, kind, name, term, status, source) VALUES ('gd-t', 'skill', 'GD&T', 'gd&t', 'draft', 'test')`).run();
  return db;
}
const idOf = (db, jobId) => db.prepare("SELECT id, company, title FROM scraped_jobs WHERE job_id = ?").get(jobId);
const pageOf = (db, jobId) => {
  const r = idOf(db, jobId);
  // A157 (45q): /<company>/<id> — the route hands the id and the path it was asked for.
  const f = publicJobFor(db, String(r.id), { requested: jobPath(r) });
  return { f, page: f?.kind === "page" ? renderPublicJobPage(db, f.row, { base: BASE, open: f.open }) : null };
};
const ldOf = (html) => {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  return m ? JSON.parse(m[1]) : null;
};

test("d128JobPagePublicServerRendered: the path is /<company>/<id> (A157; was /jobs/<company>-<title>-<id>); the page is plain HTML with the posting in it", () => {
  const db = db0();
  const r = idOf(db, "gh::open");
  assert.equal(jobPath(r), `/forge/${r.id}`, "A157: under its company (legal forms dropped: Forge & Co → forge), the id makes it distinct");
  assert.equal(idFromSlug(`anything-${r.id}`), r.id);
  assert.equal(idFromSlug("no-id-here"), null);
  const { f, page } = pageOf(db, "gh::open");
  assert.equal(f.kind, "page");
  assert.equal(f.open, true);
  assert.match(page.html, /<h1>Mechanical Engineer II<\/h1>/);
  assert.match(page.html, /You will design brackets and housings\./, "the posting's text is in the HTML, not loaded by a script");
  assert.match(page.html, /<link rel="canonical" href="https:\/\/jobsviadraft\.com\/forge\/\d+">/);
  assert.doesNotMatch(page.html, /noindex/);
  assert.match(page.html, /Draft this job/);
  assert.match(page.html, /href="\/atlas\/solidworks"/, "a published Atlas node is linked");
  assert.doesNotMatch(page.html, /\/atlas\/gd-t/, "a draft Atlas node never is");
  // an old /jobs/<words>-<id> address (or a wrong company part) redirects to the canonical path; the id decides
  const wrong = publicJobFor(db, `old-words-${r.id}`);
  assert.deepEqual(wrong, { kind: "redirect", path: jobPath(r) });
});

test("d128JobPostingJsonLdValid: Google's required and recommended fields, only what is stated", () => {
  const db = db0();
  const { page } = pageOf(db, "gh::open");
  const ld = ldOf(page.html);
  assert.equal(ld["@type"], "JobPosting");
  for (const k of ["title", "description", "datePosted", "hiringOrganization", "jobLocation"]) assert.ok(ld[k], `required: ${k}`);
  assert.equal(ld.datePosted, "2026-10-20");
  assert.equal(ld.hiringOrganization.name, "Forge & Co");
  assert.deepEqual(ld.jobLocation.address, { "@type": "PostalAddress", addressLocality: "Boston", addressRegion: "MA", addressCountry: "US" });
  assert.equal(ld.employmentType, "FULL_TIME");
  assert.deepEqual(ld.baseSalary.value, { "@type": "QuantitativeValue", unitText: "YEAR", minValue: 95000, maxValue: 125000 });
  assert.equal(ld.identifier.value, "gh::open");
  assert.match(ld.description, /<ul><li>3\+ years with SolidWorks<\/li><li>GD&amp;T<\/li><\/ul>/);
  assert.ok(!("validThrough" in ld), "no validThrough is invented when the posting gave none");
  // remote → TELECOMMUTE with the country requirement
  const r = db.prepare("SELECT * FROM scraped_jobs WHERE job_id = 'gh::open'").get();
  const remote = jobPostingJsonLd({ ...r, workplace_type: "remote", location: "Remote" }, { base: BASE });
  assert.equal(remote.jobLocationType, "TELECOMMUTE");
  assert.equal(remote.applicantLocationRequirements.name, "USA");
  // the employer's text can never close the script tag
  const { page: xss } = pageOf(db, "gh::xss");
  assert.doesNotMatch(xss.html, /<script>alert/);
  assert.doesNotMatch(xss.html, /<img src=x/);
  assert.equal(jsonLdScript({ a: "</script>" }), '<script type="application/ld+json">{"a":"\\u003c/script>"}</script>');
});

test("d128ClosedJobDropsSchemaAndSitemap: a closed posting says so, is noindex, has no JSON-LD and is not in the sitemap", () => {
  const db = db0();
  const { f, page } = pageOf(db, "gh::closed");
  assert.equal(f.open, false);
  assert.match(page.html, /This posting has closed/);
  assert.match(page.html, /<meta name="robots" content="noindex">/);
  assert.equal(ldOf(page.html), null);
  assert.doesNotMatch(page.html, /Draft this job/);
  const paths = jobsSitemapRoutes(db).map(r => r.path);
  assert.ok(paths.includes(jobPath(idOf(db, "gh::open"))));
  assert.ok(!paths.includes(jobPath(idOf(db, "gh::closed"))));
  assert.ok(!paths.includes(jobPath(idOf(db, "gh::dup"))), "a duplicate is not listed");
  // a duplicate's page points at the posting it duplicates
  const dup = idOf(db, "gh::dup");
  assert.deepEqual(publicJobFor(db, String(dup.id), { requested: jobPath(dup) }), { kind: "redirect", path: jobPath(idOf(db, "gh::open")) });
});

test("d128HeldPostingNoPublicPage: held and not-yet-classified postings have no page and no sitemap entry", () => {
  const db = db0();
  for (const j of ["gh::held", "gh::unclassified"]) {
    assert.equal(pageOf(db, j).f, null, j);
    assert.ok(!jobsSitemapRoutes(db).some(r => r.path === jobPath(idOf(db, j))), j);
  }
  // …and the route answers a real 404 (noindex), never the app shell's 200 (a soft 404 to a crawler)
  const missing = renderMissingJobPage();
  assert.equal(missing.status, 404);
  assert.match(missing.html, /<meta name="robots" content="noindex">/);
  const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  assert.match(server.slice(at(server, 'app.get("/jobs/:slug"'), at(server, 'app.get("/sitemap.xml"')), /: renderMissingJobPage\(\)/);
});

test("d128SitemapAndRobots: robots.txt allows /jobs/ and names the jobs sitemap; the routes are wired before the app shell", () => {
  const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const robots = server.slice(at(server, 'app.get("/robots.txt"'), at(server, "// AUTH", at(server, 'app.get("/robots.txt"')));
  assert.doesNotMatch(robots, /"Disallow: \/jobs"/);
  assert.match(robots, /"Allow: \/jobs\/"/);
  assert.match(robots, /Sitemap: \$\{base\}\/sitemap-jobs\.xml/);
  assert.match(server, /app\.get\("\/sitemap-jobs\.xml"[\s\S]{0,200}jobsSitemapRoutes\(db\)/);
  const route = at(server, 'app.get("/jobs/:slug"');
  assert.ok(route < at(server, 'app.get("*"'), "the page is served before the SPA's catch-all");
  assert.ok(route > at(server, "app.use(express.static(CLIENT_DIST))"));
});

test("d128EmployerCredited: the employer is named as the poster, the original is linked, and their words are shown as theirs", () => {
  const db = db0();
  const { page } = pageOf(db, "gh::open");
  assert.match(page.html, /Posted by Forge &amp; Co on their careers site/);
  assert.match(page.html, /<a href="https:\/\/boards\.example\.com\/forge\/1" rel="noopener nofollow">View the original posting<\/a>/);
  assert.match(page.html, /The posting, as Forge &amp; Co wrote it/);
  // a non-http link is never rendered
  db.prepare("UPDATE scraped_jobs SET url = 'javascript:alert(1)', apply_url = NULL WHERE job_id = 'gh::open'").run();
  assert.doesNotMatch(pageOf(db, "gh::open").page.html, /javascript:/);
});
