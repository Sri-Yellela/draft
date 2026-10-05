/**
 * D32 — THE EMPLOYER'S DESCRIPTION, FORMATTED PLAINLY. Nothing fancy, and nothing of ours.
 *
 * ⛔ THE POSTING STAYS THE EMPLOYER'S DOCUMENT. This reads the stored text and says, line by line,
 * what each line already is — a paragraph, one of THEIR headings, one of THEIR bullets — so the page
 * can draw a drop cap, a small-caps rule and an accent marker. It does not:
 *   · section the posting ("what they need / would be nice / said-not-counted") — the owner cut that;
 *   · pull a quote out of it — cut too;
 *   · reorder, merge, summarise or drop a single word of theirs. Concatenate every block's text and you
 *     get the original words in the original order (test/inkPairD32.test.js proves it on real shapes).
 * ⛔ D17: no model call — this is string handling. The ATS report is NOT in here; it is its own card.
 *
 * Shapes measured on the local board (2026-10-05, 400 sampled): Greenhouse and Ashby store plain text
 * with "\n\n" paragraphs, short heading lines and "• " bullets; Lever mostly paragraphs. No HTML.
 */

// A bullet as the employer typed it: •, ·, ▪, ◦, ‣, ●, ○, ■, -, *, –, — or "1." / "1)".
const BULLET_RE = /^\s*(?:[•·▪◦‣●○■□*–—-]|\d{1,2}[.)])\s+(.*\S)\s*$/;
const EMPTY_BULLET_RE = /^\s*[•·▪◦‣●○■□*–—-]\s*$/;
const MAX_HEADING_CHARS = 70;
const MAX_HEADING_WORDS = 9;

/** Is this standalone line one of the employer's own headings? Short, unpunctuated, not a sentence. */
function isHeading(line) {
  const t = line.trim();
  if (!t || t.length > MAX_HEADING_CHARS) return false;
  if (t.split(/\s+/).length > MAX_HEADING_WORDS) return false;
  if (/^[a-z]/.test(t)) return false;              // a sentence fragment, not a heading
  if (/[.!?;,]$/.test(t)) return false;            // a sentence ends; a heading does not ("Requirements:" does)
  return true;
}

/**
 * The description as blocks, in the employer's order:
 *   { type: "p",  text }            a paragraph (its own line breaks kept)
 *   { type: "h",  text }            one of their headings, exactly as written (the page may drop a trailing colon)
 *   { type: "ul", items: [text] }   their bullets, markers removed (the page draws its own accent marker)
 */
export function formatPosting(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let para = null;          // the paragraph being gathered
  let blankSince = true;    // only blank lines since the last block ended (a heading must stand alone)
  const flush = () => { if (para) { blocks.push({ type: "p", text: para.join("\n") }); para = null; } };
  const last = () => blocks[blocks.length - 1];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); blankSince = true; continue; }
    // An empty bullet (a lone "•" — Greenhouse emits them) carries no words: it is a blank line.
    if (EMPTY_BULLET_RE.test(line)) { flush(); blankSince = true; continue; }
    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      flush();
      // Bullets separated only by blank lines are still one list (Greenhouse writes "\n\n• ").
      if (last()?.type === "ul") last().items.push(bullet[1]);
      else blocks.push({ type: "ul", items: [bullet[1]] });
      blankSince = false;
      continue;
    }
    // An indented line right after a bullet continues that bullet.
    if (!blankSince && last()?.type === "ul" && /^\s{2,}\S/.test(line) && !para) {
      const items = last().items;
      items[items.length - 1] += `\n${line.trim()}`;
      continue;
    }
    const next = lines[i + 1];
    // A heading stands alone: not inside a paragraph, and followed by a break, a bullet — or it says
    // so itself with a colon ("Requirements:").
    const standsAlone = !para && (next == null || !next.trim() || BULLET_RE.test(next) || /:\s*$/.test(line));
    if (standsAlone && isHeading(line)) {
      flush();
      blocks.push({ type: "h", text: line.trim() });
      blankSince = false;
      continue;
    }
    (para ||= []).push(line.trim());
    blankSince = false;
  }
  flush();
  return blocks;
}

/** Every word of every block, in order — the proof that formatting dropped and reordered nothing. */
export function blockWords(blocks) {
  return blocks.flatMap(b => (b.type === "ul" ? b.items : [b.text])).join(" ").split(/\s+/).filter(Boolean);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The hover link (D32's optional half): split a block's text around every occurrence of ONE term, so
 * the page can light it while the reader points at that term in the score card. Case-insensitive,
 * whole-word. No term → the text unchanged, as one segment. Never called with more than one term:
 * the link is shown only while asked for (hover/focus), never as a standing highlight.
 */
export function markTerm(text, term) {
  const t = String(term || "").trim();
  const s = String(text || "");
  if (!t) return [{ text: s, lit: false }];
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRe(t)})(?=$|[^\\p{L}\\p{N}])`, "giu");
  const out = [];
  let at = 0;
  for (const m of s.matchAll(re)) {
    const start = m.index + m[1].length;
    if (start > at) out.push({ text: s.slice(at, start), lit: false });
    out.push({ text: m[2], lit: true });
    at = start + m[2].length;
  }
  if (at < s.length) out.push({ text: s.slice(at), lit: false });
  return out.length ? out : [{ text: s, lit: false }];
}
