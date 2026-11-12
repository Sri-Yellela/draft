import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { autoApply } from "../services/applyAutomation.js";
import { registerChallenge, liveSessionFor, liveSessionsOf, _resetLiveChallenges } from "../services/liveChallenge.js";

// ⭐ A186-CAPTCHA (1) · SOLVE IT HERE — real Chrome, the real worker (autoApply, mode full), a local form whose Submit
// raises a VISIBLE test challenge (an iframe at /recaptcha/api2/bframe — what detectGate counts as a check a person must
// answer). The run opens a live session; a simulated PERSON clicks the check through the session (pixels in, clicks
// out — services/liveChallenge.js); the run presses Submit again, reaches the confirmation and ends submitted, with the
// evidence saying so. ⛔ Nothing in draft answers the check: the click below is the test standing in for the person.
// Synthetic person; nothing leaves this machine.

const FORM = `<!doctype html><html><body>
<form id="f"><label for="n">Full name</label><input id="n" name="name" required>
<label for="e">Email</label><input id="e" name="email" type="email" required>
<button type="submit">Submit Application</button></form>
<script>
let solved = false;
document.getElementById('f').addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (!solved) {
    if (!document.getElementById('ch')) {
      const f = document.createElement('iframe'); f.id = 'ch'; f.src = '/recaptcha/api2/bframe?k=test';
      f.style = 'position:fixed;left:100px;top:100px;width:400px;height:580px;border:0;background:#fff';
      document.body.appendChild(f);
    }
    return;
  }
  location.href = '/thanks';
});
window.addEventListener('message', (m) => { if (m.data === 'solved') { solved = true; document.getElementById('ch')?.remove(); } });
</script></body></html>`;
const CHALLENGE = `<!doctype html><html><body style="margin:0">
<button id="b" style="width:400px;height:580px;font-size:24px" onclick="parent.postMessage('solved','*')">I am a person</button>
</body></html>`;
const THANKS = `<!doctype html><html><body><h1>Thank you for applying!</h1></body></html>`;

function serve() {
  const server = http.createServer((req, res) => {
    const send = (s) => { res.writeHead(200, { "content-type": "text/html" }); res.end(s); };
    if (req.url.startsWith("/recaptcha/")) return send(CHALLENGE);
    if (req.url.startsWith("/thanks")) return send(THANKS);
    return send(FORM);
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r(server)));
}
const PAYLOAD = { field_map: { first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace", email: "ada@example.com" }, handler_map: {}, custom_answers: {} };
const RESUME = path.join(os.tmpdir(), "a186-resume.pdf");
fs.writeFileSync(RESUME, "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

test("a186: a visible check after Submit opens a live session; the PERSON's click clears it; the run ends submitted", { timeout: 180000 }, async () => {
  _resetLiveChallenges();
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/apply`;
  let sawFrame = false, ownerView = null, strangerView = "unset", listed = null;
  try {
    const result = await autoApply(url, PAYLOAD, {
      mode: "full", jobId: "a186-live", platform: "greenhouse", resumePath: RESUME,
      onChallenge: async ({ page }) => {
        const live = await registerChallenge({ runJobId: 501, userId: 7, jobId: "a186-live", page, timeoutMs: 60000 });
        assert.ok(live, "a live session opens");
        ownerView = liveSessionFor(501, 7); strangerView = liveSessionFor(501, 8); listed = liveSessionsOf(7);
        // the person: waits for the first frame, then clicks the check (its centre: 100 + 200, 100 + 290)
        ownerView.subscribe((f) => {
          if (!f || sawFrame) return;
          sawFrame = true;
          setTimeout(() => ownerView.input({ type: "click", x: 300, y: 390 }), 300);
        });
        return live;
      },
    });
    assert.ok(sawFrame, "the page was streamed");
    assert.ok(ownerView, "the run's owner may watch");
    assert.equal(strangerView, null, "nobody else may");
    assert.equal(listed.length, 1);
    assert.equal(result.status, "submitted", JSON.stringify({ status: result.status, reason: result.reasonCode, evidence: result.submitEvidence }));
    assert.equal(result.submitVerified, true);
    assert.match(result.submitEvidence, /confirmation_page_after_person_check/);
    assert.equal(liveSessionsOf(7).length, 0, "the session ends with the run");
  } finally { server.close(); _resetLiveChallenges(); }
});

test("a186: nobody solves it — the session times out and the run ends held as captcha_required (not 'unverified')", { timeout: 180000 }, async () => {
  _resetLiveChallenges();
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/apply`;
  try {
    const result = await autoApply(url, PAYLOAD, {
      mode: "full", jobId: "a186-timeout", platform: "greenhouse", resumePath: RESUME,
      onChallenge: async ({ page }) => registerChallenge({ runJobId: 502, userId: 7, jobId: "a186-timeout", page, timeoutMs: 4000 }),
    });
    assert.equal(result.status, "held_gate", "the gate path: a packet is built and Open & fill finishes it");
    assert.equal(result.reasonCode, "captcha_required");
    assert.equal(result.submitEvidence, "captcha_timeout");
    assert.equal(liveSessionsOf(7).length, 0);
  } finally { server.close(); _resetLiveChallenges(); }
});

test("a186: no solver, evasion or 'undetected' library in any dependency list", () => {
  const banned = /captcha|buster|ddddocr|botright|ohmycaptcha|undetected|stealth|2captcha|anticaptcha|capsolver|nopecha/i;
  for (const f of ["package.json", "client/package.json", "packages/ats-scorer/package.json"]) {
    if (!fs.existsSync(f)) continue;
    const pj = JSON.parse(fs.readFileSync(f, "utf8"));
    const deps = Object.keys({ ...pj.dependencies, ...pj.devDependencies, ...pj.optionalDependencies });
    assert.deepEqual(deps.filter(d => banned.test(d)), [], f);
  }
  const src = fs.readFileSync("services/liveChallenge.js", "utf8");
  assert.doesNotMatch(src, /solve\(|captchaToken|g-recaptcha-response/i, "the live view only streams pixels and forwards the person's input");
});
