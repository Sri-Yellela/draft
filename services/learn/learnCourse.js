// services/learn/learnCourse.js — ⭐ D172 (2) · THE COURSE PAGE (atlas-redesign-sketch.html → Library → a course): the
// owner's path, "From silicon to software", as a course — its 8 parts are the MODULES, its 108 steps the LESSONS. Each
// lesson carries its curated links (every one mapped, none dropped — d172EveryCuratedItemMapped) with their type
// (Read · Watch · Try) and their SOURCE from the register (D176-3, services/atlas/learnSources.js), and its CHECK: the
// step's own checkpoints (explain in your own words) and build. Progress stays EARNED and is read by the client from
// /api/learn/earned with the one rule (shared/learnStepState.js) — nothing here marks anything done.
// No invented numbers: the sketch's "5 slides" and "· 15 min" appear only when a lesson HAS a deck / a length (none yet).
import { registerIndex, itemSource } from "../atlas/learnSources.js";
import { buildRequired, checkpointId, buildId, itemsToOpen } from "../../shared/learnStepState.js";

export const COURSE_ID = "silicon-to-software";
export const COURSE_TITLE = "From silicon to software";

const WATCH = new Set(["Video", "Course", "Playlist"]);
const TRY = new Set(["Build", "Project", "Sandbox", "Practice", "Lab"]);
/** Read · Watch · Try — the register's rule: "every lesson item records its source id, type and length". */
export const linkType = (k) => (WATCH.has(k) ? "Watch" : TRY.has(k) ? "Try" : "Read");

/** "Part 3: Algorithms and theory" → "Algorithms and theory" (the module's number is drawn separately). */
const moduleTitle = (t) => String(t || "").replace(/^Part\s+\d+\s*:\s*/i, "");

/**
 * @param doc the Learn document (learnContent(db)) · @param reg the source register
 * @returns { id, title, modules: [{ n, title, lessons: [{ id, title, goal, links, checks: [ids], build: id|null, optional }] }],
 *            counts: { modules, lessons, links } }
 */
export function courseOf(doc, reg) {
  const index = registerIndex(reg);
  const byId = new Map((reg?.sources || []).map(s => [s.id, s]));
  let lessons = 0, links = 0;
  const modules = (doc?.PARTS || []).map((part, pi) => ({
    n: pi + 1,
    title: moduleTitle(part.t),
    lessons: (part.phases || []).flatMap(ph => (ph.steps || []).map(st => {
      lessons++;
      const out = (st.items || []).map(it => {
        links++;
        const s = itemSource(it, index);
        const src = s.id ? byId.get(s.id) : null;
        return {
          id: it.id, type: linkType(it.k), kind: it.k, title: it.t, by: it.s || null, url: it.u || null, optional: !!it.o,
          source: src ? { id: src.id, name: src.name, licenceClass: src.licenceClass } : null,
          needsNamedSource: s.flag === "needs_named_source" || undefined,
        };
      });
      return {
        id: st.id, title: st.t, goal: st.g || "", phase: ph.t, links: out,
        toOpen: itemsToOpen(st).map(it => it.id),
        checks: (st.c || []).map((_, i) => checkpointId(st.id, i)),
        build: buildRequired(st) ? buildId(st.id) : null,
      };
    })),
  }));
  return { id: COURSE_ID, title: COURSE_TITLE, modules, counts: { modules: modules.length, lessons, links } };
}

// ⭐ D178 · CODING INTERVIEW PATTERNS — its own course on the shelf (the translation table: "LeetCode pattern atlas tab →
// its own course, linked from Interview → Practise → drills. Not a tab inside another course."). The same 28 patterns the
// tab showed (the Learn document's ATLAS), nothing added: each pattern a LESSON with its idea, why it matters, where it
// runs, how to spot it, its practice problems (Try · LeetCode) and the path's step that teaches it. The MODULES are those
// teaching steps, in the path's order — a grouping the content already has, not one invented here. A pattern whose step
// is gone still appears, under "More patterns". No progress: a pattern has no checkpoint, so nothing is earned here yet
// (`earned: false`), and the page says so rather than counting opened links.
export const PATTERN_COURSE_ID = "coding-interview-patterns";
export const PATTERN_COURSE_TITLE = "Coding interview patterns";

export function patternCourseOf(doc) {
  const steps = [];
  (doc?.PARTS || []).forEach(part => (part.phases || []).forEach(ph => (ph.steps || []).forEach(st => steps.push(st))));
  const order = new Map(steps.map((st, i) => [st.id, i]));
  const byStep = new Map();
  for (const p of doc?.ATLAS || []) {
    const key = order.has(p.st) ? p.st : null;
    if (!byStep.has(key)) byStep.set(key, []);
    byStep.get(key).push(p);
  }
  const keys = [...byStep.keys()].sort((a, b) => (a == null) - (b == null) || (order.get(a) ?? 0) - (order.get(b) ?? 0));
  let lessons = 0, links = 0;
  const modules = keys.map((k, mi) => {
    const st = k == null ? null : steps[order.get(k)];
    return {
      n: mi + 1,
      title: st ? st.t : "More patterns",
      taughtIn: st ? { stepId: st.id, title: st.t, n: order.get(k) + 1 } : null,
      lessons: byStep.get(k).map(p => {
        lessons++;
        const practice = (p.pr || []).map(([title, slug], i) => {
          links++;
          return { id: `pattern-${p.id}#pr${i}`, type: "Try", kind: "Practice", title, by: "LeetCode", url: `https://leetcode.com/problems/${slug}/`, optional: false };
        });
        return { id: `pattern-${p.id}`, title: p.n, goal: p.line || "", idea: p.idea || "", why: p.why || "", where: p.where || [], spot: p.spot || "",
          links: practice, checks: [], build: null, toOpen: [] };
      }),
    };
  });
  return { id: PATTERN_COURSE_ID, title: PATTERN_COURSE_TITLE, kind: "patterns", earned: false, intro: doc?.copy?.intros?.patterns || "",
    modules, counts: { modules: modules.length, lessons, links } };
}
