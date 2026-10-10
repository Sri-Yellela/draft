// services/byom/untrusted.js — ⛔ D86 DR-10: A JOB POSTING IS UNTRUSTED TEXT.
//
// The connector hands posting text to a model the user is talking to. An employer's posting (or anyone
// who can get text onto a careers page) can carry a prompt-injection line — "ignore your previous
// instructions and…". So posting prose leaves draft only (a) capped, (b) stripped of control characters
// and markup, and (c) with instruction-shaped phrases neutralised, in a field whose name says it is the
// posting's own words. Structured fields (title, company, pay, skills) are the default; prose is the
// exception (`include_description`). Pure: no database, no network.

export const SUMMARY_CHARS = 600;
export const DESCRIPTION_CHARS = 6000;

// Phrases whose only job in a posting would be to address the model reading it. Matched case-insensitively
// on word edges; each match is replaced, never deleted silently, so a reader sees something was there.
const INJECTION = [
  /\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|the\s+|your\s+|my\s+)?(?:previous|prior|above|earlier|preceding|other)?\s*(?:instructions?|prompts?|rules?|directions?|messages?)\b/gi,
  /\b(?:system|developer)\s+(?:prompt|message|instructions?)\b/gi,
  /\byou\s+are\s+now\b/gi,
  /\b(?:act|behave)\s+as\s+(?:an?\s+|the\s+)?(?:ai|assistant|model|chatbot|system)\b/gi,
  /\bnew\s+instructions?\s*:/gi,
  /<\/?\s*(?:system|assistant|user|instructions?|prompt)\s*>/gi,
  /\[\/?\s*(?:INST|SYS)\s*\]/g,
];

const MARKUP = /<[^>]{0,200}>/g;
// C0/C1 controls (keeping tab and newline) and the zero-width / bidi characters used to hide text.
const HIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤﻿]/g;

/**
 * Posting text made safe to hand a model as data.
 * @returns {{ text: string, truncated: boolean, neutralised: number }}
 */
export function untrustedText(value, maxChars = SUMMARY_CHARS) {
  let neutralised = 0;
  let s = String(value ?? "").replace(HIDDEN, "").replace(MARKUP, " ");
  for (const re of INJECTION) s = s.replace(re, () => { neutralised++; return "[removed]"; });
  s = s.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const truncated = s.length > maxChars;
  if (truncated) {
    const cut = s.slice(0, maxChars);
    const edge = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
    s = `${(edge > maxChars * 0.6 ? cut.slice(0, edge + 1) : cut).trim()} …`;
  }
  return { text: s, truncated, neutralised };
}
