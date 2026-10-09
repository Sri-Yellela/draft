// ⭐ D86 · THE RÉSUMÉ BUTTON'S CHOICE — write it with draft, or in the user's own ChatGPT or Claude.
//
// The Résumé button's ONE click is unchanged: it is draft's Generate. This adds the caret beside it, and
// only when the operator has the feature on — a user who never turns it on sees the panel exactly as it
// was. The caret chooses:
//   · Write it with draft — uses a draft credit (the existing Generate)
//   · Write it in ChatGPT / Claude — free to the user: their own model writes it through draft's connector
//   · or, when the user's switch is off, a way to Settings → Integrations → Connected apps.
// Choosing a host opens it with the request filled in (claude.ai/new?q= · chatgpt.com/?q= — neither is
// documented by its maker, so the request is ALSO copied, and the line says so) and then shows four steps
// that update THEMSELVES while the user is in the chat: Open → Waiting for your résumé… → Checks → Done. A
// refusal is said in plain words with "Nothing was saved".
//
// One state (useByomFlow) for the panel; the caret is drawn in both of its layouts (labelled boxes and
// icon squares) and the status line once, beneath them.
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import DepthButton from "./DepthButton.jsx";
import "./ByomResumeChoice.css";

const HOST_URL = {
  claude: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
  chatgpt: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`,
};
const POLL_MS = 3000;
const POLL_FOR_MS = 30 * 60 * 1000;

let settingsPromise = null;
/** /api/byom, once per page load — the panel opens and closes often. */
function loadSettings() {
  settingsPromise = settingsPromise || api("/api/byom").catch(() => null);
  return settingsPromise;
}
export function forgetByomSettings() { settingsPromise = null; }

export function requestText(job) {
  const id = String(job?.jobId ?? "");
  const what = [job?.title, job?.company].filter(Boolean).join(" at ");
  return `Use the draft connector to tailor my résumé for ${what ? `"${what}"` : "this job"} (draft job id ${id}): ` +
    `call get_generation_brief with job_id "${id}", follow its instructions, then call submit_resume.`;
}

/** The panel's one bring-your-own-model state. */
export function useByomFlow(job) {
  const [settings, setSettings] = useState(null);
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
  const start = useCallback(async (host) => {
    const text = requestText(job);
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch { copied = false; }
    window.open(HOST_URL[host](text), "_blank", "noopener");
    setStatus(null);
    setFlow({ host, label: settings?.hosts?.[host]?.label ?? host, since: Math.floor(Date.now() / 1000) - 5, copied });
  }, [job, settings]);
  return { settings, available: !!settings?.available, flow, status, start };
}

const caretIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>;

/** The caret and its menu. Renders nothing while the operator's switch is off. */
export default function ByomResumeChoice({ byom, square = false, onGenerate, generateDisabled = false }) {
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
  const { settings } = byom;

  const hostItem = (host) => {
    const h = settings.hosts?.[host];
    const off = !settings.enabled || !h?.enabled;
    return (
      <button key={host} type="button" role="menuitem" className="byom__item" disabled={off}
        onClick={() => { setOpen(false); byom.start(host); }}>
        <span>Write it in {h?.label ?? host}</span>
        <small>{!h?.enabled ? `${h?.label ?? host} is not available right now` : `free to you — your own ${h.label}`}</small>
      </button>
    );
  };

  return (
    <span className="byom" ref={wrap} data-byom-choice="">
      <DepthButton size={square ? "square" : "box"} icon={caretIcon} onClick={() => setOpen(o => !o)}
        title="Choose how to write the résumé" caption={square ? "Choose" : null} aria-haspopup="menu" aria-expanded={open}
        className="byom__caret">{square ? "Choose how to write the résumé" : <span className="byom__sr">Choose how to write the résumé</span>}</DepthButton>
      {open && (
        <div className="byom__menu" role="menu" aria-label="Write the résumé">
          <button type="button" role="menuitem" className="byom__item" disabled={generateDisabled}
            onClick={() => { setOpen(false); onGenerate?.(); }}>
            <span>Write it with draft</span><small>uses a draft credit</small>
          </button>
          {hostItem("chatgpt")}
          {hostItem("claude")}
          {!settings.enabled && (
            <button type="button" role="menuitem" className="byom__item byom__item--link" onClick={() => navigate("/app/integrations")}>
              <span>Turn on ChatGPT and Claude</span><small>Settings → Integrations → Connected apps</small>
            </button>
          )}
        </div>
      )}
    </span>
  );
}

const STEPS = ["Waiting for your résumé…", "Checks", "Done"];
const reached = (status) => ({ refused: 2, done: 3 }[status] ?? 1);

/** The four steps, under the actions. */
export function ByomStatus({ byom }) {
  const { flow, status } = byom || {};
  if (!flow) return null;
  const at = reached(status?.status);
  return (
    <div className="byom__flow" role="status" aria-live="polite" data-byom-status={status?.status ?? "opened"}>
      <ol className="byom__steps">
        <li data-state="done">Open {flow.label}</li>
        {STEPS.map((s, i) => <li key={s} data-state={status?.status === "done" || i + 1 < at ? "done" : i + 1 === at ? "now" : "next"}>{s}</li>)}
      </ol>
      {flow.copied && !["done", "refused"].includes(status?.status) && (
        <p className="byom__note">The request is copied too — paste it if {flow.label} opens empty.</p>
      )}
      {status?.status === "refused" && (
        <p className="byom__note byom__note--warn">Nothing was saved. draft refused it: {status.reasons.join(" ")} {flow.label} can fix this and try again.</p>
      )}
      {status?.status === "done" && (
        <p className="byom__note byom__note--ok" data-byom-done="">
          Résumé ready{status.baseAtsScore != null && status.atsScore != null ? ` · base ${status.baseAtsScore} → ${status.atsScore}` : ""} · claims checked
        </p>
      )}
      {["closed", "expired"].includes(status?.status) && (
        <p className="byom__note byom__note--warn">
          {status.status === "closed" ? "Refused three times — nothing was saved." : "The request expired — nothing was saved."} Choose “Write it in {flow.label}” to start again.
        </p>
      )}
    </div>
  );
}
