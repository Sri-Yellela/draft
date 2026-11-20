// ⭐ D194 (2) · THE NARRATION VOICE — one of the system's own installed voices (the browser lists them; nothing is fetched).
// Chosen in Customise → Narration voice and kept in THIS browser: the voices are this device's, so the choice can't follow
// the account to another one. No choice → a sensible default: the system's default voice for the page's language, else
// any voice in that language, else the first.
const KEY = "draft.narrationVoice";

export const voicesOk = () => typeof window !== "undefined" && "speechSynthesis" in window;
export function listVoices() { try { return voicesOk() ? window.speechSynthesis.getVoices() : []; } catch { return []; } }

export function chosenVoiceName() { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } }
export function chooseVoice(name) { try { if (name) localStorage.setItem(KEY, name); else localStorage.removeItem(KEY); } catch { /* private mode */ } }

/** PURE. The voice to use from a list: the chosen one if installed, else the default for `lang`. */
export function pickVoice(voices, chosen, lang = "en") {
  if (!voices?.length) return null;
  const want = voices.find(v => v.name === chosen);
  if (want) return want;
  const base = String(lang || "en").toLowerCase().split("-")[0];
  const inLang = voices.filter(v => String(v.lang || "").toLowerCase().startsWith(base));
  return inLang.find(v => v.default) || inLang[0] || voices.find(v => v.default) || voices[0];
}

export function narrationVoice() {
  return pickVoice(listVoices(), chosenVoiceName(), typeof navigator !== "undefined" ? navigator.language : "en");
}
