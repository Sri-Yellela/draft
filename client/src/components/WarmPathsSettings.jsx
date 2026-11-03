// ⭐ D138 (owner 11-02) · WARM PATHS on Account — the user's OWN contacts: LinkedIn's Connections.csv (Settings → Data
// privacy → Get a copy of your data → Connections) or an alumni list they add. The file is read here and its text posted
// to /api/warm-paths/import; nothing is scraped. Private to the user, deletable here; draft never contacts anyone.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import SettingsSection from "./SettingsSection.jsx";

const muted = { color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.5 };
const btn = { padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent",
  color: "var(--color-text)", cursor: "pointer", fontSize: 12 };

export default function WarmPathsSettings({ say = () => {} }) {
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [school, setSchool] = useState("");
  const linkedIn = useRef(), alumni = useRef();
  const load = useCallback(() => api("/api/warm-paths").then(setSummary).catch(() => setSummary(null)), []);
  useEffect(() => { load(); }, [load]);

  async function upload(source, file) {
    if (!file) return;
    setBusy(true);
    try {
      const r = await api("/api/warm-paths/import", { method: "POST",
        body: JSON.stringify({ source, text: await file.text(), ...(source === "alumni" ? { school } : {}) }) });
      say("ok", `Read ${r.imported} people at ${r.companies} companies.`);
      await load();
    } catch (e) { say("error", e.message || "That file could not be read."); }
    finally { setBusy(false); }
  }
  async function remove(source = null, sch = null) {
    if (!window.confirm(source ? "Delete these contacts from draft?" : "Delete every contact you imported?")) return;
    setBusy(true);
    try {
      const q = source ? `?source=${encodeURIComponent(source)}${sch ? `&school=${encodeURIComponent(sch)}` : ""}` : "";
      const r = await api(`/api/warm-paths${q}`, { method: "DELETE" });
      say("ok", `Deleted ${r.deleted}.`);
      await load();
    } catch (e) { say("error", e.message || "Not deleted — try again."); }
    finally { setBusy(false); }
  }

  return (
    <SettingsSection title="Warm paths" subtitle="See who you know at a company when you look at its posting. Only you see them; draft never contacts anyone.">
      <div data-warm-paths="" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={muted}>
          <strong>LinkedIn connections:</strong> on LinkedIn, Settings → Data privacy → Get a copy of your data → Connections.
          Upload the Connections.csv it emails you.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" style={btn} disabled={busy} onClick={() => linkedIn.current?.click()}>Upload Connections.csv</button>
          <input ref={linkedIn} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => { upload("linkedin", e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <div style={muted}><strong>Alumni:</strong> a list with Name and Company columns (a school's public alumni list, a club roster).</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={school} onChange={e => setSchool(e.target.value)} placeholder="School (e.g. Northeastern)" aria-label="School"
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", fontSize: 12 }} />
          <button type="button" style={btn} disabled={busy || !school.trim()} onClick={() => alumni.current?.click()}>Upload alumni list</button>
          <input ref={alumni} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => { upload("alumni", e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        {summary?.sources?.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--color-text)", display: "grid", gap: 4 }}>
            {summary.sources.map(s => (
              <li key={`${s.source}-${s.school}`}>
                {s.source === "linkedin" ? "LinkedIn connections" : `${s.school} alumni`}: {s.people} people at {s.companies} companies{" "}
                <button type="button" style={{ ...btn, padding: "2px 8px" }} disabled={busy} onClick={() => remove(s.source, s.school)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
        {summary?.people > 0 && <button type="button" style={{ ...btn, alignSelf: "flex-start" }} disabled={busy} onClick={() => remove()}>Delete all my contacts</button>}
      </div>
    </SettingsSection>
  );
}
