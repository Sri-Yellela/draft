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
