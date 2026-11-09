// ⭐ D167 · THE SITE'S MAP — THE DOCK (owner 11-06; home-sketch.html updated 11-06). Six places — /d → /draft (the jobs) ·
// Home · Atlas · Interview (a microphone) · Profile (the picture) · a thin divider · Ask draft (a speech bubble) — with
// NAMES ONLY (the descriptions under the names removed). The /d mark draws out into /draft; THE DOCK'S MOTION: every icon
// centred in the rail, only width / transform / clip-path / opacity animate, the names fade + slide in after 0.1 s, the
// logo never changes size ("raft" uncovered by clip-path while the mark slides, 0.38 s cubic-bezier(.22,1,.36,1)), the
// reduced motion instant. ⭐ THE DOCK GOES WHERE THE SPACE IS (owner 11-06, supersedes "the page moves over"): a SIDE dock
// only when the left margin fits it open with 24 px each side, centred in it and growing evenly from its centre; otherwise
// TOP, one centred row with icons and names and equal gaps above and below; PHONES at the top, icons only. It never
// pushes the page; the peek opens beside a side dock and below a top one. Ask draft opens a panel
// that moves the page over, never on top of it (the assistant is not built: the panel says so). THE PROFILE QUICK PEEK:
// a press on the picture (or ≈ 350 ms resting on it) opens a small Dusk menu beside the dock; Esc, a press outside or
// leaving it closes it; it never covers the dock.
// The real-Chrome tests read `scripts/fidelityShots.mjs --styles dock167` (a SIDE dock at 2560: motion ON, and reduced
// motion at "rm"), which drives a real pointer and writes docs/fidelity-shots/dock167-{rest,open,peek,ask}-<size>.png, and
// `--styles dock167place` (where the dock goes at 1280 · 1440 · 1920 · 2560 · 390, and on a resize).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const NAV = read("client/src/components/AppNav.jsx");
const CSS = read("client/src/components/AppNav.css");
const MARK = read("client/src/components/DraftMark.jsx");
const TOP = read("client/src/components/TopBar.jsx");
const SIZES = ["2560", "rm"];
const MOTION = ["2560"];

const probes = {};
function run(t, screen) {
  if (!(screen in probes)) {
    probes[screen] = JSON.parse(execFileSync(process.execPath, ["scripts/fidelityShots.mjs", "--styles", screen],
      { encoding: "utf8", timeout: 280000, stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());
  }
  if (probes[screen].skipped) { t.skip(probes[screen].skipped); return null; }
  return probes[screen];
}
const measured = (t) => run(t, "dock167");
const placed = (t) => run(t, "dock167place");
const dockRules = () => CSS.slice(at(CSS, "/* The rail: 60 px wide at rest"), at(CSS, "/* ⭐ D167: the thin divider before Ask draft. */"));

// ── pure ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test("d167DockSixPlaces (pure): the six places in order, the divider before Ask draft, Interview links to /interview", () => {
  assert.match(NAV, /export const DOCK_PLACES = Object\.freeze\(\["today", "auto-apply", "atlas", "interview", "profile", "ask"\]\);/);
  // ⭐ D180 P1 (45o, on purpose): + Network — drawn only while the network switch is on (placesOf's `network`); off by default.
  assert.match(NAV, /export const DOCK_NAMES = Object\.freeze\(\{ today: "draft", "auto-apply" : "Home", atlas: "Atlas", interview: "Interview", network: "Network" \}\);/);
  assert.match(NAV, /export const INTERVIEW_PATH = "\/app\/interview";/);
  assert.match(NAV, /const ICONS = \{ atlas: \(\) => <GlobeIcon \/>, "auto-apply" : \(\) => <HouseIcon \/>, interview: \(\) => <MicIcon \/>, network: \(\) => <PeopleIcon \/> \};/);
  const dock = NAV.slice(at(NAV, '<nav aria-label="Main"'), at(NAV, "</nav>", at(NAV, '<nav aria-label="Main"')));
  const order = ["<NavItems", "<ProfileItem", '<span className="appnav-sep"', "<AskItem"].map((s) => at(dock, s));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "tabs · Profile · divider · Ask draft");
  assert.match(NAV, /<rect x="9" y="3\.5" width="6" height="11" rx="3" \/>/, "the microphone");
  assert.match(NAV, /M4\.5 6\.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4\.5 3\.5v-3\.5h-\.5a2 2 0 0 1-2-2z/, "the speech bubble");
});

test("d167NoDescriptionsUnderNames (pure): no plain line in the dock or the Menu's panel", () => {
  const dockAndMenu = NAV.slice(0, at(NAV, "export function ProfilePeek("));   // (the peek's own <small> asides are not names' lines)
  assert.doesNotMatch(dockAndMenu, /NAV_PLAIN|appnav-plain|<small/, "the descriptions under the names are removed");
  assert.doesNotMatch(NAV, /you and your résumé|today's picks and every job|your dashboard and applications/);
});

test("d167DraftMarkDrawsOut (pure): the whole wordmark set once; raft uncovered by clip-path while the mark slides; reduced motion instant", () => {
  assert.match(MARK, /\/d\{drawOut && <span data-draft-raft="">raft<\/span>\}/);
  assert.match(NAV, /<DraftMark drawOut \/>/);
  assert.match(CSS, /\.appnav-ico--mark \[data-draft-mark\] \{\n  display: inline-block; white-space: nowrap; line-height: var\(--appnav-ico\);\n  transform: translateX\(calc\(var\(--appnav-raft-w, 0px\) \/ 2\)\); transition: transform \.38s cubic-bezier\(\.22, 1, \.36, 1\);/);
  assert.match(CSS, /\.appnav-ico--mark \[data-draft-raft\] \{\n  display: inline-block; clip-path: inset\(-\.3em 100% -\.3em 0\); transition: clip-path \.38s cubic-bezier\(\.22, 1, \.36, 1\);/);
  assert.match(CSS, /\[data-open="true"\] \.appnav-ico--mark \[data-draft-raft\] \{ clip-path: inset\(-\.3em -\.3em -\.3em -\.3em\); \}/);
  const rm = CSS.slice(at(CSS, "@media (prefers-reduced-motion: reduce) {"));
  for (const sel of [".appnav-ico--mark [data-draft-mark]", ".appnav-ico--mark [data-draft-raft]", ".appnav-dock[data-nav-dock]", ".appnav-peek", ".appnav-ask"]) assert.ok(rm.includes(sel), sel);
});

test("d167DockAnimatesOnlyTransformClipOpacityWidth (pure): every transition in the dock's rules", () => {
  // (the commas inside cubic-bezier(…) are not property separators)
  const props = [...dockRules().matchAll(/transition:\s*([^;]+);/g)].flatMap((m) => m[1].replace(/\([^)]*\)/g, "").split(",").map((p) => p.trim().split(/\s+/)[0]));
  assert.ok(props.length >= 6, props.join(" "));
  for (const p of props) assert.ok(["width", "transform", "clip-path", "opacity", "none", "padding-right"].includes(p), `the dock animates ${p}`);
  // padding-right is the PAGE's move for Ask draft ([data-app-shell]), not the dock's
  const dockOnly = dockRules().split("\n").filter((l) => !l.includes("[data-app-shell]")).join("\n");
  assert.doesNotMatch(dockOnly, /transition:[^;]*padding/);
  assert.match(CSS, /\[data-open="true"\] \.appnav-words \{\n  opacity: 1; transform: none; transition: opacity \.22s ease \.1s, transform \.3s cubic-bezier\(\.22, 1, \.36, 1\) \.1s;/, "names after 0.1 s");
});

test("d167DockSideOnlyWhenMarginFitsOpen (pure) / d167AskDraftPushesNeverOverlays (pure): the place is measured; nothing pushes sideways", async () => {
  const { dockPlace, DOCK_OPEN_PX, DOCK_GAP_PX } = await import("../client/src/components/dockPlace.js");
  assert.equal(DOCK_OPEN_PX + 2 * DOCK_GAP_PX, 244);
  assert.equal(dockPlace({ vw: 2560, contentLeft: 440 }), "side");
  assert.equal(dockPlace({ vw: 1920, contentLeft: 244 }), "side", "exactly room for it open, with both gaps");
  assert.equal(dockPlace({ vw: 1920, contentLeft: 243 }), "top");
  assert.equal(dockPlace({ vw: 1280, contentLeft: 24 }), "top");
  assert.equal(dockPlace({ vw: 600, contentLeft: 400 }), "phone", "phones always at the top");
  assert.doesNotMatch(CSS + NAV, /data-dock-push|--appnav-rail-w/, "the push is gone");
  assert.match(NAV, /window\.addEventListener\("resize", schedule\);/, "re-placed on every resize");
  assert.match(CSS, /:root\[data-ask-open="true"\] \[data-app-shell\] \{ padding-right: var\(--appnav-ask-w\); \}/);
  assert.match(NAV, /data-ask-draft-stub=""/, "the assistant is not built: the panel says so");
});

test("d167ProfilePeekBasics (pure): the peek's items link to Profile's panels; the switch is the auto-apply mode", () => {
  // ⭐ A151 (45o, on purpose): "about" is the NAME's link now (ABOUT_HREF), not a separate About you row.
  for (const id of ["answers", "connections", "appearance", "notifications"]) assert.ok(NAV.includes(`link("${id}", `), id);   // A140: résumés merged into about
  assert.match(NAV, /<a href={ABOUT_HREF} className="appnav-peek__name"/);
  assert.match(NAV, /export const profileHref = \(panel\) => \(panel \? `\/app\/profile\/\$\{panel\}` : "\/app\/profile"\);/);
  assert.match(NAV, /const \{ runBar, setApplyMode, holdBusy \} = useAutoApply\(\);/);
  assert.match(NAV, /onClick=\{\(\) => \{ if \(fullAuto\) setApplyMode\?\.\("semi"\); \}\}>Ask me first<\/button>/);
  assert.match(NAV, /onClick=\{mode\.selectable \? \(\) => \{ if \(!fullAuto\) setApplyMode\?\.\("auto"\); \} : undefined\}>Apply for me<\/button>/);
  assert.match(TOP, /email: user\.email \|\| "", onSignOut: onLogout/);
  assert.doesNotMatch(CSS.slice(at(CSS, "THE PROFILE QUICK PEEK")), /999px|border-radius: 50%;[^}]*(button|seg)/, "no pills");
});

// ── real Chrome ───────────────────────────────────────────────────────────────────────────────────────────────────
test("d167DockSixPlaces / d167NoDescriptionsUnderNames (real Chrome): six places, names only", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SIZES) {
    const r = out[s].dock.rest;
    // 45n (pin brought to the code in 45o): the dock's search icon comes first.
    assert.deepEqual(r.places, ["search", "today", "auto-apply", "atlas", "interview", "profile", "|", "ask"], s);
    assert.deepEqual(r.labels, ["Search", "draft", "Home", "Atlas", "Interview", "Profile", "Ask draft"], s);
    assert.deepEqual(r.names, ["Search", "Home", "Atlas", "Interview", "Profile", "Ask draft"], `${s}: the jobs' name is the wordmark itself`);
    assert.equal(r.smalls, 0, `${s}: no description under a name`);
  }
});

test("d167DockIconsCentred (real Chrome): every icon's middle is the rail's middle, at rest and open", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SIZES) {
    const d = out[s].dock, mid = d.rest.railMid;
    for (const ic of d.rest.icons) { assert.ok(Math.abs(ic.mid - mid) <= 0.5, `${s} ${ic.id}: ${ic.mid} vs ${mid}`); assert.equal(ic.w, 30); assert.equal(ic.h, 30); }
    // ⭐ D167 (the dock goes where the space is): a side dock grows evenly from its centre, so its icons move left together
    // as it opens — one column, the same x for every icon.
    for (const m of d.openIcons) assert.ok(Math.abs(m - d.openIcons[0]) <= 0.5, `${s}: the icons stay one column open (${d.openIcons})`);
    const sd = d.rest.mark.slashD;
    assert.ok(Math.abs((sd.left + sd.right) / 2 - mid) <= 1.5, `${s}: "/d" centred at rest (${sd.left}–${sd.right} vs ${mid})`);
    const o = d.open, rail = d.openRail;
    const full = { left: o.slashD.left, right: o.slashD.left + o.width };
    assert.ok(Math.abs((full.left + full.right) / 2 - (rail.left + rail.right) / 2) <= 1.5, `${s}: "/draft" centred open`);
  }
});

test("d167LogoNeverResizes / d167DraftMarkDrawsOut (real Chrome): one size at rest, mid-motion and open; raft clipped then shown", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SIZES) {
    const d = out[s].dock;
    for (const m of [d.rest.mark, d.mid, d.open]) {
      assert.equal(m.text, "/draft", `${s}: the whole wordmark is always set`);
      assert.equal(m.fontSize, "19px"); assert.equal(m.width, d.rest.mark.width); assert.equal(m.height, d.rest.mark.height);
    }
    assert.match(d.rest.mark.raftClip, /^inset\(-5\.7px 100% -5\.7px 0px\)$/, `${s}: raft covered at rest`);
    assert.equal(d.open.raftClip, "inset(-5.7px)", `${s}: raft uncovered open`);
    assert.equal(d.rest.mark.transform, `matrix(1, 0, 0, 1, ${d.rest.mark.raftWidth / 2}, 0)`, `${s}: slid by half of raft`);
    assert.equal(d.open.transform, "matrix(1, 0, 0, 1, 0, 0)");
  }
  // with motion, 120 ms in: mid-slide, raft partly uncovered; with reduced motion: already open
  for (const s of MOTION) {
    const m = out[s].dock.mid;
    assert.notEqual(m.transform, out[s].dock.open.transform, `${s}: the slide is animated`);
    assert.notEqual(m.raftClip, out[s].dock.open.raftClip);
    assert.ok(out[s].dock.midWordsOpacity < 0.5, `${s}: the names wait 0.1 s (${out[s].dock.midWordsOpacity})`);
  }
  assert.equal(out.rm.dock.mid.transform, "matrix(1, 0, 0, 1, 0, 0)", "reduced motion: instant");
  assert.equal(out.rm.dock.midWordsOpacity, 1, "reduced motion: the names at once");
});

test("d167DockAnimatesOnlyTransformClipOpacityWidth (real Chrome): the computed transitions", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of MOTION) {
    const tr = out[s].dock.rest.transitions;
    assert.equal(tr.dock.property, "width"); assert.equal(tr.dock.duration, "0.38s");
    assert.equal(tr.item.property, "none");
    assert.equal(tr.words.property, "opacity, transform");
    assert.equal(tr.mark.property, "transform"); assert.equal(tr.mark.duration, "0.38s");
    assert.equal(tr.raft.property, "clip-path"); assert.equal(tr.raft.duration, "0.38s");
  }
  for (const [k, v] of Object.entries(out.rm.dock.rest.transitions)) assert.equal(v.property, "none", `reduced motion: ${k}`);
});

test("d167DockNeverPushes (real Chrome): a side dock opens into its margin — the page never moves", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SIZES) {
    const w = out[s].dock.push;
    assert.equal(w.push, null); assert.equal(w.shellPad, "0px");
    assert.equal(w.contentLeftOpen, w.contentLeftBefore, `${s}: nothing moves`);
    assert.ok(w.contentLeftBefore >= out[s].dock.openRail.right + 24 - 0.5, `${s}: the open dock keeps its gap to the content`);
  }
});

const PLACES = { "1280": "top", "1440": "top", "1920": "top", "2560": "side", phone: "phone" };
test("d167DockSideOnlyWhenMarginFitsOpen / d167DockTopCentredOtherwise / d167DockTopOnPhones (real Chrome): the place at each width", { timeout: 300000 }, (t) => {
  const out = placed(t); if (!out) return;
  for (const [s, want] of Object.entries(PLACES)) {
    const r = out[s].node.rest;
    assert.equal(r.place, want, `${s}: ${r.place}`);
    assert.equal(r.shellPadLeft, "0px", `${s}: never pads the page sideways`);
    assert.ok(r.scrollW <= r.vw, `${s}: no sideways scroll`);
    const mid = (r.dock.left + r.dock.right) / 2;
    if (want === "side") {
      assert.ok(r.content.left >= 244, `${s}: the margin fits it open`);
      assert.ok(Math.abs(mid - r.content.left / 2) <= 1, `${s}: centred in the margin (${mid} vs ${r.content.left / 2})`);
      const o = out[s].node.open.dock;
      assert.ok(Math.abs((o.left + o.right) / 2 - mid) <= 1, `${s}: opens evenly from its centre`);
      assert.ok(Math.abs(o.left - (r.content.left - o.right)) <= 2, `${s}: equal gaps open (${o.left} / ${r.content.left - o.right})`);
    } else {
      assert.ok(Math.abs(mid - r.vw / 2) <= 1, `${s}: centred at the top (${mid} vs ${r.vw / 2})`);
      if (want === "top") { assert.equal(r.namesShown.length, 6, `${s}: icons and names (45n: + Search)`); assert.equal(r.raftShown, true, `${s}: the whole /draft`); }
      else { assert.equal(r.namesShown.length, 0, "phone: icons only"); assert.equal(r.raftShown, false, "phone: the short /d"); }
    }
  }
});

test("d167DockEqualGaps (real Chrome): a top dock's gap above equals its gap to the content (within 2 px)", { timeout: 300000 }, (t) => {
  const out = placed(t); if (!out) return;
  for (const s of ["1280", "1440", "1920", "phone"]) {
    const r = out[s].node.rest;
    assert.ok(Math.abs(r.dock.top - (r.content.top - r.dock.bottom)) <= 2, `${s}: ${r.dock.top} above, ${r.content.top - r.dock.bottom} below`);
  }
});

test("d167DockReplacesOnResize / d167PeekFollowsDock (real Chrome)", { timeout: 300000 }, (t) => {
  const out = placed(t); if (!out) return;
  assert.equal(out["1280"].node.resized.place, "side", "1280 → 2560: to the side");
  assert.equal(out["1920"].node.resized.place, "top", "1920 → 1280: to the top");
  const side = out["2560"].node.peek, top = out["1280"].node.peek;
  assert.equal(side.open, "true"); assert.ok(side.left >= side.dockRight + 8, "beside a side dock");
  assert.equal(top.open, "true"); assert.ok(top.top >= top.dockBottom + 8, "below a top dock");
});

test("d167AskDraftPushesNeverOverlays (real Chrome): the panel on the right and the page beside it", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SIZES) {
    const a = out[s].dock.ask;
    assert.equal(a.open, "true"); assert.equal(a.html, "true"); assert.equal(a.stub, true);
    assert.equal(a.right, a.vw, `${s}: on the right edge`);
    assert.equal(a.shellPadRight, `${a.vw - a.left}px`, `${s}: the shell is padded by the panel`);
    assert.ok(a.contentRight <= a.left + 0.5, `${s}: the page ends where the panel starts (${a.contentRight} vs ${a.left})`);
    assert.equal(out[s].dock.askAfterEsc.open, "false"); assert.equal(out[s].dock.askAfterEsc.pad, "0px");
  }
});

test("d167ProfilePeekBasics (real Chrome): beside the dock, the person, the links, the mode, Open Profile in the accent, Sign out", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SIZES) {
    const d = out[s].dock, p = d.peekRest;
    assert.equal(d.peekAt150, "false", `${s}: a pass over the picture does not open it`);
    assert.equal(p.open, "true", `${s}: resting ≈ 350 ms opens it`);
    assert.equal(p.dockOpen, "true");
    assert.ok(p.left >= p.dockRight + 8, `${s}: never covers the dock (${p.left} vs ${p.dockRight})`);
    assert.equal(p.name, "Ada Lovelace"); assert.equal(p.email, "ada@example.invalid");
    // ⭐ A151 (45o, on purpose): the name opens About (#profile-about) — the separate "About you" link is gone.
    assert.deepEqual(p.links.map(([, h]) => h), ["/app/profile/about#profile-about", ...["answers", "connections", "appearance", "notifications"].map((x) => `/app/profile/${x}`), "/app/profile"]);
    assert.deepEqual(p.links.map(([l]) => l), ["Ada Lovelace", "Saved answers", "Connections", "AppearanceDusk", "Notifications", "Open Profile"]);
    assert.deepEqual(p.mode.map(([l, pr]) => [l, pr]), [["Ask me first", "true"], ["Apply for me", "false"]]);
    assert.deepEqual(d.modeAfterApplyForMe, ["false", "true"], `${s}: Apply for me sets the auto-apply mode (the server's answer)`);
    assert.equal(p.signOut, true);
    assert.equal(p.radius, "22px");
  }
});

test("d167PeekClosesEscOutsideLeave (real Chrome): leaving it, Esc, a press outside", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SIZES) {
    const d = out[s].dock;
    assert.equal(d.peekAfterLeave, "false", `${s}: leaving closes it`);
    assert.equal(d.peekAfterPress, "true", `${s}: a press opens it`);
    assert.equal(d.peekAfterEsc, "false", `${s}: Esc closes it`);
    assert.equal(d.peekAfterPress2, "true");
    assert.equal(d.peekAfterOutside, "false", `${s}: a press outside closes it`);
  }
});
