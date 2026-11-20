// ⭐ D194 (2) · Customise → NARRATION VOICE. Its own section, not Appearance: the theme picker's "no dropdown" rule
// (docs/THEME_MODULE.md §6) is about the four theme cards; a voice is one of this device's installed voices, which can be
// dozens, so it is a list to pick from.
import { useEffect, useState } from "react";
import SettingsSection from "./SettingsSection.jsx";
import { ts } from "../themes/shapes.js";
import { listVoices, chosenVoiceName, chooseVoice, voicesOk } from "../lib/narrationVoice.js";

/**
 * ⭐ D194 (2) · NARRATION VOICE — the voice a played deck (Library → a deck → Watch) reads in: one of THIS device's installed
 * voices (the browser lists them; nothing is fetched or sent). Kept in this browser, since another device has other voices.
 */
export function NarrationSection() {
  const [voices, setVoices] = useState(() => listVoices());
  const [name, setName] = useState(() => chosenVoiceName());
  useEffect(() => {
    if (!voicesOk()) return undefined;
    const load = () => setVoices(listVoices());
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    load();
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, []);
  return (
    <SettingsSection title="Narration voice" subtitle="The voice that reads a deck aloud in Watch. One of this device's own voices — kept in this browser.">
      {!voicesOk() ? <p style={{ margin: 0, fontSize: ts(13), color: "var(--c-ink-faint)" }} data-narration-none="">This browser can't read aloud. Decks play with captions instead.</p> : (
        <label style={{ display: "grid", gap: 6, fontSize: ts(13), color: "var(--c-ink)" }}>
          Voice
          <select value={name} data-narration-voice="" onChange={(e) => { setName(e.target.value); chooseVoice(e.target.value); }}
            style={{ font: "inherit", padding: "6px 8px", borderRadius: 8, border: "1px solid var(--c-border-strong)", background: "var(--c-surface-solid)", color: "var(--c-ink)" }}>
            <option value="">The system's default for this language</option>
            {voices.map((v) => <option key={v.name} value={v.name}>{v.name} · {v.lang}</option>)}
          </select>
        </label>
      )}
    </SettingsSection>
  );
}
