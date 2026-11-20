// ⭐ D194 (owner 11-14) · THE DECK, PLAYED — Watch (animated, narrated by the browser's own SpeechSynthesis, captions always
// on) and Read (animated, timed captions). Cards is DeckPage's static deck, unchanged. The script IS the deck's text
// (deckPlay.js): no model, no service, no network. Never starts with sound (the person unmutes); Reduce motion → points
// appear at once; keyboard: space play / pause, ← → skip, 1–4 speed; a phone plays it full screen and a swipe skips.
import { useEffect, useReducer, useRef } from "react";
import DepthButton from "../../components/DepthButton.jsx";
import { SPEEDS, initialState, step, keyAction, revealAt, holdMs, progressLine, pointOf } from "./deckPlay.js";
import { narrationVoice } from "../../lib/narrationVoice.js";

const speechOk = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";

export default function DeckPlay({ deck, mode, onMode, renderCheck }) {
  const [s, dispatch] = useReducer(step, { deck, mode }, ({ deck: d, mode: m }) => initialState(d, { mode: m }));
  const root = useRef(null);
  useEffect(() => { dispatch({ type: "mode", mode }); }, [mode]);
  const beat = s.beats[s.at];
  const view = revealAt(s.beats, s.at);
  const slide = deck.slides[view.slide];
  const speaking = s.mode === "watch" && !s.muted && speechOk();

  // One beat at a time: the voice's onend (Watch, unmuted) or the hold (Read, or Watch muted) moves to the next.
  // A token guards against a cancelled utterance's late `end` (cancel fires it in some browsers).
  useEffect(() => {
    if (!s.playing || !beat) return undefined;
    let live = true;
    const done = () => { if (live) dispatch({ type: "ended" }); };
    if (speaking) {
      const u = new window.SpeechSynthesisUtterance(beat.speech);
      u.rate = s.speed;
      const v = narrationVoice();
      if (v) u.voice = v;
      u.onend = done; u.onerror = done;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return () => { live = false; window.speechSynthesis.cancel(); };
    }
    const t = setTimeout(done, holdMs(beat, s.speed));
    return () => { live = false; clearTimeout(t); };
  }, [s.playing, s.at, s.speed, speaking, beat]);
  useEffect(() => () => { if (speechOk()) window.speechSynthesis.cancel(); }, []);

  const onKey = (e) => {
    if (e.target.closest?.("button, input, select, textarea") && e.key === " ") return;   // a focused control takes its own space
    const a = keyAction(e.key);
    if (a) { e.preventDefault(); dispatch(a); }
  };
  const touch = useRef(null);
  const onTouchStart = (e) => { touch.current = e.touches?.[0]?.clientX ?? null; };
  const onTouchEnd = (e) => {
    const x0 = touch.current, x1 = e.changedTouches?.[0]?.clientX;
    touch.current = null;
    if (x0 == null || x1 == null || Math.abs(x1 - x0) < 40) return;
    dispatch({ type: x1 < x0 ? "next" : "prev" });
  };

  const points = slide.points || [];
  const last = view.slide === deck.slides.length - 1;
  const pct = s.beats.length > 1 ? Math.round((s.at / (s.beats.length - 1)) * 100) : 100;
  return (
    <section ref={root} className="lib-play" data-deck-play={s.mode} data-playing={s.playing ? "" : undefined} data-beat={s.at}
      tabIndex={0} onKeyDown={onKey} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      aria-label={`${deck.title}, played. Space plays or pauses; the arrow keys skip; 1 to 4 set the speed.`}>
      <div className="lib-play__stage">
        {last ? <div className="lib-play__check" data-play-check="">{renderCheck()}</div> : (<>
          <p className="lib-slide__top"><span className="lib-slide__tag">{slide.tag}</span><span className="lib-slide__crumb">{deck.title}</span></p>
          <h2 className="atl__title lib-slide__title lib-play__in" key={`t${view.slide}`}>{slide.title}</h2>
          <ul className="lib-slide__points">
            {points.map((raw, j) => {
              const p = pointOf(raw);
              return <li key={`${view.slide}-${j}`} data-point-shown={j < view.shown ? "" : undefined}
                className={`lib-play__pt lib-play__pt--${p.animateAs}${j < view.shown ? " is-in" : ""}`} aria-hidden={j < view.shown ? undefined : "true"}>{p.text}</li>;
            })}
          </ul>
        </>)}
      </div>
      <p className="lib-play__cap" aria-live="polite" data-deck-caption="">{beat?.caption}</p>
      <div className="lib-play__bar" role="toolbar" aria-label="Deck controls">
        <DepthButton size="compact" onClick={() => dispatch({ type: "prev" })} aria-label="Previous point" data-play-prev="">⏪</DepthButton>
        <DepthButton size="compact" primary onClick={() => dispatch({ type: "toggle" })} aria-label={s.playing ? "Pause" : "Play"} data-play-toggle="">{s.playing ? "⏸ Pause" : "▶ Play"}</DepthButton>
        <DepthButton size="compact" onClick={() => dispatch({ type: "next" })} aria-label="Next point" data-play-next="">⏩</DepthButton>
        {s.mode === "watch" && (speechOk()
          ? <DepthButton size="compact" pressed={!s.muted} onClick={() => dispatch({ type: "mute" })} data-play-mute={s.muted ? "muted" : "on"}>{s.muted ? "🔇 Sound off" : "🔊 Sound on"}</DepthButton>
          : <span className="atl__quiet" data-play-no-speech="">This browser can't read aloud — the captions play instead.</span>)}
        <span className="lib-play__speeds" role="group" aria-label="Speed">
          {SPEEDS.map(v => <DepthButton key={v} size="compact" pressed={s.speed === v} onClick={() => dispatch({ type: "speed", speed: v })} data-play-speed={v}>{v}×</DepthButton>)}
        </span>
        {/* a phone: the reel covers the page, so its own Watch / Read switch and ✕ Cards (hidden on a wide screen — the page's toggle is there) */}
        {s.mode === "read" && <DepthButton size="compact" className="lib-play__exit" onClick={() => onMode("watch")} data-play-mode-switch="watch">Watch</DepthButton>}
        {s.mode === "watch" && <DepthButton size="compact" className="lib-play__exit" onClick={() => onMode("read")} data-play-mode-switch="read">Read</DepthButton>}
        <DepthButton size="compact" className="lib-play__exit" onClick={() => onMode("cards")} data-play-exit="">✕ Cards</DepthButton>
        <span className="lib-play__prog" data-play-progress="">
          <span className="lib-play__track" aria-hidden="true"><span className="lib-play__fill" style={{ width: `${pct}%` }} /></span>
          <span className="atl__quiet">{progressLine(s)}</span>
        </span>
      </div>
    </section>
  );
}
