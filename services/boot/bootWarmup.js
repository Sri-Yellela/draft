// ⛔⛔ D151 RULE 1 · LISTEN FIRST, THEN WARM UP.
//
// The boot used to run every data pass that scans the board BEFORE `app.listen` — the categories, the
// automation tier, the provenance map, the role map, the description pass, the company logos — and the
// startup cleanup synchronously right after it. At 81k postings that was ≈ 50 s before the port bound on
// production (11-04 05:25Z) and over a minute on a local copy, so a deploy either 502'd (no listener) or
// took traffic and then stalled (11-03 23:35Z / 23:51Z, `connection dial timeout`).
//
// Now: config → database → migrations (schema, fast by construction) → LISTEN → this warm-up, one step at
// a time with a yield to the event loop between steps. `/api/health/live` answers as soon as the port is
// bound; `/api/health/ready` answers 503 "warming up" until every step here has run, and Railway's
// healthcheck points at it, so a new deploy takes traffic only once it is ready and the old one serves
// until then.
//
// A step is never fatal (each was a `try { } catch { log }` in the old boot and stays one): a failed step
// is recorded with its error and the warm-up continues — the reads each step feeds already treat its
// absence as "unknown", which is why none of them ever failed the boot.

const nowMs = () => Number(process.hrtime.bigint() / 1000000n);

export function createBootWarmup({ log = console, startedAt = nowMs(), yieldFn = (fn) => setImmediate(fn) } = {}) {
  const steps = [];        // { name, fn } — queued for after listen, run in order
  const timeline = [];     // { name, phase, ms, ok, error?, at } — every timed boot step
  let state = "booting";   // booting → warming → ready
  let listenMs = null, readyMs = null, running = null, done = 0;

  const record = (name, phase, ms, ok, error) => {
    timeline.push({ name, phase, ms: Math.round(ms), ok, ...(error ? { error } : {}), at: nowMs() - startedAt });
  };

  const self = {
    /** Time a step that has to run before listening (the database, migrations). Throws what fn throws. */
    mark(name, fn) {
      const s = nowMs();
      try { const r = fn(); record(name, "before-listen", nowMs() - s, true); return r; }
      catch (e) { record(name, "before-listen", nowMs() - s, false, e.message); throw e; }
    },
    /** Record a before-listen step timed by the caller (a block that cannot be wrapped in a function). */
    note(name, ms, ok = true, error) { record(name, "before-listen", ms, ok, error); },
    /** Queue a step for after the listener is bound. */
    add(name, fn) {
      if (state === "ready") throw new Error(`boot warm-up already finished; "${name}" added too late`);
      steps.push({ name, fn });
    },
    listening() { if (listenMs == null) listenMs = nowMs() - startedAt; },
    /** Run every queued step, yielding between them, then flip to ready. Resolves with the snapshot. */
    run() {
      if (running) return running;
      state = "warming";
      running = new Promise((resolve) => {
        const next = () => {
          if (done >= steps.length) {
            state = "ready"; readyMs = nowMs() - startedAt;
            const slow = timeline.filter(t => t.ms >= 100 || !t.ok).map(t => `${t.name} ${t.ms}ms${t.ok ? "" : " FAILED"}`);
            log.log(`[boot] ready at ${readyMs} ms (listening at ${listenMs} ms)` + (slow.length ? ` — ${slow.join(", ")}` : ""));
            return resolve(self.snapshot());
          }
          const { name, fn } = steps[done];
          const s = nowMs();
          Promise.resolve().then(fn).then(
            () => record(name, "warm-up", nowMs() - s, true),
            (e) => {
              record(name, "warm-up", nowMs() - s, false, e?.message || String(e));
              log.error(`[boot] warm-up step "${name}" failed (not fatal):`, e?.message || e);
            },
          ).finally(() => { done++; yieldFn(next); });
        };
        yieldFn(next);
      });
      return running;
    },
    get state() { return state; },
    get ready() { return state === "ready"; },
    snapshot() {
      return { state, listenMs, readyMs, pending: steps.slice(done).map(s => s.name), timeline: timeline.slice() };
    },
  };
  return self;
}
