import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import portalRoutes from "../routes/applyWorker.js";

// ⭐ D100 · the run bar's Portals (the approved sketch): connected sessions and portal accounts, each removable; an
// account is OFFERED only when the apply worker is configured. Synthetic user.

async function portalsWith(client) {
  const saved = { url: process.env.APPLY_WORKER_URL, token: process.env.APPLY_WORKER_TOKEN };
  delete process.env.APPLY_WORKER_URL; delete process.env.APPLY_WORKER_TOKEN;
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  const app = express();
  app.use(express.json());
  app.use((req, _r, n) => { req.user = { id: 1 }; n(); });
  portalRoutes(app, db, (_q, _r, n) => n(), { client });
  const server = app.listen(0);
  try {
    return await (await fetch(`http://127.0.0.1:${server.address().port}/api/portals`)).json();
  } finally {
    server.close();
    if (saved.url !== undefined) process.env.APPLY_WORKER_URL = saved.url;
    if (saved.token !== undefined) process.env.APPLY_WORKER_TOKEN = saved.token;
  }
}

test("D100 · GET /api/portals says whether the apply worker is configured", async () => {
  assert.equal((await portalsWith(null)).worker, false, "no worker → nothing offered");
  const on = await portalsWith({ destroyKey: async () => {} });
  assert.equal(on.worker, true);
  assert.deepEqual(on.portals, []);
  assert.deepEqual(on.accounts, []);
});

// D113 UI U8 (owner 10-31) on purpose: the Portals drawer is the ONE Settings drawer's third group, "Accounts on job sites".
test("D100 · Accounts on job sites (the Settings drawer): Remove for each, consent said in full, create offered only with a worker", () => {
  const ui = fs.readFileSync("client/src/components/AutoSettingsDrawer.jsx", "utf8");
  const panel = fs.readFileSync("client/src/panels/AutoApplyPanel.jsx", "utf8");
  assert.match(ui, /data-settings-group="accounts"/);
  assert.match(ui, /<Accounts \/>/);
  assert.match(panel, /<AutoSettingsDrawer open=\{settingsOpen\}/);
  assert.match(ui, /api\(`\/api\/portals\/\$\{p\.id\}`, \{ method: "DELETE" \}\)/);
  assert.match(ui, /api\(`\/api\/portals\/accounts\/\$\{a\.id\}`, \{ method: "DELETE" \}\)/);
  assert.match(ui, /\{d\.worker \? \(/, "create is offered only when something can do it");
  assert.match(ui, /JSON\.stringify\(\{ portalFamily: p\.family, originHost: p\.host, consent: true \}\)/);
  assert.match(ui, /a password only its apply service can read/, "the consent says what draft keeps");
});
