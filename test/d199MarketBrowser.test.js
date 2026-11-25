// ⭐ D199 C8 / C5 (47h) · in real Chrome (the browser tier): the Index row's actions PUSH the row's text left — on hover the
// actions cell grows, the title's cell shrinks, and no button lies over the title (d199IndexBubblePushesLeft, the layout
// half); and the political map's legend row walks with the arrow keys (d199MapKeyboardLegend). Drawn from the F5 fixture
// (plate/fixtures.jsx MarketSectionFinal / MarketHeroFinal), the app's own components with the board's data.
import test from "node:test";
import assert from "node:assert/strict";
import { buildFixturePage } from "../scripts/d196Regress.mjs";
import { launchBrowser } from "../services/browserLauncher.js";

test("D199 C8 · the Index row's actions push the title aside on hover — nothing covers it, the row keeps its height", { timeout: 180000 }, async () => {
  const url = await buildFixturePage("MarketSectionFinal");
  const browser = await launchBrowser({ headless: "new" });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${url}#tab=index`, { waitUntil: "load" });
    await page.waitForSelector(".pl-ixrow[data-row-opens]");
    const measure = () => page.evaluate(() => {
      const row = document.querySelectorAll(".pl-ixrow[data-row-opens]")[0];
      const t = row.querySelector(".pl-ixc--title").getBoundingClientRect();
      const a = row.querySelector(".pl-ixrow__act").getBoundingClientRect();
      const btns = [...row.querySelectorAll(".pl-ixrow__act button")].map((b) => b.getBoundingClientRect()).filter((r) => r.width > 0);
      return { titleRight: t.right, titleW: t.width, actLeft: a.left, actW: a.width, rowH: row.getBoundingClientRect().height, btnLeft: Math.min(...btns.map((b) => b.left), Infinity) };
    });
    const rest = await measure();
    await page.hover(".pl-ixrow[data-row-opens] .pl-ixc--n");
    await new Promise((r) => setTimeout(r, 600));
    const open = await measure();
    assert.ok(open.actW > rest.actW + 60, `the actions cell grows (${rest.actW} → ${open.actW})`);
    assert.ok(open.titleW < rest.titleW - 60, `the title's cell gives way (${rest.titleW} → ${open.titleW})`);
    assert.ok(open.btnLeft >= open.titleRight - 0.5, "no button lies over the title");
    assert.equal(Math.round(open.rowH), Math.round(rest.rowH), "the row's height doesn't change");
  } finally { await browser.close(); }
});

test("D199 C5 · the map's legend row: arrow keys move between the sectors", { timeout: 180000 }, async () => {
  const url = await buildFixturePage("MarketHeroFinal");
  const browser = await launchBrowser({ headless: "new" });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: "load" });
    await page.waitForSelector("[data-sector-button]");
    await page.focus('[data-sector-button="swe"]');
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-sector-button")), "data");
    await page.keyboard.press("End");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-sector-button")), "design");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-sector-button")), "swe", "it wraps round");
  } finally { await browser.close(); }
});
