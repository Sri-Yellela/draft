import test from "node:test";
import assert from "node:assert/strict";
import { titleFirstHeader, splitCompanyTitle } from "../services/structuredProfile.js";
import { howYouKnow } from "../services/warmPaths.js";

// ⭐ A113 (agent, 11-03) · found by 44i's real-Chrome walk: a résumé header "Data Analyst, Brightmart Retail — Bentonville,
// AR (2022 – 2025)" reached Profile → Experience as company "Data Analyst" with no title, so D138 said "connected while you
// were at Data Analyst". The parse cuts at the first comma; the Profile now puts the title and the employer back.

test("A113 · a title-first header is put back: the role is the title, the employer the company, the place the location", () => {
  assert.deepEqual(titleFirstHeader("Data Analyst", null, "Brightmart Retail — Bentonville, AR ()"),
    { company: "Brightmart Retail", title: "Data Analyst", location: "Bentonville, AR" });
  assert.deepEqual(titleFirstHeader("Senior Software Engineer", "", "Northwind | Remote"),
    { company: "Northwind", title: "Senior Software Engineer", location: "Remote" });
});

test("A113 · nothing else moves: a real company, an entry with a title, a location with no employer, two roles", () => {
  assert.equal(titleFirstHeader("Northwind", null, "Boston, MA"), null);
  assert.equal(titleFirstHeader("Data Analyst", "Analyst II", "Acme — Boston"), null, "it has a title already");
  assert.equal(titleFirstHeader("Data Analyst", null, "Boston, MA"), null, "no employer in the location");
  assert.equal(titleFirstHeader("Senior Engineer", null, "Staff Engineer — Remote"), null, "the location's head is a role too");
  assert.deepEqual(splitCompanyTitle("Northwind - Staff Engineer", ""), { company: "Northwind", title: "Staff Engineer", dateInTitle: null }, "D101's rule unchanged");
});

test("A113 · D138 then names the employer", () => {
  const jobs = [{ company: "Brightmart Retail", from: Date.UTC(2022, 0, 1) / 1000, to: Date.UTC(2025, 0, 1) / 1000 }];
  assert.equal(howYouKnow({ source: "linkedin", connected_on: Date.UTC(2023, 2, 12) / 1000 }, jobs),
    "a LinkedIn connection (connected while you were at Brightmart Retail)");
});
