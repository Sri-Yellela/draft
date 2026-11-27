// ⭐ D197 Wave 2 #9 · M5 (47m, lane person) · YOUR PASSPORT — Profile → Your profile rebuilt in the plate system from the
// approved mock (pages/dev/platePages/Profile.jsx) and the approved board `Passport` (docs/sketches/final/project/
// Passport.dc.html, Region V). docs/revamp/profile.md holds every M1 row and its home; nothing the D183 page did is lost:
//   THE HERO          the passport open at its identity page (the ported PassportIdentityPage, the person's own fields),
//                     the name as the title, the headline, the four answering stats (PROVEN · FROM YOUR RÉSUMÉ ·
//                     SECTIONS SHOWN · COMPLETE — each jumps to its section, D200 Rule 2), View as the public · Share link ·
//                     Edit, and YOUR NEXT STAMP (the top unproven résumé skill → Atlas) — the page's one clay point, which
//                     moves to What changed / the four things while either is open.
//   THE SOURCE LINE   Built from <file> · read <date> · Replace résumé · Open in the editor (D157), the replace's status,
//                     its error and the another-family choice drawn where the button is (45s).
//   01 WHO CAN SEE IT the visa page: the passport's level (Only you · Connections · Public, consent before widening), each
//                     section's own eye (narrows, never widens), Let search engines find it; the identity page (photo,
//                     headline, handle, fits / pick your role, open to work · referrals).
//   02 About · 03 The road so far · 04 Stamps (+ the proof page, folded in — agent's pick) · 05 Where you fit ·
//   06 Work you can show (projects, achievements, links) · 07 Schooling — the D101 editors (components/ProfileSections.jsx)
//                     edit each section in place, exactly as before; each section has its drawing.
//   08 THE SEALED PAGES  Behind your profile — never public, one folded row at a time, each editor mounted when opened.
// ⛔ What a visitor sees is decided on the server (GET /api/profile/page?as=public — services/profilePage.js viewFor);
// View as the public draws exactly that answer, never a client-side filter of the owner's page.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { useTheme } from "../../styles/theme.jsx";
import { useAccountAvatar, announceAccountChanged } from "../../lib/accountAvatar.js";
import { openResumeEditor } from "../../lib/resumeEditor.js";
import { RESUME_REPLACED_EVENT } from "../../panels/ProfilePanel.jsx";
import ProfileSections from "../../components/ProfileSections.jsx";
import { FourThingsTicket, RankingTerms, SecondFamilyChoice } from "./ResumeSetup.jsx";   // D186
import { PASSPORT_STAMPS_EVENT } from "./profilePanels.js";
import { Kickers, LetterTile } from "../../plate/Marks.jsx";
import { PageTitle, StatsStrip, LegHeader, PlateHero } from "../../plate/Plates.jsx";
import { Ticket } from "../../plate/Tickets.jsx";
import { FactSheet } from "../../plate/Cards.jsx";
import { RouteLine } from "../../plate/Lists.jsx";
import { RegionEmblem } from "../../plate/Drawings.jsx";
import { ErrorLine, Skeleton } from "../../plate/PlateState.jsx";
import { PassportIdentity, VisibilityControl, PassportStamps, SettingsSheet, LabelledField } from "../../plate/Person.jsx";
import PassportIdentityPage from "../../plate/drawings/PassportIdentityPage.jsx";
import PassportRoad from "../../plate/drawings/PassportRoad.jsx";
import PlaceHazardSeal from "../../plate/drawings/PlaceHazardSeal.jsx";
import ProfileFieldBook from "../../plate/drawings/ProfileFieldBook.jsx";
import ProfileSpecimenDrawer from "../../plate/drawings/ProfileSpecimenDrawer.jsx";
import ProfileSchoolhouse from "../../plate/drawings/ProfileSchoolhouse.jsx";
import MarketSurveyPlate from "../../plate/drawings/MarketSurveyPlate.jsx";

const LEVELS = [["only_me", "Only you"], ["connections", "Connections"], ["public", "Public"]];
const RANK = { only_me: 0, connections: 1, public: 2 };
const WORD = Object.fromEntries(LEVELS);
const SEEN_BY = { only_me: "only you", connections: "your connections", public: "the public" };
const day = (t) => (Number(t) > 0 ? new Date(Number(t) * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");
const HOW = { built: "built", checked: "passed a check" };
/** The page's sections in the order the server names them (services/profilePage.js PAGE_SECTIONS) and their passport names. */
export const PASSPORT_SECTIONS = Object.freeze([["about", "About"], ["experience", "The road so far"], ["skills", "Stamps"], ["fit", "Where you fit"],
  ["projects", "Projects"], ["achievements", "Achievements"], ["education", "Schooling"], ["links", "Links"]]);
const SECTION_DEFAULT_OWN = { fit: "only_me" };   // the server's SECTION_DEFAULTS: a section that starts narrower than the page
const proveHref = (name) => `/app/atlas/your-skills?prove=${encodeURIComponent(name)}`;

// ── the marks: GitHub and LinkedIn as their own logos (owner 11-08), in the plate's ink; anything else a link icon.
const MARK_PATHS = {
  github: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  linkedin: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
};
const SITE = { github: "GitHub", linkedin: "LinkedIn" };

/** PURE. A link's kind from its address (the server's services/profilePage.js linkKind, for links the editor holds). */
export function linkKindOf(url) {
  let host = "";
  try { host = new URL(String(url)).hostname.toLowerCase().replace(/^www\./, ""); } catch { return { kind: "web", host: String(url || "") }; }
  if (host === "github.com" || host.endsWith(".github.com")) return { kind: "github", host };
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return { kind: "linkedin", host };
  return { kind: "web", host };
}

export function LinkMark({ url, name }) {
  const { kind, host } = linkKindOf(url);
  const label = String(url || "").replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "");
  const aria = SITE[kind] ? `${name || "This person"} on ${SITE[kind]}` : `${name ? `${name}'s` : "A"} link: ${host}`;
  return (
    <a className="pl-pp-link" href={url} target="_blank" rel="noopener noreferrer nofollow" aria-label={aria} data-link-mark={kind}>
      {MARK_PATHS[kind]
        ? <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d={MARK_PATHS[kind]} /></svg>
        : <LetterTile name={host || "link"} size="sm" />}
      <span>{label}</span>
    </a>
  );
}

// ⭐ D113 consent wording for public profiles (owner 11-08, decision (5)); ⭐ A233: the promises as ✓ / ✕. Kept word for word.
export const PUBLIC_CONSENT_ITEMS = {
  public: [
    { ok: true, text: "Anyone with its link sees the sections you leave visible." },
    { ok: true, text: "People can find it by your name in draft's search, shown with your workplace and school when those sections are visible." },
    { ok: false, text: "Your contact details and everything under Behind your profile are never shown." },
    { ok: true, text: "You can make it private again at any time, and the link stops showing it at once." },
  ],
  connections: [
    { ok: true, text: "The people you connect with on draft see the sections you leave visible." },
    { ok: false, text: "Your contact details and everything under Behind your profile are never shown." },
    { ok: true, text: "You can change this at any time." },
  ],
};

/** A numbered section of the passport: the leg header, the main column and the drawing beside it. */
function PassportLeg({ n, id, meta, title, side = null, children, data }) {
  return (
    <section className="pl-section pl-pp-leg" aria-labelledby={`${id}-t`} id={id} {...data}>
      <LegHeader n={n} meta={meta} title={<span id={`${id}-t`}>{title}</span>} />
      <div className="pl-pp-row">
        <div className="pl-pp-main">{children}</div>
        {side ? <div className="pl-pp-side">{side}</div> : null}
      </div>
    </section>
  );
}

/** 01 · the visa page — the passport's level, its consent, each section's eye, the search-engine switch. */
function VisaPage({ vis, onSet }) {
  const [asking, setAsking] = useState(null);
  const choose = (k) => {
    if (vis.page === k) return;
    if (RANK[k] > RANK[vis.page]) setAsking(k); else onSet({ page: k });
  };
  const eye = (id) => (k) => onSet({ section: id, level: k === vis.page && !SECTION_DEFAULT_OWN[id] ? null : k });
  return (
    <div className="pl-pp-visa" data-who-can-see="">
      <div className="pl-pp-visa__row" data-visa-row="page">
        <b>The whole passport</b>
        <VisibilityControl value={vis.page} onChange={choose} label="Who can see your profile" />
      </div>
      {asking ? (
        <div role="alertdialog" aria-label={`Make your profile ${WORD[asking].toLowerCase()}`} data-visibility-consent={asking}>
          <SettingsSheet kicker={asking === "public" ? "IF YOU MAKE IT PUBLIC" : "IF YOU SHOW IT TO CONNECTIONS"}
            title={asking === "public" ? "Make your passport public?" : "Show your passport to your connections?"}
            rows={PUBLIC_CONSENT_ITEMS[asking].map((p) => ({ label: `${p.ok ? "✓" : "✕"} ${p.text}`, control: <span /> }))}
            actions={<>
              <button type="button" className="pl-btn pl-btn--ink" data-consent-yes="" onClick={() => { onSet({ page: asking }); setAsking(null); }}>
                {asking === "public" ? "Make it public" : "Show it to connections"}</button>
              <button type="button" className="pl-btn" data-consent-no="" onClick={() => setAsking(null)}>Keep it as it is</button>
            </>} />
        </div>
      ) : null}
      <p className="pl-pp-note">Each page of the passport has its own eye — it can be narrower than the passport, never wider. Contact details and everything under <b>the sealed pages</b> are never public.</p>
      {PASSPORT_SECTIONS.map(([id, name]) => (
        <div key={id} className="pl-pp-visa__row" data-section-eye={id}>
          <span>{name}</span>
          <VisibilityControl compact value={vis.effective[id] || vis.page} cap={vis.page} label={`Who can see ${name}`} onChange={eye(id)} />
        </div>
      ))}
      <label className="pl-pp-check">
        <input type="checkbox" className="pl-check" checked={!!vis.searchable} disabled={vis.page !== "public"} data-searchable=""
          onChange={(e) => onSet({ searchable: e.target.checked })} />
        Let search engines find it{vis.page !== "public" ? " (only for a public profile)" : ""}
      </label>
    </div>
  );
}

/** ⭐ P3 · the public link's handle — chosen once, editable, unique (the server refuses a taken or reserved one). */
function HandleEditor({ handle, onSaved }) {
  const [v, setV] = useState(handle || "");
  const [msg, setMsg] = useState("");
  useEffect(() => { setV(handle || ""); }, [handle]);
  const save = async (e) => {
    e.preventDefault(); setMsg("");
    try { onSaved(await api("/api/profile/page/handle", { method: "PUT", body: JSON.stringify({ handle: v.trim().toLowerCase() }) })); setMsg("Saved."); }
    catch (x) { setMsg(x.message || "Not saved."); }
  };
  return (
    <form className="pl-pp-form" onSubmit={save} data-handle-editor="">
      <LabelledField label={`Your public link · ${typeof window !== "undefined" ? window.location.host : "draft.work"}/in/`} value={v}
        onChange={(x) => setV(x.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30))} note="3–30 letters, numbers or dashes." />
      <div className="pl-actions">
        <button type="submit" className="pl-btn" disabled={!v || v === handle}>Save link</button>
        {msg ? <span className="pl-pp-note" role="status">{msg}</span> : null}
      </div>
    </form>
  );
}

/** ⭐ (B)-1 (45o): "we couldn't place you — pick your role" — the taxonomy's roles; the pick becomes the placement. Never a guess. */
function PickRole({ onPage }) {
  const [cats, setCats] = useState(null);
  const [sub, setSub] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { let live = true; fetch("/api/public/jobs/facets").then((r) => r.json()).then((d) => live && setCats(d.categories || [])).catch(() => live && setCats([])); return () => { live = false; }; }, []);
  const save = async () => {
    try { onPage?.(await api("/api/profile/placement", { method: "PUT", body: JSON.stringify({ subcategory: sub }) })); setMsg(""); }
    catch (e) { setMsg(e.message || "That didn't save."); }
  };
  return (
    <div className="pl-pp-form" data-placement-asks="">
      <span className="pl-pp-note">We couldn't place you from your résumé — pick your role:</span>
      <div className="pl-actions">
        <select className="pl-q-select" value={sub} onChange={(e) => setSub(e.target.value)} aria-label="Your role" data-pick-role="">
          <option value="">Choose…</option>
          {(cats || []).map((c) => (
            <optgroup key={c.id} label={c.name}>{c.subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
          ))}
        </select>
        <button type="button" className="pl-btn" disabled={!sub} onClick={save}>Save</button>
      </div>
      {msg ? <span className="pl-pp-note" role="status">{msg}</span> : null}
    </div>
  );
}

function PhotoUpload({ has }) {
  const ref = useRef(null);
  const [msg, setMsg] = useState("");
  const send = async (file) => {
    if (!file) return;
    setMsg("Uploading…");
    try {
      const form = new FormData(); form.append("avatar", file);
      await api("/api/account/avatar", { method: "POST", body: form });
      announceAccountChanged();
      setMsg("");
    } catch (e) { setMsg(e.message || "The picture could not be uploaded."); }
    finally { if (ref.current) ref.current.value = ""; }
  };
  return (
    <span className="pl-pp-photo">
      <button type="button" className="pl-btn" onClick={() => ref.current?.click()} data-photo-upload="">{has ? "Change photo" : "Add a photo"}</button>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => send(e.target.files?.[0])} />
      {msg ? <span className="pl-pp-note" role="status"> {msg}</span> : null}
    </span>
  );
}

/** The identity page: photo, name, headline, the mono fields, open to work — Edit opens the headline, the link and the switches. */
function IdentityPage({ page, avatarUrl, editing, onSet, onPage }) {
  const h = page.header;
  const p = h.placement;
  const isPublic = page.visibility.page === "public";
  const [headline, setHeadline] = useState(h.headline || "");
  useEffect(() => { setHeadline(h.headline || ""); }, [h.headline]);
  const publicUrl = h.handle ? `${window.location.origin}/in/${h.handle}` : null;
  const linkWords = publicUrl ? publicUrl.replace(/^https?:\/\//, "") : null;
  const fields = [
    { label: "HANDLE", value: linkWords ? (isPublic
      ? <a href={publicUrl} target="_blank" rel="noopener noreferrer" data-public-link="">{linkWords}</a>
      : <span data-public-link="" title="Only you can see your profile — this link shows “This profile is private.”">{linkWords}</span>) : null },
    { label: "FITS", value: p && !p.asks ? <span data-placement="">{p.subName} · {p.levelLabel}{p.also ? ` · also ${p.also.subName}` : ""}</span> : null },
    { label: "LOCATION · YEARS", value: [h.location, h.years != null ? `${h.years} year${h.years === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || null },
  ];
  const open = [h.openToWork ? "Open to work" : null, h.referrals ? "referrals welcome" : null].filter(Boolean).join(" · ");
  return (
    <PassportIdentity name={h.name} headline={h.headline} photo={avatarUrl || null} region="V" level={page.visibility.page} fields={fields}
      open={editing ? null : open || null} photoAction={<PhotoUpload has={!!avatarUrl} />} data-profile-header="">
      <div className="pl-pp-identity__more" data-open-to-work="">
        {p?.asks ? <PickRole onPage={onPage} /> : null}
        {editing ? (
          <>
            <form className="pl-pp-form" onSubmit={(e) => { e.preventDefault(); onSet({ headline: headline.trim() || null }); }}>
              <LabelledField label="Headline" value={headline} onChange={(v) => setHeadline(v.slice(0, 160))} note="Up to 160 characters." placeholder="Data engineer · streaming pipelines" />
              <div className="pl-actions"><button type="submit" className="pl-btn">Save</button></div>
            </form>
            <label className="pl-pp-check"><input type="checkbox" className="pl-check" checked={!!h.openToWork} onChange={(e) => onSet({ openToWork: e.target.checked })} /> Open to work</label>
            <label className="pl-pp-check"><input type="checkbox" className="pl-check" checked={!!h.referrals} onChange={(e) => onSet({ referrals: e.target.checked })} /> Referrals welcome</label>
          </>
        ) : null}
        {editing || !h.handle ? <HandleEditor handle={h.handle} onSaved={onPage} /> : null}
      </div>
    </PassportIdentity>
  );
}

function SourceLine({ source, onReplace }) {
  const openEditor = async () => {
    try {
      const r = await api("/api/base-resume");
      if (!r?.content) return;
      const isHtml = /<\s*(html|body|div|p|h\d|ul|section)\b/i.test(r.content);
      const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
      openResumeEditor({
        html: isHtml ? r.content : `<pre style="white-space:pre-wrap;font:inherit">${esc(r.content)}</pre>`,
        title: "Your base résumé", company: "",
        // A plain-text résumé is read here, never rewritten as HTML behind the person's back.
        readOnly: !isHtml, readOnlyNote: isHtml ? "" : "This résumé is plain text — replace it to change it.",
        onSave: isHtml ? (html) => api("/api/base-resume", { method: "POST", body: JSON.stringify({ content: html, name: r.name }) }) : undefined,
      });
    } catch { /* the editor host shows its own error */ }
  };
  return (
    <div className="pl-pp-source" data-source-line="">
      <span className="pl-label">{source ? `BUILT FROM ${String(source.name).toUpperCase()}${source.at ? ` · READ ${day(source.at).toUpperCase()}` : ""}` : "NO RÉSUMÉ YET"}</span>
      <span className="pl-pp-note">{source ? "Replacing it re-fills every section; what you added by hand stays." : "Add your résumé and every section fills from it."}</span>
      <span className="pl-grow" />
      <button type="button" className="pl-btn" onClick={onReplace} data-replace-resume="">{source ? "Replace résumé" : "Add your résumé"}</button>
      {source ? <button type="button" className="pl-btn" onClick={openEditor} data-open-editor="">Open in the editor</button> : null}
    </div>
  );
}

/** 05 · where you fit: ready %, what moves it, the family decision, Fly my route. */
function WhereYouFit({ fit }) {
  if (!fit) return <p className="pl-body" data-section="fit">Add your résumé and draft places you in a job family and level.</p>;
  const p = fit.placement;
  return (
    <div className="pl-pp-stack" data-section="fit">
      {fit.thin || fit.ready == null ? <p className="pl-body">{fit.line}</p> : (
        <>
          <p className="pl-body"><b>{fit.ready}% ready</b> for {fit.role} — the proven skills count most.</p>
          {(fit.waiting || fit.scope) ? <p className="pl-pp-note">{fit.waiting ? `+${fit.waiting}% waiting in skills from your résumé` : ""}{fit.waiting && fit.scope ? " · " : ""}{fit.scope || ""}</p> : null}
          {fit.moves?.length > 0 ? (
            <p className="pl-pp-note">What moves it most: {fit.moves.map((m, i) => <span key={m.slug || m.name}>{i ? ", " : ""}<b>{m.name}</b> (+{m.adds}%)</span>)}</p>
          ) : null}
          <div className="pl-actions"><a className="pl-btn pl-btn--ink" href="/app/atlas/your-map">Fly my route</a></div>
        </>
      )}
      {p ? <p className="pl-pp-note">Your résumé places you in <b>{p.categoryName} › {p.subName}</b>, {p.levelLabel} — your job profiles and the board follow it.</p> : null}
    </div>
  );
}

function Achievements({ items, onAdd, onRemove }) {
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="pl-card" data-section="achievements">
      <div className="pl-card__strip"><span className="pl-label">ACHIEVEMENTS · {items.length}</span></div>
      <div className="pl-card__body">
        {items.length ? (
          <ul className="pl-pp-list">{items.map((a, i) => (
            <li key={`${a.source}-${a.id ?? i}`} data-achievement={a.source}>
              <b>{a.title}</b>
              <span className="pl-pp-note"> {[a.detail || (a.source === "hand" ? "Added by you" : null), a.year || (a.at ? day(a.at) : null)].filter(Boolean).join(" · ")}</span>
              {a.source === "hand" ? <button type="button" className="pl-btn pl-btn--flat" aria-label={`Remove ${a.title}`} onClick={() => onRemove(a.id)}>Remove</button> : null}
            </li>
          ))}</ul>
        ) : <p className="pl-pp-note">Certifications and awards from your résumé, and modules you finish in Atlas, show here.</p>}
        <form className="pl-pp-inline" onSubmit={async (e) => {
          e.preventDefault(); setErr("");
          try { await onAdd({ title, year: year || null }); setTitle(""); setYear(""); } catch (x) { setErr(x.message || "Not added."); }
        }}>
          <LabelledField label="Add one — a certification or an award" value={title} onChange={(v) => setTitle(v.slice(0, 120))} />
          <LabelledField label="Year" value={year} onChange={(v) => setYear(v.replace(/\D/g, "").slice(0, 4))} />
          <button type="submit" className="pl-btn" disabled={!title.trim()}>Add</button>
        </form>
        {err ? <p role="alert" className="pl-pp-note">{err}</p> : null}
      </div>
    </div>
  );
}

const MARK = { added: "+", removed: "−", changed: "↻" };

/** ⭐ (B)-3 (45o): the one What changed line that waits for the person — Apply for me's new family. */
function FamilyDecision({ line, onPage }) {
  const [done, setDone] = useState(null);
  const answer = async (a) => {
    try { const r = await api(`/api/profile/apply-for-me/${a}`, { method: "POST", body: "{}" }); setDone(a); if (r?.page) onPage?.(r.page); }
    catch (e) { setDone(`error: ${e.message}`); }
  };
  return (
    <div className="pl-pp-stack" data-family-decision="">
      <b>{line.text}</b>
      <span className="pl-pp-note">{line.detail}</span>
      {done ? <span className="pl-pp-note" role="status">{done === "keep" ? "Kept — Apply for me follows your new résumé." : done === "change-back" ? "Changed back — Apply for me looks for what it did before." : done}</span> : (
        <div className="pl-actions">
          <button type="button" className="pl-btn" onClick={() => answer("keep")} data-family-keep="">Keep</button>
          <button type="button" className="pl-btn" onClick={() => answer("change-back")} data-family-change-back="">Change back</button>
        </div>
      )}
    </div>
  );
}

// ⭐ B-2's last piece (46f): "— N picks today" on the Where-you-fit line — the card reads today's deal (the deck's own call).
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function usePicksToday(wanted) {
  const [n, setN] = useState(null);
  useEffect(() => {
    if (!wanted) return undefined;
    let live = true;
    api(`/api/draft/today?date=${encodeURIComponent(localDay())}&order=best`)
      .then((d) => { if (live && d?.reason !== "scoring" && Array.isArray(d?.cards)) setN(d.cards.length); })
      .catch(() => { /* no count, no claim */ });
    return () => { live = false; };
  }, [wanted]);
  return n;
}

/** ⭐ D183 P2 · What changed — the replace already happened; this is so nothing changes silently. The clay point while open. */
function ReplaceWhatChanged({ r, onKeep, onUndo, busy, onPage }) {
  const [review, setReview] = useState(false);
  const picks = usePicksToday(r.lines.some((l) => l.what === "fit" && l.detail));
  const shown = review ? r.lines : r.lines.slice(0, 6);
  return (
    <section className="pl-card pl-pp-changed" data-what-changed="" aria-live="polite">
      <div className="pl-card__strip"><span className="pl-label">NEW RÉSUMÉ{r.name ? ` · ${String(r.name).toUpperCase()}` : ""} · READ {day(r.at).toUpperCase()}</span><span className="pl-label">YOUR PASSPORT NOW FOLLOWS IT</span></div>
      <div className="pl-card__body">
        {r.lines.length ? (
          <ul className="pl-pp-list">{shown.map((l, i) => l.what === "apply_for_me" ? (
            <li key={i} data-change="decision"><FamilyDecision line={l} onPage={onPage} /></li>
          ) : (
            <li key={i} data-change={l.kind}><span className="pl-pp-mark" aria-hidden="true">{MARK[l.kind] || "·"}</span>
              <span>{l.text}{l.what === "fit" && picks != null ? <span data-change-picks=""> — {picks} pick{picks === 1 ? "" : "s"} today</span> : null}{l.was ? <span className="pl-pp-note"> · was: {l.was}</span> : null}{l.detail ? <span className="pl-pp-note"> · {l.detail}</span> : null}</span></li>
          ))}</ul>
        ) : <p className="pl-pp-note">Nothing on your page changed — the new résumé reads the same.</p>}
        {r.kept?.length > 0 ? <p data-change-kept=""><span className="pl-pp-mark" aria-hidden="true">✓</span> Kept: {r.kept.join(", ")}</p> : null}
        <p data-change-untouched=""><span className="pl-pp-mark" aria-hidden="true">✓</span> Untouched: {r.untouched}</p>
        <div className="pl-actions">
          <button type="button" className="pl-btn pl-btn--primary" onClick={onKeep} disabled={busy} data-change-keep="">Looks right</button>
          {r.undoable ? <button type="button" className="pl-btn" onClick={onUndo} disabled={busy} data-change-undo="">Undo — back to the old résumé</button> : null}
          {r.lines.length > 6 && !review ? <button type="button" className="pl-btn" onClick={() => setReview(true)}>Review each change</button> : null}
        </div>
        <p className="pl-pp-note">Applied straight away — this summary is so nothing changes silently. Undo works for 30 days.</p>
      </div>
    </section>
  );
}

/** View as the public — exactly the server's answer for a signed-out visitor (GET /api/profile/page?as=public). */
function PublicPreview({ view, avatarUrl }) {
  if (!view) return <div className="pl-page"><Skeleton label="Loading the public view" height={260} lines={4} /></div>;
  if (view.private) return (
    <PassportLeg n={1} id="pp-public" meta="WHAT A VISITOR SEES" title="This profile is private" data={{ "data-public-preview": "private" }}>
      <p className="pl-body">A visitor sees only this line. Choose Connections or Public on the visa page to show it.</p>
    </PassportLeg>
  );
  const h = view.header, s = view.sections;
  const sec = (k) => s[k] != null;
  return (
    <div data-public-preview="">
      <PassportLeg n={1} id="pp-public" meta="WHAT A VISITOR SEES · THE SERVER'S OWN ANSWER" title={h.name}>
        <PassportIdentity name={h.name} headline={h.headline} photo={h.avatar && avatarUrl ? avatarUrl : null} region="V" level="public"
          fields={[{ label: "LOCATION", value: h.location || null }]}
          open={[h.openToWork ? "Open to work" : null, h.openToWork ? h.area : null, h.referrals ? "referrals welcome" : null].filter(Boolean).join(" · ") || null} />
      </PassportLeg>
      {s.about?.summary ? <PassportLeg n={2} id="pp-pub-about" meta="ABOUT" title="About"><p className="pl-body">{s.about.summary}</p></PassportLeg> : null}
      {s.experience?.items?.length > 0 ? (
        <PassportLeg n={3} id="pp-pub-road" meta="EXPERIENCE" title="The road so far">
          {s.experience.items.map((x) => <FactSheet key={x.id} kicker={`${String(x.company || "").toUpperCase()} · ${String(x.title || "").toUpperCase()}`} rows={(x.bullets || []).map((b, i) => ({ label: b, value: i + 1 }))} />)}
        </PassportLeg>
      ) : null}
      {sec("skills") ? (
        <PassportLeg n={4} id="pp-pub-stamps" meta="PROVEN ON DRAFT · NOT A CERTIFICATION" title="Stamps">
          <PassportStamps proven={s.skills.proven.map((x) => ({ name: x.name }))} listed={s.skills.fromResume.map((x) => ({ name: x.name }))} />
          <p className="pl-pp-note">“Proven on draft” means a check passed or a build linked, with its date — not a certification.</p>
        </PassportLeg>
      ) : null}
      {s.fit ? <PassportLeg n={5} id="pp-pub-fit" meta="WHERE THEY FIT" title="Where you fit"><p className="pl-body">{s.fit.line}</p></PassportLeg> : null}
      {s.projects?.items?.length > 0 || s.achievements?.items?.length > 0 || s.links?.items?.length > 0 ? (
        <PassportLeg n={6} id="pp-pub-work" meta="PROJECTS · ACHIEVEMENTS · LINKS" title="Work you can show">
          {s.projects?.items?.length > 0 ? <FactSheet kicker={`PROJECTS · ${s.projects.items.length}`} rows={s.projects.items.map((x) => ({ label: x.name, value: x.description || "" }))} /> : null}
          {s.achievements?.items?.length > 0 ? <FactSheet kicker={`ACHIEVEMENTS · ${s.achievements.items.length}`} rows={s.achievements.items.map((a, i) => ({ label: a.title, value: a.year || "" , key: i }))} /> : null}
          {s.links?.items?.length > 0 ? <div className="pl-actions">{s.links.items.map((l) => <LinkMark key={l.url} url={l.url} name={h.name} />)}</div> : null}
        </PassportLeg>
      ) : null}
      {s.education?.items?.length > 0 ? (
        <PassportLeg n={7} id="pp-pub-school" meta="EDUCATION" title="Schooling">
          {s.education.items.map((x) => <FactSheet key={x.id} kicker={String(x.school || "").toUpperCase()} rows={[{ label: [x.degree, x.field].filter(Boolean).join(", ") || "—", value: x.end || "" }]} />)}
        </PassportLeg>
      ) : null}
      <PassportLeg n={8} id="pp-pub-sealed" meta="NEVER SHOWN TO THE PUBLIC" title="The sealed pages" data={{ "data-not-shown": "" }}
        side={<RegionEmblem kind="lock" region="V" size={96} label="Security emblem: a lock — the sealed pages" />}>
        <p className="pl-body">Contact details, application defaults, job profiles and saved answers{view.hidden.length ? `, and: ${view.hidden.join(", ")}` : ""}.</p>
      </PassportLeg>
    </div>
  );
}

/** A153 · one sealed page: its title and one-line summary, folded; the editor mounts the first time it opens and stays mounted. */
function SealedRow({ id, title, summary, open, onOpen, children }) {
  const [shown, setShown] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { if (open === id) { setShown(true); setMounted(true); } }, [open, id]);
  return (
    <details className="pl-pp-sealed" data-behind-row={id} open={shown}
      onToggle={(e) => { const o = e.currentTarget.open; setShown(o); if (o) setMounted(true); else if (open === id) onOpen?.(null); }}>
      <summary><b>{title}</b> <span className="pl-pp-note">{summary}</span></summary>
      <div className="pl-pp-sealed__body">{mounted ? children : null}</div>
    </details>
  );
}

/** The drawing's mono fields from the person's own page (never the board's example person). */
function passportDrawing(page, seenBy) {
  const h = page.header, sk = page.sections.skills;
  const words = String(h.name || "").trim().split(/\s+/).filter(Boolean);
  const last = words.length > 1 ? words[words.length - 1] : words[0] || "";
  const first = words.length > 1 ? words.slice(0, -1).join(" ") : "";
  const up = (s) => String(s || "").toUpperCase();
  const mrzWord = (s) => up(s).replace(/[^A-Z0-9]+/g, "<");
  const p = h.placement && !h.placement.asks ? h.placement : null;
  return {
    name: words.length ? up(first ? `${last}, ${first}` : last) : "NOT SET",
    handle: h.handle ? `@${h.handle}` : "NOT SET",
    fits: p ? up([p.subName, p.levelLabel].filter(Boolean).join(" · ")) : "NOT SET",
    place: h.location ? up(h.location) : "NOT SET",
    years: h.years != null ? String(h.years) : "—",
    openTo: [h.openToWork ? "WORK" : null, h.referrals ? "REFERRALS" : null].filter(Boolean).join(" · ") || "NOT SAID",
    mrz: [["P", "DRAFT", mrzWord(last), "", mrzWord(first)].join("<").padEnd(25, "<").slice(0, 25), `${sk.counts.proven}PROVEN<<${sk.counts.fromResume}LISTED`.padEnd(25, "<").slice(0, 25)],
    stamps: sk.proven.slice(0, 3).map((x) => ({ name: x.name, sub: up([day(x.at), HOW[x.how]].filter(Boolean).join(" · ")) })),
    notYet: sk.fromResume[0]?.name || "",
    seenBy,
    label: `Your passport, open at its identity page: ${h.name || "your name"}${p ? `, ${p.subName}` : ""}; ${sk.counts.proven} proven stamp${sk.counts.proven === 1 ? "" : "s"} on the facing page; this page is seen by ${seenBy}`,
  };
}

export default function YourProfile({ behind = null }) {
  const { theme } = useTheme();
  const { url: avatarUrl } = useAccountAvatar();
  const [page, setPage] = useState(null);
  const [err, setErr] = useState("");
  const [loadErr, setLoadErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(null);   // null = your view; { view } = the public view
  const [behindRow, setBehindRow] = useState(null);   // A153: the sealed page the page asks to open
  const [completeness, setCompleteness] = useState(null);
  const [fourOpen, setFourOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [replaced, setReplaced] = useState(null);
  const [changeBusy, setChangeBusy] = useState(false);
  const [round, setRound] = useState(0);   // remounts the section editors after a replace / undo so they re-read
  const load = useCallback(() => {
    setLoadErr("");
    api("/api/profile/page").then(setPage).catch((e) => setLoadErr(e.message || "Your profile could not be read."));
    api("/api/profile/sections").then((r) => setCompleteness(r?.completeness || null)).catch(() => {});
  }, []);
  const loadChange = useCallback(() => api("/api/profile/replacements/latest").then((r) => setReplaced(r?.replacement || null)).catch(() => {}), []);
  useEffect(() => { load(); loadChange(); }, [load, loadChange]);
  // A résumé saved or uploaded under the sealed pages: re-read the page and its What changed.
  useEffect(() => {
    const on = () => { load(); loadChange(); setRound((x) => x + 1); };
    window.addEventListener(RESUME_REPLACED_EVENT, on);
    return () => window.removeEventListener(RESUME_REPLACED_EVENT, on);
  }, [load, loadChange]);
  const keepChange = async () => {
    setChangeBusy(true);
    try { await api(`/api/profile/replacements/${replaced.id}/keep`, { method: "POST" }); setReplaced(null); }
    catch (e) { setErr(e.message || "Not saved."); } finally { setChangeBusy(false); }
  };
  const undoChange = async () => {
    setChangeBusy(true);
    try { const r = await api(`/api/profile/replacements/${replaced.id}/undo`, { method: "POST" }); setReplaced(null); if (r?.page) setPage(r.page); setRound((x) => x + 1); }
    catch (e) { setErr(e.message || "Not undone."); } finally { setChangeBusy(false); }
  };

  const set = async (body) => {
    setErr("");
    try { setPage(await api("/api/profile/page/visibility", { method: "PUT", body: JSON.stringify(body) })); }
    catch (e) { setErr(e.message || "Not saved."); }
  };
  const togglePreview = async () => {
    if (preview) return setPreview(null);
    setPreview({ view: null });
    try { setPreview({ view: await api("/api/profile/page?as=public") }); } catch (e) { setErr(e.message || "The public view could not be read."); setPreview(null); }
  };
  // ⭐ A153 (45o): the page's OWN Replace résumé — read the PDF → save it as the job profile's base résumé → re-extract the
  // signals, then re-read and show What changed (RESUME_REPLACED_EVENT, P2).
  const replaceRef = useRef(null);
  const [replacing, setReplacing] = useState(false);
  const [choice, setChoice] = useState(null);   // D186-3: { text, name, preview } — a résumé from another family
  const [replaceErr, setReplaceErr] = useState("");
  const replaceNoteRef = useRef(null);
  const showNote = () => setTimeout(() => replaceNoteRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" }), 60);
  const replace = () => {
    if (replaceRef.current) { replaceRef.current.click(); return; }
    setBehindRow("resumes");
    setTimeout(() => document.querySelector('[data-behind-row="resumes"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const replaceInto = async (profileId, text, name) => {
    await api(`/api/domain-profiles/${profileId}/base-resume`, { method: "POST", body: JSON.stringify({ content: text, name }) });
    await api(`/api/domain-profiles/${profileId}/signals/refresh`, { method: "POST" });
  };
  const replaceWith = async (file) => {
    if (!file) return;
    setReplacing(true); setErr(""); setReplaceErr(""); setChoice(null);
    try {
      const form = new FormData(); form.append("file", file);
      const parsed = await api("/api/parse-pdf", { method: "POST", body: form });
      const text = parsed?.text || "";
      if (!page?.activeProfileId) {
        // ⭐ D186-3: the first résumé creates the job profile — no Job Profiles step first.
        await api("/api/domain-profiles/from-resume", { method: "POST", body: JSON.stringify({ content: text, name: file.name }) });
      } else {
        // ⭐ D186-3: a résumé from ANOTHER family asks first — its own job profile (the default) or a replace.
        const prev = await api("/api/domain-profiles/resume-preview", { method: "POST", body: JSON.stringify({ content: text }) }).catch(() => null);
        if (prev && !prev.sameFamily && !prev.sample) { setChoice({ text, name: file.name, preview: prev }); showNote(); return; }
        await replaceInto(page.activeProfileId, text, file.name);
      }
      window.dispatchEvent(new Event(RESUME_REPLACED_EVENT));
    } catch (e) { setReplaceErr(e.message || "The résumé could not be replaced."); showNote(); }
    finally { setReplacing(false); if (replaceRef.current) replaceRef.current.value = ""; }
  };
  const chooseNew = async () => {
    setReplacing(true);
    try { await api("/api/domain-profiles/from-resume", { method: "POST", body: JSON.stringify({ content: choice.text, name: choice.name, asNew: true }) }); setChoice(null); window.dispatchEvent(new Event(RESUME_REPLACED_EVENT)); }
    catch (e) { setReplaceErr(e.message || "The job profile could not be made."); showNote(); } finally { setReplacing(false); }
  };
  const chooseReplace = async () => {
    setReplacing(true);
    try { await replaceInto(page.activeProfileId, choice.text, choice.name); setChoice(null); window.dispatchEvent(new Event(RESUME_REPLACED_EVENT)); }
    catch (e) { setReplaceErr(e.message || "The résumé could not be replaced."); showNote(); } finally { setReplacing(false); }
  };
  const drawing = useMemo(() => (page ? passportDrawing(page, SEEN_BY[page.visibility.page] || SEEN_BY.only_me) : null), [page]);
  const stampCount = page?.sections?.skills?.counts?.proven;
  useEffect(() => { if (Number.isFinite(stampCount)) window.dispatchEvent(new CustomEvent(PASSPORT_STAMPS_EVENT, { detail: stampCount })); }, [stampCount]);

  if (!page) return (
    <div className="pl-page pl-pp-loading" data-your-profile="">
      {loadErr ? <ErrorLine text={loadErr} onRetry={load} /> : <Skeleton label="Loading your passport" height={420} lines={5} />}
    </div>
  );
  const vis = page.visibility;
  const s = page.sections;
  const h = page.header;
  const publicUrl = h.handle ? `${window.location.origin}/in/${h.handle}` : null;
  const share = async () => {
    if (!publicUrl) return;
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link is on the page */ }
  };
  const jump = (id) => () => document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  const shownCount = PASSPORT_SECTIONS.filter(([id]) => RANK[vis.effective[id] || vis.page] >= 1).length;
  const nextSkill = s.skills.fromResume[0] || null;
  const clayElsewhere = !!replaced || fourOpen;   // the one clay point moves to what needs the person
  const caption = preview
    ? (preview.view?.private ? "Seen by the public: only “This profile is private.”" : `Seen by the public: ${PASSPORT_SECTIONS.length - (preview.view?.hidden?.length || 0)} of ${PASSPORT_SECTIONS.length} sections shown, the sealed pages never.`)
    : `Your view. Your passport is seen by ${SEEN_BY[vis.page]}.`;
  const firstEmpty = completeness && completeness.done < completeness.of ? "pp-about" : "pp-visa";

  return (
    <div className="pl-pp" data-your-profile="">
      {/* the hero: the person's page is a destination (D200 Rule 3) — the passport open at its identity page */}
      <header className="pl-hero pl-pp-hero">
        <div className="pl-pp-hero__plate">
          <PlateHero aspect="620 / 440">
            <PassportIdentityPage {...drawing} />
          </PlateHero>
        </div>
        <div className="pl-hero__main">
          <Kickers parts={["YOUR PASSPORT", `${SEEN_BY[vis.page].toUpperCase()} ${vis.page === "only_me" ? "CAN SEE IT" : "SEE THIS PAGE"}`]} />
          <PageTitle stop={false}>{h.name || "Your passport"}</PageTitle>
          <p className="pl-lead">{h.headline || "No headline yet — Edit to add one."}</p>
          <StatsStrip label="Your passport at a glance" cells={[
            { value: s.skills.counts.proven, label: "PROVEN", onClick: jump("pp-stamps"), aria: "Proven skills — go to your stamps" },
            { value: s.skills.counts.fromResume, label: "FROM YOUR RÉSUMÉ", onClick: jump("pp-stamps"), aria: "Skills from your résumé — go to your stamps" },
            { value: `${shownCount} / ${PASSPORT_SECTIONS.length}`, label: "SECTIONS SHOWN", onClick: jump("pp-visa"), aria: "Sections others can see — go to who can see it" },
            { value: completeness ? `${completeness.done} / ${completeness.of}` : null, label: "COMPLETE", onClick: jump(firstEmpty), aria: "How complete your passport is — go to the first section to fill" },
          ]} />
          <div className="pl-actions">
            <button type="button" className="pl-btn" onClick={togglePreview} aria-pressed={!!preview} data-view-as-public="">{preview ? "Back to your view" : "View as the public"}</button>
            <button type="button" className="pl-btn" onClick={share} disabled={!publicUrl} data-share-link=""
              title={publicUrl ? "Copy your public link" : "Your public link comes with the public page"}>{copied ? "Copied" : "Share link"}</button>
            <button type="button" className="pl-btn pl-btn--ink" onClick={() => { setEditing((x) => !x); if (!editing) jump("pp-visa")(); }} aria-pressed={editing} data-edit-header="">{editing ? "Done" : "Edit"}</button>
          </div>
          {nextSkill && !preview ? (
            <div className="pl-pp-next" data-next-stamp="">
              <Ticket tone={clayElsewhere ? "plain" : "clay-tint"} kicker="YOUR NEXT STAMP" title={`Prove ${nextSkill.name}`}
                line="On your résumé, not yet proven · about 5 min" go="GO →" href={proveHref(nextSkill.name)} />
            </div>
          ) : null}
          <p className="pl-label pl-muted" aria-live="polite" data-passport-caption="">{caption}</p>
        </div>
      </header>

      {err ? <div className="pl-page"><p role="alert" className="pl-pp-err">{err}</p></div> : null}
      {preview ? <PublicPreview view={preview.view} avatarUrl={avatarUrl} /> : (
        <>
          <div className="pl-page pl-pp-top">
            <SourceLine source={page.source} onReplace={replace} />
            <input ref={replaceRef} type="file" accept="application/pdf,.pdf" hidden data-replace-file=""
              onChange={(e) => replaceWith(e.target.files?.[0])} />
            {replacing ? <p className="pl-pp-note" role="status" data-replacing="">Reading your new résumé and re-filling every section…</p> : null}
            {/* ⛔ 45s (owner 11-09): the choice and the upload's error are drawn where Replace sits, and scrolled into view. */}
            <div ref={replaceNoteRef} data-replace-note="">
              {replaceErr ? <p role="alert" className="pl-pp-err" data-replace-error="">{replaceErr}</p> : null}
              {choice ? <SecondFamilyChoice preview={choice.preview} busy={replacing} onNew={chooseNew} onReplace={chooseReplace} onCancel={() => { setChoice(null); setReplacing(false); }} /> : null}
            </div>
            {replaced ? <ReplaceWhatChanged r={replaced} onKeep={keepChange} onUndo={undoChange} busy={changeBusy} onPage={setPage} /> : null}
            {/* ⭐ D186-2: only what a résumé can't tell us — once, one at a time, each skippable (the clay while open). */}
            {page.activeProfileId ? <FourThingsTicket onChanged={load} onOpen={setFourOpen} clay={!replaced} /> : null}
          </div>

          <PassportLeg n={1} id="pp-visa" meta="THE VISA PAGE · ONLY YOU BY DEFAULT · EACH PAGE'S EYE NARROWS IT" title="Who can see it"
            side={<PlateHero aspect="240 / 140" caption={<span className="pl-label">THE SEALED DOOR · VISITORS WAIT OUTSIDE</span>}>
              <PlaceHazardSeal label="Your passport behind a sealed door: only you inside; connections and the public wait outside until you open it" /></PlateHero>}>
            <VisaPage vis={vis} onSet={set} />
            <IdentityPage page={page} avatarUrl={avatarUrl} editing={editing} onSet={set} onPage={setPage} />
          </PassportLeg>

          <PassportLeg n={2} id="pp-about" meta="ABOUT · FROM YOUR RÉSUMÉ · EDITED BY YOU" title="About"
            side={<PlateHero aspect="360 / 220"><ProfileFieldBook label="A ruled field-book page: your summary, pencilled" {...fieldBookLines(s.about.summary)} /></PlateHero>}>
            <ProfileSections key={`about-${round}`} theme={theme} highlight={page.highlight || []} onChanged={load} parts={["status", "summary"]} titles={{ summary: "About" }} />
          </PassportLeg>

          <PassportLeg n={3} id="pp-road" meta="EXPERIENCE · LOGOS FROM YOUR RÉSUMÉ · YOUR SKILLS IN BOLD" title="The road so far">
            {s.experience.items.length ? (
              <PlateHero aspect="520 / 120" caption={<span className="pl-label">EMPLOYERS AS STOPS ON ONE ROUTE · THE CURRENT ONE IS THE FILLED STOP</span>}>
                <PassportRoad {...roadOf(s.experience.items)} />
              </PlateHero>
            ) : null}
            {s.experience.items.length > 3 ? (
              <RouteLine label="Every employer on your résumé" stops={[...s.experience.items].reverse().map((x, i, a) => ({ name: `${x.company || x.title}`, state: i === a.length - 1 ? "next" : "lit", stage: "build" }))} />
            ) : null}
            <ProfileSections key={`road-${round}`} theme={theme} highlight={page.highlight || []} onChanged={load} parts={["experience"]} titles={{ experience: "Experience" }} />
          </PassportLeg>

          <PassportLeg n={4} id="pp-stamps" meta="SKILLS · GREEN = PROVEN IN ATLAS · DASHED = NOT YET" title="Stamps" data={{ "data-section": "skills" }}>
            <PassportStamps proven={s.skills.proven.map((x) => ({ name: x.name, how: HOW[x.how], at: day(x.at), href: x.url || undefined }))}
              listed={s.skills.fromResume.map((x) => ({ name: x.name, href: proveHref(x.name) }))} />
            <p className="pl-pp-note">Green only for proven skills. A dashed tile is a skill your résumé claims; proving it in Atlas stamps it. <a href="/app/atlas/your-skills">Your skills map in Atlas</a></p>
            {/* ⭐ 47m (agent's pick — owner may reverse): the Atlas proof page folds into the stamps — it IS the stamps, on a page of their own. */}
            <SettingsSheet kicker="YOUR STAMPS ON THEIR OWN PAGE" title="Proof page" lead="What you've proven in Atlas, at your passport's handle — on or off.">
              <ProfileSections key={`proof-${round}`} theme={theme} parts={["proofpage"]} onChanged={load} />
            </SettingsSheet>
          </PassportLeg>

          <PassportLeg n={5} id="pp-fit" meta={`YOUR BEARING ON THE MARKET${s.fit?.ready != null && !s.fit.thin ? ` · ${s.fit.ready} % READY` : ""}`} title="Where you fit"
            side={<PlateHero aspect="640 / 520"><MarketSurveyPlate best={null} label={s.fit?.placement ? `The market as a survey plate: you marked in ${s.fit.placement.categoryName}, ${s.fit.placement.subName}` : "The market as a survey plate — your mark lands once your résumé places you"} /></PlateHero>}>
            <WhereYouFit fit={s.fit} />
          </PassportLeg>

          <PassportLeg n={6} id="pp-work" meta="PROJECTS · ACHIEVEMENTS · LINKS" title="Work you can show"
            side={<PlateHero aspect="360 / 220"><ProfileSpecimenDrawer label="A pulled-out specimen drawer, one compartment per project" {...drawerOf(s.projects.items)} /></PlateHero>}>
            <ProfileSections key={`work-${round}`} theme={theme} highlight={page.highlight || []} onChanged={load} parts={["projects", "links"]}
              renderLink={(x) => <LinkMark url={x.url} name={h.name} />}
              slots={{ afterProjects: <Achievements items={s.achievements.items}
                onAdd={async (b) => setPage(await api("/api/profile/page/achievements", { method: "POST", body: JSON.stringify(b) }))}
                onRemove={async (id) => { try { setPage(await api(`/api/profile/page/achievements/${id}`, { method: "DELETE" })); } catch (e) { setErr(e.message); } }} /> }} />
          </PassportLeg>

          <PassportLeg n={7} id="pp-school" meta="EDUCATION · HIGHEST DEGREE FROM THE SECTION" title="Schooling"
            side={<PlateHero aspect="360 / 220"><ProfileSchoolhouse label="A small schoolhouse on the ruler-marked ground strip" caption={schoolOf(s.education.items)} /></PlateHero>}>
            <ProfileSections key={`school-${round}`} theme={theme} onChanged={load} parts={["education"]} />
          </PassportLeg>

          <PassportLeg n={8} id="pp-sealed" meta="ONLY YOU · USED TO APPLY AND TO RANK YOUR JOBS · NEVER PUBLIC" title="The sealed pages" data={{ "data-profile-behind": "" }}
            side={<RegionEmblem kind="lock" region="V" size={120} label="Security emblem: a lock — the sealed pages" />}>
            {/* ⭐ A153 (45o): one folded row per part, each with its one-line summary — a row mounts its editor only when opened. */}
            <SealedRow id="contact" title="Contact details for application forms" summary="Name, email, phone, address, work authorisation — filled into forms, never shown on your page"
              open={behindRow} onOpen={setBehindRow}>{behind?.contact || null}</SealedRow>
            <SealedRow id="defaults" title="Application defaults" summary="The answers forms ask every time — each set or not set"
              open={behindRow} onOpen={setBehindRow}><ProfileSections theme={theme} parts={["defaults"]} onChanged={load} /></SealedRow>
            <SealedRow id="resumes" title="Base résumés and job profiles" summary="Your résumé per kind of job, its titles, years and search terms · Manage → Your bearings"
              open={behindRow} onOpen={setBehindRow}>{behind?.resumes || null}</SealedRow>
            <SealedRow id="skills" title="Skills and keywords that rank your board" summary="What the board reads to rank your jobs — weighted terms, each removable"
              open={behindRow} onOpen={setBehindRow}><ProfileSections theme={theme} parts={["skills"]} onChanged={load} />
              {/* ⭐ D186-4: the weighted terms (from your résumé · alias · related), each removable. */}
              <RankingTerms profileId={page.activeProfileId} /></SealedRow>
            <SealedRow id="tailoring" title="How your résumés are tailored" summary="The rules a tailored résumé follows for you"
              open={behindRow} onOpen={setBehindRow}>{behind?.tailoring || null}</SealedRow>
          </PassportLeg>

          <section className="pl-section pl-section--last" aria-labelledby="pp-onward-t">
            <LegHeader n={9} meta="ONWARD · FROM YOUR PASSPORT" title={<span id="pp-onward-t">Tickets out</span>} />
            <div className="pl-tickets">
              {nextSkill ? <Ticket kicker="YOUR NEXT STAMP · 5 MIN" title={`Prove ${nextSkill.name}`} line="The top résumé skill you haven't proven yet." go="Set out →" href={proveHref(nextSkill.name)} /> : null}
              <Ticket kicker="YOUR PUBLIC PAGE" title={publicUrl ? publicUrl.replace(/^https?:\/\//, "") : "No public link yet"}
                line={vis.page === "public" && publicUrl ? "Open — what a visitor sees." : "Private until you open the visa page."} go={vis.page === "public" && publicUrl ? "Open →" : null}
                href={vis.page === "public" && publicUrl ? publicUrl : undefined} />
              {!page.source ? <Ticket kicker="SETTING OUT · ONE RÉSUMÉ" title="Hand over your résumé" line="It fills every section, your bearing and your stamps." go="Set out →" href="/app/setting-out" /> : null}
              <Ticket kicker="THE MARKET · YOUR BEARINGS" title="Job profiles" line="Every bearing you keep, and what you follow." go="Manage →" href="/app/job-profiles" />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** PURE. The field book's three pencilled lines from the summary (≈ 30 characters each, at word breaks). */
export function fieldBookLines(summary) {
  const words = String(summary || "Your summary, in your words — Edit About to write it.").split(/\s+/).filter(Boolean);
  const lines = ["", "", ""];
  let i = 0;
  for (const w of words) {
    if (i > 2) break;
    if ((lines[i] + " " + w).trim().length > 31 && lines[i]) i++;
    if (i > 2) break;
    lines[i] = (lines[i] + " " + w).trim();
  }
  if (words.join(" ").length > lines.join(" ").length && lines[2]) lines[2] = `${lines[2].replace(/[.,;:]?$/, "")}…`;
  return { line1: lines[0], line2: lines[1], line3: lines[2] };
}
/** PURE. The road's three stops: the first employer, the one before now, now (fewer when the résumé has fewer). */
export function roadOf(items = []) {
  const yr = (d) => (d ? String(d).slice(0, 4) : "");
  const stop = (x, now) => ({ name: x.company || x.title || "—", when: now ? `${yr(x.start)} → now` : [yr(x.start), yr(x.end)].filter(Boolean).join("–") });
  const chrono = [...items].reverse();   // the résumé lists the latest first
  const cur = chrono[chrono.length - 1];
  const picks = chrono.length >= 3 ? [chrono[0], chrono[chrono.length - 2], cur] : chrono.length === 2 ? [chrono[0], null, cur] : [null, null, cur];
  return { stops: picks.map((x) => (x ? stop(x, x === cur && (x.current || !x.end)) : null)),
    label: `The road so far: ${chrono.map((x) => x.company || x.title).filter(Boolean).join(", then ")}` };
}
/** PURE. The specimen drawer's five labelled compartments from the projects (an empty compartment stays blank). */
export function drawerOf(items = []) {
  const out = {};
  for (let i = 0; i < 5; i++) {
    const x = items[i];
    out[`p${i + 1}`] = x ? String(x.name || "").slice(0, 18) : "";
    out[`s${i + 1}`] = x ? String((x.tech || x.stack || []).slice?.(0, 2).join?.(" · ") || x.description || "").toUpperCase().slice(0, 16) : "";
  }
  return out;
}
/** PURE. The schoolhouse's caption: the first school, its degree, its year. */
export function schoolOf(items = []) {
  const x = items[0];
  if (!x) return "NO SCHOOL ON YOUR RÉSUMÉ YET";
  return [x.school, x.degree, x.end ? String(x.end).slice(0, 4) : null].filter(Boolean).join(" · ").toUpperCase().slice(0, 42);
}
