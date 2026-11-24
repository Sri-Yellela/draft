// ⭐ D196 FIX-7 / FIX-8 (owner 11-24, 47f) · THE MARKET'S INDEX in a real Chrome — the owner's named tests:
//   d196IndexIsGazetteer          — one table in a white card that scrolls sideways INSIDE its own box (the page never
//                                   does), the ink header row with the board's columns, the status tags as mono tags;
//   d196IndexSortedAsDeck         — the rows keep the board's own order (the server's D184 B-8 tiers, then fit): row n is
//                                   the n-th job JobsColumn was given — nothing re-sorts them on the client;
//   d196HoverBubbleKept           — hover and keyboard focus within a row open the bubble; Star and Draft call the board's
//                                   own handlers (decideJob SAVED / DRAFTED in JobsColumn — here the fixture's recorders),
//                                   and pressing them never opens the row;
//   d196HoverBubbleTouchVisible   — on a touch screen (no hover) the first tap opens the bubble without opening the row; the
//                                   second tap opens the posting;
//   d196HoverBubbleNoLayoutShift  — opening the bubble moves nothing: the row's box and every cell stay where they were;
//   d196HoverBubbleReducedMotion  — under Reduce motion the pill opens with no grow (no transition);
//   + R3: past 200 rows the index windows itself.
// ⛔ Verified to fail (47f, by mutation): the pill's hover rule removed → d196HoverBubbleKept red; the bubble put in the
// cell's flow (position: static) → d196HoverBubbleNoLayoutShift red.
import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../services/browserLauncher.js";
import { buildFixturePage } from "../scripts/d196Regress.mjs";

let browser, url;
test.before(async () => { url = await buildFixturePage("MarketIndexBoard"); browser = await launchBrowser({ headless: "new" }); });
test.after(async () => { await browser?.close(); });

async function open({ width = 1280, hash = "", reduced = false, touch = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }]);
  if (touch) await page.evaluateOnNewDocument(() => {   // a touch screen: (hover: none) matches
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/hover:\s*none/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
  });
  await page.goto(`${url}${hash}`, { waitUntil: "load" });
  await page.waitForSelector("[data-market-index] tbody tr");
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const pill = (page, i) => page.evaluate((i) => {
  const p = document.querySelectorAll("[data-market-index] tbody tr")[i].querySelector(".pl-rowbubble__pill");
  return { opacity: getComputedStyle(p).opacity, pointer: getComputedStyle(p).pointerEvents, transition: getComputedStyle(p).transitionDuration };
}, i);

test("FIX-7 · d196IndexIsGazetteer + d196IndexSortedAsDeck", { timeout: 120000 }, async () => {
  const page = await open({ width: 700, hash: "#w=652" });
  const r = await page.evaluate(() => {
    const box = document.querySelector("[data-market-index] .pl-gazetteer"), table = box.querySelector("table");
    const head = [...table.querySelectorAll("thead th")];
    return { heads: head.map((h) => h.textContent), headBg: getComputedStyle(table.querySelector("thead tr")).backgroundColor,
      headFont: getComputedStyle(head[0]).fontFamily, boxOverflow: getComputedStyle(box).overflowX, boxBorder: getComputedStyle(box).borderTopWidth,
      boxRadius: getComputedStyle(box).borderTopLeftRadius, boxScrolls: box.scrollWidth > box.clientWidth, pageScrolls: document.documentElement.scrollWidth > innerWidth,
      titles: [...table.querySelectorAll("tbody tr")].map((tr) => [tr.cells[0].textContent, tr.querySelector("[data-index-title]").textContent]),
      tags: [...table.querySelectorAll("tbody .pl-status")].map((t) => [t.textContent, t.dataset.kind || "", getComputedStyle(t).fontFamily]) };
  });
  assert.deepEqual(r.heads, ["#", "OPENING", "COMPANY", "MATCH", "STACK · YOURS", "H-1B", "STATUS"]);
  assert.match(r.headBg, /rgb\(27, 27, 27\)/, "the ink header row");
  assert.match(r.headFont, /JetBrains Mono/);
  assert.equal(r.boxOverflow, "auto"); assert.ok(["1px", "1.5px"].includes(r.boxBorder), `the 1.5 px ink border (Chrome rounds it to device pixels at DPR 1): ${r.boxBorder}`); assert.equal(r.boxRadius, "18px");
  assert.ok(r.boxScrolls, "at 700 px the table scrolls inside its own box");
  assert.ok(!r.pageScrolls, "the page never scrolls sideways");
  assert.deepEqual(r.titles.map(([n]) => n), ["1", "2", "3", "4", "5", "6"]);
  assert.equal(r.titles[0][1], "Frontend Engineer II, Checkout", "the board's order, as given (no client re-sort)");
  assert.equal(r.titles[5][1], "Web Engineer, Growth");
  assert.deepEqual(r.tags.map(([t, k]) => [t, k]), [["NEW", "new"], ["NEW", "new"], ["NEW", "new"], ["DRAFTED", "drafted"], ["NEEDS YOU", "needs"], ["SENT", "sent"]]);
  for (const [, , f] of r.tags) assert.match(f, /JetBrains Mono/);
  await page.close();
});

test("FIX-8 · d196HoverBubbleKept + d196HoverBubbleNoLayoutShift — hover / focus open it; Star / Draft are the board's; nothing moves", { timeout: 120000 }, async () => {
  const page = await open();
  const rect = () => page.evaluate(() => [...document.querySelectorAll("[data-market-index] tbody tr")[1].cells].map((c) => { const r = c.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10); }));
  const before = await rect();
  assert.equal((await pill(page, 1)).opacity, "0", "at rest the pill is closed (the circle shows)");
  await page.hover("[data-market-index] tbody tr:nth-child(2) td:nth-child(3)");
  await new Promise((r) => setTimeout(r, 400));
  const hovered = await pill(page, 1);
  assert.equal(hovered.opacity, "1", "hover opens it"); assert.equal(hovered.pointer, "auto");
  assert.deepEqual(await rect(), before, "the row and its cells did not move");
  await page.click("[data-market-index] tbody tr:nth-child(2) [data-bubble-action=star]");
  await page.click("[data-market-index] tbody tr:nth-child(2) [data-bubble-action=draft]");
  let calls = await page.evaluate(() => globalThis.__plateIndexCalls || []);
  assert.deepEqual(calls, ["save:ix-1", "draft:ix-1"], "Star → the board's save, Draft → its draft — and the row did not open");
  await page.mouse.move(5, 5);
  // the keyboard: Tab into the row's buttons opens it
  await page.evaluate(() => document.querySelectorAll("[data-market-index] tbody tr")[3].querySelector("[data-bubble-action=star]").focus());
  await new Promise((r) => setTimeout(r, 400));
  assert.equal((await pill(page, 3)).opacity, "1", "focus within the row opens it");
  const labels = await page.evaluate(() => [...document.querySelectorAll("[data-market-index] tbody tr")[0].querySelectorAll("[data-bubble-action]")].map((b) => [b.tagName, b.getAttribute("aria-label")]));
  assert.deepEqual(labels, [["BUTTON", "Star Frontend Engineer II, Checkout at Kestrel Payments"], ["BUTTON", "Draft Frontend Engineer II, Checkout at Kestrel Payments"]]);
  const target = await page.evaluate(() => { const b = document.querySelector("[data-market-index] [data-bubble-action=draft]").getBoundingClientRect(); return [b.width, b.height]; });
  assert.ok(target[1] >= 44 && target[0] >= 44, `≥ 44 px targets (${target})`);
  // a click on the row itself opens the posting
  await page.click("[data-market-index] tbody tr:nth-child(3) td:nth-child(4)");
  calls = await page.evaluate(() => globalThis.__plateIndexCalls);
  assert.equal(calls.at(-1), "open:ix-2");
  await page.close();
});

test("FIX-8 · d196HoverBubbleTouchVisible — the first tap opens the bubble, the second the posting", { timeout: 120000 }, async () => {
  const page = await open({ touch: true });
  await page.click("[data-market-index] tbody tr:nth-child(1) td:nth-child(4)");
  await new Promise((r) => setTimeout(r, 400));
  assert.equal((await pill(page, 0)).opacity, "1", "the first tap opens it");
  assert.deepEqual(await page.evaluate(() => globalThis.__plateIndexCalls || []), [], "…and does not open the row");
  await page.click("[data-market-index] tbody tr:nth-child(1) td:nth-child(4)");
  assert.deepEqual(await page.evaluate(() => globalThis.__plateIndexCalls), ["open:ix-0"], "the second tap opens the posting");
  await page.close();
});

test("FIX-8 · d196HoverBubbleReducedMotion — no grow under Reduce motion", { timeout: 60000 }, async () => {
  const page = await open({ reduced: true });
  assert.equal((await pill(page, 0)).transition, "0s");
  await page.close();
  const moving = await open();
  assert.notEqual((await pill(moving, 0)).transition, "0s", "it does grow otherwise");
  await moving.close();
});

test("FIX-7 · R3 — past 200 rows the index windows itself", { timeout: 60000 }, async () => {
  const page = await open({ hash: "#rows=600" });
  const n = await page.evaluate(() => document.querySelectorAll("[data-market-index] tbody tr:not(.pl-gz__spacer)").length);
  assert.ok(n < 300, `only a window of the 600 rows is in the page (${n})`);
  assert.ok(await page.evaluate(() => document.querySelector("[data-market-index] .pl-gazetteer").hasAttribute("data-windowed")));
  await page.close();
});
