// A46 (10-01): the Account page's sign-in methods said "Not linked", and the owner read it as an ATS
// integration status — which started a whole partnership investigation (A34). It means only that a
// Google, LinkedIn or GitHub sign-in is not connected. Say that.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("client/src/panels/AccountPanel.jsx", "utf8");

test("sign-in methods read Connected / Not connected — never 'linked', which reads as an integration", () => {
  assert.match(src, /methods\[p\] \? "Connected" : "Not connected"/);
  assert.doesNotMatch(src, /"(Not )?[Ll]inked"/);
});
