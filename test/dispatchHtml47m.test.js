// ⭐ D197 Wave 2 #18 · M5 (47m) — the dispatches: every email's HTML part in the plate tokens, the plain text unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLATE_EMAIL, PLATE_EMAIL_VARS, EMAIL_PLATES, renderDispatch, kickerDate } from "../services/dispatchHtml.js";
import { eventEmail, eventEmailHtml, eventText, NOTIFY_EVENTS } from "../services/notify.js";
import { sendPasswordResetEmail, sendVerificationCodeEmail } from "../services/emailService.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = "https://example.com";

test("the email token map is plate.css's values (one map — a token change reaches the email or fails here)", () => {
  const css = fs.readFileSync(path.join(ROOT, "client/src/styles/plate.css"), "utf8");
  for (const [k, v] of Object.entries(PLATE_EMAIL_VARS)) {
    const m = css.match(new RegExp(`${v.replace(/-/g, "\\-")}:\\s*(#[0-9A-Fa-f]{6})\\s*;`));
    assert.ok(m, `${v} has a literal value in plate.css`);
    assert.equal(PLATE_EMAIL[k].toUpperCase(), m[1].toUpperCase(), `${k} = ${v}`);
  }
});

test("the three header plates exist as PNGs in the client's public folder", () => {
  for (const p of Object.values(EMAIL_PLATES)) {
    const f = path.join(ROOT, "client/public/email", p.file);
    assert.ok(fs.existsSync(f), p.file);
    assert.deepEqual([...fs.readFileSync(f).subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], `${p.file} is a PNG`);
    assert.ok(p.alt.length > 4, "alt text");
  }
});

test("a dispatch is email-safe: a 600 px presentation table, no SVG, no script, no capsule, light scheme, escaped words", () => {
  const html = renderDispatch({ kind: "ALERT", plate: "dispatch", appUrl: APP, title: "A <b>check</b>", lead: "x & y",
    action: { label: "Open in draft →", url: `${APP}/app` }, foot: ["foot"] });
  assert.match(html, /role="presentation"[^>]*width="600"/);
  assert.match(html, /name="color-scheme" content="light"/);
  assert.doesNotMatch(html, /<svg|<script|999px|border-radius:\s*50%/i);
  assert.match(html, /A &lt;b&gt;check&lt;\/b&gt;/);
  assert.match(html, /x &amp; y/);
  assert.match(html, /src="https:\/\/example\.com\/email\/plate-dispatch\.png"[^>]*alt="/);
  assert.doesNotMatch(renderDispatch({ title: "t", plate: "dispatch" }), /<img/, "no app URL → no image (never a relative src in an email)");
  assert.doesNotMatch(renderDispatch({ title: "t", action: { label: "x", url: "javascript:alert(1)" } }), /javascript:/);
  assert.equal(kickerDate(new Date(Date.UTC(2026, 10, 27))), "NOV 27");
});

test("one clay point per dispatch, green only for proven (the run summary's Sent)", () => {
  const html = eventEmailHtml("picks_summary", { sent: 4, waiting: 1, needYou: 0 }, APP);
  assert.equal((html.match(new RegExp(`bgcolor="${PLATE_EMAIL.clay}"`, "g")) || []).length, 1);
  assert.match(html, /plate-run-report\.png/);
  assert.match(html, new RegExp(`color:${PLATE_EMAIL.lit};">4<`));
  assert.match(html, /This run sent 4 applications\. 1 needs you\./);
});

test("every notify event has an HTML part carrying its own words; the plain text is unchanged", () => {
  for (const ev of Object.keys(NOTIFY_EVENTS)) {
    const data = { count: 2, items: [{ title: "Engineer", company: "Kestrel Payments", url: `${APP}/app/jobs?job=1`, apply: `${APP}/p/confirm/a`, pass: `${APP}/p/confirm/p`, of: 5, matched: 4, sponsor: true, ago: "2 hours ago" }],
      questions: ["Why us?"], answer: `${APP}/app/auto-apply`, sponsorFirst: true };
    const html = eventEmailHtml(ev, data, APP, NOTIFY_EVENTS[ev].url);
    assert.ok(html && html.includes("DISPATCH ·"), ev);
    if (!eventEmail(ev, data, APP)) assert.ok(html.includes(eventText(ev, data).body.replace(/'/g, "&#39;")), `${ev}: the in-app line`);
  }
  const digest = eventEmail("new_match", { items: [{ title: "E", company: "C", url: "u", of: 5, matched: 4, sponsor: true, ago: "1 hour ago" }], sponsorFirst: true }, APP);
  assert.equal(digest.text.split("\n")[0], "New jobs that fit your résumé — companies with an H-1B filing record first.");
  const h = eventEmailHtml("new_match", { items: [{ title: "E", company: "C", url: `${APP}/app/jobs?job=1`, of: 5, matched: 4, sponsor: true }], sponsorFirst: true }, APP);
  assert.match(h, /aria-label="4 of your 5 top skills"/);
  assert.match(h, /A filing record is history, not a promise/);
});

test("the account mail sends both parts; the text is today's", async () => {
  const sent = [];
  const fetchImpl = async (_u, o) => { sent.push(JSON.parse(o.body)); return { ok: true }; };
  const env = { RESEND_API_KEY: "test" };
  await sendPasswordResetEmail({ to: "a@example.com", resetUrl: `${APP}/login?resetToken=t`, otp: "123456", expiresAt: 1800000000 }, { fetchImpl, env });
  await sendVerificationCodeEmail({ to: "a@example.com", code: "654321" }, { fetchImpl, env });
  assert.match(sent[0].text, /^Use this one-time link to reset your Draft password:\n/);
  assert.match(sent[0].html, /123456/);
  assert.match(sent[0].html, /Reset your password →/);
  assert.equal(sent[1].text.split("\n")[2], "654321");
  assert.match(sent[1].html, /654321/);
});
