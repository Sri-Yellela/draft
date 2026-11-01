// ⭐ D117 C9 · ADMIN → LEARN → BEFORE-THIS REVIEW (inside Admin → Atlas, beside Import content) — the owner's review of the
// chat assistant's drafted "Before this" links, per piece: Accept · Edit · Reject, and Accept all once he has read them
// (the pattern of D105 P11's definitions). Until accepted, the circle and the routes use a link and mark it "draft";
// a rejected one is not used; a re-import never undoes a review. Also here: D115 P5's links the dead-link checker held
// back, the taught terms no Atlas node answers, the guided routes (data — an audience is added without code), and the
// D117 data file's import (the same idempotent import the boot runs).
//   GET /api/admin/learn/circle · POST …/circle/needs/:step { action } · PUT …/circle/needs/:step { needs } ·
//   POST …/circle/accept-all · POST …/circle/links/check · PUT / DELETE …/circle/routes/:id · POST …/circle/import { data }
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import DepthButton from "../components/DepthButton.jsx";
import { Mark, row, quiet, sub, field, panel, h2, what } from "./adminKit.jsx";

const TONE = { drafted: C.WARNING, accepted: C.SUCCESS, rejected: C.DANGER };

function PieceRow({ p, act, busy }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const live = p.needs.filter(n => n.status !== "rejected");
  const drafted = p.needs.some(n => n.status === "drafted");
  return (
    <div style={{ ...sub, display: "grid", gap: 6 }} data-review-piece={p.id}>
      <div style={row}>
        <span style={{ flex: "1 1 220px", fontSize: 13, color: C.INK }}><b>{p.n}. {p.title}</b> <span style={quiet}>{p.id} · {p.part}</span></span>
        <DepthButton size="compact" disabled={busy || !drafted} onClick={() => act(`/api/admin/learn/circle/needs/${encodeURIComponent(p.id)}`, "POST", { action: "accept" })} data-review-accept={p.id}>Accept</DepthButton>
        <DepthButton size="compact" onClick={() => { setEditing(e => !e); setText(live.map(n => n.id).join(", ")); }} data-review-edit={p.id}>Edit</DepthButton>
        <DepthButton size="compact" disabled={busy || !live.length} onClick={() => act(`/api/admin/learn/circle/needs/${encodeURIComponent(p.id)}`, "POST", { action: "reject" })} data-review-reject={p.id}>Reject</DepthButton>
      </div>
      <div style={{ ...row, gap: 6 }}>
        {p.needs.length ? p.needs.map(n => <Mark key={n.id} tone={TONE[n.status]}>{n.title} · {n.status}</Mark>) : <span style={quiet}>Builds on nothing.</span>}
      </div>
      {editing && (
        <div style={row}>
          <input style={{ ...field, flex: "1 1 260px" }} value={text} onChange={e => setText(e.target.value)} aria-label={`Before this for ${p.title}: piece ids, comma-separated`} />
          <DepthButton size="compact" primary disabled={busy} data-review-save={p.id}
            onClick={async () => { if (await act(`/api/admin/learn/circle/needs/${encodeURIComponent(p.id)}`, "PUT", { needs: text.split(/[\s,]+/).filter(Boolean) })) setEditing(false); }}>Save</DepthButton>
        </div>
      )}
    </div>
  );
}

export function LearnBeforeThisReview() {
  const [data, setData] = useState(null);
  const [say, setSay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState(false);
  const [only, setOnly] = useState(true);
  const [route, setRoute] = useState({ id: "", name: "", targets: "" });
  const load = useCallback(() => api("/api/admin/learn/circle").then(setData).catch(e => setSay({ ok: false, text: e.message })), []);
  useEffect(() => { load(); }, [load]);
  const act = async (path, method, body) => {
    setBusy(true);
    try { const r = await api(path, { method, body: body ? JSON.stringify(body) : undefined }); setSay({ ok: true, text: "Saved." }); await load(); return r || true; }
    catch (e) { setSay({ ok: false, text: e.payload?.message || e.message }); return null; }
    finally { setBusy(false); }
  };
  const importFile = (file) => file && file.text().then(t => {
    let data; try { data = JSON.parse(t); } catch { setSay({ ok: false, text: "That is not a JSON file." }); return; }
    act("/api/admin/learn/circle/import", "POST", { data });
  });
  if (!data) return <div style={panel}><h3 style={h2}>Before-this review</h3><p style={quiet}>{say?.text || "Loading…"}</p></div>;
  const shown = data.pieces.filter(p => p.needs.length && (!only || p.needs.some(n => n.status === "drafted")));
  const held = data.extras.filter(x => x.status !== "live");
  return (
    <div style={panel} data-learn-review="">
      <h3 style={h2}>Learn · Before-this review</h3>
      <p style={what}>The drafted "Before this" links each piece builds on. The circle and the routes already use them, marked "draft"; accepting one only drops the label, rejecting one takes it out. {data.counts.drafted} drafted · {data.counts.accepted} accepted · {data.counts.rejected} rejected.</p>
      <div style={{ ...row, marginBottom: 8 }}>
        <label style={{ fontSize: 13, color: C.INK }}><input type="checkbox" checked={only} onChange={e => setOnly(e.target.checked)} /> Only pieces with drafted links</label>
        <label style={{ fontSize: 13, color: C.INK }}><input type="checkbox" checked={read} onChange={e => setRead(e.target.checked)} data-review-read="" /> I have read them</label>
        <DepthButton size="compact" primary disabled={busy || !read || !data.counts.drafted} onClick={() => act("/api/admin/learn/circle/accept-all", "POST")} data-review-accept-all="">Accept all</DepthButton>
        <label style={{ fontSize: 13, color: C.INK }}>Import the D117 data file <input type="file" accept=".json,application/json" onChange={e => importFile(e.target.files?.[0])} /></label>
      </div>
      {say && <p role="status" style={{ ...quiet, color: say.ok ? C.SUCCESS : C.DANGER }}>{say.text}</p>}
      <div style={{ display: "grid", gap: 6, maxHeight: 520, overflow: "auto" }}>
        {shown.map(p => <PieceRow key={p.id} p={p} act={act} busy={busy} />)}
        {!shown.length && <p style={quiet}>Nothing left to review.</p>}
      </div>
      <h4 style={{ margin: "14px 0 6px", color: C.INK }}>D115 P5 links held back by the link check ({held.length})</h4>
      <div style={row}>
        {held.map(x => <Mark key={x.id} tone={x.status === "held" ? C.DANGER : C.INK_FAINT}>{x.t} · {x.status}{x.note ? ` · ${x.note}` : ""}</Mark>)}
        <DepthButton size="compact" disabled={busy} onClick={() => act("/api/admin/learn/circle/links/check", "POST")}>Check links now</DepthButton>
      </div>
      <h4 style={{ margin: "14px 0 6px", color: C.INK }}>Taught terms no Atlas node answers ({data.unresolved.length})</h4>
      <p style={quiet}>{data.unresolved.map(u => `${u.term} (${u.step})`).join(" · ") || "None."}</p>
      <h4 style={{ margin: "14px 0 6px", color: C.INK }}>Guided routes</h4>
      <div style={{ display: "grid", gap: 4 }}>
        {data.routes.map(r => (
          <div key={r.id} style={row} data-review-route={r.id}>
            <span style={{ flex: "1 1 260px", fontSize: 13, color: C.INK }}><b>{r.name}</b> <span style={quiet}>{r.targets === "*" ? "the whole circle" : r.targets.join(", ")}</span></span>
            <DepthButton size="compact" disabled={busy} onClick={() => act(`/api/admin/learn/circle/routes/${encodeURIComponent(r.id)}`, "DELETE")}>Remove</DepthButton>
          </div>
        ))}
        <div style={row}>
          <input style={{ ...field, width: 120 }} placeholder="id" value={route.id} onChange={e => setRoute({ ...route, id: e.target.value })} aria-label="Route id" />
          <input style={{ ...field, flex: "1 1 180px" }} placeholder="Name, e.g. Data engineer → senior" value={route.name} onChange={e => setRoute({ ...route, name: e.target.value })} aria-label="Route name" />
          <input style={{ ...field, flex: "1 1 180px" }} placeholder="Target pieces, e.g. b2, d3" value={route.targets} onChange={e => setRoute({ ...route, targets: e.target.value })} aria-label="Target pieces" />
          <DepthButton size="compact" disabled={busy || !route.id || !route.name} onClick={() => act(`/api/admin/learn/circle/routes/${encodeURIComponent(route.id)}`, "PUT",
            { name: route.name, targets: route.targets.trim() === "*" ? "*" : route.targets.split(/[\s,]+/).filter(Boolean) })}>Add route</DepthButton>
        </div>
      </div>
    </div>
  );
}

// ⭐ D119 · Learn's thumbnails — the counts by where a picture comes from, every YouTube SEARCH link with "Pin a video"
// (paste a watch URL → the real thumbnail), and a Hide on every stored picture (the takedown path). Refresh runs the
// nightly pass now. GET /api/admin/thumbs/learn · POST …/pin { url, watchUrl } · POST …/hide { url, hidden } · POST …/refresh
function PinRow({ r, act, busy }) {
  const [watch, setWatch] = useState("");
  return (
    <div style={row} data-thumb-pin={r.id || r.u}>
      <span style={{ flex: "1 1 260px", fontSize: 13, color: C.INK }}>{r.t} <span style={quiet}>{r.thumb?.note || "search link"}</span></span>
      <input style={{ ...field, flex: "1 1 240px" }} placeholder="https://www.youtube.com/watch?v=…" value={watch} onChange={e => setWatch(e.target.value)} aria-label={`A watch link for ${r.t}`} />
      <DepthButton size="compact" disabled={busy || !watch.trim()} onClick={() => act("/api/admin/thumbs/pin", "POST", { url: r.u, watchUrl: watch.trim() })}>Pin a video</DepthButton>
    </div>
  );
}

export function LearnThumbnails() {
  const [data, setData] = useState(null);
  const [say, setSay] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api("/api/admin/thumbs/learn").then(setData).catch(e => setSay({ ok: false, text: e.message })), []);
  useEffect(() => { load(); }, [load]);
  const act = async (path, method, body) => {
    setBusy(true);
    try { const r = await api(path, { method, body: body ? JSON.stringify(body) : undefined }); setSay({ ok: r?.ok !== false, text: r?.message || "Saved." }); await load(); }
    catch (e) { setSay({ ok: false, text: e.payload?.message || e.message }); }
    finally { setBusy(false); }
  };
  if (!data) return <div style={panel}><h3 style={h2}>Learn · thumbnails</h3><p style={quiet}>{say?.text || "Loading…"}</p></div>;
  const c = data.counts;
  const search = data.rows.filter(r => r.plan === "youtube_search" && !r.thumb?.src);
  const stored = data.rows.filter(r => r.thumb?.src || r.thumb?.hidden);
  return (
    <div style={panel} data-learn-thumbs="">
      <h3 style={h2}>Learn · thumbnails</h3>
      <p style={what}>Every resource shows a picture of what it is — stored here, never hot-linked. {c.youtubeSearch} YouTube search links (no single video, so no picture until you pin one) · {c.youtubeWatch} watch links · {c.book} books (Open Library covers) · {c.site} sites (their share image) · {c.stored} pictures stored · {c.hidden} hidden.</p>
      <div style={row}><DepthButton size="compact" disabled={busy} onClick={() => act("/api/admin/thumbs/refresh", "POST")}>Refresh now</DepthButton></div>
      {say && <p role="status" style={{ ...quiet, color: say.ok ? C.SUCCESS : C.DANGER }}>{say.text}</p>}
      <h4 style={{ margin: "14px 0 6px", color: C.INK }}>Pin a video ({search.length} search links)</h4>
      <div style={{ display: "grid", gap: 4, maxHeight: 360, overflow: "auto" }}>
        {search.map(r => <PinRow key={r.u} r={r} act={act} busy={busy} />)}
      </div>
      <h4 style={{ margin: "14px 0 6px", color: C.INK }}>Stored pictures ({stored.length})</h4>
      <div style={{ display: "grid", gap: 4, maxHeight: 360, overflow: "auto" }}>
        {stored.map(r => (
          <div key={r.u} style={row} data-thumb-stored={r.id || r.u}>
            <span style={{ flex: "1 1 260px", fontSize: 13, color: C.INK }}>{r.t} <span style={quiet}>{r.thumb.attribution || r.plan}{r.thumb.hidden ? " · hidden" : ""}</span></span>
            <DepthButton size="compact" disabled={busy} onClick={() => act("/api/admin/thumbs/hide", "POST", { url: r.u, hidden: !r.thumb.hidden })}>{r.thumb.hidden ? "Show again" : "Hide"}</DepthButton>
          </div>
        ))}
      </div>
    </div>
  );
}
