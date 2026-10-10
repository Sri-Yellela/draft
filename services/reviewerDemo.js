// services/reviewerDemo.js — ⭐ D86 §6 · THE REVIEWER ACCOUNT ("DEMO") AND ITS RESET.
//
// The connector directory reviews with a real, fully populated account that only reviewers see
// (docs/CLAUDE_CONNECTOR_COMPLIANCE.md §6): a FICTIONAL candidate, a base résumé, three claims, the plugin
// switch on, a high daily cap, twelve clearly labelled sample postings with STABLE ids, no second factor and
// no email step. A reset restores it after destructive tests.
//
// ⛔ NOTHING HERE IS A REAL PERSON. Alex Rivera, every employer and every posting are invented; the contact
// details use the reserved example.com domain and a 555-01xx number.
// ⛔ THE SAMPLE POSTINGS NEVER REACH ANY BOARD. They are stored INACTIVE (is_active = 0), so no board query
// shows them to anyone — they are reached only by id (draft_get_job, the brief) and from the reviewer's own
// Draft House. The prompts that search use the real, public board.
// ⛔ The password is never in this file or the repository: the caller supplies it (the CLI reads it from an
// environment variable), and it goes only into the review portal's Test & launch step.
import crypto from "node:crypto";
import { hashPassword } from "./authSecurity.js";
import { saveBaseResumeRecord } from "./simpleApplyProfile.js";
import { addProfileSignalSuggestions, setProfileSignalClaim } from "./profileSignalAggregator.js";
import { setOverride, clearOverride } from "./userAdmin.js";
import { liveOverride } from "./entitlementResolver.js";

export const DEMO_USERNAME = "draft-reviewer";
export const DEMO_EMAIL = "alex.rivera@example.com";
export const DEMO_DAILY_CAP = 100;
export const DEMO_CLAIMS = Object.freeze(["Kubernetes", "GraphQL", "Terraform"]);
const SAMPLE = "(sample posting for review)";

export const DEMO_RESUME = `Alex Rivera
alex.rivera@example.com | (555) 010-0142 | Remote, USA
SUMMARY
Backend engineer with six years building services for logistics and retail.
TECHNICAL SKILLS
Languages: Python, Go, SQL, TypeScript
Tools: PostgreSQL, Docker, Redis, AWS, GitHub Actions
EXPERIENCE
Harborline Freight | Remote
Senior Software Engineer | Mar 2022 – Present
• Built a Python service that routes 40,000 shipments a day across three regions
• Cut PostgreSQL query time by 60% by redesigning indexes for the tracking tables
• Led four engineers through a move from a monolith to Go services
• Ran the on-call rotation and wrote the runbooks the team still uses
Maple & Pine Retail | Chicago, IL
Software Engineer | Jun 2019 – Feb 2022
• Maintained Go checkout services handling 2 million orders a month
• Added Redis caching that halved the catalogue page's response time
• Wrote the integration tests that caught 30 regressions before release
• Moved builds to Docker and GitHub Actions, cutting deploys from 40 to 8 minutes
Lakeside Analytics | Chicago, IL
Junior Developer | Jul 2018 – May 2019
• Built internal dashboards in TypeScript for the operations team
EDUCATION
Midwest State University | B.S. Computer Science | 2018`;

// A posting long enough to score: the scorer declines a posting with fewer than a handful of scorable terms
// ("not enough signal"), and the review's second prompt promises a score before → after.
const posting = (n, title, company, location, level, workplace, { does, needs, nice, years }) => ({
  job_id: `demo-job-${String(n).padStart(3, "0")}`, title: `${title} ${SAMPLE}`, company: `${company} (sample)`, location,
  experience_level: level, workplace_type: workplace, skills_json: JSON.stringify([...needs, ...nice]),
  description: [
    "This is a sample posting written for draft's connector review. It is not a real job.",
    "",
    `About the role: ${company} is hiring a ${title.toLowerCase()} to ${does}.`,
    "",
    "What you will do:",
    `- Design, build and operate services using ${needs.slice(0, 3).join(", ")}.`,
    `- Work with product and data teams on reliability, performance and testing.`,
    `- Review code, write documentation and take part in an on-call rotation.`,
    "",
    "Requirements:",
    `- ${years}+ years of professional software engineering experience.`,
    ...needs.map(x => `- Production experience with ${x}.`),
    "- Strong SQL and experience with REST APIs, CI/CD and automated testing.",
    "",
    "Nice to have:",
    ...nice.map(x => `- ${x}.`),
  ].join("\n"),
});

/** Twelve invented postings with stable ids. 007 asks for Kafka (the résumé has none: the refusal prompt); 004 is the gap prompt. */
export const DEMO_POSTINGS = Object.freeze([
  posting(1, "Backend Engineer", "Northgate Shipping", "Remote", "mid", "remote", { years: 3, does: "build the services that track parcels across the network",
    needs: ["Python", "PostgreSQL", "Docker", "AWS"], nice: ["Redis", "GitHub Actions"] }),
  posting(2, "Senior Backend Engineer", "Bluefin Payments", "New York, NY", "senior", "hybrid", { years: 5, does: "own the services that route card payments",
    needs: ["Go", "PostgreSQL", "Redis", "Docker"], nice: ["Kubernetes", "AWS"] }),
  posting(3, "Platform Engineer", "Cedar Health Tech", "Remote", "senior", "remote", { years: 5, does: "run the platform every product team ships on",
    needs: ["Kubernetes", "Terraform", "AWS", "Docker"], nice: ["Go", "Python"] }),
  posting(4, "Data Engineer", "Granite Insights", "Austin, TX", "mid", "onsite", { years: 3, does: "build the pipelines behind customer analytics",
    needs: ["Python", "SQL", "Spark", "Airflow"], nice: ["AWS", "PostgreSQL"] }),
  posting(5, "Software Engineer, Checkout", "Orchard Market", "Chicago, IL", "mid", "hybrid", { years: 3, does: "make checkout fast and reliable",
    needs: ["Go", "Redis", "TypeScript", "PostgreSQL"], nice: ["Docker", "GitHub Actions"] }),
  posting(6, "Site Reliability Engineer", "Summit Streaming", "Remote", "senior", "remote", { years: 5, does: "keep video streaming reliable at peak",
    needs: ["Kubernetes", "Go", "Prometheus", "AWS"], nice: ["Terraform", "Python"] }),
  posting(7, "Backend Engineer, Events", "Riverbend Logistics", "Remote", "senior", "remote", { years: 5, does: "build the event pipeline behind live shipment tracking",
    needs: ["Python", "Kafka", "PostgreSQL", "Docker"], nice: ["AWS", "Redis"] }),
  posting(8, "Full Stack Engineer", "Lantern Learning", "Denver, CO", "mid", "hybrid", { years: 3, does: "build the course platform end to end",
    needs: ["TypeScript", "React", "PostgreSQL", "Python"], nice: ["Docker", "AWS"] }),
  posting(9, "API Engineer", "Quarry Maps", "Seattle, WA", "mid", "onsite", { years: 3, does: "design the public APIs for map data",
    needs: ["GraphQL", "Go", "PostgreSQL", "Docker"], nice: ["Redis", "AWS"] }),
  posting(10, "Infrastructure Engineer", "Tidewater Energy", "Remote", "senior", "remote", { years: 5, does: "automate the infrastructure behind grid monitoring",
    needs: ["Terraform", "AWS", "Docker", "Python"], nice: ["Kubernetes", "GitHub Actions"] }),
  posting(11, "Software Engineer II", "Juniper Travel", "Boston, MA", "mid", "hybrid", { years: 2, does: "build booking services",
    needs: ["Python", "Redis", "AWS", "PostgreSQL"], nice: ["Docker", "TypeScript"] }),
  posting(12, "Staff Backend Engineer", "Ironwood Security", "Remote", "lead", "remote", { years: 8, does: "lead the design of the detection services",
    needs: ["Go", "Kubernetes", "PostgreSQL", "AWS"], nice: ["Terraform", "Redis"] }),
]);

export class DemoError extends Error {}

function demoUser(db) {
  const u = db.prepare("SELECT u.id, u.is_admin, p.email FROM users u LEFT JOIN user_profile p ON p.user_id = u.id WHERE u.username = ?").get(DEMO_USERNAME);
  if (u && (u.is_admin || u.email !== DEMO_EMAIL)) throw new DemoError(`The username ${DEMO_USERNAME} belongs to an account that is not the reviewer account; nothing was changed.`);
  return u || null;
}

function seedPostings(db) {
  const up = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, location, description, source, url, _hash, posted_at,
      experience_level, workplace_type, skills_json, is_active, scraped_at)
    VALUES (@job_id, 'reviewer-demo', @company, @title, @location, @description, 'demo', NULL, @hash, datetime('now'), @experience_level,
      @workplace_type, @skills_json, 0, unixepoch())
    ON CONFLICT(job_id) DO UPDATE SET company = excluded.company, title = excluded.title, location = excluded.location,
      description = excluded.description, experience_level = excluded.experience_level, workplace_type = excluded.workplace_type,
      skills_json = excluded.skills_json, is_active = 0`);
  for (const p of DEMO_POSTINGS) up.run({ ...p, hash: crypto.createHash("sha256").update(p.job_id).digest("hex").slice(0, 32) });
}

/**
 * Creates the reviewer account, or brings it back to its starting state. Idempotent.
 * @param {{ password?: string, actorId?: number|null }} opts — a password is required to create the account;
 *   on an existing one it replaces the password only when given.
 * @returns {{ userId: number, created: boolean, postings: number }}
 */
export function seedReviewerDemo(db, { password = null, actorId = null } = {}) {
  return db.transaction(() => {
    let u = demoUser(db);
    let created = false;
    if (!u) {
      if (!password || String(password).length < 12) throw new DemoError("A password of 12 or more characters is needed to create the reviewer account.");
      db.prepare("INSERT INTO users (username, password_hash, is_admin, apply_mode, plan_tier) VALUES (?, ?, 0, 'SIMPLE', 'BASIC')").run(DEMO_USERNAME, hashPassword(password));
      const id = db.prepare("SELECT id FROM users WHERE username = ?").pluck().get(DEMO_USERNAME);
      db.prepare(`INSERT INTO user_profile (user_id, full_name, first_name, last_name, email, location, country, requires_sponsorship, has_clearance)
        VALUES (?, 'Alex Rivera', 'Alex', 'Rivera', ?, 'Remote, USA', 'United States', 0, 0)`).run(id, DEMO_EMAIL);
      u = { id };
      created = true;
    } else if (password) {
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), u.id);
    }
    const userId = u.id;
    db.prepare("UPDATE users SET password_set = 1, byom_enabled = 1, domain_profile_complete = 1 WHERE id = ?").run(userId);
    let profileId = db.prepare("SELECT id FROM domain_profiles WHERE user_id = ? AND is_active = 1").pluck().get(userId);
    if (!profileId) {
      profileId = db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, seniority, target_titles, selected_keywords,
          selected_verbs, selected_tools, is_active) VALUES (?, 'Backend engineering', 'engineering', 'engineering', 'senior', ?, '[]', '[]', '[]', 1)`)
        .run(userId, JSON.stringify(["Backend Engineer", "Software Engineer"])).lastInsertRowid;
    }
    saveBaseResumeRecord(db, { userId, profileId }, DEMO_RESUME, "alex-rivera-resume.txt");
    addProfileSignalSuggestions(db, { userId, profileId, kind: "skill", labels: [...DEMO_CLAIMS] });
    for (const label of DEMO_CLAIMS) setProfileSignalClaim(db, { userId, profileId, kind: "skill", label, claimed: true });
    if (liveOverride(db, userId, "byo_daily_cap")?.value_json !== JSON.stringify(DEMO_DAILY_CAP)) {
      setOverride(db, { userId, featureKey: "byo_daily_cap", value: DEMO_DAILY_CAP, reason: "reviewer account (D86 §6)", actorId });
    }
    seedPostings(db);
    // The reviewer's Draft House: every sample posting, queued.
    db.prepare("DELETE FROM apply_run_jobs WHERE user_id = ?").run(userId);
    const runId = db.prepare("INSERT INTO apply_runs (user_id) VALUES (?)").run(userId).lastInsertRowid;
    const add = db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, ?, ?, 'queued')");
    for (const p of DEMO_POSTINGS) add.run(runId, userId, p.job_id);
    return { userId, created, postings: DEMO_POSTINGS.length };
  })();
}

/**
 * "Reset demo account": removes what reviewers made — saved résumés, briefs, the connector's activity — and seeds
 * the starting state again. Connections stay (a reviewer is not made to reconnect); the password is unchanged.
 */
export function resetReviewerDemo(db, { actorId = null } = {}) {
  const u = demoUser(db);
  if (!u) throw new DemoError("There is no reviewer account to reset.");
  db.transaction(() => {
    for (const t of ["resume_versions", "resumes", "byom_briefs", "mcp_audit"]) {
      try { db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(u.id); } catch (e) { if (!/no such table/.test(e.message)) throw e; }
    }
    if (liveOverride(db, u.id, "plugin_byo")) clearOverride(db, { userId: u.id, featureKey: "plugin_byo", reason: "reviewer account reset", actorId });
  })();
  return seedReviewerDemo(db, { actorId });
}
