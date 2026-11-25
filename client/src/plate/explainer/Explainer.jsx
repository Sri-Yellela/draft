// ⭐ D198 E1 · THE EXPLAINER — format A (concept), as canvas v4's *Explainer · Big O, acted out* (the oracle,
// docs/sketches/Atlas plate system v4.html). One frame (9:16 at 405 × 720 — the board's own inner frame, which it scales
// into its column; or 16:9 for a lesson): the kicker and the /d mark whose slash turns one step a beat · the serif title
// with its key words on a Region III tape · the question line (the beat's tag + one plain question) · ONE plate panel
// (the cost table: each structure drawn small and acted on, the beat's column lit, finished ones at 40 %) · the small
// print under it · captions = the voice, word by word, in a card at the foot · ten squares (past ink, now clay, ahead
// empty) · the controls under the frame. The stage changes with the beat: the proof draws the tree and counts the steps;
// the usual answer and where it runs drop a ticket over the dimmed table; your turn is the register (the right answer goes
// green and LIT lands). The clock is explainerModel.js, so the export (E4) draws the same frame at the same time (`at`).
// 47h (F5): every size, colour and shape here is the board's, read from the export beat by beat — d198VisualDiffExplainer
// gates each beat at ≤ 2 % (scripts/d196Regress.mjs). Built from the library (A93 — built once): Stamp, LitSquares,
// plateState, usePlateMotion.
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

/** The title: its key words (title.tape) on the region's label tape, the rest after. */
function Title({ title }) {
  const text = String(title?.text || ""), tape = String(title?.tape || "");
  const rest = tape && text.startsWith(tape) ? text.slice(tape.length) : (tape ? ` ${text}` : text);
  return <h2 className="pl-xp__title">{tape ? <span className="pl-xp__tape">{tape}</span> : null}{rest}</h2>;
}

// ── each structure drawn small (80 × 20; the trees 80 × 22) — the shapes `lit` names fill with the ramp's III-3 ──
const TREE7 = [[40, 4], [24, 11], [56, 11], [48, 18], [64, 18], [16, 18], [32, 18]];
const HEAP6 = [[40, 4], [26, 11], [54, 11], [19, 18], [33, 18], [47, 18]];
function Picto({ kind, data = [], lit = [] }) {
  const on = (k) => (lit.includes(k) ? "yes" : undefined);
  if (kind === "array") return (
    <svg className="pl-xp__pic" aria-hidden="true" width="80" height="20" viewBox="0 0 80 20">
      {data.map((v, k) => <g key={k}><rect x={k * 13} y="2" width="12" height="14" rx="2" data-lit={on(k)}/><text x={k * 13 + 6} y="12.5" textAnchor="middle" fontSize="8">{v}</text></g>)}
    </svg>
  );
  if (kind === "list") return (
    <svg className="pl-xp__pic" aria-hidden="true" width="80" height="20" viewBox="0 0 80 20">
      {data.map((v, k) => <g key={k}><rect x={k * 19} y="3" width="12" height="12" rx="2" data-lit={on(k)}/><text x={k * 19 + 6} y="12" textAnchor="middle" fontSize="7.5">{v}</text>
        {k < data.length - 1 ? <path className="pl-xp__link" d={`M${k * 19 + 12} 9 L${k * 19 + 18} 9`}/> : null}</g>)}
    </svg>
  );
  if (kind === "stack") return (
    <svg className="pl-xp__pic" aria-hidden="true" width="80" height="20" viewBox="0 0 80 20">
      {[2, 6, 10, 14].map((y, k) => <rect key={k} x="20" y={y} width="34" height="3" rx="1.5" data-lit={on(k)}/>)}
    </svg>
  );
  if (kind === "queue") return (
    <svg className="pl-xp__pic" aria-hidden="true" width="80" height="20" viewBox="0 0 80 20">
      {[0, 1, 2, 3].map((k) => <rect key={k} x={k * 14} y="4" width="12" height="11" rx="1.5" data-lit={on(k)}/>)}
    </svg>
  );
  if (kind === "hash") return (
    <svg className="pl-xp__pic" aria-hidden="true" width="80" height="20" viewBox="0 0 80 20">
      {[6, 30, 54].map((x) => <path key={x} className="pl-xp__bucket" d={`M${x} 6 L${x} 18 L${x + 18} 18 L${x + 18} 6`}/>)}
      {lit.includes(0) ? <><rect x="30" y="0" width="18" height="9" rx="2" data-lit="yes"/><text x="39" y="7" textAnchor="middle" fontSize="6">cat</text></> : null}
    </svg>
  );
  const nodes = kind === "tree" ? TREE7 : kind === "heap" ? HEAP6 : null;
  if (!nodes) return null;
  const edges = kind === "tree" ? "M40 4 L24 11 M40 4 L56 11 M56 11 L48 18 M56 11 L64 18 M24 11 L16 18 M24 11 L32 18"
    : "M40 4 L26 11 M40 4 L54 11 M26 11 L19 18 M26 11 L33 18 M54 11 L47 18";
  return (
    <svg className="pl-xp__pic" aria-hidden="true" width="80" height="22" viewBox="0 0 80 22">
      <path className="pl-xp__edge" d={edges}/>
      {nodes.map(([cx, cy], k) => <circle key={k} cx={cx} cy={cy} r="3.6" data-lit={on(k)}/>)}
    </svg>
  );
}

function CostTable({ plate, cols, lit, dimmed }) {
  return (
    <div className="pl-xp__plate" data-dimmed={dimmed ? "yes" : undefined} role="img"
      aria-label={`${plate.rows.length} structures, ${plate.columns.length} jobs: the cost of each`}>
      <div className="pl-xp__head" aria-hidden="true">
        <span className="pl-xp__headname">STRUCTURE</span>
        {plate.columns.map((c) => <span key={c.id} className="pl-xp__headcol" data-col={cols[c.id]}>{c.label}</span>)}
      </div>
      {plate.rows.map((r) => (
        <div key={r.id} className="pl-xp__row" aria-hidden="true">
          <div className="pl-xp__name">
            <span className="pl-xp__label">{r.label}</span>
            <span className="pl-xp__sub">{r.sub}</span>
            <Picto kind={r.id} data={r.data} lit={lit?.[r.id] || []}/>
          </div>
          {plate.columns.map((c) => {
            const cell = r.cells?.[c.id];
            const st = cols[c.id];
            return (
              <div key={c.id} className="pl-xp__cell">
                {st !== "hidden" && cell ? (
                  <div className="pl-xp__cost" data-col={st}>
                    <span className="pl-xp__big" data-level={cell.level || "none"}>{cell.big}<span className="pl-xp__markup">{cell.mark || ""}</span></span>
                    <span className="pl-xp__why">{cell.reason}</span>
                  </div>
                ) : <div className="pl-xp__empty"/>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** The proof: the tree drawn with the search's path, and the two counts (the tree's steps against scanning all). */
const TREE_AT = [[160, 30], [90, 82], [230, 82], [55, 136], [125, 136], [195, 136], [265, 136]];
function Proof({ data }) {
  const keys = data?.tree || [];
  const path = data?.path || [];
  const at = (key) => TREE_AT[keys.indexOf(key)];
  const route = path.map(at).filter(Boolean).map(([x, y], k) => `${k ? "L" : "M"}${x} ${y}`).join(" ");
  return (
    <div className="pl-xp__proof">
      <svg role="img" aria-label={`A balanced search tree: finding ${path[path.length - 1]} visits ${path.join(", then ")} — ${data?.steps} steps`}
        viewBox="0 0 320 170" width="100%" className="pl-xp__tree">
        <path className="pl-xp__treeedge" d="M160 30 L90 82 M160 30 L230 82 M90 82 L55 136 M90 82 L125 136 M230 82 L195 136 M230 82 L265 136"/>
        {route ? <path className="pl-xp__route at-draw" d={route}/> : null}
        {keys.map((key, k) => (
          <g key={key}><circle cx={TREE_AT[k][0]} cy={TREE_AT[k][1]} r="17" data-lit={path.includes(key) ? "yes" : undefined}/>
            <text x={TREE_AT[k][0]} y={TREE_AT[k][1] + 6} textAnchor="middle" fontSize="19">{key}</text></g>
        ))}
      </svg>
      <div className="pl-xp__counts">
        <div className="pl-xp__count" data-tone="tree"><span className="pl-xp__countn">{data?.steps}</span><span className="pl-xp__countl">STEPS · THE TREE</span></div>
        <div className="pl-xp__count"><span className="pl-xp__countn">{data?.scan}</span><span className="pl-xp__countl">STEPS · SCANNING ALL</span></div>
      </div>
    </div>
  );
}

function Turn({ check, picked, onPick }) {
  const right = picked != null && picked === check.answer;
  return (
    <div className="pl-xp__turn">
      <span className="pl-xp__lab">REGISTER · ONE QUESTION</span>
      <p className="pl-xp__q">{check.question}</p>
      <div className="pl-xp__opts" role="group" aria-label="Your answer">
        {check.options.map((opt, k) => (
          <button key={opt} type="button" className="pl-xp__opt" onClick={() => onPick(opt)} aria-pressed={picked === opt}
            data-right={picked != null && opt === check.answer ? "yes" : undefined} data-wrong={picked === opt && opt !== check.answer ? "yes" : undefined}>
            <span className="pl-xp__optl">{LETTERS[k]}</span>{opt}{picked != null && opt === check.answer ? " ✓" : ""}
          </button>
        ))}
      </div>
      {right ? <Stamp tone="lit" rotate={-8} className="pl-xp__lit">LIT</Stamp> : null}
    </div>
  );
}

function Ticket({ beat, script, openings }) {
  const o = beat?.overlay;
  if (o?.kind === "usualAnswer") return (
    <div className="pl-xp__over">
      <div className="pl-xp__ticket" data-kind="usual">
        <span className="pl-xp__lab">THE USUAL ANSWER</span>
        <p className="pl-xp__quote">“{o.answer}”</p>
        <Stamp tone="ink" rotate={-8} className="pl-xp__stamp">{o.stamp}</Stamp>
      </div>
    </div>
  );
  if (o?.kind === "whereItRuns") {
    const line = marketLine(script, openings);
    const n = line ? line.match(/^[\d,]+ openings this week/)?.[0] : null;
    return (
      <div className="pl-xp__over">
        <div className="pl-xp__ticket" data-kind="runs">
          <div className="pl-xp__tickethead"><span className="pl-xp__lab">WHERE IT RUNS · TODAY</span></div>
          <div className="pl-xp__ticketbody">
            <p className="pl-xp__runs">{o.line}</p>
            <span className="pl-xp__detail">{o.detail}</span>
            {line ? <>
              <div aria-hidden="true" className="pl-xp__tear"/>
              <span className="pl-xp__market">{n ? <><b>{n}</b>{line.slice(n.length)}</> : line} <span className="pl-xp__from">FROM THE MARKET</span></span>
            </> : null}
          </div>
        </div>
      </div>
    );
  }
  return null;
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
  const over = beat.overlay?.kind;
  const stage = beat.act?.target === "tree" ? "proof" : over === "yourTurn" ? "turn" : "plate";
  const ticket = over === "usualAnswer" || over === "whereItRuns";
  // the small print settles under the table whenever a cost is on it and nothing lies over it
  const small = stage === "plate" && !ticket && Object.values(cols).some((c) => c !== "hidden");

  return (
    <section className="pl-xp" data-aspect={aspect} data-beat={f.i + 1} data-reduce={reduce ? "yes" : undefined}
      aria-label={`${script.title?.text || script.title?.tape}: an explainer`}>
      <div className="pl-xp__screen">
        <div className="pl-xp__frame" data-region={script.region || undefined}>
          <div className="pl-xp__top">
            <span className="pl-xp__kicker">{script.kicker}</span>
            <TurnMark slash={f.slash}/>
          </div>
          <Title title={script.title}/>
          <div className="pl-xp__askrow">
            <p className="pl-xp__ask">{beat.ask?.plain ? null : <span className="pl-xp__tag">{beat.ask?.tag}</span>}<span>{beat.ask?.text}</span></p>
          </div>
          <div className="pl-xp__stage" data-stage={stage} data-over={over || undefined}>
            {stage === "proof" ? <Proof data={beat.act?.data}/>
              : stage === "turn" ? <Turn check={script.check} picked={picked} onPick={pick}/>
              : <CostTable plate={script.plate} cols={cols} lit={beat.lit} dimmed={ticket}/>}
            {small ? <p className="pl-xp__small">{script.smallPrint}</p> : null}
            {ticket ? <Ticket beat={beat} script={script} openings={openings}/> : null}
          </div>
          <div className="pl-xp__captions">
            <p aria-live="off">
              {words.map((x, k) => (
                <span key={k}>{k ? " " : null}<span className="pl-xp__word" data-s={x.state} data-key={x.key ? "yes" : undefined} data-now={x.now && playing ? "yes" : undefined}>{x.t}</span></span>
              ))}
            </p>
          </div>
          <p className="pl-sr">{beat.say}</p>
          <div className="pl-xp__progress">
            <LitSquares squares={progressSquares(f.i, script.beats.length)} size={10} label={`Beat ${f.i + 1} of ${script.beats.length}: ${beat.name}`}/>
          </div>
        </div>
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
