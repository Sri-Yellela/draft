// components/ResumeChangesPanel.jsx — ⭐ D90 P2 · "What we changed", side by side (approved by the owner, 10-10).
//
// Purpose line (the spec's): "Every change we made to your résumé for this job — and why." Two panels — the left
// résumé and the right — with every section, role and bullet on one row, so a rewrite sits beside its original.
// The data is the server's comparison (routes/resumeChanges.js → services/resumeChanges.js): this file draws it and
// computes nothing about the résumés. The default pair is a tailored version against the upload it was made from;
// the user may pick any two (owner, 10-10). Scores are the stored ones. ⛔ "Not traced" is the loudest element when
// present. One main action: Copy the changes. Marks are .mark (D60). On a narrow screen: a left / right switch.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api.js";
import DepthButton from "./DepthButton.jsx";
import "./ResumeChangesPanel.css";

const day = (unix) => (unix ? new Date(unix * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");
const SOURCE = { resume: ["ok", "from your résumé"], claims: ["dim", "from your claims"], untraced: ["no", "Not traced to your résumé or claims"] };

function RcTerms({ list }) {
  if (!list?.length) return null;
  return (
    <div className="rc__terms">
      {list.map(t => <span key={`${t.term}-${t.source}`} className={`mark mark--${SOURCE[t.source]?.[0] || "dim"}`}>now mentions {t.term} · {SOURCE[t.source]?.[1]}</span>)}
    </div>
  );
}

/** One side of a rewritten line: the left keeps what was removed (struck), the right what was added (marked). */
function RcWords({ ops, side }) {
  return ops.filter(o => o.op === "same" || (side === "left" ? o.op === "del" : o.op === "add")).map((o, i) => (
    <span key={i}>{i ? " " : ""}{o.op === "same" ? (side === "left" ? (o.was ?? o.text) : o.text) : side === "left" ? <del>{o.text}</del> : <ins>{o.text}</ins>}</span>
  ));
}

function RcPair({ b }) {
  const L = "rc__cell rc__left", R = "rc__cell rc__right";
  if (b.status === "unchanged") return <><div className={L}>{b.before}</div><div className={R}>{b.after}</div></>;
  if (b.status === "added") return (
    <><div className={`${L} rc__cell--blank`}>not in this version</div>
      <div className={`${R} rc__cell--add`}><div className="rc__row"><span className="mark mark--ok">Added</span></div><ins>{b.after}</ins><RcTerms list={b.termsGained} /></div></>
  );
  if (b.status === "removed") return (
    <><div className={`${L} rc__cell--del`}><div className="rc__row"><span className="mark mark--no">Removed</span></div><del>{b.before}</del></div>
      <div className={`${R} rc__cell--blank`}>removed in this version</div></>
  );
  return (
    <><div className={`${L} rc__cell--rew`}><div className="rc__row"><span className="mark mark--warn">Rewritten</span></div><RcWords ops={b.wordDiff || []} side="left" /></div>
      <div className={`${R} rc__cell--rew`}><div className="rc__row"><span className="mark mark--warn">Rewritten</span></div><RcWords ops={b.wordDiff || []} side="right" /><RcTerms list={b.termsGained} /></div></>
  );
}

function RcRole({ e }) {
  const [open, setOpen] = useState(false);
  const changed = e.bullets.filter(b => b.status !== "unchanged"), same = e.bullets.filter(b => b.status === "unchanged");
  return (
    <>
      <div className="rc__role">{e.company} {e.role && <span>· {e.role}</span>} <span className="mark mark--dim">employer, title and dates unchanged</span></div>
      {changed.map((b, i) => <RcPair key={`c${i}`} b={b} />)}
      {same.length > 0 && (open
        ? same.map((b, i) => <RcPair key={`u${i}`} b={b} />)
        : <button type="button" className="rc__more" onClick={() => setOpen(true)}>{same.length} unchanged — show both sides</button>)}
    </>
  );
}

function RcSection({ s }) {
  const head = <div className="rc__sec">{s.title}</div>;
  if (s.type === "summary") return <>{head}<RcPair b={{ status: s.status, before: s.before, after: s.after, wordDiff: s.wordDiff, termsGained: s.termsGained }} /></>;
  if (s.type === "skills") {
    const changed = s.status !== "unchanged";
    return (
      <>{head}
        <div className="rc__cell rc__left">{(s.before || []).join(", ")}</div>
        <div className={`rc__cell rc__right${changed ? " rc__cell--rew" : ""}`}>
          {changed && <div className="rc__row">
            {s.reordered && <span className="mark mark--warn">Reordered</span>}
            {s.added?.length > 0 && <span className="mark mark--ok">+ {s.added.join(", ")}</span>}
            {s.removed?.length > 0 && <span className="mark mark--no">− {s.removed.join(", ")}</span>}
          </div>}
          {(s.after || []).join(", ")}
        </div>
      </>
    );
  }
  if (!s.entries) return s.status === "removed" ? <>{head}<div className="rc__cell rc__left rc__cell--del">This section is not in the right-hand résumé.</div><div className="rc__cell rc__right rc__cell--blank" /></> : null;
  return <>{head}{s.entries.map((e, i) => <RcRole key={i} e={e} />)}</>;
}

/** Plain text of the changes, for the one action. */
export function changesAsText(d, jobLabel = "") {
  const lines = [`What we changed${jobLabel ? ` — ${jobLabel}` : ""}`, `${d.from.label} → ${d.to.label}`];
  const a = d.scores?.[0]?.atsScore, b = d.to?.atsScore ?? d.scores?.at(-1)?.atsScore;
  if (a != null && b != null) lines.push(`ATS ${a} → ${b}`);
  for (const s of d.sections || []) {
    const rows = [];
    if (s.type === "summary" && s.status !== "unchanged") rows.push(`${s.status === "added" ? "Added" : "Rewritten"}: ${s.before ? `${s.before} → ` : ""}${s.after}`);
    if (s.type === "skills" && s.status !== "unchanged") rows.push(`Now: ${(s.after || []).join(", ")} (was: ${(s.before || []).join(", ")})`);
    for (const e of s.entries || []) for (const x of e.bullets) {
      if (x.status === "rewritten") rows.push(`${e.company}: ${x.before} → ${x.after}`);
      else if (x.status === "added") rows.push(`${e.company}: added — ${x.after}`);
      else if (x.status === "removed") rows.push(`${e.company}: removed — ${x.before}`);
    }
    if (rows.length) lines.push("", s.title, ...rows.map(r => `• ${r}`));
  }
  if (d.summary?.untraced) lines.push("", `⚠ Not traced to your résumé or claims: ${d.summary.termsGained.filter(t => t.source === "untraced").map(t => t.term).join(", ")}`);
  return lines.join("\n");
}

export default function ResumeChangesPanel({ jobId, jobLabel = "", onClose }) {
  const [list, setList] = useState(null);
  const [from, setFrom] = useState("base");
  const [to, setTo] = useState(null);
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [side, setSide] = useState("right");
  const [copied, setCopied] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  useEffect(() => {
    let live = true;
    setErr(null);
    api(`/api/jobs/${encodeURIComponent(jobId)}/resume-versions`)
      .then(r => { if (!live) return; setList(r); setFrom(r.default?.from || "base"); setTo(r.default?.to || null); })
      .catch(e => { if (live) { setList({ empty: true }); setErr(/404|no tailored/i.test(String(e?.message)) ? null : e.message); } });
    return () => { live = false; };
  }, [jobId]);
  useEffect(() => {
    if (!to) return;
    let live = true;
    setD(null); setErr(null);
    api(`/api/jobs/${encodeURIComponent(jobId)}/resume-changes?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(r => { if (live) setD(r); })
      .catch(e => { if (live) setErr(e.message || "The comparison could not be loaded."); });
    return () => { live = false; };
  }, [jobId, from, to]);

  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(changesAsText(d, jobLabel)); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setErr("The browser refused the copy — select the text and copy it by hand."); }
  }, [d, jobLabel]);

  const options = list && !list.empty ? [
    { ref: "base", label: "Your résumé it was made from" },
    ...(list.uploads || []).map(u => ({ ref: u.ref, label: `Your résumé — uploaded ${day(u.uploadedAt)}` })),
    ...(list.versions || []).map(v => ({ ref: v.ref, label: `Tailored v${v.version} — ${day(v.createdAt)}${v.atsScore != null ? ` · ATS ${v.atsScore}` : ""}` })),
    ...(list.sent || []).map(s => ({ ref: s.ref, label: `What we sent — ${day(s.sentAt)}` })),
  ] : [];
  const sum = d?.summary;
  const first = d?.scores?.[0]?.atsScore ?? d?.from?.atsScore ?? null;
  const last = d?.to?.atsScore ?? null;
  const untraced = sum ? sum.termsGained.filter(t => t.source === "untraced") : [];

  return createPortal(
    <div className="rc__scrim" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <section className="rc" role="dialog" aria-modal="true" aria-label="What we changed" data-side={side} data-resume-changes="">
        <div className="rc__head"><h2>What we changed</h2><button ref={closeRef} type="button" className="rc__link" onClick={onClose}>Close</button></div>
        <p className="rc__purpose">Every change we made to your résumé for this job — and why. Your résumé on the left, the tailored one on the right.</p>
        {err && <div className="rc__alarm" role="alert">{err}</div>}
        {list?.empty && !err && (
          <div className="rc__empty"><b>No tailored résumé for this job yet.</b><br />When you tailor one, it appears here beside your résumé, every change lined up.</div>
        )}
        {options.length > 0 && (
          <div className="rc__pick">
            <div><label htmlFor="rc-from">Left</label>
              <select id="rc-from" value={from} onChange={e => setFrom(e.target.value)}>{options.map(o => <option key={o.ref} value={o.ref}>{o.label}</option>)}</select></div>
            <div className="rc__swap" aria-hidden="true">⇆</div>
            <div><label htmlFor="rc-to">Right</label>
              <select id="rc-to" value={to || ""} onChange={e => setTo(e.target.value)}>{options.filter(o => o.ref !== "base").map(o => <option key={o.ref} value={o.ref}>{o.label}</option>)}</select></div>
          </div>
        )}
        {to && !d && !err && <div className="rc__empty">Comparing…</div>}
        {d && <>
          {untraced.length > 0 && (
            <div className="rc__alarm" role="alert" data-untraced=""><b>{untraced.length} change{untraced.length === 1 ? " is" : "s are"} not traced to your résumé or claims.</b>{" "}
              {untraced.map(t => `“${t.term}”`).join(", ")} — read {untraced.length === 1 ? "it" : "them"} on the right before you send this.</div>
          )}
          {d.to?.kind === "sent" && <div className="rc__note"><b>What we sent</b> — the right-hand side is the résumé exactly as it went to the employer, kept unchanged.</div>}
          {!d.baseKnown && d.from?.kind === "upload" && <div className="rc__note">This version was made before draft kept every upload, so it is compared with the earliest résumé we have.</div>}
          {d.roleChanges?.length > 0 && <div className="rc__alarm" role="alert"><b>An employer, title or date differs between the two sides.</b> Those should never change.</div>}
          {sum.identical ? (
            <div className="rc__empty"><b>Nothing was changed for this job.</b><br />Both sides are the same résumé.</div>
          ) : <>
            <div className="rc__nums">
              {first != null && last != null && <div className="rc__num rc__num--big"><div className="v">{first} → {last}</div><div className="l">ATS {last - first >= 0 ? "+" : ""}{last - first}</div></div>}
              <div className="rc__num"><div className="v">{sum.rewritten}</div><div className="l">rewritten</div></div>
              <div className="rc__num"><div className="v">{sum.added}</div><div className="l">added</div></div>
              <div className="rc__num"><div className="v">{sum.removed}</div><div className="l">removed</div></div>
              <div className="rc__num"><div className="v">{sum.unchanged}</div><div className="l">unchanged</div></div>
              <div className="rc__num"><div className="v">{sum.requirementsMissing.length}</div><div className="l">still missing</div></div>
            </div>
            <div className="rc__strip" aria-label="ATS history">
              {(d.scores || []).map((x, i) => <span key={x.ref}>{i ? "→ " : ""}<span className="s">{x.label} <b>{x.atsScore ?? "—"}</b></span></span>)}
              {sum.requirementsMissing.map(t => <span key={t} className="mark mark--dim">still missing: {t}</span>)}
            </div>
            <div className="rc__cols">
              <div className="rc__colh"><b>{d.from.label}</b><span>before{first != null ? ` · ATS ${first}` : ""}</span></div>
              <div className="rc__colh"><b>{d.to.label}</b><span>after{last != null ? ` · ATS ${last}` : ""}</span></div>
            </div>
            <div className="rc__tabs" role="group" aria-label="Which résumé to show">
              <button type="button" aria-pressed={side === "left"} onClick={() => setSide("left")}>{d.from.label}</button>
              <button type="button" aria-pressed={side === "right"} onClick={() => setSide("right")}>{d.to.label}</button>
            </div>
            <div className="rc__grid">{d.sections.map((s, i) => <RcSection key={i} s={s} />)}</div>
            <div className="rc__actions">
              <DepthButton size="compact" onClick={copy} data-copy-changes="">Copy the changes</DepthButton>
              {copied && <span className="rc__copied" role="status">Copied.</span>}
            </div>
          </>}
        </>}
      </section>
    </div>,
    document.body,
  );
}

/** The posting panel's way in: a link beside "Résumé ready". */
export function WhatWeChangedLink({ jobId, jobLabel }) {
  const [open, setOpen] = useState(false);
  if (!jobId) return null;
  return (
    <>
      <button type="button" className="rc__open" onClick={() => setOpen(true)} data-what-we-changed="">What we changed</button>
      {open && <ResumeChangesPanel jobId={jobId} jobLabel={jobLabel} onClose={() => setOpen(false)} />}
    </>
  );
}
