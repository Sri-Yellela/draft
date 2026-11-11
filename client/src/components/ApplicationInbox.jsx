// ── D103 · THE TABLE'S INBOX — replies from job sites, sorted by rule, linked to the application ──────
//
// The user forwards ATS mail to a private address (…@in.jobsviadraft.com); employers keep writing to their own
// address and draft never connects to the mailbox. Each message is filed by FIXED RULES (services/inbox.js — no
// model reads mail) into one of nine categories; re-filing is one press and is counted against the rule.
//   · The address is shown only when intake is on (`intake` from GET /api/inbox — the owner's DNS + Resend steps),
//     and only when the user asks for it: asking is what makes one.
//   · Delete one message, or all of them; Stop forwarding revokes the address at once.
//   · ⭐ D112 item 2: OR connect Gmail (GmailConnection below) — offered only when the owner has set the Google client
//     (`available` from GET /api/gmail/status). What is read is stated before the press: mail from the job sites'
//     systems and about the companies applied to, nothing else, no attachments. Disconnect revokes it at Google.
//     While the Google app is in Testing mode, a test user's grant lasts seven days — the note says so.
import { useCallback, useEffect, useState } from "react";
import { api, authContextQuery } from "../lib/api.js";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

// D182 (45n): a message carries no category mark — its "File as [category]" select already says it.
const LABEL = { applied: "Applied", verification: "Verification", interview: "Interview", assessment: "Assessment",
  recruiter: "Recruiter", reminder: "Reminder", offer: "Offer", rejection: "Rejection", other: "Other" };

// ⭐ D112 · the Gmail connection: connect (a navigation to Google's consent), the connected state, Disconnect.
// ⭐ D167: exported — Profile → Connections draws this same control (pages/profile/ProfilePage.jsx).
export function GmailConnection({ theme, onChange }) {
  const [g, setG] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(() => {
    try {
      const v = new URLSearchParams(window.location.search).get("gmail");
      return { connected: "Gmail connected. Replies from job sites will appear here within a few minutes.",
        declined: "Gmail was not connected.", scope_not_granted: "Gmail was not connected: the permission to read mail was not ticked.",
        expired: "That took too long — press Connect Gmail again.", error: "Gmail could not be connected. Try again." }[v] || "";
    } catch { return ""; }
  });
  const load = useCallback(async () => { try { setG(await api("/api/gmail/status")); } catch { setG(null); } }, []);
  useEffect(() => { load(); }, [load]);
  if (!g || !g.available) return null;
  const muted = { fontSize: ts(12), color: theme.textMuted };
  const off = async () => {
    if (!window.confirm("Disconnect Gmail? draft stops reading at once and Google's permission is revoked. Messages already in your draft inbox stay until you delete them.")) return;
    setBusy(true);
    try { const r = await api("/api/gmail/disconnect", { method: "POST" }); setNote(r.revoked ? "Gmail disconnected and the permission revoked." : "Gmail disconnected. Google did not confirm the revoke — you can also remove draft at myaccount.google.com/permissions."); await load(); onChange?.(); }
    catch (e) { setNote(e.message || "That did not work — nothing changed."); }
    finally { setBusy(false); }
  };
  const reads = (
    <span style={muted} data-gmail-reads="">
      draft reads only mail from job sites' application systems ({(g.reads?.senders || []).slice(0, 6).join(", ")} and others)
      and mail about the companies you have applied to{g.reads?.companies?.length ? ` (${g.reads.companies.slice(0, 5).join(", ")}${g.reads.companies.length > 5 ? " …" : ""})` : ""}.
      Nothing else in your mailbox is read, attachments are never opened, and draft never sends or changes mail.
    </span>
  );
  const weekly = g.testingMode && (
    <span style={muted} data-gmail-weekly="">While draft's Google app is in testing, Google ends the connection after 7 days — reconnect once a week.</span>
  );
  return (
    <div data-gmail-connection={g.status} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {g.connected ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: ts(13), color: theme.text }}>Gmail connected{g.email ? <> · <b>{g.email}</b></> : null}</span>
          <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={off} disabled={busy}>Disconnect Gmail</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <a className="rm-btn rm-btn-primary rm-btn-sm" href={`/api/gmail/connect?${authContextQuery()}`} data-gmail-connect="">
            {g.status === "expired" ? "Reconnect Gmail" : "Connect Gmail"}</a>
          {g.status === "expired" && <span style={muted}>The Gmail connection ended — reconnect to keep reading replies.</span>}
        </div>
      )}
      {reads}
      {weekly}
      {note && <span role="status" style={muted}>{note}</span>}
    </div>
  );
}

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

  const muted = { fontSize: ts(12), color: theme.textMuted };
  const messages = data?.messages || [];
  return (
    <div data-table-inbox="" style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <GmailConnection theme={theme} onChange={load} />
        {!data ? <span style={muted}>{msg || "Loading…"}</span> : !data.intake ? (
          <p style={{ ...muted, margin: 0 }} data-inbox-off="">
            The application inbox is not switched on yet. When it is, you will get a private address to forward
            replies from job sites to — employers keep writing to your own email, and with forwarding draft never connects to your mailbox.
          </p>
        ) : addr ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: ts(13), color: theme.text }}>Forward to <b data-inbox-address="">{addr.address}</b></span>
            <ol style={{ ...muted, margin: 0, paddingLeft: 18 }}>{(addr.steps || []).map(s => <li key={s}>{s}</li>)}</ol>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="rm-btn rm-btn-ghost rm-btn-sm" href={`/api/inbox/gmail-filter.xml?${authContextQuery()}`}>Download the Gmail filter</a>
              <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={revoke} disabled={busy === "revoke"}>Stop forwarding</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="rm-btn rm-btn-primary rm-btn-sm" onClick={showAddress} disabled={busy === "addr"}>My forwarding address</button>
            <span style={muted}>Forward replies from job sites to this address. Employers keep writing to your own email; with forwarding, draft never connects to your mailbox.</span>
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
              <b style={{ fontSize: ts(13), color: theme.text, flex: "1 1 200px", minWidth: 0 }}>{m.subject || "(no subject)"}</b>
              <span style={muted}>{when(m.receivedAt)}</span>
            </div>
            <span style={muted}>{m.from}{m.source === "gmail" ? " · via Gmail" : ""}{m.applicationId ? " · linked to an application" : ""}{m.code ? ` · code ${m.code}` : ""}</span>
            {m.preview && <span style={{ fontSize: ts(12), color: theme.text }}>{m.preview}</span>}
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
