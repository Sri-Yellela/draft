// ⭐ D118 P2 · the tracker extractor IN THE OWNER'S BROWSER (Admin → Atlas → Import content, adminLearnImport.jsx).
//
// The SAME extractor as scripts/learn/extractTracker.mjs (shared/learnTracker.js): the data block is found as text and
// run in a sandboxed iframe — sandbox="allow-scripts" and nothing else, so it has an opaque origin: no cookies, no
// storage, no reach into this page — with a CSP of default-src 'none', so it cannot load or send anything. It hands
// back the arrays as JSON text, re-parsed here (plain data only). ⛔ Only that JSON goes to the server, which never
// evaluates an upload (routes/learnAdmin.js; d118ServerNeverEvaluatesUpload).
import { dataBlockOf, DATA_RESULT, plainData, assembleLearnFile } from "../../../shared/learnTracker.js";

export const SANDBOX_CSP = "default-src 'none'; script-src 'unsafe-inline'";

/** The iframe's whole document: the CSP, then the block wrapped so it can only post its result back. */
export function sandboxDocument(code, nonce) {
  const runner = `(function(){var n=${JSON.stringify(nonce)};try{var out=(function(){\n${code}\n;return ${DATA_RESULT};})();`
    + `parent.postMessage({nonce:n,ok:true,json:JSON.stringify(out)},"*");}catch(e){parent.postMessage({nonce:n,ok:false,error:String(e&&e.message||e)},"*");}})();`;
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}"><script>${runner.replace(/<\/script/gi, "<\\/script")}</script>`;
}

/** Run the tracker's data block in the sandbox; resolves the plain { PARTS, ATLAS, INDEX }. */
export function evaluateInSandbox(code, { timeoutMs = 8000, doc = globalThis.document, win = globalThis.window } = {}) {
  return new Promise((resolve, reject) => {
    const frame = doc.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("tabindex", "-1");
    frame.style.display = "none";
    const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    let settled = false;
    const finish = (fn, v) => {
      if (settled) return;
      settled = true;
      win.removeEventListener("message", onMessage);
      clearTimeout(timer);
      frame.remove();
      fn(v);
    };
    function onMessage(e) {
      if (e.source !== frame.contentWindow || !e.data || e.data.nonce !== nonce) return;
      if (!e.data.ok) return finish(reject, new Error(`The tracker's data did not run: ${e.data.error}`));
      try { finish(resolve, plainData(JSON.parse(String(e.data.json)))); } catch (err) { finish(reject, err); }
    }
    const timer = setTimeout(() => finish(reject, new Error("The tracker's data took too long to run.")), timeoutMs);
    win.addEventListener("message", onMessage);
    frame.srcdoc = sandboxDocument(code, nonce);
    doc.body.appendChild(frame);
  });
}

/**
 * A picked file → the JSON to send. A .json (or text starting with "{") is parsed — never run; a page is extracted in
 * the sandbox. @param file { name, text(): Promise<string> }
 */
export async function learnFileFromUpload(file, opts = {}) {
  const text = await file.text();
  if (/\.json$/i.test(file.name) || /^\s*\{/.test(text)) return JSON.parse(text);
  const data = await evaluateInSandbox(dataBlockOf(text), opts);
  return assembleLearnFile(text, data, { sourceName: file.name, at: opts.at ?? new Date().toISOString().slice(0, 10) });
}
