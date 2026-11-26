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
    // ⛔ 46s (production froze the tab): with real fractional positions |q.y − (q.y + line)| reads 14.999999999999998 < 15,
    // so "moved below q" fired on the same spot forever. A label MOVES only when it goes down, and the passes are capped.
    for (let moved = true, passes = 0; moved && passes <= placed.length; passes++) {
      moved = false;
      for (const q of placed) {
        if (Math.abs(q.y - ly) < line - 0.5 && lx < q.x + q.w && lx + lw > q.x && q.y + line > ly) { ly = q.y + line; moved = true; }
      }
    }
    placed.push({ x: lx, y: ly, w: lw });
    return { ...p, lx: right ? p.cx - gap : p.cx + gap, ly, anchor: right ? "end" : "start" };
  });
}

/**
 * ⭐ A231 (46t, owner 11-17: "go with c") · the move-to scatter's LOG height scale. One role can hold 20× the open jobs of
 * the rest (production: Software Engineer 4,996 vs 14–213), and on a straight scale every other dot sat on the floor.
 * Ticks are the powers of ten from the smallest count's decade up to the clean top (10 · 100 · 1,000 · 5,000); a count
 * below the first tick (0 included) sits on the floor. pos(v) is 0 at the floor, 1 at the top.
 */
export function logScale(values = [], { decade = false } = {}) {
  const vals = values.map(Number).filter(v => Number.isFinite(v) && v > 0);
  const lo = 10 ** Math.floor(Math.log10(vals.length ? Math.max(1, Math.min(...vals)) : 1));
  // ⭐ D200 (a) (47h): decade = the top is the next power of ten (Your survey's board: 10 · 100 · 1,000 · 10,000)
  let hi = decade ? 10 ** Math.ceil(Math.log10(Math.max(...vals, 1))) : niceTop(Math.max(...vals, 1));
  if (hi <= lo) hi = lo * 10;
  const ticks = [];
  for (let t = lo; t < hi; t *= 10) ticks.push(t);
  if (hi / ticks[ticks.length - 1] < 1.5 && ticks.length > 1) ticks.pop();   // a top too close to the last power would crowd it
  ticks.push(hi);
  const l0 = Math.log10(lo), span = Math.log10(hi) - l0;
  return { lo, hi, ticks, pos: (v) => Math.min(1, Math.max(0, (Math.log10(Math.max(Number(v) || 0, lo)) - l0) / span)) };
}

/** The scatter's y scale top: the largest open count rounded up to a clean step. */
export function niceTop(max) {
  const m = Math.max(1, max);
  const p = 10 ** Math.floor(Math.log10(m));
  for (const k of [1, 1.5, 2, 3, 5, 7.5, 10]) if (k * p >= m) return k * p;
  return 10 * p;
}

// ── ⭐ D200 (a) (47h) · YOUR SURVEY — the skill map in the plate system (docs/sketches/final/project/YourSurvey.dc.html).
// The charts draw at the board's fixed drawing sizes and scale to the width (960 / 1000 wide viewBoxes, as the board);
// every number is still the server's.

/** The histogram on the plate (viewBox 960 × 280): bars 74 wide every 88 from x 60, the floor at 230, the tallest 176
 *  high, four rules evenly from 40 to 230, the reach line 4 px before the first bar you can apply for. */
export function plateHistogram(bins = [], threshold = 0.6) {
  const mx = Math.max(1, ...bins.map(b => b.jobs || 0));
  const n = Math.max(1, bins.length), step = 880 / n, bw = Math.round(step * (74 / 88));
  const bars = bins.map((b, i) => {
    const h = Math.round(((b.jobs || 0) / mx) * 176);
    const from = b.from ?? i / n;
    return { ...b, i, x: Math.round(60 + i * step), w: bw, y: 230 - h, h, ok: from >= threshold - 1e-9 };
  });
  const firstOk = bars.findIndex(b => b.ok);
  const xReach = firstOk >= 0 ? bars[firstOk].x - 4 : Math.round(60 + threshold * 880) - 4;
  return { W: 960, H: 280, floor: 230, rules: [182, 135, 88, 40], bars, xReach };
}

/** Learn next's climb on the plate (viewBox 960 × 270): x = the hours so far (60 → 900), y = the jobs you could apply for
 *  (the top of the climb at 40, the floor at 230). Each point sits where its step ends; the line steps along, then up. */
export function plateClimb(applicable = 0, steps = []) {
  const pts = routePoints(applicable, steps);
  const hours = Math.max(1, pts[pts.length - 1].hours);
  const top = Math.max(1, ...pts.map(p => p.total));
  const at = pts.map(p => ({ ...p, x: Math.round(60 + (p.hours / hours) * 840), y: Math.round(230 - (p.total / top) * 190) }));
  let d = `M${at[0].x} ${at[0].y}`;
  for (let i = 1; i < at.length; i++) d += ` L${at[i].x} ${at[i - 1].y} L${at[i].x} ${at[i].y}`;
  const end = at[at.length - 1];
  return { W: 960, H: 270, rules: [182, 135, 88, 40], pts: at, line: d, area: `M${at[0].x} 230 L${d.slice(1)} L${end.x} 230 Z`, top };
}

/** The move-to scatter on the plate (viewBox 960 × 270): x = how much of the role you have (60 → 900), y = open jobs on
 *  the log scale with a power-of-ten top (A231's scale, the board's decades), floor 230, top 30. */
export function plateScatter(roles = []) {
  const ys = logScale(roles.map(r => r.open), { decade: true });
  const y = (v) => Math.round(230 - ys.pos(v) * 200);
  const x = (v) => Math.round(60 + Math.max(0, Math.min(1, Number(v) || 0)) * 840);
  return { W: 960, H: 270, ys, ticks: ys.ticks.map(t => ({ t, y: y(t) })), x, y };
}

// ── THE THIRD MAP · the cadastral (plot) survey (D200): each skill a plot sized by the share of the role's jobs that want
// it, grouped into districts by area (its family). The districts are squarified; a district left a full-height column
// narrower than its label is widened to fit it (the board's BACKEND · DISTRICT B), the room taken from the widest column.
// Inside a district the plots are squarified (Bruls et al. — near-square, never strips), 4 px apart, numbered as lots
// in reading order (district by district, the biggest first).

export const PLOT = Object.freeze({ W: 1000, H: 430, pad: 10, top: 24, labelGap: 18, gap: 4, inset: 8, labelChar: 7.3, labelPad: 28 });
const DISTRICT_LETTER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** A district's label: "INFRA · DISTRICT A". */
export const districtLabel = (name, i) => `${String(name).toUpperCase()} · DISTRICT ${DISTRICT_LETTER[i] || i + 1}`;

/** The width a district needs for its label (mono 10 px, 1.3 letter spacing ≈ 7.3 px a character, + its padding). */
export const districtMinWidth = (label) => Math.ceil(String(label).length * PLOT.labelChar + PLOT.labelPad);

/** A small deterministic wobble (the hand-drawn survey line): −1 … 1 from a seed. */
function wobble(seed) {
  let x = Math.imul((seed + 1) ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (((x ^ (x >>> 16)) >>> 0) / 4294967295) * 2 - 1;
}

/** A plot's outline: four corners and four mid-points, each mid-point nudged off the line (≤ 1.2 px) — hand-drawn. */
export function plotPath(p, seed = 0) {
  const j = (k, a = 1.2) => wobble(seed * 16 + k) * a;
  const f = (v) => v.toFixed(1);
  const x0 = p.x, y0 = p.y, x1 = p.x + p.w, y1 = p.y + p.h, mx = p.x + p.w / 2, my = p.y + p.h / 2;
  return `M${f(x0)} ${f(y0 + j(0, 0.4))} L${f(mx)} ${f(y0 + j(1))} L${f(x1)} ${f(y0 + j(2, 0.4))} L${f(x1 + j(3))} ${f(my)} `
    + `L${f(x1)} ${f(y1)} L${f(mx)} ${f(y1 + j(5))} L${f(x0)} ${f(y1)} L${f(x0 + j(7))} ${f(my)} Z`;
}

/**
 * The survey's layout in the board's drawing (viewBox 1000 × 430). asks: [{ id, slug, name, share, state, familyName }] →
 * { W, H, districts: [{ name, label, x, y, w, h, plots: [{ ...ask, lot, x, y, w, h }] }] }.
 */
export function plotLayout(asks = []) {
  const { W, H, pad, top, labelGap, gap, inset } = PLOT;
  const groups = familyGroups(asks);
  // the districts' cells: x pad … W − pad, y (top − labelGap) … H − pad, 4 px apart; each label sits in its cell's top 18 px
  const bx = pad, by = top - labelGap, bw = W - 2 * pad, bh = H - pad - by;
  const cells = squarify(groups.map((g, i) => ({ ...g, i, label: districtLabel(g.id, i) })), bx - gap / 2, by - gap / 2, bw + gap, bh + gap)
    .map(c => ({ ...c, x: c.x + gap / 2, y: c.y + gap / 2, w: c.w - gap, h: c.h - gap }));
  const full = cells.filter(c => Math.abs(c.h - bh) < 0.5).sort((a, b) => a.x - b.x);
  if (full.length > 1) {
    for (const c of full) {
      const need = districtMinWidth(c.label) - c.w;
      if (need <= 0) continue;
      const donor = full.filter(d => d !== c).sort((a, b) => b.w - a.w)[0];
      const give = Math.min(need, Math.max(0, donor.w - districtMinWidth(donor.label)));
      c.w += give; donor.w -= give;
    }
    let x = full[0].x;
    for (const c of full) { c.x = x; x += c.w + gap; }
  }
  let lot = 0;
  const districts = cells.sort((a, b) => a.i - b.i).map(c => {
    const rect = { x: c.x, y: c.y + labelGap, w: c.w, h: c.h - labelGap };
    const ix = rect.x + inset, iy = rect.y + inset, iw = Math.max(1, rect.w - 2 * inset), ih = Math.max(1, rect.h - 2 * inset);
    const plots = squarify(c.kids, ix - gap / 2, iy - gap / 2, iw + gap, ih + gap)
      .map(p => ({ ...p, lot: ++lot, x: p.x + gap / 2, y: p.y + gap / 2, w: Math.max(0, p.w - gap), h: Math.max(0, p.h - gap) }));
    return { name: c.id, label: c.label, ...rect, plots };
  });
  return { W, H, districts };
}

/** The worst aspect (long side ÷ short side) of a layout's plots — the bound d200PlotMapSquarified holds. */
export const worstAspect = (layout) => Math.max(1, ...layout.districts.flatMap(d => d.plots).filter(p => p.w > 0 && p.h > 0)
  .map(p => Math.max(p.w / p.h, p.h / p.w)));

/** What a plot can carry — labels only where they fit: the lot (from 40 × 26), its monogram (from 100 wide), the name
 *  (18 px from 150 × 70, else 14; the serif ≈ 0.42 em a character), the share ("N% of jobs" where it fits, else "N%";
 *  Inter 11.5 ≈ 5.5 px a character). With no room for the name, the share takes its row. */
export function plotWords(p) {
  const size = p.w >= 150 && p.h >= 70 ? 18 : 14;
  const lot = p.w >= 40 && p.h >= 26;
  const mono = lot && p.w >= 100;
  const name = p.h >= 44 && String(p.name).length * size * 0.42 <= p.w - 16;
  const n = Math.round((Number(p.share) || 0) * 100);
  const long = `${n}% of jobs`, bare = `${n}%`;
  const share = p.w >= long.length * 5.5 + 16 ? long : p.w >= bare.length * 5.5 + 16 ? bare : null;
  const room = p.h >= (name ? 62 : 44);
  return { lot, mono, name, size, share: room ? share : null, shareRow: name ? 2 : 1 };
}

/** "LOT 02" — two digits. */
export const lotWord = (n) => `LOT ${String(n).padStart(2, "0")}`;
