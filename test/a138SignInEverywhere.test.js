// ⭐ A138 (owner 11-07): one shared sign-in provider block with Continue with Google on every sign-in
// surface, and every sign-in returning to the page it was started from.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { safeReturnPath, returnToFromSearch, currentReturnPath, loginHref, providerStartHref }
  from "../client/src/lib/signInReturn.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");

test("a138OneSignInComponent: the nav popover and /login both render THE provider block, and nothing else draws provider buttons", () => {
  const popover = read("client/src/components/InlineLoginPopover.jsx");
  const auth = read("client/src/components/AuthScreen.jsx");
  for (const [name, src] of [["InlineLoginPopover", popover], ["AuthScreen", auth]]) {
    assert.match(src, /import SignInProviders from "\.\/SignInProviders\.jsx"/, `${name} imports the shared block`);
    assert.match(src, /<SignInProviders\b/, `${name} renders it`);
    assert.doesNotMatch(src, /\/api\/auth\/oauth\/[a-z${}]+\/start|href=\{`\/auth\/\$\{provider\}`\}/, `${name} builds no provider URL of its own`);
  }
  // The defect: the popover read the status as { google } while the endpoint answers { providers: { google } }.
  const block = read("client/src/components/SignInProviders.jsx");
  assert.match(block, /d\?\.providers/, "the block reads the endpoint's `providers` key");
  const server = read("server.js");
  assert.match(server, /res\.json\(\{ providers: oauthReadiness\(req\) \}\)/, "the endpoint's shape the block reads");
});

test("a138EverySignInOffersGoogle: Google is first, and shown while the status loads", () => {
  const block = read("client/src/components/SignInProviders.jsx");
  assert.match(block, /SIGN_IN_PROVIDERS = Object\.freeze\(\["google", "linkedin", "github"\]\)/);
  assert.match(block, /providers === null \? p === "google"/);
});

test("a138GoogleReturnsToOrigin: the return path rule", () => {
  assert.equal(safeReturnPath("/jobs/123?x=1#y"), "/jobs/123?x=1#y");
  for (const bad of ["//evil.example", "https://evil.example/", "evil", "/\\evil", "/login", "/login?returnTo=/x", "/register", ""])
    assert.equal(safeReturnPath(bad), null, bad);
  assert.equal(returnToFromSearch("?returnTo=%2Fatlas%2Fskills"), "/atlas/skills");
  assert.equal(returnToFromSearch("?returnTo=%2F%2Fevil.example"), null);
  assert.equal(currentReturnPath({ pathname: "/jobs/9", search: "?q=go", hash: "" }), "/jobs/9?q=go");
  assert.equal(currentReturnPath({ pathname: "/login", search: "?returnTo=%2Fatlas", hash: "" }), "/atlas");
  assert.equal(currentReturnPath({ pathname: "/login", search: "", hash: "" }), "/app");
  assert.equal(loginHref("/atlas"), "/login?returnTo=%2Fatlas");
  assert.equal(loginHref("/app"), "/login");
  assert.equal(providerStartHref("google", "/jobs/9"), "/auth/google?returnTo=%2Fjobs%2F9");
  assert.equal(providerStartHref("google", "//evil"), "/auth/google?returnTo=%2Fapp");
});

test("a138GoogleReturnsToOrigin: the gate sends returnTo, /login honours it, a failed login keeps it", () => {
  const app = read("client/src/App.jsx");
  assert.match(app, /<Navigate to=\{loginHref\(currentReturnPath\(\)\)\} replace\/>/);
  assert.match(app, /returnToFromSearch\(window\.location\.search\)\) \|\| "\/app"/);
  const server = read("server.js");
  assert.match(server, /returnTo === "\/login" && stored\?\.returnTo \? \{ returnTo: stored\.returnTo \}/);
  assert.match(server, /mode === "login" \? \{ returnTo \} : \{\}/);
  // The server's own same-origin rule still applies to whatever comes back (oauthReturnUrl).
  assert.match(server, /if \(sameOrigin && rawPath\.startsWith\("\/"\) && !rawPath\.startsWith\("\/\/"\)\)/);
  for (const rel of ["client/src/pages/atlas/AtlasPanels.jsx", "client/src/pages/tools/ApplyToolPage.jsx",
    "client/src/pages/tools/ATSToolPage.jsx", "client/src/pages/tools/GenerateToolPage.jsx"])
    assert.doesNotMatch(read(rel), /to="\/login"/, `${rel}: Sign in links carry the return path`);
});
