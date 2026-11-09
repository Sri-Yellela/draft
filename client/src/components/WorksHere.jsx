// ⭐ D180 P4 (45r) → (45s) ONE component for "1 connection works here" → Ask for a referral, on the company page, the posting
// panel and the deck's open posting (JobDetailPanel). Only the signed-in person's connections who SHOW their experience, at
// this same company (the server decides — GET /api/network/at-company, 404 while the network is off). The ask is a message
// they edit, then send (sealed, like any message); the job they opened goes with it as a card. Nothing is drawn when no one
// works here, or while the network is off.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import "./WorksHere.css";

// Is the network on? One read a minute for every WorksHere on the page (the posting panel opens many postings).
let statusAt = 0, statusP = null;
function networkOn() {
  if (!statusP || Date.now() - statusAt > 60000) {
    statusAt = Date.now();
    statusP = api("/api/network/status").then(r => !!r?.enabled).catch(() => false);
  }
  return statusP;
}

export default function WorksHere({ company, job = null, enabled = undefined }) {
  const [r, setR] = useState(null);
  const [asking, setAsking] = useState(null);   // { handle, name, text }
  const [said, setSaid] = useState("");
  useEffect(() => {
    let live = true;
    setR(null); setAsking(null); setSaid("");
    if (!company || enabled === false) return undefined;
    (enabled === true ? Promise.resolve(true) : networkOn()).then(on => {
      if (!on || !live) return;
      api(`/api/network/at-company?name=${encodeURIComponent(company)}${job?.id ? `&job=${encodeURIComponent(job.id)}` : ""}`)
        .then((x) => { if (live) setR(x); }).catch(() => {});
    });
    return () => { live = false; };
  }, [company, job?.id, enabled]);
  if (!r || !r.count) return null;
  const send = async () => {
    try {
      const sent = await api("/api/network/messages", { method: "POST", body: JSON.stringify({ to: asking.handle, text: asking.text }) });
      if (job?.id) await api("/api/network/messages", { method: "POST", body: JSON.stringify({ to: asking.handle, jobId: job.id }) }).catch(() => {});
      setAsking(null); setSaid(`Sent to ${asking.name} — it's in your Messages.`);
      return sent;
    } catch (e) { setSaid(e.message || "That didn't go through."); return null; }
  };
  return (
    <div className="wh" data-company-works-here={r.count}>
      <p className="wh__k">{r.count === 1 ? "1 connection works here" : `${r.count} connections work here`}</p>
      <ul className="wh__people">
        {r.people.map((p) => (
          <li key={p.handle}>
            <a href={`/in/${encodeURIComponent(p.handle)}`}>{p.name}</a>{p.title ? <span className="wh__where"> · {p.title}</span> : null}
            {p.openToReferrals && <span className="wh__where"> · open to referrals</span>}
            {" "}<button type="button" className="wh__btn" data-ask-referral={p.handle} onClick={() => setAsking({ handle: p.handle, name: p.name, text: p.template })}>Ask for a referral</button>
          </li>
        ))}
      </ul>
      {asking && (
        <div className="wh__ask" data-referral-ask={asking.handle}>
          <textarea rows={4} maxLength={4000} value={asking.text} onChange={(e) => setAsking({ ...asking, text: e.target.value })} aria-label={`Your message to ${asking.name}`} />
          <p>
            <button type="button" className="wh__btn" onClick={send}>Send to {asking.name}</button>{" "}
            <button type="button" className="wh__btn" onClick={() => setAsking(null)}>Cancel</button>
          </p>
        </div>
      )}
      {said && <p role="status">{said}</p>}
    </div>
  );
}
