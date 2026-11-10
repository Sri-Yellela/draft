// 46a (owner 11-10: "the 1.2$ came from local prod key and also the 13 cent haiku from the same key … need probing as to
// why local prod key was used"). WHY: server.js reads ANTHROPIC_KEY (server.js: const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY)
// and `import "dotenv/config"` loads the checkout's .env, whose ANTHROPIC_KEY is the owner's local key (label local-dev).
// Two harnesses that boot the real server blanked only ANTHROPIC_API_KEY — a name server.js never reads — so a local boot
// ran with the live local key. Every script that spawns server.js must blank ANTHROPIC_KEY AND keep .env out
// (DOTENV_CONFIG_PATH → a file that does not exist; verified: dotenv/config then sets no key).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

test("every script that boots server.js blanks ANTHROPIC_KEY and blocks .env", () => {
  const files = [...walk("scripts"), ...walk("test-support")].filter(f => /\.(m?js)$/.test(f));
  // 46c: any spawn of node whose argument list names server.js — scripts/scaleSuite.mjs puts "--import" flags first and
  // escaped the earlier `["server.js"` match (it blanked the key but loaded the rest of .env).
  const booting = files.filter(f => /spawn\(process\.execPath, \[[^;]{0,300}?"server\.js"/.test(fs.readFileSync(f, "utf8")));
  assert.ok(booting.some(f => /scaleSuite\.mjs$/.test(f)), "the scale suite boots the server too");
  assert.ok(booting.length >= 4, `found ${booting.length} server-booting scripts`);
  for (const f of booting) {
    const s = fs.readFileSync(f, "utf8");
    assert.match(s, /ANTHROPIC_KEY: ""/, `${f}: ANTHROPIC_KEY is the name server.js reads — blank it`);
    assert.match(s, /DOTENV_CONFIG_PATH: "/, `${f}: keep the checkout's .env (and its live local key) out`);
  }
  assert.match(fs.readFileSync("server.js", "utf8"), /const ANTHROPIC_KEY\s+= process\.env\.ANTHROPIC_KEY/, "the key's one name");
});
