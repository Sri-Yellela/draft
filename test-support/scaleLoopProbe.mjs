// ⭐ D151 RULE 5 · the event-loop probe the scale suite preloads into the server (`node --import`), so the server's own
// code carries no measuring hook. It samples the loop's delay with perf_hooks and writes the histogram to
// $SCALE_LOOP_FILE every 500 ms; the suite creates `$SCALE_LOOP_FILE.reset` to start a fresh window (the probe resets
// and deletes it). Values in milliseconds.
//
// ⛔ 47c · THE MAIN THREAD ONLY. A `--import` preload also runs in every worker_threads Worker started from a FILE (Node 24:
// the read pool, offload, score, report and term-weight workers all are), and until 47c each worker ran this whole probe:
// its own histogram overwrote loop.json every 500 ms (the last writer won — the suite's "event-loop p99 / max" could be any
// thread's), and its own 50 ms timer appended "stalls" to the same .stalls file, timed from that worker's own start. A read
// worker inside a long synchronous query — its job, off the main thread — read as a 26 s "main-thread stall" (47b run 2),
// and stalls overlapped in time, which one timer cannot do. Now: the histogram and .stalls are the MAIN thread's; a worker
// appends its long tasks to .worker-stalls tagged with its thread id (information, not a freeze of the server); every
// thread's clock starts at the process's start, so a [t=…] log line, a stall and a worker stall share one timeline.
import fs from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { isMainThread, threadId } from "node:worker_threads";

const file = process.env.SCALE_LOOP_FILE;
if (file) {
  const t0 = Date.now() - Math.round(process.uptime() * 1000);   // the PROCESS's start: one timeline for every thread
  if (isMainThread) {
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
  // ⭐ 45j (11-08): name a long stall. Every console line gets a [t=<ms since start>] prefix (a worker's adds [w<id>]), and a
  // stall over 1 s (a 50 ms timer that fired late) is appended as { end, ms } — the main thread's to $SCALE_LOOP_FILE.stalls
  // (the suite prints each with the server's lines from just before it ended), a worker's to .worker-stalls with its thread.
  const tag = isMainThread ? "" : `[w${threadId}]`;
  for (const k of ["log", "warn", "error"]) {
    const orig = console[k].bind(console);
    console[k] = (...a) => orig(`[t=${Date.now() - t0}]${tag}`, ...a);
  }
  const out = isMainThread ? `${file}.stalls` : `${file}.worker-stalls`;
  let last = Date.now();
  const s = setInterval(() => {
    const now = Date.now(), gap = now - last - 50;
    last = now;
    if (gap > 1000) {
      try { fs.appendFileSync(out, JSON.stringify(isMainThread ? { end: now - t0, ms: gap } : { thread: threadId, end: now - t0, ms: gap }) + "\n"); }
      catch { /* never breaks the server */ }
    }
  }, 50);
  s.unref();
}
