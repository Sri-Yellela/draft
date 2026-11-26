// ⭐ A151 (45o, owner 11-08) · "we should be able to click on our username to go to an about section, a seperate about you
// is not needed" — the name in the dock's profile peek and the username in the profile menu open /app/profile/about at the
// About box (#profile-about); the peek's "About you" link is gone.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("A151 · the name opens the About section; no separate About you link", () => {
  const nav = fs.readFileSync("client/src/components/AppNav.jsx", "utf8");
  assert.match(nav, /export const ABOUT_HREF = "\/app\/profile\/about#profile-about";/);
  assert.match(nav, /<a href=\{ABOUT_HREF\} className="appnav-peek__name" data-peek-name=""/);
  assert.doesNotMatch(nav, /link\("about", "About you"\)/);
  // ⛔ 47j w1-shell (changed on purpose): the profile menu's username link left with TopBar's ProfileMenuPanel (nothing
  // opened it since D197 #1) — the peek's name above is the one way in.
  const bar = fs.readFileSync("client/src/components/TopBar.jsx", "utf8");
  assert.doesNotMatch(bar, /function ProfileMenuPanel|data-username-about/);
  const sections = fs.readFileSync("client/src/components/ProfileSections.jsx", "utf8");
  assert.match(sections, /export const ABOUT_ANCHOR = "profile-about";/);
  assert.match(sections, /<Box id=\{ABOUT_ANCHOR\} title=\{titles\.summary \|\| "Summary"\}/);
  assert.match(sections, /window\.location\.hash !== `#\$\{ABOUT_ANCHOR\}`/, "arriving by the link scrolls to the box");
});
