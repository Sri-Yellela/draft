// ⭐ D194 (owner 11-14) · ANIMATED DECKS WITH NARRATION AND CAPTIONS — the PURE model of a deck played as a reel.
// A rendering mode, not new content: the deck's own slides and points ARE the script. No model writes or rewrites anything
// (D190); narration is the browser's SpeechSynthesis reading the point's text — or its optional `narration` speaker note,
// written by the deck's author. Three modes, one toggle: Watch (animated + narrated + captions), Read (animated + timed
// captions), Cards (the static deck, unchanged).
export const MODES = Object.freeze(["watch", "read", "cards"]);
export const SPEEDS = Object.freeze([0.75, 1, 1.25, 1.5]);
export const ANIMATIONS = Object.freeze(["fadeIn", "drawSvg", "typewriter", "none"]);
export const READ_MS_PER_POINT = 2500;    // the row's "≈ 2.5 s per point"
const MS_PER_WORD = 280;                   // a long point is given time to be read (≈ 215 words a minute)

/** A point as authored: a string, or { text, narration?, animateAs? } (D194 (5), both fields optional). */
export function pointOf(p) {
  if (p && typeof p === "object") {
    const text = String(p.text ?? "");
    const narration = typeof p.narration === "string" && p.narration.trim() ? p.narration.trim() : null;
    const animateAs = ANIMATIONS.includes(p.animateAs) ? p.animateAs : "fadeIn";
    return { text, narration, animateAs };
  }
  return { text: String(p ?? ""), narration: null, animateAs: "fadeIn" };
}

/**
 * The deck as beats, in play order. A slide's title is its first beat (said, then its points one at a time); the last
 * slide (the check) is one beat — the player stops there for the person to answer. Every beat carries its caption (what
 * shows) and its speech (what the voice says: the speaker note when there is one, else the caption).
 */
export function beatsOf(deck) {
  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  const out = [];
  slides.forEach((s, slide) => {
    const last = slide === slides.length - 1;
    out.push({ slide, point: -1, caption: String(s.title || ""), speech: String(s.title || ""), animateAs: "fadeIn", check: last });
    if (last) return;
    (s.points || []).forEach((raw, point) => {
      const p = pointOf(raw);
      out.push({ slide, point, caption: p.text, speech: p.narration || p.text, animateAs: p.animateAs, check: false });
    });
  });
  return out;
}

/** How long Read mode (or Watch while muted) holds a beat, at a speed. */
export function holdMs(beat, speed = 1) {
  const words = String(beat?.caption || "").split(/\s+/).filter(Boolean).length;
  const ms = Math.max(READ_MS_PER_POINT, words * MS_PER_WORD);
  return Math.round(ms / (SPEEDS.includes(speed) ? speed : 1));
}

/** What is revealed on screen at beat i: the current slide, and how many of its points show (one at a time). */
export function revealAt(beats, i) {
  const b = beats[Math.max(0, Math.min(i, beats.length - 1))];
  if (!b) return { slide: 0, shown: 0 };
  return { slide: b.slide, shown: b.point + 1 };
}

/** One step of the player's state. Pure: (state, action) → state. */
export function step(state, action) {
  const n = state.beats.length;
  const at = (i) => Math.max(0, Math.min(i, n - 1));
  switch (action.type) {
    case "play": return state.beats[state.at]?.check ? { ...state, at: 0, playing: n > 1 } : { ...state, playing: true };   // at the check: from the top
    case "pause": return { ...state, playing: false };
    case "toggle": return step(state, { type: state.playing ? "pause" : "play" });
    case "next": { const i = at(state.at + 1); return { ...state, at: i, playing: state.playing && !state.beats[i]?.check }; }
    case "prev": return { ...state, at: at(state.at - 1) };
    case "ended": {   // the beat's speech ended, or its hold ran out
      if (!state.playing) return state;
      const i = at(state.at + 1);
      return { ...state, at: i, playing: i !== state.at && !state.beats[i]?.check };
    }
    case "speed": return SPEEDS.includes(action.speed) ? { ...state, speed: action.speed } : state;
    // Choosing Watch or Read is the person's press: it plays (muted — the sound is theirs to turn on). Cards stops.
    case "mode": return MODES.includes(action.mode) ? { ...state, mode: action.mode, playing: action.mode !== "cards" && !state.beats[state.at]?.check } : state;
    case "mute": return { ...state, muted: action.muted ?? !state.muted };
    default: return state;
  }
}

/** The first state: Watch / Read play at once but never with sound (D194 (6)) — muted until the person unmutes. */
export function initialState(deck, { mode = "cards", speed = 1 } = {}) {
  const m = MODES.includes(mode) ? mode : "cards";
  return { beats: beatsOf(deck), at: 0, playing: m !== "cards", mode: m, speed: SPEEDS.includes(speed) ? speed : 1, muted: true };
}

/** The keyboard (D194 (4)): space play / pause · ← → skip · 1–4 speed. Returns an action or null. */
export function keyAction(key) {
  if (key === " " || key === "Spacebar") return { type: "toggle" };
  if (key === "ArrowRight") return { type: "next" };
  if (key === "ArrowLeft") return { type: "prev" };
  if (/^[1-4]$/.test(key)) return { type: "speed", speed: SPEEDS[Number(key) - 1] };
  return null;
}

/** The progress line: "point 3 of 8" across the whole deck. */
export function progressLine(state) {
  return `point ${Math.min(state.at + 1, state.beats.length)} of ${state.beats.length}`;
}
