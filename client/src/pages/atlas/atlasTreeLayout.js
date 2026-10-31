// ⭐ D116 M2 · THE TREE'S LAYOUT — deterministic: the same data always draws the same tree. Computed here, client-side,
// from the server's answer (GET /api/atlas/me → tree, /api/atlas/tree/role|family/…); nothing here measures the board.
//
// The centre at (0, 0); each family a sector of 360° / families, used ± 39 % of its width (the gaps between families);
// a trunk from the centre to radius 62 along the sector's middle; radius = closeness (the user's skills at 128 — when a
// family has more than 3 of them, alternately 108 / 150 — others at 160 + (100 − closeness) × 3.4; on a role or family
// page 120 + (100 − share) × 2.6); the angular order = each of the user's skills followed by its children, then the
// trunk's children, spread evenly across the sector; square size = √postings × 0.95, clamped 15–32; branches = gentle
// outward-bowed curves parent → child. ⛔ No two squares closer than their half-sizes + 10 (d116TreeNoOverlap): a
// square that would be is moved OUTWARD along its own angle, a step at a time, until it is clear — never inward, so
// nothing is drawn closer than it measured.
// The camera, the selection's path back to the centre, the waypoints and Fly my route are here too (pure functions),
// so the drawing (AtlasTree.jsx) holds no maths.

export const GEOM = Object.freeze({
  TRUNK: 62, YOURS: 128, YOURS_IN: 108, YOURS_OUT: 150, YOURS_TWO_RINGS_OVER: 3,
  OTHERS_FROM: 160, OTHERS_PER_POINT: 3.4, PAGE_FROM: 120, PAGE_PER_POINT: 2.6,
  SECTOR_USE: 0.39, SIZE_PER_ROOT: 0.95, SIZE_MIN: 15, SIZE_MAX: 32, GAP: 10, PUSH_STEP: 6, PUSH_MAX: 80,
  CENTRE: 76, TAG_FROM: 420, TAG_PAD: 54, WORLD: 470, LABEL_ROOM: 130, BOW: 0.12,
  FLY_MS: 700, TOUR_MS: 2300, TOUR_MS_REDUCED: 1700, ZOOM_NODE: 1.9, ZOOM_FAMILY: 1.45, ZOOM_YOURS: 2,
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const squareSize = (postings) => clamp(Math.sqrt(Math.max(0, postings || 0)) * GEOM.SIZE_PER_ROOT, GEOM.SIZE_MIN, GEOM.SIZE_MAX);

/** The radius closeness (or a page's share) asks for — before any square is moved clear of another. */
export function baseRadius(page, node, { havesInFamily = 0, haveIndex = 0 } = {}) {
  if (page !== "you") return GEOM.PAGE_FROM + (100 - (node.share ?? 0)) * GEOM.PAGE_PER_POINT;
  if (node.have) {
    if (havesInFamily > GEOM.YOURS_TWO_RINGS_OVER) return haveIndex % 2 ? GEOM.YOURS_OUT : GEOM.YOURS_IN;
    return GEOM.YOURS;
  }
  return GEOM.OTHERS_FROM + (100 - (node.closeness ?? 0)) * GEOM.OTHERS_PER_POINT;
}

/** The guide bands (dashed circles) and their labels (M2, M7). */
export function bandsFor(page) {
  const you = (c) => GEOM.OTHERS_FROM + (100 - c) * GEOM.OTHERS_PER_POINT;
  const pg = (s) => GEOM.PAGE_FROM + (100 - s) * GEOM.PAGE_PER_POINT;
  if (page === "role") return [[pg(75), "IN 3 OF 4 POSTINGS"], [pg(50), "HALF"], [pg(25), "1 IN 4 OR FEWER"]];
  if (page === "family") return [[pg(50), "CORE · 50 %+"], [pg(25), "COMMON"], [pg(10), "SPECIALIST"]];
  return [[GEOM.YOURS, "YOURS"], [you(75), "VERY CLOSE · 75 %+"], [you(60), "CLOSE · 60–75 %"], [you(40), "A STRETCH · UNDER 60 %"]];
}

/** A gentle outward-bowed curve a → b (an SVG path). */
export function curve(a, b) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, r = Math.hypot(mx, my) || 1;
  const k = Math.hypot(b[0] - a[0], b[1] - a[1]) * GEOM.BOW;
  const f = (n) => Math.round(n * 10) / 10;
  return `M${f(a[0])} ${f(a[1])} Q${f(mx + (mx / r) * k)} ${f(my + (my / r) * k)} ${f(b[0])} ${f(b[1])}`;
}

/**
 * The drawn nodes of a family, in angular order: each of the user's skills followed by its children, then the
 * trunk's children (in the family's list order — closest first).
 */
export function sectorOrder(page, fam, bySlug) {
  const drawn = fam.order.map(s => bySlug.get(s)).filter(n => n && n.onTree);
  if (page !== "you") return drawn;
  const haves = drawn.filter(n => n.have);
  const placed = new Set();
  const out = [];
  for (const h of haves) {
    out.push(h); placed.add(h.slug);
    for (const c of drawn) if (!placed.has(c.slug) && !c.have && c.parent === h.slug) { out.push(c); placed.add(c.slug); }
  }
  for (const c of drawn) if (!placed.has(c.slug)) { out.push(c); placed.add(c.slug); }
  return out;
}

/**
 * The whole layout. @param tree the server's tree ({ page, families, nodes, … })
 * @returns {{ page, sectors, pos: Map(slug → { x, y, a, r, base, size }), order: string[], edges, bands, tags, bounds }}
 */
export function layoutTree(tree) {
  const page = tree.page || "you";
  const bySlug = new Map(tree.nodes.map(n => [n.slug, n]));
  const fams = tree.families || [];
  const sectors = {};
  const pos = new Map();
  const order = [];
  const span = page === "family" ? Math.PI * 2 : (Math.PI * 2) / Math.max(1, fams.length);
  fams.forEach((f, i) => {
    const mid = -Math.PI / 2 + i * span;
    let lo = mid - span * GEOM.SECTOR_USE, hi = mid + span * GEOM.SECTOR_USE;
    if (page === "family") { lo = -Math.PI; hi = Math.PI * 0.95; }
    sectors[f.key] = { mid, lo, hi, trunk: [GEOM.TRUNK * Math.cos(mid), GEOM.TRUNK * Math.sin(mid)] };
    const seq = sectorOrder(page, f, bySlug);
    const haves = seq.filter(n => n.have);
    seq.forEach((n, j) => {
      const t = seq.length === 1 ? 0.5 : j / (seq.length - 1);
      const a = lo + (hi - lo) * t;
      const base = baseRadius(page, n, { havesInFamily: haves.length, haveIndex: haves.indexOf(n) });
      pos.set(n.slug, { a, r: base, base, size: squareSize(n.postings), x: base * Math.cos(a), y: base * Math.sin(a) });
      order.push(n.slug);
    });
  });
  // Clear every square of every earlier one: outward along its own angle (deterministic — the order above).
  const done = [];
  for (const s of order) {
    const p = pos.get(s);
    for (let k = 0; k < GEOM.PUSH_MAX && done.some(q => tooClose(p, q)); k++) {
      p.r += GEOM.PUSH_STEP; p.x = p.r * Math.cos(p.a); p.y = p.r * Math.sin(p.a);
    }
    done.push(p);
  }
  // Branches: the trunk per family, then parent → child (a node with no parent drawn hangs off its family's trunk).
  const edges = [];
  for (const f of fams) edges.push({ id: `trunk:${f.key}`, from: "centre", to: `trunk:${f.key}`, family: f.key, trunk: true,
    d: `M0 0 L${Math.round(sectors[f.key].trunk[0] * 10) / 10} ${Math.round(sectors[f.key].trunk[1] * 10) / 10}` });
  for (const s of order) {
    const n = bySlug.get(s);
    const from = parentOf(n, pos);
    const a = from.startsWith("trunk:") ? sectors[n.family].trunk : [pos.get(from).x, pos.get(from).y];
    const p = pos.get(s);
    edges.push({ id: `${from}>${s}`, from, to: s, family: n.family, d: curve(a, [p.x, p.y]) });
  }
  // The pulsing family tags, outside their branch; the bounds every view fits.
  const tags = fams.map(f => {
    const rs = order.filter(s => bySlug.get(s).family === f.key).map(s => pos.get(s).r + pos.get(s).size);
    const R = Math.max(GEOM.TAG_FROM, ...rs.map(r => r + GEOM.TAG_PAD));
    const sec = sectors[f.key];
    return page === "family" ? { key: f.key, x: 0, y: -R } : { key: f.key, x: R * Math.cos(sec.mid), y: R * Math.sin(sec.mid) };
  });
  let ext = GEOM.WORLD;
  for (const p of pos.values()) ext = Math.max(ext, Math.hypot(p.x, p.y) + p.size + GEOM.LABEL_ROOM);
  for (const t of tags) ext = Math.max(ext, Math.hypot(t.x, t.y) + GEOM.TAG_PAD);
  return { page, sectors, pos, order, edges, bands: bandsFor(page), tags, bounds: { r: ext } };
}

/** Two squares closer than their half-sizes + GAP (the test's rule, centre to centre). */
export const tooClose = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < p.size / 2 + q.size / 2 + GEOM.GAP;

/** A drawn node's parent on the drawing: its parent when that is drawn, else its family's trunk. */
export function parentOf(n, pos) {
  return n.parent && pos.has(n.parent) ? n.parent : `trunk:${n.family}`;
}

/** M4 · the path a chosen node lights back to the centre: [it, its parent…, trunk:<family>, "centre"]. */
export function pathBack(slug, tree, layout) {
  const bySlug = new Map(tree.nodes.map(n => [n.slug, n]));
  const out = [];
  let cur = slug;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur); out.push(cur);
    if (cur === "centre") break;
    if (cur.startsWith("trunk:")) { cur = "centre"; continue; }
    const n = bySlug.get(cur);
    if (!n || !layout.pos.has(cur)) break;
    cur = parentOf(n, layout.pos);
  }
  return out;
}

/** The edges of a path (their ids), to light. */
export function pathEdges(path) {
  const ids = new Set();
  for (let i = 0; i + 1 < path.length; i++) {
    const child = path[i], parent = path[i + 1];
    ids.add(parent === "centre" ? child : `${parent}>${child}`);
  }
  return ids;
}

// ── the camera ──────────────────────────────────────────────────────────────────────────────────

/** The whole tree in a stage of this aspect (width / height). */
export function fitView(layout, aspect) {
  const R = layout.bounds.r;
  let h = R * 2, w = h * aspect;
  if (w < R * 2) { w = R * 2; h = w / aspect; }
  return { x: -w / 2, y: -h / 2, w, h };
}
/** A view centred on a point at a zoom (1 = the whole world). */
export function viewAround(layout, [x, y], zoom, aspect) {
  const h = (layout.bounds.r * 2) / zoom, w = h * aspect;
  return { x: x - w / 2, y: y - h / 2, w, h };
}
/** Where the view goes for a target: { kind: "fit" | "node" | "family" | "yours", slug?, key? }. */
export function viewFor(target, layout, tree, aspect) {
  if (target.kind === "node") {
    const p = layout.pos.get(target.slug);
    if (p) return viewAround(layout, [p.x, p.y], GEOM.ZOOM_NODE, aspect);
    const n = tree.nodes.find(x => x.slug === target.slug);   // not drawn: its family's branch
    return n ? viewFor({ kind: "family", key: n.family }, layout, tree, aspect) : fitView(layout, aspect);
  }
  if (target.kind === "family" && layout.page !== "family" && layout.sectors[target.key]) {
    const s = layout.sectors[target.key], R = GEOM.TAG_FROM * 0.67;
    return viewAround(layout, [R * Math.cos(s.mid), R * Math.sin(s.mid)], GEOM.ZOOM_FAMILY, aspect);
  }
  if (target.kind === "yours") return viewAround(layout, [0, 0], GEOM.ZOOM_YOURS, aspect);
  return fitView(layout, aspect);
}
/** A flight: eased over FLY_MS, or — reduced motion — a jump (no frames). */
export function flight(reduced, ms = GEOM.FLY_MS) {
  return reduced ? { jump: true, ms: 0 } : { jump: false, ms };
}
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const between = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k });
/** Zoom about a point of the stage (px, py in 0..1), bounded. */
export function zoomAt(v, layout, px, py, factor) {
  const R = layout.bounds.r;
  const wx = v.x + px * v.w, wy = v.y + py * v.h;
  const nw = clamp(v.w / factor, R * 0.45, R * 6), nh = (nw * v.h) / v.w;
  return { x: wx - px * nw, y: wy - py * nh, w: nw, h: nh };
}
