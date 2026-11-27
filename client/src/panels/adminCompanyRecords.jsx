// ⭐ A142 (45o) · Admin → The board → Company records — the D179 report's weak point: "production's company records and
// duplicates were never counted — build the count into Admin → Board so it is read without a DB shell". The records'
// counts (GET /api/admin/company-records), what the stats lacked (…/health: postings with no record, records sharing a
// domain or a name), and the review queue's unsure pairs with the three decisions (merge · keep apart · subsidiary).
// Nothing merges by itself.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Btn, Panel, row, quiet, sub } from "./adminKit.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const n = (v) => (v == null ? "—" : Number(v).toLocaleString());

function Groups({ title, g, testid }) {
  if (!g) return null;
  return (
    <div style={{ ...sub, marginBottom: 10 }} data-company-dupes={testid}>
      <div style={{ fontWeight: 600 }}>{title}: {n(g.groups)} groups · {n(g.records)} records</div>
      {g.top.length === 0 && <div style={quiet}>None.</div>}
      {g.top.map(x => (
        <div key={x.key} style={{ fontSize: ts(13), margin: "4px 0" }}>
          <span style={quiet}>{x.key}</span> — {x.records.map((r, i) => (
            <span key={r.id}>{i ? " · " : ""}<a href={`/companies/${encodeURIComponent(r.slug)}`} target="_blank" rel="noreferrer">{r.name}</a> ({n(r.open)} open)</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CompanyRecordsTab() {
  const [d, setD] = useState(null);
  const [h, setH] = useState(null);
  const [said, setSaid] = useState("");
  const load = useCallback(() => {
    api("/api/admin/company-records").then(setD).catch(e => setSaid(e.message));
    api("/api/admin/company-records/health").then(setH).catch(e => setSaid(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (id, decision) => {
    try { await api(`/api/admin/company-records/review/${id}`, { method: "POST", body: JSON.stringify({ decision }) }); setSaid(`Pair ${id}: ${decision}.`); load(); }
    catch (e) { setSaid(e.message); }
  };
  const s = d?.stats;
  return (
    <Panel title="Company records" data-admin-company-records=""
      purpose="One company = one record (D179 P4a). The counts, the postings no record covers yet, records that look like one company twice, and the unsure pairs — merged only when you say so.">
      {said && <div style={quiet} role="status">{said}</div>}
      <div style={{ ...row, margin: "6px 0 12px", gap: 18 }} data-company-counts="">
        <span><b>{n(s?.companies)}</b> records</span>
        <span><b>{n(h?.recordsWithOpenJobs)}</b> with open jobs</span>
        <span><b>{n(s?.withDomain)}</b> with a domain</span>
        <span><b>{n(s?.aliases)}</b> aliases</span>
        <span><b>{n(s?.linkedPostings)}</b> postings linked</span>
        <span data-company-unlinked={h?.postingsNoRecord ?? ""}><b>{n(h?.postingsNoRecord)}</b> of {n(h?.openPostings)} open postings with no record</span>
        <span><b>{n(s?.reviewOpen)}</b> pairs to review</span>
      </div>
      {h?.asOf && <div style={quiet}>Counted {new Date(h.asOf).toLocaleString()}{h.refreshing ? " · recounting" : ""}. The linker: {d?.walk?.state || "idle"}.</div>}
      <Groups title="Same domain" g={h?.sameDomain} testid="domain" />
      <Groups title="Same name (case, punctuation and Inc / LLC / Ltd ignored)" g={h?.sameName} testid="name" />
      <div style={{ fontWeight: 600, margin: "10px 0 6px" }}>Unsure pairs</div>
      {d?.review?.length === 0 && <div style={quiet}>None waiting.</div>}
      {d?.review?.map(r => (
        <div key={r.id} style={{ ...sub, marginBottom: 8 }} data-company-review={r.id}>
          <div style={{ fontSize: ts(13) }}>
            <a href={`/companies/${encodeURIComponent(r.a_slug)}`} target="_blank" rel="noreferrer">{r.a_name}</a>{r.a_domain ? ` (${r.a_domain})` : ""}
            {" "}and{" "}
            <a href={`/companies/${encodeURIComponent(r.b_slug)}`} target="_blank" rel="noreferrer">{r.b_name}</a>{r.b_domain ? ` (${r.b_domain})` : ""}
            <span style={quiet}> — {r.reason}</span>
          </div>
          <div style={{ ...row, marginTop: 6 }}>
            <Btn onClick={() => decide(r.id, "merge")}>Merge the second into the first</Btn>
            <Btn onClick={() => decide(r.id, "apart")}>Keep apart</Btn>
            <Btn onClick={() => decide(r.id, "parent")}>Second is a subsidiary</Btn>
          </div>
        </div>
      ))}
    </Panel>
  );
}
