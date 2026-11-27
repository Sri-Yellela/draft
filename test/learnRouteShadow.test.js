// ⛔ 46q · A ROUTE THAT NEVER ANSWERED. The audit's newcomer opened Atlas → Today's question and the whole app went blank:
// D154 P6's practice card fetched GET /api/learn/progress, but server.js mounts routes/learn.js at /api/learn FIRST, and
// that router answers GET /progress with the lesson marks ({ marks }) — so server.js's own practice-progress route was
// never reached, and the card read p.level of { marks } and threw. The card now has its own path and refuses a shape it
// does not know. This guard holds the class: no app-level route under /api/learn may share a method + path with the
// router mounted before it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const SERVER = read("server.js"), ROUTER = read("routes/learn.js"), PANELS = read("client/src/pages/atlas/AtlasPanels.jsx");

const routerRoutes = () => [...ROUTER.matchAll(/router\.(get|post|put|delete|patch)\(\s*"([^"]+)"/g)].map(([, m, p]) => `${m.toUpperCase()} /api/learn${p === "/" ? "/" : p}`);
const appLearnRoutes = () => [...SERVER.matchAll(/app\.(get|post|put|delete|patch)\(\s*"(\/api\/learn\/[^"]+)"/g)].map(([, m, p]) => ({ key: `${m.toUpperCase()} ${p}`, at: SERVER.indexOf(`app.${m}("${p}"`) }));

test("46q learnRouteShadow — no app-level /api/learn route is shadowed by the learn router mounted before it", () => {
  const mountAt = SERVER.indexOf('app.use("/api/learn", createLearnRouter(');
  assert.ok(mountAt > 0, "the learn router is mounted");
  const taken = new Set(routerRoutes());
  assert.ok(taken.has("GET /api/learn/progress"), "the router answers the lesson marks at /progress");
  const shadowed = appLearnRoutes().filter(r => r.at > mountAt && taken.has(r.key)).map(r => r.key);
  assert.deepEqual(shadowed, [], `declared after app.use("/api/learn", …) and answered by the router first — never reached: ${shadowed.join(", ")}`);
});

// ⛔ 47m (changed on purpose): "46q the practice card asks its own route and refuses a shape it does not know" retired — the surface it pinned was rebuilt in the plate system (47m M5).
