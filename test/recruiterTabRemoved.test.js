// D5 (10-03): the user-side nav carries no "Recruiter" tab. FE-6 built a recruiter surface with no
// recruiter role, no signup path and no front door — a tab that advertises a product that does not
// exist is the "Not linked" class of label. The TAB goes; the CODE stays: the panel, its route and
// the two in-app deep links (JobCard's company KB link, CompanyViewModal's "Open in Recruiter view")
// still work, and R2–R6 build on them.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const app = fs.readFileSync("client/src/App.jsx", "utf8");
const tabStart = at(app, "const appTabs = [");
const tabRow = app.slice(tabStart, at(app, "];", tabStart));

test("⛔ the tab row has no Recruiter tab", () => {
  assert.ok(!/id:\s*"recruiter"/.test(tabRow), "a Recruiter tab is back in the user-side nav");
  assert.ok(!/label:\s*"Recruiter"/.test(tabRow));
});

test("the recruiter route still resolves — the deep links into it are not bounced to the board", () => {
  // D10 added "job-profiles" beside it (a tab removed, its page kept the same way).
  assert.match(app, /const ROUTE_ONLY_TABS = \["recruiter"[^\]]*\];/);
  assert.match(app, /\.\.\.ROUTE_ONLY_TABS\]\)/);
  assert.match(app, /activeTab === "recruiter"\s*&& <RecruiterPanel\/>/);
  assert.ok(fs.existsSync("client/src/panels/RecruiterPanel.jsx"), "the panel's code was deleted, not just its tab");
});
