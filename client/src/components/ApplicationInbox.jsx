// ── D103 · THE TABLE'S INBOX — replies from job sites, sorted by rule, linked to the application ──────
//
// The user forwards ATS mail to a private address (…@in.jobsviadraft.com); employers keep writing to their own
// address and draft never connects to the mailbox. Each message is filed by FIXED RULES (services/inbox.js — no
// model reads mail) into one of nine categories; re-filing is one press and is counted against the rule.
//   · The address is shown only when intake is on (`intake` from GET /api/inbox — the owner's DNS + Resend steps),
//     and only when the user asks for it: asking is what makes one.
//   · Delete one message, or all of them; Stop forwarding revokes the address at once.
import { useCallback, useEffect, useState } from "react";
import { api, authContextQuery } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";

const LABEL = { applied: "Applied", verification: "Verification", interview: "Interview", assessment: "Assessment",
  recruiter: "Recruiter", reminder: "Reminder", offer: "Offer", rejection: "Rejection", other: "Other" };
const COLOUR = { interview: C.SUCCESS, offer: C.SUCCESS, assessment: C.WARNING, rejection: C.DANGER,
  verification: C.INFO, applied: C.INK_MUTED };

const when = (sec) => (sec ? new Date(sec * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");

export default function ApplicationInbox({ theme }) {
  const [data, setData] = useState(null);
  const [category, setCategory] = useState(null);
  const [addr, setAddr] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try { setData(await api(`/api/inbox${category ? `?category=${category}` : ""}`)); }
    catch (e) { setMsg(e.message || "Could not load your inbox."); }
  }, [category]);
  useEffect(() => { load(); }, [load]);

  const act = async (key, fn, done) => {
    setBusy(key); setMsg("");
    try { await fn(); if (done) setMsg(done); await load(); }
    catch (e) { setMsg(e.message || "That did not work — nothing changed."); }
    finally { setBusy(null); }
  };
  const showAddress = () => act("addr", async () => setAddr(await api("/api/inbox/address")));
  const revoke = () => act("revoke", async () => { await api("/api/inbox/address/revoke", { method: "POST" }); setAddr(null); },
    "Forwarding stopped. Mail sent to the old address is no longer accepted.");
  const refile = (m, to) => act(`f${m.id}`, () => api(`/api/inbox/${m.id}/category`, { method: "POST", body: JSON.stringify({ category: to }) }));
  const remove = (m) => act(`d${m.id}`, () => api(`/api/inbox/${m.id}`, { method: "DELETE" }));
  const removeAll = () => {
    if (!window.confirm("Delete every message in your draft inbox? Your own mailbox is not touched.")) return;
    act("all", () => api("/api/inbox", { method: "DELETE" }), "Deleted.");
  };

  const muted = { fontSize: 12, color: theme.textMuted };
  const messages = data?.messages || [];
  return (
    <div data-table-inbox="" style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {!data ? <span style={muted}>{msg || "Loading…"}</span> : !data.intake ? (
          <p style={{ ...muted, margin: 0 }} data-inbox-off="">
            The application inbox is not switched on yet. When it is, you will get a private address to forward
            replies from job sites to — employers keep writing to your own email, and draft never connects to your mailbox.
          </p>
        ) : addr ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, color: theme.text }}>Forward to <b data-inbox-address="">{addr.address}</b></span>
            <ol style={{ ...muted, margin: 0, paddingLeft: 18 }}>{(addr.steps || []).map(s => <li key={s}>{s}</li>)}</ol>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="rm-btn rm-btn-ghost rm-btn-sm" href={`/api/inbox/gmail-filter.xml?${authContextQuery()}`}>Download the Gmail filter</a>
              <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={revoke} disabled={busy === "revoke"}>Stop forwarding</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="rm-btn rm-btn-primary rm-btn-sm" onClick={showAddress} disabled={busy === "addr"}>My forwarding address</button>
            <span style={muted}>Forward replies from job sites to this address. Employers keep writing to your own email; draft never connects to your mailbox.</span>
          </div>
        )}
      </section>

      <div role="group" aria-label="Filter by category" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {[null, ...(data?.categories || [])].map(c => (
          <button key={c || "all"} className={`rm-btn rm-btn-sm ${category === c ? "rm-btn-primary" : "rm-btn-ghost"}`}
            aria-pressed={category === c} onClick={() => setCategory(c)}>{c ? LABEL[c] || c : "All"}</button>
        ))}
        <div style={{ flex: 1 }} />
        {messages.length > 0 && !category && (
          <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={removeAll} disabled={busy === "all"}>Delete all</button>
        )}
      </div>
      {msg && data && <p role="status" style={{ ...muted, margin: 0 }}>{msg}</p>}

      {data && messages.length === 0 && (
        <p style={{ ...muted, margin: 0 }}>{category ? `No ${LABEL[category] || category} messages.` : "No messages yet."}</p>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map(m => (
          <li key={m.id} data-inbox-message={m.id} style={{ padding: "10px 12px", borderRadius: 12, background: theme.surface,
            border: `1px solid ${theme.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={markStyle(COLOUR[m.category] || C.INK_FAINT)}>{LABEL[m.category] || m.category}</span>
              <b style={{ fontSize: 13, color: theme.text, flex: "1 1 200px", minWidth: 0 }}>{m.subject || "(no subject)"}</b>
              <span style={muted}>{when(m.receivedAt)}</span>
            </div>
            <span style={muted}>{m.from}{m.applicationId ? " · linked to an application" : ""}{m.code ? ` · code ${m.code}` : ""}</span>
            {m.preview && <span style={{ fontSize: 12, color: theme.text }}>{m.preview}</span>}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label style={muted}>File as{" "}
                <select value={m.category} disabled={busy === `f${m.id}`} onChange={(e) => refile(m, e.target.value)}>
                  {(data.categories || []).map(c => <option key={c} value={c}>{LABEL[c] || c}</option>)}
                </select>
              </label>
              <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => remove(m)} disabled={busy === `d${m.id}`}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
