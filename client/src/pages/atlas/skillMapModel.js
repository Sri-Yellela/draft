// client/src/pages/atlas/skillMapModel.js — ⭐ A228 (46r) · the skill map's PURE drawing model (docs/sketches/A228-ab-combined.html):
// the squarified treemap, the histogram's and the step chart's geometry, the scatter's label nudging, and the plain words.
// Every number is the server's (services/atlas/skillMap.js) — nothing here re-derives a count. ⛔ No model call (D190).

export const STATE_WORD = Object.freeze({ proven: "Proven", claimed: "On your résumé", missing: "Not yet" });
export const LEVEL_WORD = Object.freeze({ entry: "Entry", early: "Early career", mid: "Mid-level", senior: "Senior" });

export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
export const pct = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
export const jobsWord = (n) => `${fmt(n)} ${Math.round(n) === 1 ? "job" : "jobs"}`;
/** A label cut to fit a width at a character width (an ellipsis when cut). */
export const fit = (txt, w, cw) => (String(txt).length * cw <= w ? String(txt) : `${String(txt).slice(0, Math.max(1, Math.floor(w / cw) - 1))}…`);
/** The letter mark for a skill with no picture: the first letters of its first two words ("Apache Spark" → "AS"). */
export const monogram = (name) => {
  const w = String(name || "?").replace(/[^\p{L}\p{N}+#. ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2)).toUpperCase();
};

/**
 * The squarified treemap (Bruls, Huizing, van Wijk): items [{ v, … }] laid into x, y, w, h, largest first.
 * @returns the items with { x, y, w, h }
 */
export function squarify(items, x, y, w, h) {
  const out = [];
  const total = items.reduce((a, b) => a + (b.v || 0), 0) || 1;
  const rest = items.filter(it => it.v > 0).map(it => ({ ...it, a: (it.v / total) * w * h }));
  let row = [];
  const worst = (r, side) => {
    const s = r.reduce((a, b) => a + b.a, 0), mx = Math.max(...r.map(z => z.a)), mn = Math.min(...r.map(z => z.a));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const lay = (r) => {
    const s = r.reduce((a, b) => a + b.a, 0);
    if (w >= h) {
      const cw = s / h; let cy = y;
      for (const z of r) { const ch = z.a / cw; out.push({ ...z, x, y: cy, w: cw, h: ch }); cy += ch; }
      x += cw; w -= cw;
    } else {
      const rh = s / w; let cx = x;
      for (const z of r) { const cw = z.a / rh; out.push({ ...z, x: cx, y, w: cw, h: rh }); cx += cw; }
      y += rh; h -= rh;
    }
  };
  while (rest.length) {
    const side = Math.min(w, h), c = rest[0];
    if (!row.length || worst([...row, c], side) <= worst(row, side)) { row.push(c); rest.shift(); }
    else { lay(row); row = []; }
  }
  if (row.length) lay(row);
  return out.map(({ a, ...it }) => it);
}

/** The role's asks grouped by family, biggest family first — the treemap's two levels. */
export function familyGroups(asks = []) {
  const by = new Map();
  for (const a of asks) {
    const k = a.familyName || "Other";
    if (!by.has(k)) by.set(k, { id: k, kids: [] });
    by.get(k).kids.push({ ...a, v: a.share });
  }
  return [...by.values()].map(f => ({ ...f, v: f.kids.reduce((s, k) => s + k.v, 0), kids: f.kids.sort((a, b) => b.v - a.v) }))
    .filter(f => f.v > 0).sort((a, b) => b.v - a.v);
}

/** The treemap's height for a width (the sketch's: 58 % of the width, 380–620 px; a phone keeps 380). */
export const treemapHeight = (W) => Math.round(Math.max(380, Math.min(620, W * 0.58)));

/** The histogram's bars: a bin is "you can apply" when it starts at or past the threshold. */
export function histogramBars(bins = [], threshold, W, { H = 210, pb = 40, pl = 40, top = 14 } = {}) {
  const mx = Math.max(1, ...bins.map(b => b.jobs));
  const step = mx > 1000 ? 500 : mx > 400 ? 200 : mx > 100 ? 50 : mx > 20 ? 10 : 5;
  const yTop = Math.max(step, Math.ceil(mx / step) * step);
  const bw = (W - pl) / Math.max(1, bins.length);
  const y = (v) => H - pb - (v / yTop) * (H - pb - top);
  const ticks = [0, 1, 2, 3, 4].map(i => (yTop * i) / 4);
  return {
    H, pb, pl, bw, y, ticks, xReach: pl + threshold * (W - pl),
    bars: bins.map((b, i) => ({ ...b, i, x: pl + i * bw + 1, w: Math.max(0, bw - 2), y: y(b.jobs), h: H - pb - y(b.jobs),
      ok: b.from >= threshold - 1e-9 })),
  };
}

/** The Learn next step chart's points: today, then each step's running total at its running hours. */
export function routePoints(applicable, steps = []) {
  const pts = [{ name: "Today", total: applicable, hours: 0, today: true }];
  let h = 0;
  for (const s of steps) { h += s.hours; pts.push({ ...s, hours: h }); }
  return pts;
}

/** A step's words: "Learn Spark" / "Prove Python". */
export const stepVerb = (s) => `${s.kind === "prove" ? "Prove" : "Learn"} ${s.name}`;

/**
 * The scatter's labels: each placed beside its dot (left of it when the dot is far right), and a label that would
 * overlap one already placed moves below it. Pure. @param pts [{ cx, cy, name }] in drawing order
 * @returns [{ ...pt, lx, ly, anchor }]
 */
export function nudgeLabels(pts, W, { charW = 7, gap = 16, line = 15 } = {}) {
  const placed = [];
  return pts.map(p => {
    const right = p.cx > W * 0.72;
    const lw = String(p.name).length * charW;
    const lx = right ? p.cx - gap - lw : p.cx + gap;
    let ly = p.cy;
    for (let moved = true; moved;) {
      moved = false;
      for (const q of placed) if (Math.abs(q.y - ly) < line && lx < q.x + q.w && lx + lw > q.x) { ly = q.y + line; moved = true; }
    }
    placed.push({ x: lx, y: ly, w: lw });
    return { ...p, lx: right ? p.cx - gap : p.cx + gap, ly, anchor: right ? "end" : "start" };
  });
}

/** The scatter's y scale top: the largest open count rounded up to a clean step. */
export function niceTop(max) {
  const m = Math.max(1, max);
  const p = 10 ** Math.floor(Math.log10(m));
  for (const k of [1, 1.5, 2, 3, 5, 7.5, 10]) if (k * p >= m) return k * p;
  return 10 * p;
}
