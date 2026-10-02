// Owner, 10-02 (A44): Skroutz posts only in Greece, so it is DEACTIVATED (not deleted) for a US-only
// board; Hygraph's empty board is kept. Run the real migration SQL against a small fixture.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { at } from "../test-support/sourceAnchors.js";

const block = (p) => {
  const src = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  const i = at(src, 'id: "115_deactivate_skroutz_outside_us"', 0, `${p} migration 115`);
  return src.slice(i, at(src, "`,", at(src, "sql: `", i, "115 sql"), "115 end"));
};

test("115 deactivates Skroutz and nothing else — both runners", () => {
  for (const p of ["server.js", "scripts/migrations.js"]) {
    const sql = block(p).split("sql: `")[1];
    const db = new Database(":memory:");
    db.exec(`CREATE TABLE company_ats_list (company TEXT, ats_type TEXT, ats_slug TEXT, active INTEGER);
             INSERT INTO company_ats_list VALUES ('Skroutz','workable','skroutz',1),('Persado','workable','persado',1),
                                                 ('Hygraph','recruitee','hygraph',1),('Stripe','greenhouse','stripe',1);`);
    db.exec(sql);
    const active = db.prepare("SELECT company, active FROM company_ats_list ORDER BY company").all();
    assert.deepEqual(active, [
      { company: "Hygraph", active: 1 }, { company: "Persado", active: 1 },
      { company: "Skroutz", active: 0 }, { company: "Stripe", active: 1 },
    ], p);
    assert.doesNotMatch(sql, /DELETE/i, "deactivated, never deleted");
  }
});
