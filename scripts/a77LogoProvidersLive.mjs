#!/usr/bin/env node
/**
 * A77 — IS EVERY LOGO PROVIDER ALIVE? Exits 1 when one is dead.
 *
 * logo.clearbit.com died with its DNS record, and the code that used it looked fine for weeks because
 * nothing ever asked the provider whether it still existed. The suite cannot ask (it is offline by
 * design), so this script does, against companies whose logos are known to exist: each provider is
 * tried ON ITS OWN, and a provider that returns no raster image for any of them is dead.
 *
 *   node scripts/a77LogoProvidersLive.mjs
 *
 * Needs the network. Excluded from verify:harness for that reason; run it when the boot log names a
 * provider as dead ("[logos] ⛔ provider(s) with attempts and NO success"), and before swapping one.
 */
import { PROVIDERS, declaredIcons, sniffImage } from "../services/jobs/companyLogoStore.js";

const SAMPLE = ["stripe.com", "github.com", "duolingo.com", "wealthfront.com"];
const UA = "Mozilla/5.0 (compatible; draft-logo/1.0; +https://jobsviadraft.com)";
const get = async (url) => {
  const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return { buf: Buffer.from(await r.arrayBuffer()), url: r.url || url };
};

let dead = 0;
for (const p of PROVIDERS) {
  let ok = 0;
  const notes = [];
  for (const domain of SAMPLE) {
    let declared = [];
    if (p.name === "site-declared") {
      try { const page = await get(`https://${domain}/`); declared = declaredIcons(page.buf.toString("utf8"), page.url); }
      catch (e) { notes.push(`${domain}: homepage ${e.message}`); continue; }
    }
    for (const url of p.urls(domain, { declared })) {
      try { const { buf } = await get(url); if (sniffImage(buf)) { ok++; break; } notes.push(`${domain}: not a raster image`); }
      catch (e) { notes.push(`${domain}: ${e.message}`); }
    }
  }
  console.log(`${ok ? "✓ alive" : "⛔ DEAD "}  ${p.name.padEnd(14)} ${ok}/${SAMPLE.length}${notes.length ? "   " + notes.slice(0, 3).join(" | ") : ""}`);
  if (!ok) dead++;
}
process.exit(dead ? 1 : 0);
