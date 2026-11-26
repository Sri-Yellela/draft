// ⭐ D197 Wave 2 · #14 · M3 (47j, lane w2-public) · NETWORK → "Correspondence" — People as a gazetteer, the feed as
// dispatches, messages as letters, every composer a Send ticket. Only plate library pieces; synthetic people (Maya Chen is
// the reader; Priya Raman, Diego Alvarez, Sam Okafor, Lena Park, Tomás Reyes). M1 / M2: docs/revamp/network.md.
// Served at /dev/plate?page=network (&w=390). D180 is OFF until counsel — this is a mock, nothing ships.
import { useState } from "react";
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { AreaNav } from "../../../plate/Shell.jsx";
import { Kickers, StatusTag, LetterTile } from "../../../plate/Marks.jsx";
import { LegHeader } from "../../../plate/Plates.jsx";
import { Gazetteer } from "../../../plate/Lists.jsx";
import { Ticket } from "../../../plate/Tickets.jsx";
import { CorrespondenceLetter } from "../../../plate/Correspondence.jsx";
import { DrawingToCome } from "../../../plate/Drawings.jsx";
import { isPhone } from "./publicFixtures.jsx";

const VIEWS = [
  { id: "people", label: "People", href: "#people", icon: "network" },
  { id: "dispatches", label: "Dispatches", href: "#dispatches", icon: "list" },
  { id: "letters", label: "Letters", href: "#letters", icon: "replies" },
];
const who = (name, handle) => ({ name, href: `#in-${handle}` });
const name = (r) => <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}><LetterTile name={r.title} size="sm"/><a href={r.href} style={{ fontWeight: 700, color: "var(--pl-ink)" }}>{r.title}</a></span>;
const acts = (...labels) => () => <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>{labels.map((l, i) => <button key={l} type="button" className={`pl-btn ${i === 0 && l === "Accept" ? "pl-btn--ink" : "pl-btn--paper"}`}>{l}</button>)}</span>;

/** The Send ticket: every composer (a letter, a dispatch, a request's note) — write, tear, send. */
function SendTicket({ kicker, to, placeholder, send = "Send", note }) {
  return (
    <div className="pl-ticket" style={{ flex: "none" }}>
      <div className="pl-ticket__head">
        <span className="pl-label">{kicker}</span>
        {to ? <span className="pl-ticket__title">{to}</span> : null}
        {note ? <span className="pl-ticket__line">{note}</span> : null}
        <textarea className="pl-textarea" rows={3} placeholder={placeholder} aria-label={placeholder}/>
      </div>
      <div aria-hidden="true" className="pl-tear"/>
      <span className="pl-ticket__go" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" className="pl-btn pl-btn--primary">{send}</button><button type="button" className="pl-btn pl-btn--paper">Cancel</button>
      </span>
    </div>
  );
}

function People() {
  return (
    <>
      <section aria-labelledby="nw-req">
        <LegHeader n={1} id="nw-req" meta="A REQUEST STAYS A REQUEST UNTIL YOU ACCEPT · THEY AREN'T TOLD IF YOU DECLINE" title="Waiting on you"/>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 260px", minWidth: 0 }}><DrawingToCome what="a sealed letter on a doorstep" aspect="640 / 420" note="DRAWING TO COME"/></div>
          <div style={{ flex: "999 1 520px", minWidth: 0 }}>
            <Gazetteer label="Requests" cols={[{ key: "title", label: "NAME", render: name }, { key: "who", label: "WHO" }, { key: "note", label: "THEIR NOTE" }, { key: "s", label: "", render: () => <StatusTag>WAITING ON YOU</StatusTag> }, { key: "a", label: "", render: acts("Accept", "Decline", "Block") }]}
              rows={[{ id: "l", title: "Lena Park", href: "#in-lena", who: "Frontend Engineer · Northwind Analytics", note: "“We met at the Boston React meetup.”" }]}/>
          </div>
        </div>
      </section>
      <section aria-labelledby="nw-people">
        <LegHeader n={2} id="nw-people" meta="YOUR PEOPLE · 3 CONNECTIONS · ANYONE'S PUBLIC PAGE HAS CONNECT" title="The gazetteer of people"/>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 18 }}>
          <Gazetteer label="Your people" cols={[{ key: "title", label: "NAME", render: name }, { key: "who", label: "WHERE THEY ARE" }, { key: "a", label: "", render: acts("Message", "Remove", "Block") }]}
            rows={[{ id: "p", title: "Priya Raman", href: "#in-priya", who: "Staff Engineer · Kestrel Payments" }, { id: "d", title: "Diego Alvarez", href: "#in-diego", who: "Data Engineer · Halcyon Robotics" }, { id: "s", title: "Sam Okafor", href: "#in-sam", who: "Designer · Fieldwork" }]}/>
          <Gazetteer label="Asked, waiting" cols={[{ key: "title", label: "NAME", render: name }, { key: "who", label: "WHO" }, { key: "a", label: "", render: acts("Withdraw") }]}
            rows={[{ id: "t", title: "Tomás Reyes", href: "#in-tomas", who: "Engineering Manager · Orbital Works" }]}/>
          <Gazetteer label="Maybe you know" cols={[{ key: "title", label: "NAME", render: name }, { key: "who", label: "WHY" }, { key: "a", label: "", render: acts("Connect") }]}
            rows={[{ id: "m", title: "Ana Silva", href: "#in-ana", who: "Also worked at Toast" }]}/>
          <p className="pl-body pl-muted">Suggestions come only from public pages that share your workplace or school — never from an address book.</p>
          <Gazetteer label="Blocked" cols={[{ key: "title", label: "NAME", render: name }, { key: "a", label: "", render: acts("Unblock") }]} rows={[{ id: "b", title: "J. Doe", href: "#in-jdoe" }]}/>
        </div>
      </section>
    </>
  );
}

function Dispatches({ phone }) {
  return (
    <section aria-labelledby="nw-disp">
      <LegHeader n={3} id="nw-disp" meta="NEWEST FIRST · NEVER RANKED · NO AI READS IT" title="Dispatches"/>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <SendTicket kicker="A DISPATCH · TO YOUR CONNECTIONS" placeholder="Something worth knowing — a tip, a win, a question" send="Post"
            note="Only your connections see it, newest first. No AI reads it."/>
          <CorrespondenceLetter kind="dispatch" from={who("Diego Alvarez", "diego")} when="NOV 23 · 18:02" proof={{ label: "PASSED · WEBHOOKS" }}
            text="Finally get why retries need idempotency keys." link="https://example.com/notes/idempotency"
            actions={<><button type="button" className="pl-btn pl-btn--paper" aria-pressed="false">Helpful · 4</button><button type="button" className="pl-btn pl-btn--paper">Comment · 2</button><button type="button" className="pl-btn pl-btn--paper">Report</button></>}/>
          <CorrespondenceLetter kind="dispatch" from={who("Priya Raman", "priya")} when="NOV 22 · 09:40" text="Kestrel's checkout team is hiring — worth a look if you build payments UIs."
            job={{ title: "Frontend Engineer II, Checkout", company: "Kestrel Payments", place: "Boston, MA", href: "#opening" }}
            actions={<><button type="button" className="pl-btn pl-btn--paper" aria-pressed="true">Helpful ✓ · 7</button><button type="button" className="pl-btn pl-btn--paper">Comment</button><button type="button" className="pl-btn pl-btn--paper">Report</button></>}/>
          <button type="button" className="pl-btn pl-btn--dashed" style={{ alignSelf: "flex-start" }}>Older dispatches</button>
        </div>
        <aside style={{ flex: "1 1 250px", maxWidth: phone ? "none" : 270, minWidth: 0 }} aria-label="What you share">
          <div className="pl-card">
            <div className="pl-card__strip"><span className="pl-label">WHAT YOU SHARE</span><span className="pl-label pl-muted">ALL OFF TO START</span></div>
            <div className="pl-card__body">
              {["A check passed on Atlas", "A job you applied to", "A new role you started"].map((k, i) => (
                <label key={k} className="pl-card__item"><input type="checkbox" className="pl-check" defaultChecked={i === 0}/> {k}</label>
              ))}
              <span className="pl-body pl-muted">Only what you turn on here is posted to your connections for you.</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Letters({ phone }) {
  const [open, setOpen] = useState(true);
  const list = (
    <Gazetteer label="Letters" rowClick onRow={() => setOpen(true)}
      cols={[{ key: "title", label: "NAME", render: name }, { key: "last", label: "LAST LINE" }, { key: "when", label: "WHEN", kind: "mono" }, { key: "n", label: "", render: (r) => (r.n ? <span className="mark-count" aria-label={`${r.n} unread`}>{r.n}</span> : null) }]}
      rows={[{ id: "p", title: "Priya Raman", href: "#in-priya", last: "Want an intro?", when: "NOV 24", n: 2 }, { id: "s", title: "Sam Okafor", href: "#in-sam", last: "This message was removed.", when: "NOV 20", n: 0 }]}/>
  );
  const thread = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {phone ? <button type="button" className="pl-btn pl-btn--paper" onClick={() => setOpen(false)}>‹ All letters</button> : null}
        <span className="pl-label">CORRESPONDENCE · PRIYA RAMAN</span><span className="pl-grow"/>
        <button type="button" className="pl-btn pl-btn--paper" aria-haspopup="true" aria-expanded="false">Mute · Report · Block</button>
      </div>
      <span className="pl-label pl-muted" data-no-ai="">NO AI READS THIS CONVERSATION UNLESS YOU ASK</span>
      <CorrespondenceLetter from={who("Priya Raman", "priya")} when="NOV 24 · 9:12" text="Saw Kestrel is hiring for checkout — your Toast work is exactly it. Want an intro?"
        job={{ title: "Frontend Engineer II, Checkout", company: "Kestrel Payments", place: "Boston, MA", href: "#opening" }}
        actions={<><button type="button" className="pl-btn pl-btn--paper">Delete for me</button><button type="button" className="pl-btn pl-btn--paper">Report</button></>}/>
      <CorrespondenceLetter mine when="NOV 24 · 9:40" text="Yes please — thank you!" actions={<button type="button" className="pl-btn pl-btn--paper">Delete for me</button>}/>
      <SendTicket kicker="A LETTER · TO PRIYA RAMAN" placeholder="Write a message" note="Ctrl + Enter sends."/>
    </div>
  );
  return (
    <section aria-labelledby="nw-let">
      <LegHeader n={4} id="nw-let" meta="SEALED · A STRANGER'S LINK IS NEVER CLICKABLE" title="Letters"/>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <Ticket tone="clay-tint" kicker="A REQUEST · LENA PARK ISN'T A CONNECTION" title="Lena Park wrote to you" line="Reply only if you accept — links here aren't clickable."
          go="Accept · Decline · Report"/>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start" }}>
          {!phone || !open ? <div style={{ flex: "1 1 320px", minWidth: 0 }}>{list}</div> : null}
          {!phone || open ? <div style={{ flex: "999 1 480px", minWidth: 0 }}>{thread}</div> : null}
        </div>
      </div>
    </section>
  );
}

export default function NetworkMock({ width }) {
  const phone = isPhone(width);
  const [view, setView] = useState("people");
  return (
    <PlateRoot region="VI" style={{ minHeight: "100vh", fontSize: "var(--pl-t-ui-lg)", lineHeight: 1.5 }}>
      <AreaNav area="Correspondence" views={VIEWS} current={view} phone={phone} onGo={(id) => setView(id)}
        search={{ placeholder: "A name or a company…" }}/>{/* the unread chip waits on a NavChip "unread" kind (network.md §6) */}
      <main className="pl-page" style={{ display: "flex", flexDirection: "column", gap: 40, paddingTop: 24, paddingBottom: 72 }}>
        <section style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }} aria-labelledby="nw-title">
          <div style={{ flex: "999 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <Kickers parts={["CORRESPONDENCE", view.toUpperCase(), "EXAMPLE DATA · OFF UNTIL COUNSEL"]}/>
            <h1 id="nw-title" className="pl-mk-hero__title">Your correspondence</h1>
            <p className="pl-mk-hero__line">People you know on draft. A request stays a request until they accept; you can block anyone, any time.</p>
            <p className="pl-label pl-muted" role="status" aria-live="polite">CONNECTED.</p>
          </div>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}><DrawingToCome what="a dispatch rider's route between camps" aspect="640 / 360" note="HERO · DRAWING TO COME"/></div>
        </section>
        {view === "people" ? <People/> : view === "dispatches" ? <Dispatches phone={phone}/> : <Letters phone={phone}/>}
        <section aria-label="Where to go next" className="pl-tickets">
          <Ticket kicker="THE MARKET" title="Send a job to someone" line="Every opening has Send — it arrives as a job card in their letters." go="Open the market →" href="#market"/>
          <Ticket kicker="SURVEY SHEETS" title="Who works where you're applying" line="A connection who shows their experience there can be asked for a referral." go="Open a survey sheet →" href="#survey"/>
        </section>
      </main>
    </PlateRoot>
  );
}
