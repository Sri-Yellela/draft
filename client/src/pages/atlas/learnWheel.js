// client/src/pages/atlas/learnWheel.js — ⭐ D117 C10 + C11 (revised) + C12 · THE WHEEL'S GEOMETRY, pure (no DOM), so the
// tests can hold it without a browser. Ported from the owner's final sketch (docs/sketches/learn-circle.html, 10-31):
//   · ONE deck of portrait cards fanned round ONE wheel; the fan's pivot is the circle's centre; a gap between parts;
//   · zoomed out: the whole wheel, centred, as large as the stage allows;
//   · zoomed in: the chosen card brought to the RIGHT of the arc (3 o'clock), where a portrait card on the ring lies flat,
//     its neighbours fanned above and below (7° each, 4 visible, then tighter), the circle's centre off the stage's left;
//   · C12: the front card as large as the stage allows, up to FRONT_MAX (the sketch's 1.25 is raised to 1.4 so the front
//     card is ≥ 60 % of the stage's height at 1280 × 800 — C12's own test; the sketch measured 56 %).
export const WHEEL = Object.freeze({ R: 520, CW: 300, CH: 390, GAP: 1.4, FRONT_MAX: 1.4, SPREAD: 7, VISIBLE: 4 });

/** Each piece's slot round the wheel (parts separated by GAP), and the total. */
export function wheelSlots(pieces) {
  const slot = new Map();
  let pos = 0, part = null;
  for (const p of pieces) {
    if (part !== null && p.partIndex !== part) pos += WHEEL.GAP;
    part = p.partIndex;
    slot.set(p.id, pos);
    pos += 1;
  }
  const order = pieces.map(p => slot.get(p.id));
  return { slot, order, total: pos + WHEEL.GAP };
}

export const angAtSlot = (x, total) => (x / total) * 360;

/** The slot at a fractional card index f (the turning deck), wrapping round. */
export function slotAt(f, slots) {
  const N = slots.order.length;
  const i = Math.floor(((f % N) + N) % N), j = (i + 1) % N, t = f - Math.floor(f);
  const a = slots.order[i], b = j === 0 ? slots.total : slots.order[j];
  return a + (b - a) * t;
}

/** The signed distance from card i to the deck's position f, the short way round. */
export function wrapOff(i, f, N) {
  let d = i - f;
  while (d > N / 2) d -= N;
  while (d < -N / 2) d += N;
  return d;
}

/** The fan: SPREAD° a card for the VISIBLE nearest, then tighter (fanGeometry.js's board fan). */
export function fanAng(o) {
  const a = Math.abs(o), deg = a <= WHEEL.VISIBLE ? a * WHEEL.SPREAD : WHEEL.VISIBLE * WHEEL.SPREAD + (a - WHEEL.VISIBLE) * 2.2;
  return (o < 0 ? -1 : 1) * deg;
}

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerpAng = (a, b, t) => { let d = b - a; while (d > 180) d -= 360; while (d < -180) d += 360; return a + d * t; };

/** The whole wheel's scale (zoomed out) and the front card's scale (zoomed in) for a W × H stage. */
export const outScale = (W, H) => (Math.min(W, H) / 2 - 34) / (WHEEL.R + WHEEL.CH);
export const inScale = (W, H) => Math.max(0.2, Math.min(WHEEL.FRONT_MAX, (H - 70) / WHEEL.CW, (W - 60) / WHEEL.CH));

/**
 * One frame: the wheel's transform and each card's angle, opacity, blur and stacking, for zoom e (0 out … 1 in, eased)
 * and deck position f (a fractional card index).
 */
export function frameAt({ W, H, e, f, pieces, slots, dimmed = null }) {
  const N = pieces.length, { R, CH } = WHEEL;
  const s0 = outScale(W, H), x0 = W / 2, y0 = H / 2;
  const s1 = inScale(W, H), x1 = W - (R + CH) * s1 - Math.max(30, (W - CH * s1) / 2 - 40), y1 = H / 2;
  const base = angAtSlot(slotAt(f, slots), slots.total);
  const wheel = { x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e, scale: s0 + (s1 - s0) * e, rot: lerpAng(0, 90 - base, e) };
  const cards = pieces.map((p, i) => {
    const o = wrapOff(i, f, N), a = Math.abs(o);
    const ang = lerpAng(angAtSlot(slots.slot.get(p.id), slots.total), base + fanAng(o), e);
    let op = 1 + ((a <= 4 ? 1 - a / 6 : a <= 7 ? 0.18 : 0) - 1) * e;
    if (e < 0.02 && dimmed && dimmed.has(p.id)) op = 0.25;
    const blur = (a < 0.5 ? 0 : Math.min(5, a * 0.8)) * e;
    const z = Math.round(e > 0.5 ? 500 - a * 2 : 1 + slots.slot.get(p.id));
    return { id: p.id, ang, op, blur, z };
  });
  return { wheel, cards, base };
}

/** The front card's on-screen height when zoomed in (it lies flat at 3 o'clock, so its WIDTH is vertical). */
export const frontCardHeight = (W, H) => WHEEL.CW * inScale(W, H);

/** Zoomed out: a point on the ring at radius r (in stage px), for a piece — for the chords and the route's ink. */
export function ringPoint(id, slots, W, H, r) {
  const a = (angAtSlot(slots.slot.get(id), slots.total) * Math.PI) / 180 - Math.PI / 2;
  return [W / 2 + r * Math.cos(a), H / 2 + r * Math.sin(a)];
}
