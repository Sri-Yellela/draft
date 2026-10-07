// crawler/lib/browser.js — ⛔ D75 · THE BROWSER STAGE, LAST ON THE LADDER, AND NAVIGATION ONLY.
//
// Used by J1 only when plain HTTP found no board AND the page looked client-rendered. It loads ONE page
// in a FRESH browser context (no cookies carried between companies), waits for the network to settle,
// and returns every URL the page itself requested — the page's own call to
// boards-api.greenhouse.io/v1/boards/<slug> is the strongest evidence there is.
//   · Every request the page makes is passed through the SAME guard as the fetcher (SSRF, deny-list) and
//     ABORTED when refused — a page cannot make the worker reach a private address.
//   · `offline: true` (the tests) aborts every request outside allowHosts after RECORDING it, so CI never
//     reaches the internet and the network log is still read.
//   · It calls page.goto and nothing else: no click, no type, no keyboard, no submit. Downloads,
//     notifications and geolocation are off; Chromium runs sandboxed where the platform allows.
import { recordUrl } from "./guards.js";
import { CrawlStop } from "./fetcher.js";

export function createBrowserStage({ puppeteer, executablePath, guard, audit, isPaused = async () => false,
                                     allowHosts = new Set(), offline = false, timeoutMs = 20000, settleMs = 1500 }) {
  return {
    async networkUrls(url) {
      if (await isPaused()) throw new CrawlStop("paused");
      await guard(url);
      const browser = await puppeteer.launch({
        executablePath, headless: true,
        args: ["--disable-notifications", "--disable-geolocation", "--no-first-run", "--disable-extensions",
               ...(process.platform === "linux" ? ["--disable-dev-shm-usage"] : [])],
      });
      try {
        const context = await browser.createBrowserContext();
        const page = await context.newPage();
        const seen = [];
        await page.setRequestInterception(true);
        page.on("request", async (req) => {
          const u = req.url();
          if (!/^https?:/i.test(u)) return req.abort().catch(() => {});
          seen.push(u);
          let host; try { host = new URL(u).host; } catch { return req.abort().catch(() => {}); }
          if (offline && !allowHosts.has(host)) return req.abort().catch(() => {});
          try { await guard(u); return req.continue().catch(() => {}); } catch { return req.abort().catch(() => {}); }
        });
        audit.push({ kind: "navigate", url: recordUrl(url), via: "browser" });
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs }).catch(() => {});
        await new Promise(r => setTimeout(r, settleMs));
        await context.close();
        return seen;
      } finally {
        await browser.close().catch(() => {});
      }
    },
  };
}
