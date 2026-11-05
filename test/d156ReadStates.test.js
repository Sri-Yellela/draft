// ⚠ D156 (6) (owner 11-05) · THE LOADING BUG, AGAIN: "Sorting by fit needs this profile's base resume — Add one", "We
// couldn't load your job profiles — draft didn't answer in time", the deck stuck on "Dealing today's draft…".
// Measured (production, Railway's request log, 11-05): the server's event loop was held ≈ 70 s at 02:52:10–02:53:20Z and
// ≈ 65 s at 05:52:40–05:53:47Z with no deploy running (every request in flight finished in the same second afterwards;
// /api/draft/today cut off by the deck's 8 s limit, /api/domain-profiles by Full House's 10 s, a two-row read). The 11-03
// rule — a failed or slow read is never drawn as "you have none" — held for the profile list only; these tests hold it
// for every profile, résumé and deck read, and the deck's last good picks stay on screen while it refreshes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const JOBS = read("client/src/panels/JobsPanel.jsx");
const PROFILES = read("client/src/panels/JobProfilesPanel.jsx");
const DECK = read("client/src/panels/DeckView.jsx");

test("d156FailedReadNeverShownAsMissing · the résumé: 'Add one' only after a read that succeeded and found none", () => {
  const eff = JOBS.slice(at(JOBS, "if (!activeProfileResumePath || !activeProfileEnhanceStatusPath) {"),
                         at(JOBS, "[user, activeProfileResumePath, activeProfileEnhanceStatusPath, resumeTry]);"));
  assert.match(eff, /api\(activeProfileResumePath, \{ timeoutMs: 10000 \}\)/, "the read has a limit");
  assert.match(eff, /\.then\(\(\[resume, status\]\) => \{\n\s+if \(!live\) return;\n\s+setResumeState\("ready"\);/);
  assert.match(eff, /\.catch\(\(\) => \{\n\s+if \(!live\) return;\n[\s\S]{0,200}setResumeState\("error"\);/, "a failure is an error state");
  // the notice: never while loading; a failure says it could not be read and offers Try again, not "Add one"
  assert.match(JOBS, /<FitRankingNotice theme=\{theme\} show=\{!canRankByFit && resumeReadState !== "loading"\}\n\s+failed=\{resumeReadState === "error"\} onRetry=\{onRetryResume\}/);
  const notice = JOBS.slice(at(JOBS, "function FitRankingNotice("), at(JOBS, "function FilteredEmptyState("));
  const failed = notice.indexOf("if (failed) return (");
  assert.ok(failed > 0 && failed < notice.indexOf("Sorting by fit needs this profile's base resume"), "the failure is answered first");
  assert.match(notice.slice(failed, notice.indexOf("Sorting by fit needs")), /We couldn't load this profile's résumé[\s\S]*Try again/);
  assert.doesNotMatch(notice.slice(failed, notice.indexOf("Sorting by fit needs")), /Add one/);
  // both board call sites hand the state down
  assert.equal(JOBS.split("resumeReadState={resumeState} onRetryResume={() => setResumeTry(n => n + 1)}").length - 1, 2);
});

test("d156FailedReadNeverShownAsMissing · the profiles (Full House) and the job-profiles page", () => {
  // Full House (44p's guard, still holding)
  assert.match(JOBS, /api\("\/api\/domain-profiles", \{ timeoutMs: 10000 \}\)/);
  assert.match(JOBS, /setProfilesState\(s => \(s === "ready" \? s : "error"\)\)/);
  // the job-profiles page: "No job profiles yet" only on a successful empty read
  const load = PROFILES.slice(at(PROFILES, "const loadProfiles = useCallback(async () => {"), at(PROFILES, "useEffect(() => { loadProfiles(); }"));
  assert.match(load, /setProfilesState\("ready"\)/);
  assert.match(load, /catch \(e\) \{\n\s+setProfilesState\(s => \(s === "ready" \? s : "error"\)\);/);
  assert.match(PROFILES, /\{profilesState === "ready" && profiles\.length === 0 && \([\s\S]{0,400}No job profiles yet/);
  assert.doesNotMatch(PROFILES, /\{profiles\.length === 0 && \(/, "no bare empty check left");
  assert.match(PROFILES, /profilesState === "error" && profiles\.length === 0[\s\S]{0,900}We couldn't load your job profiles[\s\S]{0,400}Try again/);
});

test("d156FailedReadNeverShownAsMissing · the deck: a failure is an error with Try again or the last good deal — never an empty deck", () => {
  const fetch = DECK.slice(at(DECK, "const fetchDeck = useCallback(async () => {"), at(DECK, "useEffect(() => { fetchDeck(); }, [fetchDeck]);"));
  const katch = fetch.slice(at(fetch, "} catch (e) {"));
  assert.match(katch, /const last = lastGoodDeck\.get\(cacheKey\);/);
  assert.match(katch, /setLoad\(\{ status: "error", error: e\.message/);
  assert.doesNotMatch(katch, /initialDeck\(null\)|cards: \[\]/, "a failure never deals an empty deck");
  // the empty-deck copy ("Start with your résumé." / "Add your résumé…") is drawn only from a deck the server dealt
  assert.match(DECK, /\{load\.status === "ready" && s\.size === 0 && \(\(\) => \{/);
});

test("d156DeckShowsLastGoodWhileRefreshing · today's last good picks stay on screen while the deck refreshes or scores", () => {
  const fetch = DECK.slice(at(DECK, "const fetchDeck = useCallback(async () => {"), at(DECK, "useEffect(() => { fetchDeck(); }, [fetchDeck]);"));
  const head = fetch.slice(0, at(fetch, "try {"));
  assert.match(head, /const held = rememberedDeck\(cacheKey\);/);
  assert.match(head, /if \(held\) \{[\s\S]{0,300}setLoad\(\{ status: "ready", error: null, refreshing: true \}\);[\s\S]{0,40}\} else \{/);
  assert.ok(head.indexOf('status: "loading"') > head.indexOf("} else {"), "\"Dealing…\" only without a last good deal");
  assert.match(fetch, /setLoad\(held \? \{ status: "ready", error: null, refreshing: true \} : \{ status: "scoring", error: null \}\);/);
  assert.match(fetch, /rememberDeck\(cacheKey, deck\);/);
  // a refresh never replaces the picks on screen (and the decisions made on them)
  assert.equal(fetch.split('if (loadStatusRef.current !== "ready") {').length - 1, 2);
  // the session cache: guarded storage, read back on a reload, carrying the decisions made since
  const helpers = DECK.slice(at(DECK, 'const LAST_GOOD_PREFIX = "draft.deck.lastGood.";'), at(DECK, "const localDate = "));
  assert.match(helpers, /try \{ sessionStorage\.setItem\(LAST_GOOD_PREFIX \+ key, JSON\.stringify\(deck\)\); \} catch/);
  assert.match(helpers, /try \{\n\s+const raw = sessionStorage\.getItem\(LAST_GOOD_PREFIX \+ key\);/);
  assert.match(DECK, /rememberDeck\(key, \{ \.\.\.base, cards: state\.cards\.map/);
  assert.match(DECK, /load\.refreshing && !load\.stale[\s\S]{0,200}Refreshing today's draft…/);
  // the box says "Dealing…" only while loading with nothing to show
  assert.match(DECK, /\(load\.status === "loading" \|\| load\.status === "scoring"\) && \(/);
});
