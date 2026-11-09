// services/pdfText.js — PDF → text, locally, no model call (D17). ⭐ 45s (owner 11-09: "Could not read this PDF??").
//
// pdf-parse (1.1.x) wraps a 2018 copy of pdf.js (1.10) and REFUSES some PDFs that every viewer opens — newer cross-reference
// streams, some encryption dictionaries (owner-password only), certain font programs — so /api/parse-pdf answered 422
// "Could not read this PDF" for a résumé the owner's own PDF reader shows fine. Now: pdf-parse first (unchanged results for
// every PDF it reads), and when it throws or finds no text, the CURRENT pdf.js (pdfjs-dist's Node build) reads the text
// layer page by page. Only when both fail is the PDF refused — with the reason logged, so a refusal can be diagnosed.
// A scan (no text layer) is still a scan: neither reads images, and the route says what to do instead.
export const MIN_TEXT = 50;

async function viaPdfParse(buffer) {
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
  return String((await pdfParse(buffer)).text || "").trim();
}

/** The current pdf.js's reading on its own (exported for the test). */
export async function viaPdfjs(buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  try {
    const pages = [];
    for (let i = 1; i <= Math.min(doc.numPages, 40); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // One line per text run that ends a line (hasEOL), so sections keep their lines as pdf-parse's output does.
      let line = "", out = [];
      for (const it of content.items) {
        line += it.str ?? "";
        if (it.hasEOL) { out.push(line); line = ""; }
      }
      if (line) out.push(line);
      pages.push(out.join("\n"));
    }
    return pages.join("\n\n").replace(/[ \t]+\n/g, "\n").trim();
  } finally { await doc.destroy().catch(() => {}); }
}

/** → { text, via: 'pdf-parse' | 'pdfjs' | null, errors: [string] } — text '' when neither could read it. */
export async function extractPdfText(buffer, { log = console } = {}) {
  const errors = [];
  let text = "";
  try { text = await viaPdfParse(buffer); } catch (e) { errors.push(`pdf-parse: ${String(e?.message || e).slice(0, 160)}`); }
  if (text.length >= MIN_TEXT) return { text, via: "pdf-parse", errors };
  try {
    const t = await viaPdfjs(buffer);
    if (t.length >= MIN_TEXT) { if (errors.length) log?.warn?.(`[parse-pdf] pdf-parse refused, pdf.js read it (${t.length} chars): ${errors[0]}`); return { text: t, via: "pdfjs", errors }; }
    if (t.length > text.length) text = t;
  } catch (e) { errors.push(`pdf.js: ${String(e?.message || e).slice(0, 160)}`); }
  if (errors.length) log?.warn?.(`[parse-pdf] could not read a PDF (${buffer?.length || 0} bytes): ${errors.join(" | ")}`);
  return { text, via: null, errors };
}
