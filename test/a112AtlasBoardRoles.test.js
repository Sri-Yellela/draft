import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode } from "../services/atlas/atlasStore.js";
import { postingMatcher } from "../services/atlas/postingMatcher.js";
import { readBoardRoles, seedBoardRoles, roleTitles, ROLES_FILE } from "../services/atlas/atlasRoles.js";
import { familyCategory } from "../shared/atlasFamilies.js";

// ⭐ A112/Atlas (11-03) — the board's own roles (content/atlas/roles.json): drafts the registry never named, and the
// alternate titles the ONE matcher's roleOf reads. Synthetic nodes and titles only.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const node = (db, slug) => db.prepare(`SELECT kind, status, source, family, family_by FROM atlas_nodes WHERE slug = ?`).get(slug);
const ROLES = [
  { family: "backend", name: "Engineering Manager", slug: "engineering-manager", titles: ["software engineering manager"] },
  { family: "ml", name: "ML Engineer", slug: "ml-engineer", titles: ["machine learning engineer"] },
  { family: "sales", name: "Customer Success Manager", slug: "customer-success-manager", titles: [] },
];

test("A112/Atlas · boardRolesFileValid — every role sits under a real family, once, with string titles", () => {
  const roles = readBoardRoles();
  assert.ok(roles.length >= 25);
  assert.equal(new Set(roles.map(r => r.slug)).size, roles.length);
  for (const r of roles) for (const t of r.titles) assert.equal(typeof t, "string");
  assert.match(JSON.parse(read(ROLES_FILE)).about, /owner's review/);
});

test("A112/Atlas · boardRolesSeedDrafts — a missing role becomes a draft 'board' role; non-computing takes its family, computing none", () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "role", name: "ML Engineer", source: "registry" });
  const r = seedBoardRoles(db, ROLES);
  assert.deepEqual(r.created, ["engineering-manager", "customer-success-manager"]);
  assert.deepEqual(node(db, "engineering-manager"), { kind: "role", status: "draft", source: "board", family: null, family_by: null });
  assert.deepEqual(node(db, "customer-success-manager"), { kind: "role", status: "draft", source: "board", family: "sales", family_by: "seed" });
  assert.equal(node(db, "ml-engineer").source, "registry", "an existing role is not re-created");
  assert.deepEqual(seedBoardRoles(db, ROLES), { created: [], tagged: 0 }, "idempotent");
  assert.equal(familyCategory("ml"), "computing");
});

test("A112/Atlas · boardRolesCuratorWins — a curator's family stays; a slug that is another kind is never re-typed", () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "role", name: "Customer Success Manager", source: "registry" });
  db.prepare(`UPDATE atlas_nodes SET family = 'consulting', family_by = 'owner' WHERE slug = 'customer-success-manager'`).run();
  upsertNode(db, { kind: "skill", name: "Engineering Manager", source: "registry" });
  seedBoardRoles(db, ROLES);
  assert.equal(node(db, "customer-success-manager").family, "consulting");
  assert.equal(node(db, "engineering-manager").kind, "skill");
});

test("A112/Atlas · roleOfReadsAlternateTitles — a posting titled by an alternate title finds the role; the longest term wins", () => {
  const db = fixtureDb();
  seedBoardRoles(db, [...ROLES, { family: "backend", name: "Software Engineer", slug: "software-engineer", titles: [] }]);
  const nodes = db.prepare(`SELECT id, slug, kind, name, term FROM atlas_nodes`).all();
  const id = (s) => nodes.find(n => n.slug === s).id;
  const titles = roleTitles(ROLES);
  const m = postingMatcher(db, nodes, { listOnly: true });
  // The matcher reads the reviewed file's titles; the fixture's are a subset of it.
  for (const [slug, ts] of titles) for (const t of ts) assert.ok((roleTitles().get(slug) || []).includes(t), `${slug}: ${t} is in roles.json`);
  assert.equal(m.roleOf("Senior Machine Learning Engineer, Ads"), id("ml-engineer"));
  assert.equal(m.roleOf("Software Engineering Manager, Payments"), id("engineering-manager"));
  assert.equal(m.roleOf("Software Engineer II"), id("software-engineer"));
  assert.equal(m.roleOf("Head of Brand"), null);
});

test("A112/Atlas · boardRolesAtBoot — server.js seeds the board roles inside its own try, after the families", () => {
  const src = read(new URL("../server.js", import.meta.url));
  const fam = src.indexOf("const f = seedAtlasFamilies(db);");
  const roles = src.indexOf("const r = seedBoardRoles(db);");
  assert.ok(fam > 0 && roles > fam);
  assert.match(src.slice(roles - 200, roles), /try \{\s*$/);
});
