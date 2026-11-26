// T25 (owner, 10-19) · THE BOARD CARD'S BUTTON BOX — retired with the card.
// ⛔ 47j A248 (changed on purpose): JobBubble's card (its `.jb__rail` of ATS · star · Draft squares) is DELETED — since R2 the
// market's list is the Index (plate/MarketIndex.jsx), whose rows say Draft in a word and draw no rail. The seam this file
// measured in real Chrome (a clipped shadow drawing a box round the three squares, D92 rule 2) has nothing left to clip.
// What stays: the rail never comes back as a second card face.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");

test("T25 · the board card's rail is gone with the card (47j A248) — no .jb__rail in the client", () => {
  assert.doesNotMatch(read("client/src/components/JobBubble.css"), /\.jb__rail\b/, "the deleted card's rail rules are back");
  const jsx = fs.readdirSync("client/src", { recursive: true }).map(String).filter((f) => /\.jsx$/.test(f));
  assert.ok(jsx.length > 100, "the scan found the client");
  for (const f of jsx) assert.doesNotMatch(read(`client/src/${f}`), /jb__rail/, `${f} draws the deleted rail`);
});
