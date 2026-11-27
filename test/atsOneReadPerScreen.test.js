// ONE SCORING READ PER SCREEN (A52) — the client half of test/atsStoredScoreCurrent.test.js.
//
// A card's JD header read "No signal" (a null stored score printed as a verdict) beside an ATS panel
// reading "Strong match" (the posting scored fresh). The header no longer prints an absent score as a
// decline, and when the panel scores a posting itself, its verdict is adopted by the card, the JD
// header and the panel's own header until the next board load reads the re-scored stored value.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SERVER = fs.readFileSync("server.js", "utf8");

// ⛔ 47m (changed on purpose): "the client: one scoring read per screen" retired — the posting panel is deleted (D199 C7): a job opens as its opening sheet (plate/OpeningSheet.jsx, SheetResume.jsx), pinned by d199Market47h and a204.
