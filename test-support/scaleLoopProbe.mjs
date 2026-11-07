// ⭐ D151 RULE 5 · the event-loop probe the scale suite preloads into the server (`node --import`), so the server's own
// code carries no measuring hook. It samples the loop's delay with perf_hooks and writes the histogram to
// $SCALE_LOOP_FILE every 500 ms; the suite creates `$SCALE_LOOP_FILE.reset` to start a fresh window (the probe resets
// and deletes it). Values in milliseconds.
import fs from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";

const file = process.env.SCALE_LOOP_FILE;
if (file) {
  const h = monitorEventLoopDelay({ resolution: 10 });
  h.enable();
  const ms = (ns) => Math.round(ns / 1e4) / 100;
  const t = setInterval(() => {
    try {
      if (fs.existsSync(`${file}.reset`)) { h.reset(); fs.rmSync(`${file}.reset`, { force: true }); }
      fs.writeFileSync(file, JSON.stringify({ at: Date.now(), count: h.count, p50: ms(h.percentile(50)), p99: ms(h.percentile(99)), max: ms(h.max) }));
    } catch { /* a probe never breaks the server */ }
  }, 500);
  t.unref();
}
