// ⭐ D155 Part C · THE DECK BATCH WRITER — one place that turns a batch's source (decks + their check questions) into
// content/decks/decks-vN.json and its review copy decks-vN.md, in D154 P4's five-slide format. Every deck and question is
// written status "draft": nothing is live until the owner approves the batch.
import fs from "node:fs";
import { ruleProblems, pacing } from "../../services/learn/deckLayers.js";
import { loadRegistry } from "../../services/atlas/sourceRegistry.js";

export const CHECK = Object.freeze({ tag: "Check yourself", title: "One question", points: ["Answer it, then read the why."] });

/** A deck: four slides [tag, title, points] + the check. `id` like "sw-p-01" (its number = its position in the stage). */
export const deck = (id, pathway, stage, title, skills, pieces, slides, q) => ({
  id, pathway, stage, title, skills, pieces,
  slides: [...slides.map(([tag, t, points]) => ({ tag, title: t, points })), CHECK],
  questions: [q.id], source: "drafted-for-review", status: "draft", _q: q,
});

/**
 * ⭐ D195 (47a) · a deck under the content rule: four slides [layer, tag, title, points] — concept → proof → realWorld —
 * plus the check; `realWorld` { name, url } is the named system or failure layer 3 shows, `tryStep` { source, url, label }
 * the hands-on step from an open register source. services/learn/deckLayers.js lints it (writeBatch refuses a failing deck).
 */
export const layeredDeck = (id, pathway, stage, title, skills, pieces, slides, realWorld, tryStep, q) => ({
  ...deck(id, pathway, stage, title, skills, pieces, slides.map(([, tag, t, points]) => [tag, t, points]), q),
  slides: [...slides.map(([layer, tag, t, points]) => ({ layer, tag, title: t, points })), CHECK],
  realWorld, try: tryStep, rule: "D195",
});

/** A scenario question for the bank (a draft until reviewed): every choice has its why. */
export const question = (id, role, level, skills, pieces, stem, choices, correct, why) =>
  ({ id, type: "scenario", role, level, skills, pieces, stem, choices, correct, why, source: "drafted-for-review", status: "draft" });

/** The owner's approval of a batch (content/decks/approvals.json), or null. */
export function approvalOf(version) {
  try { return JSON.parse(fs.readFileSync("content/decks/approvals.json", "utf8")).approved?.[String(version)] || null; } catch { return null; }
}

export function writeBatch({ version, title, note, decks, dir = "content/decks" }) {   // 46z: `dir` — a batch held for review outside the served folder
  // ⭐ An approved batch is written approved (its decks served, its questions live on import) — regenerating never reverts it.
  // ⭐ D195: a deck written under the rule is linted before it is written — a failing deck is sent back, never saved.
  const reg = loadRegistry();
  const bad = decks.filter(d => d.rule === "D195").map(d => [d.id, ruleProblems(d, reg)]).filter(([, p]) => p.length);
  if (bad.length) throw new Error(`D195: ${bad.map(([id, p]) => `${id}: ${p.join("; ")}`).join(" | ")}`);
  const ok = approvalOf(version);
  if (ok) { for (const d of decks) { d.status = "approved"; d._q.status = "live"; } note = `${note} APPROVED by the ${ok.by} ${ok.at} ("${ok.words}").`; }
  const out = { version, note, decks: decks.map(({ _q, ...d }) => d), newQuestions: decks.map(d => d._q) };
  fs.writeFileSync(`${dir}/decks-v${version}.json`, JSON.stringify(out, null, 1) + "\n");
  const md = [
    `# Decks v${version} — ${title} (for your review)`,
    "",
    ok ? `Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. ${decks.length} five-slide decks, each with one new question. **APPROVED by the ${ok.by} ${ok.at}** — served in the Library; the questions are live in the bank.`
       : `Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. ${decks.length} five-slide decks; each ends with one new question (drafts for the bank). **Nothing is live until you approve** — say "approve decks-v${version}" (or name the decks to change).`,
    "",
    ...decks.flatMap(d => [
      `## ${d.id} · ${d.title}`,
      `*Skills:* ${d.skills.join(", ")} · *Check yourself:* ${d.questions.join(", ")}`,
      "",
      ...(d.rule === "D195" ? [`*D195 layers:* concept → proof → real world · *plays in* ${pacing(d).total} s (concept ${pacing(d).concept} · proof ${pacing(d).proof} · real world ${pacing(d).realWorld}) · *real world:* [${d.realWorld.name}](${d.realWorld.url}) · *Try:* [${d.try.label || d.try.source}](${d.try.url}) (\`${d.try.source}\`)`, ""] : []),
      ...d.slides.flatMap((s, i) => [`**${i + 1}. ${s.tag} — ${s.title}**${s.layer ? ` *(${s.layer})*` : ""}`, ...s.points.map(p => `- ${p}`), ""]),
      `**The question (${d._q.id}).** ${d._q.stem}`,
      ...d._q.choices.map((c, i) => `${i === d._q.correct ? "- ✅" : "-"} ${c} — *${d._q.why[i]}*`),
      "",
    ]),
  ].join("\n");
  fs.writeFileSync(`${dir}/decks-v${version}.md`, md);
  console.log(`decks-v${version}: ${decks.length} decks, ${decks.length} questions (draft)`);
}
