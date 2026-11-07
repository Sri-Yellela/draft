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
