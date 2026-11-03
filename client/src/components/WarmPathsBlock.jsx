// ⭐ D138 (owner 11-02) · WARM PATHS on a posting — "2 people you know work at Snowflake: a LinkedIn connection (connected
// while you were at Walmart) and a Northeastern alum", from the user's OWN imported contacts (Account → Warm paths).
// "Draft a note": a short note drafted from the facts for the user to edit, copy and send themselves — ⛔ draft never
// sends it. Beside the posting panel, not inside it (the D32 ink pair reads no network). Nothing shows without contacts.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

const quiet = { padding: 0, border: 0, background: "none", color: "var(--color-primary-text)", font: "inherit", fontSize: 12,
  textDecoration: "underline", cursor: "pointer" };

export default function WarmPathsBlock({ jobId }) {
  const [path, setPath] = useState(null);
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setPath(null); setOpen(null);
    if (jobId == null) return undefined;
    let live = true;
    api(`/api/warm-paths/job/${encodeURIComponent(jobId)}`).then(r => live && setPath(r)).catch(() => live && setPath(null));
    return () => { live = false; };
  }, [jobId]);
  if (!path?.count) return null;
  const person = open != null ? path.people[open] : null;
  return (
    <div data-warm-paths-block={path.count} style={{ margin: "0 0 12px", padding: "10px 12px", borderRadius: 8,
      border: "1px solid var(--color-border)", fontSize: 13, lineHeight: 1.5, color: "var(--color-text)" }}>
      <div style={{ fontWeight: 700 }}>{path.line}</div>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
        {path.people.map((p, i) => (
          <li key={i}>
            {p.name}{p.position ? ` · ${p.position}` : ""} — {p.how}{" "}
            <button type="button" style={quiet} onClick={() => { setOpen(open === i ? null : i); setCopied(false); }}>
              {open === i ? "Close" : "Draft a note"}
            </button>
          </li>
        ))}
      </ul>
      {person && (
        <div data-warm-note="">
          <textarea key={open} defaultValue={person.note} rows={8} id={`warm-note-${open}`}
            aria-label={`A note to ${person.name} — edit it before you send it`}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 6, font: "inherit", fontSize: 13, padding: 8,
              borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)" }} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
            <button type="button" style={quiet} onClick={() => {
              const t = document.getElementById(`warm-note-${open}`)?.value ?? person.note;
              navigator.clipboard?.writeText(t).then(() => setCopied(true)).catch(() => setCopied(false));
            }}>{copied ? "Copied" : "Copy the note"}</button>
            {person.url && <a style={quiet} href={person.url} target="_blank" rel="noreferrer">Open their LinkedIn</a>}
            {person.email && <a style={quiet} href={`mailto:${person.email}`}>Email them yourself</a>}
            <span style={{ color: "var(--color-text-faint)" }}>draft never sends it for you.</span>
          </div>
        </div>
      )}
    </div>
  );
}
