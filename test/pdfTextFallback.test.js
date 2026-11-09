// 45s (owner 11-09: "Could not read this PDF??") · /api/parse-pdf reads with pdf-parse, and when it refuses (or finds no text)
// with the CURRENT pdf.js; a PDF neither reads is still refused, its reason logged. No model call (D17).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractPdfText, viaPdfjs } from "../services/pdfText.js";

// A minimal one-page PDF with a text layer (hand-built: a Helvetica Tj).
function tinyPdf(text) {
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n"; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
const LINE = "Maya Chen - Software Engineer II, Frontend - Toast - Boston, MA - React TypeScript GraphQL";

test("pdfTextFallback: the current pdf.js reads a real text layer on its own (the fallback path works)", async () => {
  const t = await viaPdfjs(tinyPdf(LINE));
  assert.match(t, /Maya Chen - Software Engineer II, Frontend - Toast/);
});

test("pdfTextFallback: pdf-parse first; junk refused with both reasons logged; the route uses the module", async () => {
  const ok = await extractPdfText(tinyPdf(LINE), { log: { warn: () => {} } });
  assert.ok(ok.text.includes("Maya Chen")); assert.ok(["pdf-parse", "pdfjs"].includes(ok.via));
  const logged = [];
  const bad = await extractPdfText(Buffer.from("this is not a pdf"), { log: { warn: (m) => logged.push(m) } });
  assert.equal(bad.text, ""); assert.equal(bad.via, null); assert.equal(bad.errors.length, 2);
  assert.match(logged.join(" "), /could not read a PDF .*pdf-parse: .*\| pdf\.js: /);
  const server = fs.readFileSync("server.js", "utf8");
  assert.match(server, /const \{ text, errors \} = await extractPdfText\(req\.file\.buffer\);/);
  assert.doesNotMatch(fs.readFileSync("services/pdfText.js", "utf8"), /callModel|anthropic/i);
});
