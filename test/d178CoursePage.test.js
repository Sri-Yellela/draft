// ⭐ D178-3 (owner's pick 11-07: Course A + C) · d178OneCourseOneRecord — the half ring, the lesson deck and the modules list
// are one course and one progress (the one earned rule); the deck turns with the jobs page's gesture (lib/deckWheel.js).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { courseOf } from "../services/learn/learnCourse.js";
import { halfRingLayout, HALF, lessonState, lessonStateLine, courseProgress } from "../client/src/pages/atlas/libraryModel.js";
import { deckWheelHandler, WHEEL_STEP } from "../client/src/lib/deckWheel.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const course = courseOf(JSON.parse(fs.readFileSync("content/learn/silicon-to-software.json", "utf8")), { sources: [] });

// ⛔ 47m (changed on purpose): "d178OneCourseOneRecord: one tick per lesson, in module order, inside the drawing" retired — the classic lesson deck is deleted (D201): a lesson is a Gazetteer entry.

// ⛔ 47m (changed on purpose): "d178OneCourseOneRecord: the deck gesture — one flick turns one card, ends releas" retired — the classic Library / course pages are deleted (D201): courses are Gazetteer routes (pages/atlas/AtlasGazetteer.jsx).
