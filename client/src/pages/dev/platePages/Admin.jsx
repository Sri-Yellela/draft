// ⭐ D197 Wave 2 #21 · M3 (47j, lane w2-outside) — ADMIN, DENSE: tokens and components only, no new art
// (docs/revamp/admin.md). One representative panel, People → Users: the five groups as the area nav, the sections as binder
// tabs, the stats strip, the filter chips, the users as a Gazetteer, an open person as a fact sheet with its actions (one
// clay write; the guarded writes open a confirm with a "why"). Synthetic people only (example.com). Nothing here ships.
import { useState } from "react";
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { Kickers, FilterChips, StatusTag } from "../../../plate/Marks.jsx";
import { PageTitle, StatsStrip, BinderTabs } from "../../../plate/Plates.jsx";
import { AreaNav } from "../../../plate/Shell.jsx";
import { Gazetteer } from "../../../plate/Lists.jsx";
import { FactSheet } from "../../../plate/Cards.jsx";
import { Ticket } from "../../../plate/Tickets.jsx";

const GROUPS = [
  { id: "today", label: "Today", href: "#today", icon: "needs" },
  { id: "board", label: "The board", href: "#board", icon: "list" },
  { id: "people", label: "People", href: "#people", icon: "network" },
  { id: "data", label: "Data", href: "#data", icon: "library" },
  { id: "system", label: "System", href: "#system", icon: "filters" },
];
const SECTIONS = [["users", "Users"], ["support", "Support"], ["messages", "Messages"], ["alerts", "New-match alerts"], ["network", "Network"], ["reports", "Profile reports"], ["testers", "Testers"]]
  .map(([id, label]) => ({ id, label }));

const NAMES = ["Maya Chen", "Arjun Rao", "Lena Ortiz", "Tomas Weber", "Priya Nair", "Sam Okafor", "Hana Sato", "Diego Lima", "Noor Haddad", "Ivy Brooks", "Owen Price", "Zara Ali"];
const PEOPLE = NAMES.map((name, i) => {
  const user = name.toLowerCase().replace(" ", ".");
  return { id: String(1040 + i), n: String(1040 + i), name, email: `${user}@example.com`, plan: i % 4 === 0 ? "Full" : "Standard",
    seen: ["2 min", "1 h", "3 h", "yesterday", "2 d", "4 d", "6 d", "9 d", "12 d", "20 d", "31 d", "45 d"][i], drafts: String((i * 7) % 11),
    status: i === 6 ? "SUSPENDED" : i === 9 ? "OVERRIDE" : "ACTIVE" };
});
const COLS = [
  { key: "n", label: "ID", kind: "num" }, { key: "name", label: "PERSON", kind: "title" }, { key: "email", label: "EMAIL", kind: "mono" },
  { key: "plan", label: "PLAN" }, { key: "drafts", label: "DRAFTS TODAY", kind: "mono" }, { key: "seen", label: "LAST SEEN", kind: "mono" },
  { key: "status", label: "STATUS", render: (r) => <StatusTag kind={r.status === "ACTIVE" ? "sent" : r.status === "SUSPENDED" ? "needs" : "drafted"}>{r.status}</StatusTag> },
];

export default function AdminMock({ width = 1280 }) {
  const phone = width < 640;
  const [open, setOpen] = useState(PEOPLE[0]);
  const [confirm, setConfirm] = useState(null);
  const [chips, setChips] = useState({ all: true, suspended: false, overrides: false, hideTest: true });
  const toggle = (id) => setChips((c) => (id === "hideTest" ? { ...c, hideTest: !c.hideTest } : { ...c, all: id === "all", suspended: id === "suspended", overrides: id === "overrides" }));
  const shown = PEOPLE.filter((p) => chips.all || (chips.suspended && p.status === "SUSPENDED") || (chips.overrides && p.status === "OVERRIDE"));
  return (
    <PlateRoot region="IV" style={{ minHeight: "100vh", boxSizing: "border-box" }}>
      <AreaNav area="Admin" views={GROUPS} current="people" phone={phone} more={[{ label: "Database inspector", href: "#db" }]}
        search={{ placeholder: "Find a person — name, email, username or id" }}/>
      <div style={{ padding: phone ? "16px 16px 64px" : "20px 24px 72px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 18 }}>
        <Kickers parts={["ADMIN · PEOPLE", "WHO IS USING IT?", "D197 #21 · M3 MOCK · EXAMPLE DATA"]}/>
        <PageTitle as="h1">People</PageTitle>
        <Ticket kicker="DISK · AMBER · 81% FULL" title="The data volume is filling" line="12.1 GB of 15 GB. Admin → Today → Disk shows the largest files." go="Open Disk and backups →" href="#disk"/>
        <BinderTabs label="People" tabs={SECTIONS} selected="users" idBase="pl-admin">
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 14 }}>
            <StatsStrip label="Users" cells={[{ value: 1284, label: "PEOPLE", onClick: () => toggle("all"), pressed: chips.all }, { value: 412, label: "ACTIVE · 7 DAYS" },
              { value: 3, label: "SUSPENDED", onClick: () => toggle("suspended"), pressed: chips.suspended }, { value: 9, label: "OVERRIDES", onClick: () => toggle("overrides"), pressed: chips.overrides }]}/>
            <FilterChips label="Show" onToggle={toggle} chips={[
              { id: "all", label: "Everyone", count: 1284, on: chips.all }, { id: "suspended", label: "Suspended", count: 3, on: chips.suspended },
              { id: "overrides", label: "With an override", count: 9, on: chips.overrides }, { id: "hideTest", label: "Hide internal and test accounts", on: chips.hideTest }]}/>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
              <div style={{ flex: "999 1 640px", minWidth: 0 }}>
                <Gazetteer label="Users" cols={COLS} rows={shown} rowClick onRow={(r) => { setOpen(r); setConfirm(null); }}
                  rowProps={(r) => ({ "aria-selected": open?.id === r.id ? "true" : undefined, style: { cursor: "pointer" } })}/>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <span className="pl-label pl-muted">1–12 OF 1,284</span>
                  <button type="button" className="pl-btn">Next →</button>
                </div>
              </div>
              {open ? (
                <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  <FactSheet kicker={`PERSON · ${open.n}`} label={open.name} rows={[
                    { label: "Name", value: open.name }, { label: "Email", value: open.email }, { label: "Plan", value: open.plan },
                    { label: "Access", value: open.status === "SUSPENDED" ? "Suspended" : "Standard — the plan's limits" },
                    { label: "Drafts today", value: open.drafts }, { label: "Last seen", value: open.seen }]}
                    foot="Notes are private to admins; the person never sees them."/>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button type="button" className="pl-btn pl-btn--primary">Send the reset link</button>
                    <button type="button" className="pl-btn pl-btn--secondary" onClick={() => setConfirm("Sign out everywhere")}>Sign out everywhere</button>
                    <button type="button" className="pl-btn pl-btn--secondary" onClick={() => setConfirm(open.status === "SUSPENDED" ? "Restore the account" : "Suspend the account")}>
                      {open.status === "SUSPENDED" ? "Restore…" : "Suspend…"}
                    </button>
                    <button type="button" className="pl-btn pl-btn--dashed">Change the plan</button>
                  </div>
                  {confirm ? (
                    <div role="dialog" aria-label={confirm} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <Ticket kicker="CONFIRM · KEPT IN THE AUDIT LOG" title={`${confirm}?`} line={`${open.name} — say why; it can be undone from this page.`}/>
                      <label className="pl-label" style={{ display: "flex", flexDirection: "column", gap: 6 }}>WHY (REQUIRED)
                        <input type="text" className="pl-search__input" style={{ border: "var(--pl-border)", borderRadius: "var(--pl-r-input)", padding: "10px 12px", background: "var(--pl-card)" }}
                          placeholder="e.g. support ticket 12 — asked for it"/>
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="pl-btn pl-btn--ink" onClick={() => setConfirm(null)}>{confirm}</button>
                        <button type="button" className="pl-btn" onClick={() => setConfirm(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </BinderTabs>
      </div>
    </PlateRoot>
  );
}
