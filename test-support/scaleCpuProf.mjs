// ⭐ D151 Rule 5 (45j) · a MAIN-THREAD CPU profile of the server during the scale suite's load window, on demand.
// The suite (scripts/scaleSuite.mjs --cpu-prof <dir>) preloads this into the server with SCALE_PROF_DIR set, creates
// <dir>/start when the load begins and <dir>/stop when it ends; this writes <dir>/main.cpuprofile and <dir>/stopped.
// Worker threads (read pool, score pool) load preloads too — only the main thread profiles. Test support only.
import fs from "node:fs";
import path from "node:path";
import inspector from "node:inspector";
import { isMainThread } from "node:worker_threads";

const DIR = process.env.SCALE_PROF_DIR;
if (DIR && isMainThread) {
  const s = new inspector.Session();
  s.connect();
  let on = false;
  // 46i: SCALE_PROF_FROM_BOOT=1 starts the profiler NOW, at import — a timer tick can't fire while the loop is blocked, so
  // the 200 ms start missed the 7 s boot stall it was meant to catch (in-process session calls answer synchronously).
  if (process.env.SCALE_PROF_FROM_BOOT === "1") s.post("Profiler.enable", () => s.post("Profiler.setSamplingInterval", { interval: 1000 }, () => s.post("Profiler.start", () => { on = true; })));
  const t = setInterval(() => {
    try {
      if (!on && fs.existsSync(path.join(DIR, "start"))) {
        fs.rmSync(path.join(DIR, "start"), { force: true });
        s.post("Profiler.enable", () => s.post("Profiler.setSamplingInterval", { interval: 1000 }, () => s.post("Profiler.start", () => { on = true; })));
      }
      if (on && fs.existsSync(path.join(DIR, "stop"))) {
        fs.rmSync(path.join(DIR, "stop"), { force: true });
        on = false;
        s.post("Profiler.stop", (err, res) => {
          if (!err && res?.profile) fs.writeFileSync(path.join(DIR, "main.cpuprofile"), JSON.stringify(res.profile));
          fs.writeFileSync(path.join(DIR, "stopped"), "1");
        });
      }
    } catch { /* a probe never breaks the server */ }
  }, 200);
  t.unref();
}
