// Agent open item 8 (WORKLOG 43k) · T20's edge: a consent click whose answer reached Chrome while the service worker
// restarted (an extension update) — or a grant made from chrome://extensions — leaves Chrome holding every preset
// site with NO consent recorded. Consent is still never inferred (T20): the card stays, and only its line changes to
// say one press finishes it, with no prompt. The click itself is unchanged (it still asks Chrome first).
import test from "node:test";
import assert from "node:assert/strict";

const { popupAutoView, SITES, CARD, defaultSettings } = await import("../extension/autoRead.js");
const all = (v) => Object.fromEntries(SITES.map(s => [s.id, v]));
const url = "https://boards.greenhouse.io/example/jobs/100";

test("every preset site already granted, no consent recorded → the card stays and says one press finishes it", () => {
  const v = popupAutoView({ settings: defaultSettings(), url, granted: { sites: all(true) } });
  assert.equal(v.card, true, "consent is never inferred from a grant");
  assert.equal(v.alreadyGranted, true);
  assert.match(CARD.askingGranted, /already allows/);
  assert.match(CARD.askingGranted, /Nothing is read until you press it/);
});

test("a partial grant, or none, keeps Chrome's own prompt line", () => {
  const some = all(true); some[SITES[0].id] = false;
  assert.equal(popupAutoView({ settings: defaultSettings(), url, granted: { sites: some } }).alreadyGranted, false);
  assert.equal(popupAutoView({ settings: defaultSettings(), url, granted: { sites: all(false) } }).alreadyGranted, false);
});

test("with consent recorded there is no card, so nothing to say", () => {
  const s = { ...defaultSettings(), consent2: { at: Date.now() } };
  const v = popupAutoView({ settings: s, url, granted: { sites: all(true) } });
  assert.equal(v.card, false);
  assert.equal(v.alreadyGranted, false);
});
