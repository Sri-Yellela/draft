// ⭐ D191 sketch 2 (owner 11-18: "Ask at install", then "alright go") — the manifest's install-time hosts and its declared
// content scripts, pinned in ONE place for every test that used to pin "draft's own origin only". The six board families
// are autoRead.js SITES' origins (extension/MANIFEST_RATIONALE.md, Host permissions); the second script is the panel's
// arrival (extension/panelArrive.js — reads nothing, says "a page loaded").
import { OPTIONAL_ORIGINS } from "../extension/autoRead.js";

export const D191_BOARD_HOSTS = Object.freeze([...OPTIONAL_ORIGINS]);
export const D191_HOSTS = Object.freeze(["https://jobsviadraft.com/*", ...D191_BOARD_HOSTS]);
export const D191_CONTENT_SCRIPTS = Object.freeze([
  { matches: ["https://jobsviadraft.com/*"], js: ["boardBridge.js"], run_at: "document_start", all_frames: false },
  { matches: [...D191_BOARD_HOSTS], js: ["panelArrive.js"], run_at: "document_idle", all_frames: false },
]);
