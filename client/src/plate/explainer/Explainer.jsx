// ⭐ D198 E1 · THE EXPLAINER — format A (concept), as canvas v4's *Explainer · Big O, acted out* (the oracle,
// docs/sketches/Atlas plate system v4.html). One frame (9:16, 405 × 720 base, scaled; or 16:9 for a lesson): the kicker
// and the /d mark whose slash turns one step a beat · the serif title on its label tape · the question line (a mono tag +
// one plain question) · ONE plate panel (the cost table; the beat's column lit, finished ones at 40 %) · captions = the
// voice, word by word (spoken ink, the keyword in the region colour, upcoming grey) · the small print · ten squares
// (past ink, now clay, ahead empty) · the controls. Overlays: the usual answer (ticket + stamp), where it runs (a survey
// ticket + the market's [N] openings), your turn (the register: the right answer goes green and LIT lands) and the saved
// card. The clock is explainerModel.js, so the export (E4) draws the same frame at the same time (`at`).
// Built from the library (A93 — built once): Stamp, LitSquares, Ticket's classes, plateState, usePlateMotion.
import { useEffect, useMemo, useRef, useState } from "react";
import { plateState } from "../PlateState.jsx";
import { Stamp, LitSquares } from "../Marks.jsx";
import { usePlateMotion } from "../motion.js";
import { frameAt, timeline, lengthMs, captionWords, progressSquares, columnStates, marketLine } from "./explainerModel.js";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** The /d mark with its turning slash (aria-hidden: the beat line says where we are). */
function TurnMark({ slash }) {
  return <span className="pl-xp__mark" aria-hidden="true"><span className="pl-xp__slash">{slash}</span>d</span>;
}

function CostTable({ plate, cols }) {
  return (
    <div className="pl-xp__plate" role="img" aria-label={`${plate.rows.length} structures, ${plate.columns.length} jobs: the cost of each`}>
      <div className="pl-xp__row pl-xp__row--head" aria-hidden="true">
        <span className="pl-xp__cell pl-xp__cell--name">STRUCTURE</span>
        {plate.columns.map((c) => <span key={c.id} className="pl-xp__cell" data-col={cols[c.id]}>{c.label}</span>)}
      </div>
      {plate.rows.map((r) => (
        <div key={r.id} className="pl-xp__row" aria-hidden="true">
          <span className="pl-xp__cell pl-xp__cell--name"><b>{r.label}</b><span className="pl-xp__sub">{r.sub}</span></span>
          {plate.columns.map((c) => {
            const cell = r.cells?.[c.id];
            const st = cols[c.id];
            return (
              <span key={c.id} className="pl-xp__cell" data-col={st} data-level={st !== "hidden" ? cell?.level : undefined}>
                {st !== "hidden" && cell ? <><span className="pl-xp__big">{cell.big}{cell.mark || ""}</span><span className="pl-xp__why">{cell.reason}</span></> : null}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Overlay({ beat, script, openings, picked, onPick }) {
  const o = beat?.overlay;
  if (!o) return null;
  if (o.kind === "usualAnswer") return (
    <div className="pl-xp__over" data-kind="usual">
      <div className="pl-ticket"><div className="pl-ticket__head"><span className="pl-label">THE USUAL ANSWER</span><span className="pl-ticket__title">“{o.answer}”</span></div></div>
      <Stamp rotate={-6}>{o.stamp}</Stamp>
    </div>
  );
  if (o.kind === "whereItRuns") {
    const line = marketLine(script, openings);
    return (
      <div className="pl-xp__over" data-kind="runs">
        <div className="pl-ticket"><div className="pl-ticket__head"><span className="pl-label">WHERE IT RUNS · TODAY</span>
          <span className="pl-ticket__title">{o.line}</span><span className="pl-ticket__line">{o.detail}</span></div>
          {line ? <><div aria-hidden="true" className="pl-tear"/><span className="pl-ticket__go">{line} <span className="pl-label">FROM THE MARKET</span></span></> : null}
        </div>
      </div>
    );
  }
  if (o.kind === "yourTurn") {
    const ck = script.check;
    const right = picked != null && picked === ck.answer;
    return (
      <div className="pl-xp__over" data-kind="turn">
        <span className="pl-label">REGISTER · ONE QUESTION</span>
        <p className="pl-xp__q">{ck.question}</p>
        <div className="pl-xp__opts" role="group" aria-label="Your answer">
          {ck.options.map((opt, k) => (
            <button key={opt} type="button" className="pl-btn pl-xp__opt" onClick={() => onPick(opt)} aria-pressed={picked === opt}
              data-right={picked != null && opt === ck.answer ? "yes" : undefined} data-wrong={picked === opt && opt !== ck.answer ? "yes" : undefined}>
              <span className="pl-label">{LETTERS[k]}</span> {opt}{picked != null && opt === ck.answer ? " ✓" : ""}
            </button>
          ))}
        </div>
        {right ? <Stamp tone="lit" rotate={-8}>LIT</Stamp> : null}
      </div>
    );
  }
  return null;   // savedCard: the plate itself, every column lit
}

/**
 * script = the explainer's script.json · aspect "9:16" | "16:9" · openings = the market's live count for realWorld.query
 * (none → the line is left out, never guessed) · at = a fixed time in ms (the export renders frames this way) ·
 * onAnswer(option, right) = the check was answered (the host lights a square).
 */
export function Explainer({ script, aspect = "9:16", openings = null, at = null, autoplay = false, onAnswer, ...s }) {
  const gate = plateState(s, { height: aspect === "9:16" ? 720 : 405, radius: "plate", label: "Loading the explainer" });
  const motion = usePlateMotion();
  const reduce = !motion;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!!autoplay);
  const [picked, setPicked] = useState(null);
  const last = useRef(null);
  const tl = useMemo(() => timeline(script), [script]);
  const total = useMemo(() => lengthMs(script), [script]);

  useEffect(() => {
    if (!playing || at != null) return undefined;
    let raf = 0;
    const step = (now) => {
      if (last.current == null) last.current = now;
      const dt = now - last.current; last.current = now;
      setT((v) => { const n = v + dt; if (n >= total) { setPlaying(false); return total; } return n; });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); last.current = null; };
  }, [playing, at, total]);

  if (gate) return gate;
  const now = at != null ? at : t;
  const f = frameAt(script, now, { reduce });
  const beat = script.beats[f.i];
  // paused at a beat's start the whole line shows (the sketch); playing (or a fixed `at`) it fills word by word
  const w = at == null && !playing && now <= tl[f.i].start ? f.n : f.w;
  const words = captionWords(beat.say, beat.keyword, w);
  const cols = columnStates(script, f.i);
  const goBeat = (k) => { setPlaying(false); setT(tl[Math.max(0, Math.min(tl.length - 1, k))].start); };
  const pick = (opt) => { if (picked != null) return; setPicked(opt); onAnswer?.(opt, opt === script.check?.answer); };
  const ended = !playing && now >= total;

  return (
    <section className="pl-xp" data-aspect={aspect} data-beat={f.i + 1} data-reduce={reduce ? "yes" : undefined}
      aria-label={`${script.title?.tape || script.title?.text}: an explainer`}>
      <div className="pl-xp__frame">
        <div className="pl-xp__top">
          <span className="pl-label">{script.kicker}</span>
          <TurnMark slash={f.slash}/>
        </div>
        <h2 className="pl-xp__title"><span className="pl-xp__tape">{script.title?.text}</span></h2>
        <p className="pl-xp__ask"><span className="pl-label">{beat.ask?.tag}</span> {beat.ask?.text}</p>
        <div className="pl-xp__stage" data-over={beat.overlay ? beat.overlay.kind : undefined}>
          <CostTable plate={script.plate} cols={cols}/>
          <Overlay beat={beat} script={script} openings={openings} picked={picked} onPick={pick}/>
        </div>
        <p className="pl-xp__captions" aria-live="off">
          {words.map((x, k) => (
            <span key={k} className="pl-xp__word" data-s={x.state} data-key={x.key ? "yes" : undefined} data-now={x.now && playing ? "yes" : undefined}>{x.t}</span>
          ))}
        </p>
        <p className="pl-sr">{beat.say}</p>
        <p className="pl-xp__small">{script.smallPrint}</p>
        <LitSquares squares={progressSquares(f.i, script.beats.length)} size={10} label={`Beat ${f.i + 1} of ${script.beats.length}: ${beat.name}`}/>
      </div>
      <div className="pl-xp__controls" role="group" aria-label="Explainer controls">
        <button type="button" className="pl-btn" onClick={() => goBeat(f.i - 1)} disabled={f.i === 0}>← Beat</button>
        <button type="button" className="pl-btn pl-btn--ink" onClick={() => { if (ended) { setT(0); setPlaying(true); } else setPlaying((p) => !p); }}>
          {playing ? "❚❚ Pause" : ended ? "↻ Play again" : "▶ Play"}
        </button>
        <button type="button" className="pl-btn" onClick={() => goBeat(f.i + 1)} disabled={f.i === script.beats.length - 1}>Beat →</button>
        <button type="button" className="pl-btn" onClick={() => { setT(0); setPicked(null); setPlaying(true); }}>Restart</button>
      </div>
      <ol className="pl-xp__beats" aria-label="The beats">
        {script.beats.map((b, k) => (
          <li key={k}><button type="button" className="pl-btn pl-xp__beat" aria-current={k === f.i ? "step" : undefined} onClick={() => goBeat(k)}>
            <span className="pl-label">{String(k + 1).padStart(2, "0")}</span> {b.name}
          </button></li>
        ))}
      </ol>
    </section>
  );
}
