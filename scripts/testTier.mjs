#!/usr/bin/env node
/**
 * ⭐ A232 R1 + R2 (46t, owner 11-17: "go with R1 and R2") — run one tier of the suite.
 *
 *   npm run test:fast       every file that drives no browser, concurrency 3 (≈ 5 min; measured 302 s, 11-17)
 *   npm run test:browser    every file that drives one, concurrency 1, the fidelity probes filled ONCE first (R2)
 *   npm run test:all        both, browser last
 *   node scripts/testTier.mjs browser --batch 1/3   one third of a tier (the machine's memory: one batch per call)
 *   node scripts/testTier.mjs fast --list            print the files only
 *
 * The tier of a file is decided in ONE place, test-support/testTiers.mjs. The model keys are blanked and no .env is read
 * (memory: a harness that boots server.js once spent the local key), as `npm test` would on a clean machine.
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { filesFor } from "../test-support/testTiers.mjs";

const tier = process.argv[2] || "fast";
if (!["fast", "browser", "all"].includes(tier)) { console.error(`usage: testTier.mjs fast|browser|all [--batch i/n] [--list]`); process.exit(2); }
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const slice = (files) => {
  const b = arg("--batch"); if (!b) return files;
  const [i, n] = b.split("/").map(Number); const per = Math.ceil(files.length / n);
  return files.slice((i - 1) * per, i * per);
};
const env = { ...process.env, ANTHROPIC_KEY: "", ANTHROPIC_API_KEY: "", DOTENV_CONFIG_PATH: "tmp/no.env" };
const run = (files, concurrency, setup) => {
  if (!files.length) return 0;
  const args = ["--test", `--test-concurrency=${concurrency}`, "--import", "./test-support/isolateTrackingSink.mjs",
    ...(setup ? ["--test-global-setup=./test-support/fidelityGlobalSetup.mjs"] : []), ...files];
  console.log(`[tier] ${files.length} file(s), concurrency ${concurrency}${setup ? ", the fidelity probes first" : ""}`);
  return spawnSync(process.execPath, args, { stdio: "inherit", env }).status ?? 1;
};
const fast = tier === "browser" ? [] : slice(filesFor("fast"));
const browser = tier === "fast" ? [] : slice(filesFor("browser"));
if (process.argv.includes("--list")) { console.log([...fast, ...browser].join("\n")); process.exit(0); }
const t0 = Date.now();
const a = run(fast, Number(arg("--concurrency") || 3), false);
// R2: fill the shared fidelity probe first only when a file in this run reads it
const b = run(browser, 1, browser.some(f => fs.readFileSync(f, "utf8").includes("fidelityProbe(")));
console.log(`[tier] ${tier} done in ${Math.round((Date.now() - t0) / 1000)} s`);
process.exit(a || b);
