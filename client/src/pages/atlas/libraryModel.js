// client/src/pages/atlas/libraryModel.js — ⭐ D172 (2) · the Library and a course page, the pure half. Progress is EARNED,
// read with the ONE rule (shared/learnStepState.js stepState) from the reader's /api/learn/earned marks — a lesson is
// "checked" only when its links are opened, its checkpoints explained in the reader's own words and its build done.
import { stepState } from "../../../../shared/learnStepState.js";

/** A course lesson back in the shape the one rule reads (`items` with id · o · u · k, and `c`). */
export const lessonAsStep = (l) => ({ id: l.id, items: (l.links || []).map(x => ({ id: x.id, o: x.optional, u: x.url, k: x.kind })), c: l.checks || [] });

export const lessonState = (l, marks = {}) => stepState(lessonAsStep(l), marks);

/** Per module: { done, total }; for the course: { done, total, pct } — lessons complete by the one rule. */
export function courseProgress(course, marks = {}) {
  let done = 0, total = 0;
  const modules = (course?.modules || []).map(m => {
    const d = m.lessons.filter(l => lessonState(l, marks).complete).length;
    done += d; total += m.lessons.length;
    return { n: m.n, done: d, total: m.lessons.length };
  });
  return { modules, done, total, pct: total ? Math.floor((done / total) * 100) : 0 };
}

/** The module to open first: the first with an unfinished lesson (or the first). */
export function firstOpenModule(course, marks = {}) {
  const m = (course?.modules || []).find(x => x.lessons.some(l => !lessonState(l, marks).complete));
  return m ? m.n : (course?.modules?.[0]?.n ?? null);
}

/** "Watch · Crash Course Computer Science · CrashCourse" — the type, the title, the register's name for its source. */
export function linkLine(x) {
  const who = x.source?.name || x.by || null;
  return [x.type, x.title, who && who !== x.title ? who : null].filter(Boolean).join(" · ");
}

/** A deck slide's label: "1 of 5 · What it is". */
export const slideLabel = (i, n, tag) => `${i + 1} of ${n}${tag ? ` · ${tag}` : ""}`;

// ⭐ D178-3 (owner's pick 11-07: "keep the half circle for scrolling through modules") · THE HALF RING: every lesson a tick
// on a half circle (left → over the top → right), modules separated by a gap; pure geometry for LibraryPanel's ring.
export const HALF = Object.freeze({ w: 640, h: 340, cx: 320, cy: 320, r: 270, len: 34, gap: 0.035 });
export function halfRingLayout(course) {
  const mods = course?.modules || [];
  const n = mods.reduce((a, m) => a + m.lessons.length, 0);
  const span = Math.PI - HALF.gap * Math.max(0, mods.length - 1);
  const per = n ? span / n : 0;
  const ticks = [];
  let a = Math.PI;                                      // start at the left, go over the top
  mods.forEach((m, mi) => {
    if (mi) a += HALF.gap;
    for (const l of m.lessons) {
      const t = a + per / 2;
      const c = Math.cos(t), s = Math.sin(t);
      ticks.push({ id: l.id, module: m.n, x1: HALF.cx + HALF.r * c, y1: HALF.cy + HALF.r * s, x2: HALF.cx + (HALF.r - HALF.len) * c, y2: HALF.cy + (HALF.r - HALF.len) * s });
      a += per;
    }
  });
  return ticks.map(t => ({ ...t, x1: +t.x1.toFixed(1), y1: +t.y1.toFixed(1), x2: +t.x2.toFixed(1), y2: +t.y2.toFixed(1) }));
}

/** A lesson card's state line: "✓ Checked" · "In progress · 3 of 7" · "Not started". */
export function lessonStateLine(st) {
  if (st.complete) return { state: "checked", text: "✓ Checked" };
  if (st.started) return { state: "started", text: `In progress · ${st.done} of ${st.total}` };
  return { state: "new", text: "Not started" };
}
