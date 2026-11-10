// ⭐ A180 (owner 11-10: "job-boards.greenhouse.io is behind an identity check") · production 21:33Z logged both Greenhouse
// holds as `captcha_required — visible iframe[src*="/recaptcha/"] 256x60`: invisible reCAPTCHA's BADGE ("protected by
// reCAPTCHA", 256x60, …/anchor?…&size=invisible), drawn in the corner — bot scoring no visitor interacts with. AE1 had
// already ruled the same frame out when HIDDEN; rendered, it still is not a challenge. The checkbox and the image frame are.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyGateEvidence, isInvisibleCaptchaBadge } from "../services/applyAutomation.js";

const ev = (c) => ({ challenges: [c], configured: [], credentials: [] });
const SEL = 'iframe[src*="/recaptcha/"]';
const anchor = (q, w, h) => ({ selector: SEL, tag: "iframe", visible: true, why: "rendered", w, h,
  src: `https://www.recaptcha.net/recaptcha/api2/anchor?ar=1&k=6LeFb_YUAAAAAA&co=aHR0cHM6&hl=en&v=abc${q}` });

test("a180CheckKindDetected: the rendered invisible-reCAPTCHA badge is NOT a gate", () => {
  const badge = anchor("&size=invisible&cb=x", 256, 60);
  assert.equal(isInvisibleCaptchaBadge(badge), true);
  assert.equal(classifyGateEvidence(ev(badge), "https://job-boards.greenhouse.io/acme/jobs/1").gate, null);
  // its URL cut before size= (the probe kept 160 characters until A180): the badge's own box decides
  assert.equal(classifyGateEvidence(ev(anchor("", 256, 60)), "u").gate, null);
});

test("a180CheckKindDetected: a challenge a person must answer still is one", () => {
  assert.equal(classifyGateEvidence(ev(anchor("&size=normal", 304, 78)), "u").gate, "captcha_required", "the checkbox");
  const bframe = { selector: SEL, tag: "iframe", visible: true, why: "rendered", w: 400, h: 580,
    src: "https://www.google.com/recaptcha/api2/bframe?hl=en&v=abc&k=6LeFb_YUAAAAAA" };
  assert.equal(classifyGateEvidence(ev(bframe), "u").gate, "captcha_required", "the image challenge");
  const hcaptcha = { selector: 'iframe[src*="hcaptcha.com"]', tag: "iframe", visible: true, why: "rendered", w: 303, h: 78,
    src: "https://newassets.hcaptcha.com/captcha/v1/abc/static/hcaptcha.html#frame=checkbox" };
  assert.equal(classifyGateEvidence(ev(hcaptcha), "u").gate, "captcha_required");
});

test("a180: the probe keeps enough of a frame's URL to see size=invisible; the log names the badge", () => {
  const src = fs.readFileSync("services/applyAutomation.js", "utf8");
  assert.match(src, /src: \(el\.getAttribute\('src'\) \|\| ''\)\.slice\(0, 400\),/);
  assert.match(src, /why: 'invisible_captcha_badge'/);
  assert.doesNotMatch(src, /\x08/, "no stray control character in the source");
});
