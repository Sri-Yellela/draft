// ⭐ D183 P1 (owner 11-08, TOP PRIORITY — spec docs/sketches/Profile redesign.html) · YOUR PROFILE = YOUR PAGE.
//
// One LinkedIn-like page filled from the résumé, at /app/profile/about (nav: You — Your profile). Top to bottom, as the
// approved sketch:
//   WHO CAN SEE IT   Only you (DEFAULT) · Connections · Public; each section's eye narrows it, never widens it; Let search
//                    engines find it (off). Contact and Behind your profile are never public (they are not sections).
//   THE HEADER       cover band, photo (or its letter), name, headline, location · years, the public link, View as the
//                    public · Share link · Edit; "Fits <subcategory> · <level> · also <second>" from the résumé; Open to
//                    work · referrals welcome (each the person's switch).
//   THE SOURCE LINE  Built from <file> · read <date> · Replace résumé · Open in the editor (D157).
//   SECTIONS         About · Experience (logos, skills bold where said — A140 kept) · Skills in two columns (Proven in
//                    Atlas / From your résumé) · Where you fit · Projects · Achievements · Education · Links as logos —
//                    the D101 editors (components/ProfileSections.jsx) draw About, Experience, Projects, Education and
//                    Links, so every section is still edited in place by the same code; this page adds the rest.
//   BEHIND YOUR PROFILE  always private, folded — the private machinery, nothing removed (`behind`, from ProfilePage).
//   ⭐ P2 WHAT CHANGED   after a résumé replace (every section re-filled straight away, hand edits and proven skills
//                    kept — services/profileReplace.js), a card at the top: each change, Kept, Untouched, then Looks right ·
//                    Undo — back to the old résumé (30 days) · Review each change.
// ⛔ What a visitor sees is decided on the server (GET /api/profile/page?as=public — services/profilePage.js viewFor);
// View as the public draws exactly that answer, never a client-side filter of the owner's page.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useTheme } from "../../styles/theme.jsx";
import { useAccountAvatar } from "../../lib/accountAvatar.js";
import { openResumeEditor } from "../../lib/resumeEditor.js";
import { RESUME_REPLACED_EVENT } from "../../panels/ProfilePanel.jsx";
import ProfileSections from "../../components/ProfileSections.jsx";
import "./YourProfile.css";

const LEVELS = [["only_me", "Only you"], ["connections", "Connections"], ["public", "Public"]];
const RANK = { only_me: 0, connections: 1, public: 2 };
const WORD = Object.fromEntries(LEVELS);
const day = (t) => (Number(t) > 0 ? new Date(Number(t) * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");
const HOW = { built: "built", checked: "passed a check" };

// ── the marks: GitHub and LinkedIn as their own logos (owner 11-08), in the theme's text colour; anything else a link icon.
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
    <a className="yp__link" href={url} target="_blank" rel="noopener noreferrer nofollow" aria-label={aria} data-link-mark={kind}>
      {MARK_PATHS[kind]
        ? <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d={MARK_PATHS[kind]} /></svg>
        : <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>}
      <span>{label}</span>
    </a>
  );
}

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
    <path fill="none" stroke="currentColor" strokeWidth="2" d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

/** A section's eye: who can see this section — never wider than the page (wider choices are not offered). */
function Eye({ id, vis, onSet }) {
  const page = vis.page;
  const eff = vis.effective[id];
  return (
    <label className="yp__eye" data-section-eye={id} title="Who can see this section">
      <EyeIcon />
      <span className="yp__sr">Who can see {id}</span>
      <select value={vis.sections[id] == null ? "" : eff} onChange={e => onSet({ section: id, level: e.target.value || null })}>
        <option value="">{WORD[page]} (the page)</option>
        {LEVELS.filter(([k]) => RANK[k] < RANK[page]).map(([k, w]) => <option key={k} value={k}>{w}</option>)}
      </select>
    </label>
  );
}

function WhoCanSee({ vis, onSet }) {
  return (
    <section className="yp__who" data-who-can-see="" aria-label="Who can see your profile">
      <div className="yp__whohead">
        <b>Who can see your profile</b>
        <div className="yp__seg" role="group" aria-label="Who can see your profile">
          {LEVELS.map(([k, w]) => (
            <button key={k} type="button" className="yp__segb dbx-depth" aria-pressed={vis.page === k} data-page-level={k}
              onClick={() => vis.page !== k && onSet({ page: k })}>{w}</button>
          ))}
        </div>
      </div>
      <p className="yp__muted">Each section can be narrower (the eye on it). Contact details and everything under <b>Behind your profile</b> are never public.</p>
      <label className="yp__check">
        <input type="checkbox" checked={!!vis.searchable} disabled={vis.page !== "public"} data-searchable=""
          onChange={e => onSet({ searchable: e.target.checked })} />
        Let search engines find it{vis.page !== "public" ? " (only for a public profile)" : ""}
      </label>
    </section>
  );
}

function Header({ page, avatarUrl, editing, onEdit, onSet, onPreview, previewing }) {
  const h = page.header;
  const p = h.placement;
  const [headline, setHeadline] = useState(h.headline || "");
  useEffect(() => { setHeadline(h.headline || ""); }, [h.headline]);
  const publicUrl = h.handle ? `${window.location.origin}/in/${h.handle}` : null;
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (!publicUrl) return;
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link is on the page */ }
  };
  const initial = (h.name || "?").trim().charAt(0).toUpperCase();
  return (
    <section className="yp__head" data-profile-header="">
      <div className="yp__cover" aria-hidden="true" />
      <div className="yp__headrow">
        {avatarUrl ? <img className="yp__avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
          : <span className="yp__avatar yp__avatar--letter" aria-hidden="true">{initial}</span>}
        <div className="yp__acts">
          <button type="button" className="pf__btn" onClick={onPreview} aria-pressed={previewing} data-view-as-public="">
            {previewing ? "Back to your view" : "View as the public"}</button>
          <button type="button" className="pf__btn" onClick={share} disabled={!publicUrl} data-share-link=""
            title={publicUrl ? "Copy your public link" : "Your public link comes with the public page"}>{copied ? "Copied" : "Share link"}</button>
          <button type="button" className="pf__btn" onClick={onEdit} aria-pressed={editing} data-edit-header="">{editing ? "Done" : "Edit"}</button>
        </div>
      </div>
      <h2 className="yp__name">{h.name || "Your name"}</h2>
      {editing ? (
        <form className="yp__hedit" onSubmit={e => { e.preventDefault(); onSet({ headline: headline.trim() || null }); }}>
          <label>Headline <input value={headline} maxLength={160} onChange={e => setHeadline(e.target.value)} placeholder="Data engineer · streaming pipelines" /></label>
          <button type="submit" className="pf__btn">Save</button>
        </form>
      ) : <p className="yp__headline">{h.headline || <span className="yp__muted">No headline yet — Edit to add one.</span>}</p>}
      <p className="yp__muted">
        {[h.location, h.years != null ? `${h.years} year${h.years === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}
        {publicUrl && <>{h.location || h.years != null ? " · " : ""}<span data-public-link="">{publicUrl.replace(/^https?:\/\//, "")}</span></>}
      </p>
      {p && (
        <p className="yp__fits" data-placement="">
          Fits <b>{p.subName}</b> · {p.levelLabel}{p.also ? <> · also <b>{p.also.subName}</b></> : null}
        </p>
      )}
      <div className="yp__open" data-open-to-work="">
        {editing ? (
          <>
            <label className="yp__check"><input type="checkbox" checked={!!h.openToWork} onChange={e => onSet({ openToWork: e.target.checked })} /> Open to work</label>
            <label className="yp__check"><input type="checkbox" checked={!!h.referrals} onChange={e => onSet({ referrals: e.target.checked })} /> Referrals welcome</label>
          </>
        ) : (h.openToWork || h.referrals) ? (
          <span>{[h.openToWork ? "Open to work" : null, h.referrals ? "referrals welcome" : null].filter(Boolean).join(" · ")}</span>
        ) : null}
      </div>
    </section>
  );
}

function SourceLine({ source, onReplace }) {
  const openEditor = async () => {
    try {
      const r = await api("/api/base-resume");
      if (!r?.content) return;
      const isHtml = /<\s*(html|body|div|p|h\d|ul|section)\b/i.test(r.content);
      const esc = (s) => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
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
    <section className="yp__source" data-source-line="">
      {source ? (
        <p>Built from <b>{source.name}</b>{source.at ? ` · read ${day(source.at)}` : ""}. Replacing it re-fills every section; what you added by hand stays.</p>
      ) : <p>Add your résumé and every section fills from it.</p>}
      <div className="yp__acts">
        <button type="button" className="pf__btn" onClick={onReplace} data-replace-resume="">{source ? "Replace résumé" : "Add your résumé"}</button>
        {source && <button type="button" className="pf__btn" onClick={openEditor} data-open-editor="">Open in the editor</button>}
      </div>
    </section>
  );
}

function PageBox({ title, right, children, data }) {
  return (
    <section className="yp__box" {...data}>
      <div className="yp__boxhead"><h3>{title}</h3>{right}</div>
      <div className="yp__boxbody">{children}</div>
    </section>
  );
}

function SkillsColumns({ skills, eye }) {
  return (
    <PageBox title={<>Skills <span className="yp__muted">{skills.counts.proven} proven · {skills.counts.fromResume} from your résumé</span></>} right={eye}
      data={{ "data-section": "skills" }}>
      <div className="yp__cols">
        <div data-skills-proven="">
          <h4>Proven in Atlas</h4>
          {skills.proven.length ? (
            <ul className="yp__list">{skills.proven.map(s => (
              <li key={s.key}><b>{s.name}</b>
                <span className="yp__muted"> {HOW[s.how]}{s.url ? <> · <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">proof link</a></> : null}{s.at ? ` · ${day(s.at)}` : ""}</span></li>
            ))}</ul>
          ) : <p className="yp__muted">Nothing proven yet — a five-minute check proves a skill.</p>}
        </div>
        <div data-skills-from-resume="">
          <h4>From your résumé</h4>
          {skills.fromResume.length ? (
            <ul className="yp__list">{skills.fromResume.map(s => (
              <li key={s.key}><b>{s.name}</b> <Link className="yp__quiet" to={`/app/atlas/your-skills?prove=${encodeURIComponent(s.name)}`}>Prove it · 5 min</Link></li>
            ))}</ul>
          ) : <p className="yp__muted">No skills read from your résumé yet.</p>}
        </div>
      </div>
      <Link className="yp__quiet" to="/app/atlas/your-skills">Your skills map in Atlas</Link>
    </PageBox>
  );
}

function WhereYouFit({ fit, eye }) {
  if (!fit) return (
    <PageBox title="Where you fit" right={eye} data={{ "data-section": "fit" }}>
      <p className="yp__muted">Add your résumé and draft places you in a job family and level.</p>
    </PageBox>
  );
  const p = fit.placement;
  return (
    <PageBox title="Where you fit" right={eye} data={{ "data-section": "fit" }}>
      {fit.thin || fit.ready == null ? <p className="yp__muted">{fit.line}</p> : (
        <>
          <p className="yp__ready"><b>{fit.ready}% ready</b> for {fit.role}</p>
          {(fit.waiting || fit.scope) && <p className="yp__muted">{fit.waiting ? `+${fit.waiting}% waiting in skills from your résumé` : ""}{fit.waiting && fit.scope ? " · " : ""}{fit.scope || ""}</p>}
          {fit.moves?.length > 0 && (
            <p className="yp__muted">What moves it most: {fit.moves.map((m, i) => <span key={m.slug || m.name}>{i ? ", " : ""}<b>{m.name}</b> (+{m.adds}%)</span>)}</p>
          )}
          <Link className="pf__btn" to="/app/atlas/your-map">Fly my route</Link>
        </>
      )}
      {p && <p className="yp__muted">Your résumé places you in <b>{p.categoryName} › {p.subName}</b>, {p.levelLabel} — your job profiles and the board follow it.</p>}
    </PageBox>
  );
}

function Achievements({ items, eye, onAdd, onRemove }) {
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [err, setErr] = useState("");
  return (
    <PageBox title="Achievements" right={eye} data={{ "data-section": "achievements" }}>
      {items.length ? (
        <ul className="yp__list">{items.map((a, i) => (
          <li key={`${a.source}-${a.id ?? i}`} data-achievement={a.source}>
            <b>{a.title}</b>
            <span className="yp__muted"> {[a.detail || (a.source === "hand" ? "Added by you" : null), a.year || (a.at ? day(a.at) : null)].filter(Boolean).join(" · ")}</span>
            {a.source === "hand" && <button type="button" className="yp__x" aria-label={`Remove ${a.title}`} onClick={() => onRemove(a.id)}>Remove</button>}
          </li>
        ))}</ul>
      ) : <p className="yp__muted">Certifications and awards from your résumé, and modules you finish in Atlas, show here.</p>}
      <form className="yp__add" onSubmit={async e => {
        e.preventDefault(); setErr("");
        try { await onAdd({ title, year: year || null }); setTitle(""); setYear(""); } catch (x) { setErr(x.message || "Not added."); }
      }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Add one — a certification or an award" maxLength={120} aria-label="Achievement" />
        <input value={year} onChange={e => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Year" inputMode="numeric" aria-label="Year" className="yp__year" />
        <button type="submit" className="pf__btn" disabled={!title.trim()}>Add</button>
      </form>
      {err && <p role="alert" className="yp__muted">{err}</p>}
    </PageBox>
  );
}

const MARK = { added: "+", removed: "−", changed: "↻" };

/** ⭐ D183 P2 · What changed — the replace already happened; this is so nothing changes silently. */
function WhatChanged({ r, onKeep, onUndo, busy }) {
  const [review, setReview] = useState(false);
  const shown = review ? r.lines : r.lines.slice(0, 6);
  return (
    <section className="yp__changed" data-what-changed="" aria-live="polite">
      <p className="yp__chhead"><b>New résumé{r.name ? ` · ${r.name}` : ""}</b> · read {day(r.at)} — <b>your profile now follows it</b></p>
      {r.lines.length ? (
        <ul className="yp__chlist">{shown.map((l, i) => (
          <li key={i} data-change={l.kind}><span className="yp__chmark" aria-hidden="true">{MARK[l.kind] || "·"}</span>
            <span>{l.text}{l.was ? <span className="yp__muted"> · was: {l.was}</span> : null}{l.detail ? <span className="yp__muted"> · {l.detail}</span> : null}</span></li>
        ))}</ul>
      ) : <p className="yp__muted">Nothing on your page changed — the new résumé reads the same.</p>}
      {r.kept?.length > 0 && <p data-change-kept=""><span className="yp__chmark" aria-hidden="true">✓</span> Kept: {r.kept.join(", ")}</p>}
      <p data-change-untouched=""><span className="yp__chmark" aria-hidden="true">✓</span> Untouched: {r.untouched}</p>
      <div className="yp__acts">
        <button type="button" className="pf__btn" onClick={onKeep} disabled={busy} data-change-keep="">Looks right</button>
        {r.undoable && <button type="button" className="pf__btn" onClick={onUndo} disabled={busy} data-change-undo="">Undo — back to the old résumé</button>}
        {r.lines.length > 6 && !review && <button type="button" className="pf__btn" onClick={() => setReview(true)}>Review each change</button>}
      </div>
      <p className="yp__muted">Applied straight away — this summary is so nothing changes silently. Undo works for 30 days.</p>
    </section>
  );
}

/** View as the public — exactly the server's answer for a signed-out visitor (GET /api/profile/page?as=public). */
function PublicPreview({ view, avatarUrl }) {
  if (!view) return <p className="yp__muted">Loading the public view…</p>;
  if (view.private) return (
    <section className="yp__box" data-public-preview="private"><p><b>This profile is private.</b></p>
      <p className="yp__muted">A visitor sees only this line. Choose Connections or Public above to show it.</p></section>
  );
  const h = view.header, s = view.sections;
  return (
    <div data-public-preview="">
      <section className="yp__head">
        <div className="yp__cover" aria-hidden="true" />
        <div className="yp__headrow">
          {h.avatar && avatarUrl ? <img className="yp__avatar" src={avatarUrl} alt="" /> : <span className="yp__avatar yp__avatar--letter" aria-hidden="true">{(h.name || "?").charAt(0)}</span>}
        </div>
        <h2 className="yp__name">{h.name}</h2>
        {h.headline && <p className="yp__headline">{h.headline}</p>}
        {h.location && <p className="yp__muted">{h.location}</p>}
        {(h.openToWork || h.referrals) && <p>{[h.openToWork ? "Open to work" : null, h.openToWork ? h.area : null, h.referrals ? "referrals welcome" : null].filter(Boolean).join(" · ")}</p>}
      </section>
      {s.about?.summary && <PageBox title="About"><p>{s.about.summary}</p></PageBox>}
      {s.experience?.items?.length > 0 && <PageBox title="Experience"><ul className="yp__list">{s.experience.items.map(x => (
        <li key={x.id}><b>{x.title}</b> · {x.company}<ul>{(x.bullets || []).map((b, i) => <li key={i}>{b}</li>)}</ul></li>))}</ul></PageBox>}
      {s.skills && <PageBox title="Skills"><p><b>Proven on draft:</b> {s.skills.proven.map(x => x.name).join(", ") || "none yet"}</p>
        <p className="yp__muted">Also lists: {s.skills.fromResume.map(x => x.name).join(" · ") || "—"}</p>
        <p className="yp__muted">“Proven on draft” means a check passed or a build linked, with its date — not a certification.</p></PageBox>}
      {s.fit && <PageBox title="Where you fit"><p>{s.fit.line}</p></PageBox>}
      {s.projects?.items?.length > 0 && <PageBox title="Projects"><ul className="yp__list">{s.projects.items.map(x => <li key={x.id}><b>{x.name}</b>{x.description ? ` — ${x.description}` : ""}</li>)}</ul></PageBox>}
      {s.achievements?.items?.length > 0 && <PageBox title="Achievements"><ul className="yp__list">{s.achievements.items.map((a, i) => <li key={i}>{a.title}{a.year ? ` · ${a.year}` : ""}</li>)}</ul></PageBox>}
      {s.education?.items?.length > 0 && <PageBox title="Education"><ul className="yp__list">{s.education.items.map(x => <li key={x.id}><b>{x.school}</b> {[x.degree, x.field].filter(Boolean).join(", ")}</li>)}</ul></PageBox>}
      {s.links?.items?.length > 0 && <PageBox title="Links"><div className="yp__links">{s.links.items.map(l => <LinkMark key={l.url} url={l.url} name={h.name} />)}</div></PageBox>}
      <section className="yp__box" data-not-shown=""><b>Not shown to the public</b>
        <p className="yp__muted">Contact details, application defaults, job profiles and saved answers{view.hidden.length ? `, and: ${view.hidden.join(", ")}` : ""}.</p></section>
    </div>
  );
}

export default function YourProfile({ behind = null }) {
  const { theme } = useTheme();
  const { url: avatarUrl } = useAccountAvatar();
  const [page, setPage] = useState(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(null);   // null = your view; { view } = the public view
  const [behindOpen, setBehindOpen] = useState(false);

  const [replaced, setReplaced] = useState(null);
  const [changeBusy, setChangeBusy] = useState(false);
  const [round, setRound] = useState(0);   // remounts the section editors after a replace / undo so they re-read
  const load = useCallback(() => api("/api/profile/page").then(setPage).catch(e => setErr(e.message || "Your profile could not be read.")), []);
  const loadChange = useCallback(() => api("/api/profile/replacements/latest").then(r => setReplaced(r?.replacement || null)).catch(() => {}), []);
  useEffect(() => { load(); loadChange(); }, [load, loadChange]);
  // A résumé saved or uploaded under Behind your profile: re-read the page and its What changed.
  useEffect(() => {
    const on = () => { load(); loadChange(); setRound(x => x + 1); };
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
    try { const r = await api(`/api/profile/replacements/${replaced.id}/undo`, { method: "POST" }); setReplaced(null); if (r?.page) setPage(r.page); setRound(x => x + 1); }
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
  const replace = () => {
    setBehindOpen(true);
    setTimeout(() => document.querySelector("[data-profile-behind]")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  if (!page) return <p className="yp__muted">{err || "Loading your profile…"}</p>;
  const vis = page.visibility;
  const eyeFor = (id) => <Eye id={id} vis={vis} onSet={set} />;
  const s = page.sections;

  return (
    <div className="yp" data-your-profile="">
      <WhoCanSee vis={vis} onSet={set} />
      {err && <p role="alert" className="yp__err">{err}</p>}
      {replaced && <WhatChanged r={replaced} onKeep={keepChange} onUndo={undoChange} busy={changeBusy} />}
      <Header page={page} avatarUrl={avatarUrl} editing={editing} onEdit={() => setEditing(x => !x)} onSet={set}
        onPreview={togglePreview} previewing={!!preview} />
      {preview ? <PublicPreview view={preview.view} avatarUrl={avatarUrl} /> : (
        <>
          <SourceLine source={page.source} onReplace={replace} />
          <ProfileSections key={`page-${round}`} theme={theme} highlight={page.highlight || []} onChanged={load}
            parts={["summary", "experience", "projects", "education", "links"]}
            titles={{ summary: "About", experience: "Experience" }} eyeFor={eyeFor}
            renderLink={(x) => <LinkMark url={x.url} name={page.header.name} />}
            slots={{
              afterExperience: <>
                <SkillsColumns skills={s.skills} eye={eyeFor("skills")} />
                <WhereYouFit fit={s.fit} eye={eyeFor("fit")} />
              </>,
              afterProjects: <Achievements items={s.achievements.items} eye={eyeFor("achievements")}
                onAdd={async (b) => setPage(await api("/api/profile/page/achievements", { method: "POST", body: JSON.stringify(b) }))}
                onRemove={async (id) => { try { setPage(await api(`/api/profile/page/achievements/${id}`, { method: "DELETE" })); } catch (e) { setErr(e.message); } }} />,
            }} />
          <details className="yp__behind" data-profile-behind="" open={behindOpen} onToggle={e => setBehindOpen(e.currentTarget.open)}>
            <summary><b>Behind your profile</b> <span className="yp__muted">Only you · used to apply and to rank your jobs · never public</span></summary>
            <p className="yp__muted">Contact details for application forms · Application defaults · Base résumés and job profiles · Titles, years and search terms ·
              Skills and keywords that rank your board · Structured facts and ATS suggestions · How your résumés are tailored.</p>
            <ProfileSections theme={theme} parts={["status", "defaults", "skills", "proofpage"]} onChanged={load} />
            {behind}
          </details>
        </>
      )}
    </div>
  );
}
