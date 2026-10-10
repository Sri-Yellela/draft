// ⭐ D86 · THE RÉSUMÉ BUTTON — a SPLIT BUTTON: write it with draft, or in the user's own ChatGPT or Claude.
//
// Built to the owner's sketch (plugin-ui.html, tab 2). The split replaces the plain Résumé button ONLY while
// the operator has the feature on — a user who never turns it on sees the panel exactly as it was, and the
// default method is draft's Generate, so the one click is unchanged until the user chooses otherwise.
//   · the caret CHOOSES the method (Write it with draft — uses a draft credit · Write it in ChatGPT / Claude —
//     free to you) and the main half's label follows it ("Résumé · Claude"); the choice is remembered
//     per browser. "Don't see them?" leads to Settings.
//   · choosing a host shows the four steps — Open → Waiting for your résumé… → Checks → Done — which update
//     THEMSELVES while the user is in the chat. "Open {host}" opens it with the request prefilled
//     (claude.ai/new?q= · chatgpt.com/?q= — neither documented by its maker, so the request is ALSO copied,
//     and the card says so). A refusal names the term and says "Nothing was saved"; Done says base → tailored
//     with View and Download.
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import DepthButton, { ICONS } from "./DepthButton.jsx";
import "./ByomResumeChoice.css";

const HOST_URL = {
  claude: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
  chatgpt: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`,
};
const POLL_MS = 3000;
const POLL_FOR_MS = 30 * 60 * 1000;
const METHOD_KEY = "draft-byom-method";

let settingsPromise = null;
/** /api/byom, once per page load — the panel opens and closes often. */
function loadSettings() {
  settingsPromise = settingsPromise || api("/api/byom").catch(() => null);
  return settingsPromise;
}
const readMethod = () => { try { return localStorage.getItem(METHOD_KEY) || "draft"; } catch { return "draft"; } };
const writeMethod = (m) => { try { localStorage.setItem(METHOD_KEY, m); } catch { /* a convenience, never required */ } };

export function requestText(job) {
  const id = String(job?.jobId ?? "");
  const what = [job?.title, job?.company].filter(Boolean).join(" at ");
  return `Use the draft connector to tailor my résumé for ${what ? `"${what}"` : "this job"} (draft job id ${id}): ` +
    `get a brief with get_generation_brief (job_id "${id}"), rewrite my bullets using only facts in my résumé, then save it with submit_resume.`;
}

/** The panel's one bring-your-own-model state. */
export function useByomFlow(job) {
  const [settings, setSettings] = useState(null);
  const [chosen, setChosen] = useState(readMethod);
  const [flow, setFlow] = useState(null);      // { host, label, since, copied }
  const [status, setStatus] = useState(null);
  useEffect(() => { let live = true; loadSettings().then(s => { if (live) setSettings(s); }); return () => { live = false; }; }, []);
  useEffect(() => { setFlow(null); setStatus(null); }, [job?.jobId]);
  useEffect(() => {
    if (!flow || !job?.jobId) return;
    let live = true, timer = null;
    const started = Date.now();
    const tick = () => api(`/api/byom/status/${encodeURIComponent(job.jobId)}?since=${flow.since}`)
      .then(s => {
        if (!live) return;
        setStatus(s);
        if (["done", "closed", "expired"].includes(s?.status)) return;
        if (Date.now() - started < POLL_FOR_MS) timer = setTimeout(tick, POLL_MS);
      })
      .catch(() => { if (live) timer = setTimeout(tick, POLL_MS * 2); });
    tick();
    return () => { live = false; clearTimeout(timer); };
  }, [flow, job?.jobId]);
  // A remembered host that is now off falls back to draft: the one click never points at a dead path.
  const usable = (m) => m === "draft" || (!!settings?.enabled && !!settings?.hosts?.[m]?.enabled);
  const method = usable(chosen) ? chosen : "draft";
  const choose = useCallback((m) => { setChosen(m); writeMethod(m); setFlow(null); setStatus(null); }, []);
  const start = useCallback(async (host) => {
    const text = requestText(job);
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch { copied = false; }
    window.open(HOST_URL[host](text), "_blank", "noopener");
    setStatus(null);
    setFlow({ host, label: settings?.hosts?.[host]?.label ?? host, since: Math.floor(Date.now() / 1000) - 5, copied });
  }, [job, settings]);
  const connected = (h) => (settings?.connections || []).some(c => c.host === h);
  return { settings, available: !!settings?.available, method, choose, flow, status, start, connected };
}

/**
 * The split button: the main half runs the chosen method; the caret chooses. Renders nothing while the
 * operator's switch is off — the caller then draws its plain Résumé button.
 * @param {{ byom, label: string, square?: boolean, onGenerate: () => void, disabled?: boolean, busy?: boolean }} p
 */
export default function ByomResumeChoice({ byom, label, square = false, onGenerate, disabled = false, busy = false }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  if (!byom?.available) return null;
  const { settings, method } = byom;
  const hostLabel = method === "draft" ? null : settings.hosts?.[method]?.label;
  const runMain = () => (method === "draft" ? onGenerate?.() : byom.start(method));
  const mainLabel = busy ? "Generating…" : hostLabel ? `${label} · ${hostLabel}` : label;

  const opt = (m, title, sub, mark) => {
    const off = m !== "draft" && (!settings.enabled || !settings.hosts?.[m]?.enabled);
    return (
      <button key={m} type="button" role="menuitemradio" aria-checked={method === m} className="byom__opt" disabled={off}
        onClick={() => { setOpen(false); byom.choose(m); }}>
        <span><b>{title}</b>{sub}</span>{mark}
      </button>
    );
  };
  const hostMark = (h) => !settings.hosts?.[h]?.enabled ? <span className="mark mark--warn">Unavailable</span>
    : byom.connected(h) ? <span className="mark mark--ok">Connected</span> : <span className="mark mark--dim">Not connected</span>;

  return (
    <span className={`byom${square ? " byom--sq" : ""}`} ref={wrap} data-byom-choice="">
      <DepthButton size={square ? "square" : "box"} icon={ICONS.resume} onClick={runMain} disabled={disabled && method === "draft"}
        title={hostLabel ? `Write it in ${hostLabel} — free to you` : `${label} — uses a draft credit`} caption={square ? (hostLabel || "Résumé") : null}
        className="byom__main">{square ? mainLabel : mainLabel}</DepthButton>
      <DepthButton size="box" icon={<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>} onClick={() => setOpen(o => !o)}
        title="Choose how to write it" aria-haspopup="menu" aria-expanded={open} aria-label="Choose how to write it" className="byom__car">{null}</DepthButton>
      {open && (
        <div className="byom__pop" role="menu" aria-label="Write the résumé">
          {opt("draft", "Write it with draft", "Uses a draft credit · about 10 seconds", <span className="mark mark--dim">default</span>)}
          {opt("chatgpt", "Write it in ChatGPT", "Free to you · uses your own ChatGPT", hostMark("chatgpt"))}
          {opt("claude", "Write it in Claude", "Free to you · uses your own Claude", hostMark("claude"))}
          <div className="byom__foot">Don't see them?{" "}
            <button type="button" className="byom__link" onClick={() => { setOpen(false); navigate("/app/integrations"); }}>Turn on Connected apps in Settings</button>
          </div>
        </div>
      )}
    </span>
  );
}

/** The four steps, under the actions — shown once a host is the chosen method. */
export function ByomStatus({ byom, onView, onDownload }) {
  const navigate = useNavigate();
  if (!byom?.available || byom.method === "draft") return null;
  const { flow, status, method, settings } = byom;
  const label = settings.hosts?.[method]?.label ?? method;
  const s = status?.status;
  const at = !flow ? 0 : s === "refused" || s === "closed" || s === "expired" ? 2 : s === "done" ? 4 : 1;
  const state = (i) => (i < at ? "done" : i === at ? "active" : "wait");
  const terms = status?.terms || [];
  const card = (i, title, body) => (
    <div className={`byom__fs${i === 2 && ["refused", "closed", "expired"].includes(s) ? " byom__fs--bad" : ""}`} data-s={state(i)} key={i}>
      <h5>{i + 1} · {title}</h5>{body}
    </div>
  );
  return (
    <div className="byom__flow" role="status" aria-live="polite" data-byom-status={s ?? (flow ? "opened" : "chosen")}>
      {card(0, `Open ${label}`, !flow ? (
        byom.connected(method)
          ? <><p>We open {label} with your request ready. You press send.</p>
              <button type="button" className="dbx dbx--box dbx--p byom__go" onClick={() => byom.start(method)}>Open {label} →</button></>
          : <><p>{label} isn't connected yet — connect it in Settings first.</p>
              <button type="button" className="byom__link" onClick={() => navigate("/app/integrations")}>Settings → Connected apps</button></>
      ) : <p>{flow.copied ? `Opened, and the request is copied too — paste it if ${label} opens empty.` : `Opened ${label} with your request.`}</p>)}
      {card(1, "Waiting for your résumé…", <p>{label} is writing it. This page updates by itself — you can keep working.</p>)}
      {card(2, "Checks", s === "refused" ? (
        <><p><span className="mark mark--warn">Needs a fix</span></p>
          <p className="byom__why">{terms.length
            ? <>{label} included <b>{terms.join(", ")}</b>, which {terms.length === 1 ? "isn't" : "aren't"} in your résumé or claims. It was told and is revising. <b>Nothing was saved.</b></>
            : <>draft refused it: {status.reasons.join(" ")} <b>Nothing was saved.</b></>}</p></>
      ) : s === "closed" || s === "expired" ? (
        <><p><span className="mark mark--no">{s === "closed" ? "Refused three times" : "Expired"}</span></p>
          <p className="byom__why"><b>Nothing was saved.</b>{" "}
            <button type="button" className="byom__link" onClick={() => byom.start(method)}>Open {label} again</button></p></>
      ) : <p>draft checks every claim and scores it.</p>)}
      {card(3, "Done", s === "done" ? (
        <><p><span className="mark mark--ok">Résumé ready</span></p>
          <p className="byom__why" data-byom-done="">{status.baseAtsScore != null && status.atsScore != null ? <>Base <b>{status.baseAtsScore} → {status.atsScore}</b>. </> : null}Claims checked.{" "}
            <button type="button" className="byom__link" onClick={onView}>View</button> · <button type="button" className="byom__link" onClick={onDownload}>Download</button></p>
          <p className="byom__why" data-byom-ai-notice="">Written with AI assistance in your own {label}. Read it before you send it.</p></>
      ) : <p>Your résumé is attached to this job.</p>)}
    </div>
  );
}
