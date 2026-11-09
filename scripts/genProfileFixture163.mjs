// 45s: one-off — the real /api/profile/page and /api/profile/sections answers for a synthetic person, for the
// screens163 Profile fixture. Run from the repo root: node scripts/genProfileFixture163.mjs > tmp/profile_fixture.json
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "./migrations.js";
import profileSectionRoutes from "../routes/profileSections.js";

const RESUME = `Ada Example
ada@example.invalid | Boston, MA
SUMMARY
Backend engineer building data systems.
EXPERIENCE
Northwind — Software Engineer
Jan 2022 – Present | Boston, MA
- Built a queue
- Cut latency 30%
EDUCATION
Northeastern University — MS Computer Science
2020 – 2022
SKILLS
Languages: Java, Python
Tools: Docker
`;
const db = new Database(":memory:");
for (const m of MIGRATIONS) db.exec(m.sql);
db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt',?,unixepoch())").run(RESUME);
db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email,requires_sponsorship) VALUES (1,'Ada','Example','ada@example.invalid',0)").run();
const app = express(); app.use(express.json());
const requireAuth = (req, _res, next) => { req.user = { id: 1, username: "ada" }; next(); };
profileSectionRoutes(app, db, requireAuth, { resolveLogo: async () => null });
const srv = app.listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;
const out = {};
for (const p of ["/api/profile/page", "/api/profile/sections", "/api/profile/replacements/latest"]) {
  const r = await fetch(base + p); out[p] = { status: r.status, body: await r.json() };
}
srv.close();
console.log(JSON.stringify(out));
