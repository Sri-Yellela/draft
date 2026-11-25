// ⭐ D196 FIX-7 → D199 C8 (owner 11-25, 47h) · THE MARKET'S INDEX in a real Chrome. Moved on purpose in 47h: FIX-8's bubble
// OVERLAID the row's last cells ("the draft buttons come up and cover them … the buttons need to push the options to the
// left not overlap"); C8 makes it push (test/d199MarketBrowser.test.js measures the push). What these keep from 47f:
//   d196IndexIsGazetteer   — the ink header row with the board's columns, the status tags as mono tags, the page never
//                            scrolls sideways;
//   d196IndexSortedAsDeck  — row n is the n-th job JobsColumn was given (no client re-sort);
//   d196HoverBubbleKept    — hover and keyboard focus within a row open Star and Draft; they call the board's own handlers
//                            and never open the row; a row click opens the posting; ≥ 44 px targets;
//   d196HoverBubbleReducedMotion — no grow under Reduce motion.
// Retired with the overlay: the touch screen's "first tap arms the bubble" (on a touch screen the actions are always open
// now — the `Market` board's rule) and the 200-row window (the market shows 50 a page, D199 C3).
import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../services/browserLauncher.js";
import { buildFixturePage } from "../scripts/d196Regress.mjs";

let browser, url;
test.before(async () => { url = await buildFixturePage("MarketIndexBoard"); browser = await launchBrowser({ headless: "new" }); });
test.after(async () => { await browser?.close(); });

async function open({ width = 1280, hash = "", reduced = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }]);
  await page.goto(`${url}${hash}`, { waitUntil: "load" });
  await page.waitForSelector("[data-market-index] .pl-ixrow[data-row-opens]");
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const ROWS = "[data-market-index] .pl-ixrow[data-row-opens]";
const act = (page, i) => page.evaluate((sel, i) => {
  const a = document.querySelectorAll(sel)[i].querySelector(".pl-ixrow__act");
  const btn = a.querySelector("[data-bubble-action]");
  return { w: a.getBoundingClientRect().width, transition: btn ? getComputedStyle(btn).animationName : "none" };
}, ROWS, i);

test("C8 · d196IndexIsGazetteer + d196IndexSortedAsDeck", { timeout: 120000 }, async () => {
  const page = await open({ width: 700, hash: "#w=652" });
  const r = await page.evaluate((sel) => {
    const head = document.querySelector("[data-market-index] .pl-ixrow--head");
    return { heads: [...head.querySelectorAll("[role=columnheader]")].filter((h) => h.getBoundingClientRect().width > 0).map((h) => h.textContent).filter(Boolean), headBg: getComputedStyle(head).backgroundColor,
      headFont: getComputedStyle(head).fontFamily, pageScrolls: document.documentElement.scrollWidth > innerWidth,
      titles: [...document.querySelectorAll(sel)].map((row) => [row.children[0].textContent, row.querySelector("[data-index-title]").textContent]),
      tags: [...document.querySelectorAll(`${sel} .pl-status`)].map((t) => [t.textContent, t.dataset.kind || "", getComputedStyle(t).fontFamily]) };
  }, ROWS);
  assert.deepEqual(r.heads, ["#", "OPENING · COMPANY", "MATCH", "STATUS", "Actions"], "at 700 px the STACK and H-1B columns fold away (the board's at-hide-sm)");
  assert.match(r.headBg, /rgb\(27, 27, 27\)/, "the ink header row");
  assert.match(r.headFont, /JetBrains Mono/);
  assert.ok(!r.pageScrolls, "the page never scrolls sideways");
  assert.deepEqual(r.titles.map(([n]) => n), ["1", "2", "3", "4", "5", "6"]);
  assert.equal(r.titles[0][1], "Frontend Engineer II, Checkout", "the board's order, as given (no client re-sort)");
  assert.equal(r.titles[5][1], "Web Engineer, Growth");
  assert.deepEqual(r.tags.map(([t, k]) => [t, k]), [["NEW", "new"], ["NEW", "new"], ["NEW", "new"], ["DRAFTED", "drafted"], ["NEEDS YOU", "needs"], ["SENT", "sent"]]);
  for (const [, , f] of r.tags) assert.match(f, /JetBrains Mono/);
  await page.close();
});

test("C8 · d196HoverBubbleKept — hover / focus open Star and Draft; they are the board's; a row click opens the posting", { timeout: 120000 }, async () => {
  const page = await open();
  const rest = (await act(page, 1)).w;
  await page.hover(`${ROWS}:nth-of-type(3) .pl-ixc--match`);
  await new Promise((r) => setTimeout(r, 500));
  assert.ok((await act(page, 1)).w > rest + 60, "hover opens the actions");
  await page.click(`${ROWS}:nth-of-type(3) [data-bubble-action=star]`);
  await page.click(`${ROWS}:nth-of-type(3) [data-bubble-action=draft]`);
  let calls = await page.evaluate(() => globalThis.__plateIndexCalls || []);
  assert.deepEqual(calls, ["save:ix-1", "draft:ix-1"], "Star → the board's save, Draft → its draft — and the row did not open");
  await page.mouse.move(5, 5);
  await page.evaluate((sel) => document.querySelectorAll(sel)[3].querySelector("[data-bubble-action=star]").focus(), ROWS);
  await new Promise((r) => setTimeout(r, 500));
  assert.ok((await act(page, 3)).w > rest + 60, "focus within the row opens them");
  const labels = await page.evaluate((sel) => [...document.querySelectorAll(sel)[0].querySelectorAll("[data-bubble-action]")].map((b) => [b.tagName, b.getAttribute("aria-label")]), ROWS);
  assert.deepEqual(labels, [["BUTTON", "Star Frontend Engineer II, Checkout at Kestrel Payments"], ["BUTTON", "Draft Frontend Engineer II, Checkout at Kestrel Payments"]]);
  const target = await page.evaluate((sel) => { const b = document.querySelectorAll(sel)[3].querySelector("[data-bubble-action=star]").getBoundingClientRect(); return [b.width, b.height]; }, ROWS);
  assert.ok(target[1] >= 44 && target[0] >= 44, `≥ 44 px targets (${target})`);
  await page.click(`${ROWS}:nth-of-type(4) .pl-ixc--match`);
  calls = await page.evaluate(() => globalThis.__plateIndexCalls);
  assert.equal(calls.at(-1), "open:ix-2");
  await page.close();
});

test("C8 · d196HoverBubbleReducedMotion — no grow under Reduce motion", { timeout: 60000 }, async () => {
  // 47h (A201): the actions fade in as they join the row (no clipping grow); under Reduce motion they just appear
  const page = await open({ reduced: true });
  await page.hover(`${ROWS}:nth-of-type(2) .pl-ixc--match`);
  assert.equal((await act(page, 0)).transition, "none");
  await page.close();
  const moving = await open();
  await moving.hover(`${ROWS}:nth-of-type(2) .pl-ixc--match`);
  assert.equal((await act(moving, 0)).transition, "pl-ix-in", "they fade in otherwise");
  await moving.close();
});
