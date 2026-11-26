// ⭐ D197 Wave 2 · M3 (47j, lane w2-person) · #17 SETTINGS — Appearance, Notifications, Privacy, Account — the mock
// (docs/revamp/settings.md). Plain names in plate styling, the passport's palette (Region V). ⛔ APPEARANCE IS SHOWN
// UNCHANGED (owner 11-06: "customise screen design is very good right now" — ProfilePage.jsx:206): the same preview card,
// the same sections in the same order, the same words, redrawn in plate tokens; the one addition D197 #17 asks for (a Plate
// theme card) is marked ASK THE OWNER. The operable model: the per-event notification table (its caption says what changed).
import { useState } from "react";
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { AreaNav } from "../../../plate/Shell.jsx";
import { Kickers, FilterChips } from "../../../plate/Marks.jsx";
import { StatsStrip, BinderTabs } from "../../../plate/Plates.jsx";
import { Gazetteer } from "../../../plate/Lists.jsx";
import { RegionEmblem } from "../../../plate/Drawings.jsx";
import { SettingsSheet, LabelledField, DrawingToCome } from "../../../plate/Person.jsx";
import { PASSPORT_VIEWS, PASSPORT_MORE } from "./Profile.jsx";

const TABS = [{ id: "appearance", label: "Appearance", sub: "RETAINED" }, { id: "notifications", label: "Notifications", sub: "WHEN WE TELL YOU" },
  { id: "privacy", label: "Privacy and your data", sub: "WHAT WE KEEP" }, { id: "account", label: "Account", sub: "SIGN-IN · PLAN" }];
const HEAD = { appearance: ["Customise", "How draft looks and is laid out for you — saved to your account, so it follows you to every device."],
  notifications: ["When we tell you things", null], privacy: ["What we keep, and for how long", "Application emails in your Inbox are deleted after 6 months. Download everything draft keeps for you, or delete it all."],
  account: ["Signing in and your plan", null] };
const EVENTS = [["picks", "Today's picks are dealt"], ["needs", "An application needs you"], ["sent", "An application was sent"], ["reply", "An employer replied"], ["interview", "An interview is scheduled"]];
const sw = (on, set, label) => <input type="checkbox" role="switch" className="pl-check" checked={on} aria-checked={on} aria-label={label} onChange={(e) => set(e.target.checked)}/>;
const radios = (chips, value, set, label) => <FilterChips label={label} chips={chips.map((c) => ({ ...c, on: c.id === value }))} onToggle={set}/>;
const col = { display: "flex", flexDirection: "column", gap: 20, minWidth: 0 };

function SettingsMockAppearance() {
  const [theme, setTheme] = useState("dusk");
  const [follow, setFollow] = useState(true);
  const [cues, setCues] = useState(false);
  const [sentence, setSentence] = useState("marked");
  const [learning, setLearning] = useState("quiet");
  const [text, setText] = useState("default");
  const [size, setSize] = useState("10");
  const [order, setOrder] = useState("best");
  const [show, setShow] = useState(true);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start" }}>
      <aside className="pl-card" style={{ flex: "1 1 280px", minWidth: 0, maxWidth: 420 }} aria-label="Live preview">
        <div className="pl-card__strip"><span className="pl-label">LIVE PREVIEW</span>
          <button type="button" className="pl-btn pl-btn--flat" aria-expanded={show} onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button></div>
        <div className="pl-card__body">
          <span className="pl-label pl-muted">{`${theme} · filter sentence: ${sentence} · learning links: ${learning} · text size: ${text}${cues ? " · shape cues on" : ""}`.toUpperCase()}</span>
          {show ? <DrawingToCome aspect="4 / 3" kicker="THE SAME PREVIEW (CustomisePreview)" what="today's preview, unchanged — it draws the page in the chosen look"/> : null}
          <p className="pl-body" style={{ fontSize: "var(--pl-t-small)" }}>Drawn with the same styles as the page. Choosing here changes only this preview until you leave — your choice is saved to your account at once.</p>
        </div>
      </aside>
      <div style={{ ...col, flex: "999 1 480px" }}>
        <SettingsSheet kicker="THEME" title="Theme" lead="How draft looks on this account, on every device. Documents — your résumé and cover letter — always stay black on white.">
          {radios([{ id: "dusk", label: "Dusk" }, { id: "dusk-light", label: "Dusk light" }, { id: "plain-light", label: "Plain light" }, { id: "plain-dark", label: "Plain dark" },
            { id: "plate", label: "Plate", tag: "ASK THE OWNER" }], theme, setTheme, "Theme")}
          <label className="pl-body" style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 44 }}>{sw(follow, setFollow, "Follow my system")} Follow my system's light / dark setting</label>
        </SettingsSheet>
        <SettingsSheet kicker="ACCESSIBILITY" title="Accessibility" rows={[{ label: "Shape cues", note: "Adds a symbol and a line style to every status and fit band — ✓ solid, ! dashed, ✕ double, i dotted — so nothing depends on telling colours apart.", control: sw(cues, setCues, "Shape cues") }]}/>
        <SettingsSheet kicker="NARRATION VOICE" title="Narration voice" lead="The voice that reads a deck aloud in Watch. One of this device's own voices — kept in this browser."
          rows={[{ label: "Voice", control: <select className="pl-q-select" aria-label="Voice" defaultValue=""><option value="">The system's default for this language</option></select> }]}/>
        <SettingsSheet kicker="FILTER SENTENCE" title="Filter sentence">{radios([{ id: "marked", label: "Marked words", tag: "REC." }, { id: "calm", label: "Calm boxes" }], sentence, setSentence, "Filter sentence")}</SettingsSheet>
        <SettingsSheet kicker="LEARNING LINKS" title="Learning links">{radios([{ id: "quiet", label: "Quiet", tag: "REC." }, { id: "shown", label: "Shown" }], learning, setLearning, "Learning links")}</SettingsSheet>
        <SettingsSheet kicker="TEXT SIZE" title="Text size">{radios([{ id: "smaller", label: "Smaller" }, { id: "default", label: "Default", tag: "REC." }, { id: "larger", label: "Larger" }, { id: "largest", label: "Largest" }], text, setText, "Text size")}</SettingsSheet>
        <SettingsSheet kicker="TODAY'S PICKS" title="Today's picks" lead="How many cards you're dealt each day, how they are fanned out, and the order they come in.">
          <span className="pl-label pl-muted">CARDS A DAY</span>{radios(["5", "10", "15"].map((n) => ({ id: n, label: `${n} a day` })), size, setSize, "Cards a day")}
          <p className="pl-body" style={{ fontSize: "var(--pl-t-small)" }}>Today's cards are already dealt — a new count starts with tomorrow's deal.</p>
          <span className="pl-label pl-muted">LAYOUT · FINE-TUNE THE FAN (ASK THE OWNER: THE PLATE DECK IS A PILE)</span>
          <span className="pl-label pl-muted">ORDER</span>{radios([{ id: "best", label: "Best first" }, { id: "newest", label: "Newest first" }], order, setOrder, "Deck order")}
        </SettingsSheet>
        <SettingsSheet kicker="RESET" title="Reset" lead="Back to the defaults: your system's light or dark setting, shapes off, the recommended layout, and ten picks a day, best first."
          actions={<button type="button" className="pl-btn">Reset to defaults</button>}/>
      </div>
    </div>
  );
}

function SettingsMockNotifications() {
  const [here, setHere] = useState(false);
  const [prefs, setPrefs] = useState({ "needs:push": true, "needs:email": true, "interview:email": true });
  const [said, setSaid] = useState("");
  const set = (ev, ch, on) => { const next = { ...prefs, [`${ev}:${ch}`]: on }; setPrefs(next); const name = EVENTS.find((e) => e[0] === ev)[1];
    setSaid(`${name}: push ${next[`${ev}:push`] ? "on" : "off"}, email ${next[`${ev}:email`] ? "on" : "off"}.`); };
  return (
    <div style={col}>
      <SettingsSheet kicker="PRODUCT NEWS" title="Product news" lead="Occasional email about what's new in draft. Account and policy notices come either way — they are about your account."
        rows={[{ label: "Email me product news", control: sw(false, () => {}, "Product news") }]}/>
      <SettingsSheet kicker="NOTIFICATIONS" title="The bell always shows these" lead="Choose which also reach you outside draft."
        drawing={<DrawingToCome aspect="1 / 1" kicker="TO COME" what="a signal lamp"/>}
        rows={[{ label: "Push on this browser", note: here ? "This browser gets them." : "Off — turn it on to choose push below.", control: <button type="button" className={here ? "pl-btn" : "pl-btn pl-btn--primary"} aria-pressed={here} onClick={() => setHere(!here)}>{here ? "On" : "Turn on"}</button> },
          ...EVENTS.map(([ev, label]) => ({ label, control: <>
            <label className="pl-label" style={{ display: "inline-flex", gap: 6, alignItems: "center", minHeight: 44 }}>{sw(!!prefs[`${ev}:push`] && here, (on) => set(ev, "push", on), `${label} by push`)} PUSH</label>
            <label className="pl-label" style={{ display: "inline-flex", gap: 6, alignItems: "center", minHeight: 44 }}>{sw(!!prefs[`${ev}:email`], (on) => set(ev, "email", on), `${label} by email`)} EMAIL</label></> })),
          { label: "New jobs that fit you", note: "Only postings that ask for most of your résumé's top skills, still open. At most 5 a day.",
            control: <select className="pl-q-select" aria-label="New jobs that fit you" defaultValue="digest"><option value="off">Off</option><option value="instant">As they arrive</option><option value="digest">A daily digest · 08:00</option></select> }]}
        actions={<><button type="button" className="pl-btn">Send a test notification</button><span className="pl-label pl-muted" aria-live="polite" style={{ alignSelf: "center" }}>{said}</span></>}>
        <p className="pl-body" style={{ fontSize: "var(--pl-t-small)" }}>Notifications never name a company or show your answers — only what happened.</p>
      </SettingsSheet>
    </div>
  );
}

function SettingsMockPrivacy() {
  const [improve, setImprove] = useState(false);
  return (
    <div style={col}>
      <SettingsSheet kicker="YOUR DATA" title="A copy of everything draft keeps for you" lead="As JSON."
        drawing={<RegionEmblem kind="lock" region="V" size={88} label="Security emblem: a lock"/>}
        rows={[{ label: "Download my data", note: "draft-account-2026-11-26.json", control: <button type="button" className="pl-btn">Download my data</button> },
          { label: "Base résumé only", note: "Tailored résumés are not made; your base résumé goes with every application.", control: sw(false, () => {}, "Base résumé only") }]}>
        <Gazetteer label="Generated résumés" cols={[{ key: "job", label: "JOB", kind: "title" }, { key: "status", label: "STATUS" }, { key: "act", label: "ACTIONS", kind: "mono" }]}
          rows={[{ id: "1", job: "Frontend Engineer II · Kestrel Payments", status: "Kept — you applied with it", act: "DOWNLOAD · DELETE" },
            { id: "2", job: "UI Engineer · Halcyon Robotics", status: "Expires in 40 days", act: "DOWNLOAD · DELETE" }]}/>
      </SettingsSheet>
      <SettingsSheet kicker="ASK DRAFT" title="What Ask draft did for you" lead="Each one only after you pressed Confirm."
        rows={[{ label: "Use my questions to improve Atlas", note: "Stored without your name or contact details, and never linked to you.", control: sw(improve, setImprove, "Improve Atlas") },
          { label: "Saved an answer · Sponsorship", value: "confirmed · Nov 20" }, { label: "Opened a job profile · Frontend", value: "cancelled · Nov 18" }]}/>
      <SettingsSheet kicker="DELETE ACCOUNT" tone="danger" title="Delete your account" lead="Deletes your account and everything in it — profiles, résumés, applications, history. This can't be undone. Download your data first if you want a copy."
        actions={<button type="button" className="pl-btn pl-btn--dashed">Delete my account…</button>}/>
    </div>
  );
}

function SettingsMockAccount() {
  return (
    <div style={col}>
      <SettingsSheet kicker="PROFILE" title="Your picture and name" rows={[{ label: "Picture", control: <><button type="button" className="pl-btn">Change picture</button><button type="button" className="pl-btn pl-btn--flat">Remove</button></> }]}>
        <LabelledField label="Display name" value="Maya Chen" onChange={() => {}}/>
      </SettingsSheet>
      <SettingsSheet kicker="EMAIL" title="Email" lead="Used to sign in and to reset your password." rows={[{ label: "Current", value: "maya.chen@example.com" }]}
        actions={<button type="button" className="pl-btn">Change email</button>}/>
      <SettingsSheet kicker="YOUR PHONE" title="Your phone" lead="Confirmed by a one-time code. One draft account per phone number. Never used for marketing."
        rows={[{ label: "+1 617 555 0100", note: "Not confirmed yet", control: <button type="button" className="pl-btn pl-btn--primary">Text me a code</button> }]}/>
      <SettingsSheet kicker="SIGN-IN & SECURITY" title="Signing in" lead="You signed in recently, so changes below are unlocked."
        drawing={<RegionEmblem kind="net" region="IV" size={72} label="Systems emblem: a connected globe — the sign-in methods"/>}
        rows={[{ label: "Password", control: <button type="button" className="pl-btn">Change password</button> },
          { label: "Google", note: "Connected", control: <button type="button" className="pl-btn">Unlink</button> },
          { label: "LinkedIn", note: "Not connected", control: <a className="pl-btn" href="#link">Link</a> }, { label: "GitHub", note: "Not connected", control: <a className="pl-btn" href="#link">Link</a> }]}/>
      <SettingsSheet kicker="WHERE YOU'RE SIGNED IN" title="Sessions" rows={[{ label: "Chrome · Boston", note: "This browser", value: "now" }, { label: "Android app", note: "2 days ago", control: <button type="button" className="pl-btn">Sign out</button> }]}
        actions={<button type="button" className="pl-btn">Sign out everywhere else</button>}/>
      <SettingsSheet kicker="YOUR PLAN AND ALLOWANCE" title="Plan: Free" lead="What you can use and how much of it is left. Need more? Ask in Help below.">
        <StatsStrip label="Your allowance" cells={[{ value: 7, label: "DRAFTS LEFT · 24 H" }, { value: 2, label: "RÉSUMÉS TODAY" }, { value: 31, label: "LAST 30 DAYS" }]}/>
      </SettingsSheet>
      <SettingsSheet kicker="MERGE" title="Merge another account into this one" lead="Signed up twice? Bring the other account's jobs, profiles and sign-in here. The other account is then deleted."
        actions={<button type="button" className="pl-btn">Check another account</button>}/>
      <SettingsSheet kicker="HELP" title="Ask us anything" lead="About your account, résumés, drafts or applications. We reply here and by email."
        rows={[{ label: "Gmail reconnect", note: "Answered · Nov 19", control: <button type="button" className="pl-btn">Open</button> }]} actions={<button type="button" className="pl-btn pl-btn--ink">Contact support</button>}/>
      <SettingsSheet kicker="SIGN OUT" title="Sign out" lead="On this device. Your account and everything in it stay as they are." actions={<button type="button" className="pl-btn">Sign out</button>}/>
    </div>
  );
}

export default function SettingsMock({ width = 1280 }) {
  const phone = width <= 480;
  const [tab, setTab] = useState("appearance");
  const [title, lead] = HEAD[tab];
  return (
    <PlateRoot region="V" style={{ minHeight: "100vh", paddingBottom: 72 }} data-mock="settings">
      <AreaNav area="Your passport" views={PASSPORT_VIEWS} current={null} more={PASSPORT_MORE} phone={phone}
        home={{ href: "#home", label: "draft — the market" }} search={phone ? { onOpen: () => {} } : { placeholder: "Search your passport…" }}/>
      <div className="pl-page" style={{ paddingTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
        <Kickers parts={["YOUR PASSPORT", TABS.find((t) => t.id === tab).label.toUpperCase()]}/>
        {/* D200 Rule 3: a working page — one plain serif line, no hero */}
        <h1 style={{ margin: 0, fontFamily: "var(--pl-serif)", fontWeight: 400, fontSize: "var(--pl-t-working)", lineHeight: 1 }}>{title}</h1>
        {lead ? <p className="pl-body">{lead}</p> : null}
      </div>
      <div className="pl-page" style={{ marginTop: 22 }}>
        <BinderTabs label="Settings" tabs={TABS} selected={tab} onSelect={setTab} idBase="st">
          <div style={{ paddingTop: 18 }}>
            {tab === "appearance" ? <SettingsMockAppearance/> : tab === "notifications" ? <SettingsMockNotifications/> : tab === "privacy" ? <SettingsMockPrivacy/> : <SettingsMockAccount/>}
          </div>
        </BinderTabs>
      </div>
    </PlateRoot>
  );
}
