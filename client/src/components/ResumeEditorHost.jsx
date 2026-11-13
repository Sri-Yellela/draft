// components/ResumeEditorHost.jsx — ⭐ D157 (owner 11-06: option A — "the editor opens as a focused full-screen view")
// + D171 FIX 4 ("résumé opens as a downloaded pdf in a new tab" → it opens IN draft).
//
// The editor is resume-master's (the tools service's /editor/ — its own repo, its own tests); draft keeps no fork. This host
// is mounted ONCE in the app shell and opened from anywhere through lib/resumeEditor.js `openResumeEditor(request)`:
// the posting's Résumé control (Preview / edit), Home's application rows (Résumé). It is a focused full-screen view
// over the page — the page under it never unmounts, so Back / Esc (and the browser's Back) return to exactly where the
// person was, the posting still open. The dock stays visible: the view starts where the dock ends.
//
// THE CONTRACT (rm-editor/1, resume-master src/editor/sections.js): messages are read only from this iframe's window
// at the editor's origin, and posted only to that origin. Host → editor: theme (draft's live tokens, again whenever the
// theme changes), load {html, meta}, saved {ok}. Editor → host: ready, loaded, changed {html} (saved here), export
// {format} (downloaded here), close (Esc), error. If the editor can't be reached in time, the opener's own preview
// (panels/SandboxPanel.jsx) takes over — the person is never left with nothing.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, authHeaders, printResume } from "../lib/api.js";
import { RESUME_EDITOR_EVENT, changedLines, themeTokens, editorPath, REOPEN_KEY, openResumeEditor } from "../lib/resumeEditor.js";
import { Z } from "../styles/zLayers.js";
import ResumeChangesPanel from "./ResumeChangesPanel.jsx";   // 46j: What we changed, docked beside a job's tailored résumé
import "./ResumeEditorHost.css";

const CONTRACT = "rm-editor/1";
const READY_TIMEOUT_MS = 12000;
let configPromise = null;
function editorConfig() {
  if (!configPromise) configPromise = api("/api/resume-editor").catch(() => { configPromise = null; return { available: false }; });
  return configPromise;
}

function safeName(company, ext) {
  return `Resume_${String(company || "resume").replace(/[^\w-]+/g, "_")}.${ext}`;
}

/** Where the view starts: after the dock (a side dock on the left, a top dock above), so the dock stays. */
function insetFromDock() {
  const dock = document.querySelector("[data-nav-dock]");
  if (!dock) return { top: 0, left: 0 };
  const r = dock.getBoundingClientRect();
  if (!r.width || !r.height || r.bottom <= 0) return { top: 0, left: 0 };
  const side = r.height > r.width && r.left < window.innerWidth / 3;
  return side ? { top: 0, left: Math.max(0, Math.round(r.right + 8)) } : { top: Math.max(0, Math.round(r.bottom)), left: 0 };
}

export default function ResumeEditorHost() {
  const [request, setRequest] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [phase, setPhase] = useState("idle");       // idle · loading · ready · failed
  const [status, setStatus] = useState("");
  // ⭐ 46j (owner 11-13: "move the entire what we changed panel as a side panel beside the resume tailored for this job. so
  // opening the resume is much more transparent"): open by default for a job's résumé; the bar's button hides / shows it.
  const [changesOpen, setChangesOpen] = useState(true);
  const [inset, setInset] = useState({ top: 0, left: 0 });
  const frameRef = useRef(null);
  const reqRef = useRef(null);
  const pendingSave = useRef(Promise.resolve());
  const pushedRef = useRef(false);
  const backRef = useRef(null);
  const saidReady = useRef(false);   // the editor answered `ready` for the request open now

  const close = useCallback((fromPop = false) => {
    setRequest(null); setPhase("idle"); setStatus("");
    reqRef.current = null;
    if (pushedRef.current) {
      pushedRef.current = false;
      if (!fromPop && window.history.state?.rmEditor) window.history.back();
    }
  }, []);

  // Open: from any screen, through lib/resumeEditor.js.
  useEffect(() => {
    const onOpen = (e) => {
      const r = e.detail;
      if (!r?.html) return;
      reqRef.current = r;
      saidReady.current = false;
      setRequest(r); setPhase("loading"); setStatus("");
      setInset(insetFromDock());
      if (!pushedRef.current) {
        // The browser's Back closes the view. The router's own state is kept, so it sees no navigation.
        // ⭐ D157 (i): a job's own (editable) résumé gets its own address; a read-only attempt keeps the page's.
        const own = r.jobId && !r.readOnly ? editorPath(r.jobId) : undefined;
        window.history.pushState({ ...(window.history.state || {}), rmEditor: 1 }, "", own);
        pushedRef.current = true;
      }
      editorConfig().then(c => {
        if (reqRef.current !== r) return;
        if (!c?.available) return fail("The résumé editor isn't available right now.");
        setCfg(c);
      });
    };
    window.addEventListener(RESUME_EDITOR_EVENT, onOpen);
    return () => window.removeEventListener(RESUME_EDITOR_EVENT, onOpen);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ⭐ D157 (i): arriving from /draft/resume/<job> (App.jsx's EditorAddress), open that job's stored résumé again.
  useEffect(() => {
    let jobId = null;
    try { jobId = sessionStorage.getItem(REOPEN_KEY); sessionStorage.removeItem(REOPEN_KEY); } catch { jobId = null; }
    if (!jobId) return;
    api(`/api/resumes/${encodeURIComponent(jobId)}`).then(r => {
      if (r?.html) openResumeEditor({ html: r.html, jobId, company: r.company, title: r.role, tool: r.toolType || r.tool, version: r.version });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const onPop = () => { if (pushedRef.current && !window.history.state?.rmEditor) close(true); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [close]);

  // The page under the view doesn't scroll while it's open; the dock re-measures with the window.
  useEffect(() => {
    if (!request) return undefined;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onResize = () => setInset(insetFromDock());
    window.addEventListener("resize", onResize);
    return () => { document.documentElement.style.overflow = prev; window.removeEventListener("resize", onResize); };
  }, [request]);

  const fail = useCallback((message) => {
    const r = reqRef.current;
    if (r?.fallback) { close(); r.fallback(); return; }
    setPhase("failed"); setStatus(message);
  }, [close]);

  // The editor must say it's there in time; otherwise the opener's own preview takes over.
  useEffect(() => {
    if (phase !== "loading" || !cfg) return undefined;
    const t = setTimeout(() => fail("The résumé editor didn't load."), READY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [phase, cfg, fail]);

  const post = useCallback((type, payload = {}) => {
    const w = frameRef.current?.contentWindow;
    if (w && cfg?.origin) w.postMessage({ contract: CONTRACT, type, ...payload }, cfg.origin);
  }, [cfg]);

  // The theme follows the site, live. Only themes/index.js decides a theme (inkPairD32): a new theme
  // reloads the page, and the tokens it writes on <html> (style / class) are what this watches.
  useEffect(() => {
    if (phase !== "ready") return undefined;
    let raf = 0;
    const send = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => post("theme", { tokens: themeTokens() })); };
    const mo = new MutationObserver(send);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, [phase, post]);

  const save = useCallback(async (html) => {
    const r = reqRef.current;
    if (!r || r.readOnly) return;
    const run = (async () => {
      if (r.onSave) await r.onSave(html);
      else if (r.jobId) await api(`/api/resumes/${encodeURIComponent(r.jobId)}/html`, { method: "POST", body: JSON.stringify({ html, tool: r.tool, version: r.version }) });
      r.html = html;
    })();
    pendingSave.current = run.catch(() => {});
    try { await run; post("saved", { ok: true }); } catch (e) { post("saved", { ok: false, message: e?.message || "Couldn't save" }); }
  }, [post]);

  const exportDoc = useCallback(async (format, html, filename) => {
    const r = reqRef.current;
    if (!r) return;
    if (format === "html") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      a.download = filename || safeName(r.company, "html");
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return;
    }
    try {
      if (r.onExport) { await r.onExport(html); return; }
      if (r.downloadPdfUrl) {
        await pendingSave.current;  // the PDF is made from the stored résumé — wait for the last edit to land
        const res = await fetch(r.downloadPdfUrl, { credentials: "include", headers: authHeaders() });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `The download failed (${res.status}).`);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename || safeName(r.company, "pdf");
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        return;
      }
      printResume(html, (filename || safeName(r.company, "pdf")).replace(/\.pdf$/i, ""));
    } catch (e) { setStatus(e?.message || "The PDF couldn't be made."); }
  }, []);

  // rm-editor/1, host side.
  useEffect(() => {
    if (!cfg?.origin || !request) return undefined;
    const onMessage = async (e) => {
      if (e.origin !== cfg.origin || e.source !== frameRef.current?.contentWindow) return;
      const m = e.data;
      if (!m || typeof m !== "object" || m.contract !== CONTRACT) return;
      const r = reqRef.current;
      if (!r) return;
      if (m.type === "ready") {
        saidReady.current = true;
        post("theme", { tokens: themeTokens() });
        let changes = Array.isArray(r.changes) ? r.changes : null;
        if (!changes && r.jobId) {
          changes = await Promise.race([
            api(`/api/jobs/${encodeURIComponent(r.jobId)}/resume-changes`).then(changedLines).catch(() => []),
            new Promise(res => setTimeout(() => res([]), 3000)),
          ]);
        }
        post("load", { html: r.html, meta: { company: r.company || "", title: r.title || "", changes: changes || [],
          readOnly: !!r.readOnly, readOnlyNote: r.readOnlyNote || "", filename: safeName(r.company, "pdf") } });
      } else if (m.type === "loaded") {
        setPhase("ready");
        frameRef.current?.focus();
      } else if (m.type === "changed" && typeof m.html === "string") {
        save(m.html);
      } else if (m.type === "export" && typeof m.html === "string") {
        exportDoc(m.format === "html" ? "html" : "pdf", m.html, m.filename);
      } else if (m.type === "close") {
        close();
      } else if (m.type === "error") {
        fail(m.message || "The résumé couldn't be opened in the editor.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [cfg, request, post, save, exportDoc, close, fail]);

  // Esc on draft's side of the view (the editor sends its own Esc as `close`).
  useEffect(() => {
    if (!request) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [request, close]);

  if (!request) return null;
  const src = cfg?.url ? `${cfg.url}?embed=1&host=${encodeURIComponent(window.location.origin)}&v=1` : null;
  return createPortal(
    <section className="rmeh" role="dialog" aria-modal="true" aria-label={`Résumé${request.company ? ` for ${request.company}` : ""}`}
      data-resume-editor={phase} style={{ top: inset.top, left: inset.left, zIndex: Z.MODAL }}>
      <div className="rmeh__bar">
        <button type="button" ref={backRef} className="rmeh__back dbx-depth" onClick={() => close()} data-resume-editor-back="">← Back</button>
        <span className="rmeh__title">{request.company ? `Résumé · ${request.company}` : "Résumé"}{request.readOnly ? " · as sent" : ""}</span>
        <span className="rmeh__status" role="status">{phase === "loading" ? "Opening the editor…" : status}</span>
        {request.jobId != null && (
          <button type="button" className="rmeh__back dbx-depth" aria-pressed={changesOpen} data-resume-editor-changes=""
            onClick={() => setChangesOpen(v => !v)}>{changesOpen ? "Hide what we changed" : "What we changed"}</button>
        )}
      </div>
      <div className="rmeh__body">
      {phase === "failed" ? (
        <div className="rmeh__failed">
          <p>{status || "The résumé editor couldn't be opened."}</p>
          <button type="button" className="dbx-depth" onClick={() => exportDoc("html", request.html)}>Download the HTML instead</button>
        </div>
      ) : src && (
        <iframe ref={frameRef} className="rmeh__frame" src={src} title="Résumé editor"
          // The page arrived but never said `ready` (an older tools service without the editor answers a 404 page):
          // don't make the person wait out the whole timeout.
          onLoad={() => { const r = reqRef.current; setTimeout(() => { if (reqRef.current === r && !saidReady.current) fail("The résumé editor didn't load."); }, 3000); }}
          sandbox="allow-scripts allow-same-origin allow-modals allow-downloads" allow="clipboard-write"
          referrerPolicy="no-referrer" data-ready={phase === "ready" ? "true" : "false"} />
      )}
      {request.jobId != null && changesOpen && (
        <aside className="rmeh__changes" data-resume-editor-side="">
          <ResumeChangesPanel docked jobId={request.jobId} jobLabel={request.company || ""} onClose={() => setChangesOpen(false)} />
        </aside>
      )}
      </div>
    </section>,
    document.body,
  );
}
