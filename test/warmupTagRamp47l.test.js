// ⭐ 47l · the zero-downtime lane's next lever: with WARMUP_DEFER_TAGS=1 the boot tag walk starts BOOT_TAG_DELAY_MS after
// its deferred step (past Railway's switch-over) and ramps its first ranges 100 → 200 → 400 rows. Production 47k
// (93c7871) measured the deferred first slice at 2,574 ms on a cold volume, right after ready. Flag off and the interval
// walk keep the old path.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const S = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const at = (needle, from = 0) => { const i = S.indexOf(needle, from); assert.ok(i >= 0, `server.js has: ${needle}`); return i; };

test("47l: the delay and the ramp are declared beside the slice sizes", () => {
  assert.match(S, /const BOOT_TAG_DELAY_MS = 4000;/);
  assert.match(S, /const BOOT_TAG_RAMP = \[100, 200, 400\];/);
  assert.ok(at("const BOOT_TAG_RAMP") < at("function runJobTagPassSliced(trigger) {"), "declared before the walk");
});

test("47l: only the flag-on boot walk waits; the interval walk and flag off start at once", () => {
  const fn = S.slice(at("function runJobTagPassSliced(trigger) {"), at("function runJobTagWalkSlice() {"));
  assert.match(fn, /if \(WARMUP_DEFER_TAGS_ON && trigger === "boot"\) \{/);
  assert.match(fn, /\}, BOOT_TAG_DELAY_MS\)\.unref\(\);\n\s+return;\n\s+\}\n\s+runJobTagWalkSlice\(\);\n\}/, "the else path runs the first slice at once");
  assert.match(fn, /console\.log\(`\[boot\] job tags boot walk starts at /, "the start is on the boot timeline for the next deploy's read");
});

test("47l: the ramp applies only to the flag-on boot walk's first slices; every other slice reads JOB_TAG_SLICE_ROWS", () => {
  const fn = S.slice(at("function runJobTagWalkSlice() {"), at("function runJobTagPass(trigger,"));
  assert.ok(at("const ranged = WARMUP_DEFER_TAGS_ON && w.trigger === \"boot\";", 0) < at("BOOT_TAG_RAMP[w.slices]"), "ranged is known before the range is read");
  assert.match(fn, /ranged && w\.slices < BOOT_TAG_RAMP\.length \? nextRowidRange\(db, w\.from, BOOT_TAG_RAMP\[w\.slices\]\)/);
  assert.match(fn, /: nextRowidRange\(db, w\.from, JOB_TAG_SLICE_ROWS\);/);
  assert.match(fn, /w\.slices \+= 1;/);
});
