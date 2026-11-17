// ── A232 R2 (46t) · node --test --test-global-setup: fill every fidelity probe ONCE (one vite, one Chrome) before the
// browser tier's files run, so each of them reads the shared answer (test-support/fidelityProbe.mjs). Used by
// scripts/testTier.mjs for the browser and all tiers. A failure here is not fatal: each file then measures its own probe.
import { fill, PROBES, treeHash } from "./fidelityProbe.mjs";

export async function globalSetup() {
  const t0 = Date.now();
  try {
    const got = fill(PROBES);
    const bad = Object.entries(got).filter(([, v]) => v?.error).map(([k]) => k);
    console.log(`[fidelity] ${PROBES.length} probes ready (tree ${treeHash()}) in ${Math.round((Date.now() - t0) / 1000)} s${bad.length ? ` — failed, measured per file: ${bad.join(", ")}` : ""}`);
  } catch (e) {
    console.log(`[fidelity] the shared probe did not run (${String(e.message).slice(0, 200)}) — each file measures its own`);
  }
}
