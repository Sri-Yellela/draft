// client/src/pages/atlas/BankAnswers.jsx — ⭐ D154 P2 / D150 T14 (46y) · answering one item of the owner-approved question bank:
// a MATCH or an ORDER item (moved here from AtlasPanels.jsx so the daily question and Learn's piece questions share ONE
// implementation, A93), and the person's local day (the review rule counts days in it).
import { useState } from "react";
import "./AtlasPanels.css";

export const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// ⭐ D154 P2 · MATCH: tap an item on the left, then its partner on the right (buttons, so Tab / Enter / Space work too);
// tap a paired left item again to undo. After the answer each pair shows right or wrong, the right partner, and its why.
export function MatchAnswer({ q, r, busy, onAnswer }) {
  const [pick, setPick] = useState(null);            // the left index waiting for a partner
  const [pairs, setPairs] = useState({});            // left index → right's stored index
  const used = new Set(Object.values(pairs));
  const rightText = (i) => q.right.find(x => x.i === i)?.text || "";
  const done = Object.keys(pairs).length === q.left.length;
  if (r) {
    const resp = r.response || [];
    return (
      <ol className="atl-dq__pairs" data-daily-match-result="">
        {q.left.map((l, k) => (
          <li key={k} className="atl-dq__pair" data-state={r.parts?.[k] ? "right" : "wrong"}>
            <b>{l}</b> → {rightText(resp[k])}
            {!r.parts?.[k] && <span> · the match: {rightText(r.answer?.[k])}</span>}
            {Array.isArray(r.why) && r.why[k] && <span className="atl__quiet"> — {r.why[k]}</span>}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="atl-dq__match" data-daily-match="">
      <div className="atl-dq__choices" role="group" aria-label="Items">
        {q.left.map((l, k) => (
          <button key={k} type="button" className="atl-dq__choice" aria-pressed={pick === k} data-state={pick === k ? "picked" : ""}
            onClick={() => { if (pairs[k] != null) { const n = { ...pairs }; delete n[k]; setPairs(n); setPick(k); } else setPick(pick === k ? null : k); }}>
            {l}{pairs[k] != null && <span className="atl__quiet"> → {rightText(pairs[k])}</span>}
          </button>
        ))}
      </div>
      <div className="atl-dq__choices" role="group" aria-label="Partners">
        {q.right.map((x) => (
          <button key={x.i} type="button" className="atl-dq__choice" disabled={pick == null || used.has(x.i)}
            onClick={() => { setPairs({ ...pairs, [pick]: x.i }); setPick(null); }}>{x.text}</button>
        ))}
      </div>
      <button type="button" className="atl-dq__choice atl-dq__go" disabled={!done || busy} onClick={() => onAnswer(q.left.map((_, k) => pairs[k]))}>Check my pairs</button>
    </div>
  );
}

// ⭐ D154 P2 · ORDER: move each step up or down (buttons — keyboard reachable), then check. After the answer each position
// shows right or wrong, and the right order is listed.
export function OrderAnswer({ q, r, busy, onAnswer }) {
  const [order, setOrder] = useState(() => q.steps.map(s => s.i));
  const text = (i) => q.steps.find(s => s.i === i)?.text || "";
  const move = (k, d) => { const n = [...order]; const j = k + d; if (j < 0 || j >= n.length) return; [n[k], n[j]] = [n[j], n[k]]; setOrder(n); };
  if (r) {
    const resp = r.response || order;
    return (
      <div data-daily-order-result="">
        <ol className="atl-dq__pairs">{resp.map((i, k) => <li key={k} className="atl-dq__pair" data-state={r.parts?.[k] ? "right" : "wrong"}>{text(i)}</li>)}</ol>
        {!r.correct && <><p className="atl__quiet">The order:</p><ol className="atl-dq__pairs">{(r.answer || []).map((i, k) => <li key={k} className="atl-dq__pair">{text(i)}{Array.isArray(r.why) && r.why[i] ? <span className="atl__quiet"> — {r.why[i]}</span> : null}</li>)}</ol></>}
      </div>
    );
  }
  return (
    <div data-daily-order="">
      <ol className="atl-dq__pairs">
        {order.map((i, k) => (
          <li key={i} className="atl-dq__pair atl-dq__step">
            <span>{text(i)}</span>
            <span className="atl-dq__moves">
              <button type="button" className="atl-dq__move" disabled={k === 0} aria-label={`Move "${text(i)}" up`} onClick={() => move(k, -1)}>↑</button>
              <button type="button" className="atl-dq__move" disabled={k === order.length - 1} aria-label={`Move "${text(i)}" down`} onClick={() => move(k, 1)}>↓</button>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" className="atl-dq__choice atl-dq__go" disabled={busy} onClick={() => onAnswer(order)}>Check my order</button>
    </div>
  );
}
