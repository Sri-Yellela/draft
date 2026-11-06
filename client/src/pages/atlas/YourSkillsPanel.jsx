// ⭐ D169 (owner 11-06, APPROVED, revisable) · YOUR SKILLS, IN ATLAS — one panel, two views of the same data
// (sketch docs/sketches/Atlas.html, its "Your skills" and "Your map" panels).
//   · LIST (manage): each of the person's skills resolved to its Atlas node (an unknown one is HELD FOR THE CURATOR — never
//     invented as a node), its state as a 6px dot + a plain word — claimed · checked · built (no chips, D152 (7b)) — its
//     proof, and add · remove · prove: "Check it · 1 min" opens the quick check IN PLACE; "Add proof" where no questions
//     exist (components/SkillCheck.jsx, the same thing the ATS panel's "That's true of me" opens).
//   · MAP (explore): the same skills against the market — what's near, what opens the most roles, the gaps for the target
//     — from D116's map (GET /api/atlas/me's reader, served through GET /api/your-skills/map).
//   ⛔ Adding stays open (a new skill lands as claimed and counts on the map); a skill not on the résumé goes into a
//     tailored résumé only once proven (services/yourSkills.js resumeClaims).
// MOUNT (the Atlas shell, D167): import YourSkillsPanel from "./YourSkillsPanel.jsx";
//   <YourSkillsPanel signedIn={…} base="/app/atlas" view="list" onView={(v) => …} onCounts={(c) => …} />
//   every prop optional; `onCounts` hands the shell the nav's "9 checked".
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import SkillCheck from "../../components/SkillCheck.jsx";
import "./YourSkillsPanel.css";

export const STATE_WORDS = Object.freeze({ claimed: "claimed", checked: "checked", built: "built" });

/** PURE. The map's drawing: you in the middle, your skills on the inner ring, what's near and the gaps on the outer. */
export function skillsMapLayout(data, { width = 680, height = 400, inner = 6, outer = 8 } = {}) {
  const cx = width / 2, cy = height / 2;
  const ring = (items, r, kind) => items.map((it, i, a) => {
    const t = (-Math.PI / 2) + (2 * Math.PI * i) / Math.max(1, a.length) + (kind === "have" ? 0 : Math.PI / Math.max(2, a.length));
    return { ...it, kind, x: Math.round(cx + r * 1.45 * Math.cos(t)), y: Math.round(cy + r * Math.sin(t)) };
  });
  const have = ring((data?.have || []).slice(0, inner), 110, "have");
  const out = [...(data?.gaps || []).slice(0, Math.ceil(outer / 2)).map(g => ({ ...g, gap: true })), ...(data?.near || []).filter(n => !(data?.gaps || []).some(g => g.slug === n.slug))]
    .slice(0, outer);
  const far = ring(out, 170, "far").map(n => ({ ...n, kind: n.gap ? "gap" : "near" }));
  return { width, height, cx, cy, nodes: [...have, ...far] };
}

export function SkillsMapView({ data, base = "/app/atlas" }) {
  if (!data) return <p className="ysk__quiet">Loading…</p>;
  if (!data.map && !(data.have || []).length) {
    return <p className="ysk__quiet" data-skills-map-empty="">Add a skill or a résumé and this becomes your map against the market.</p>;
  }
  const L = skillsMapLayout(data);
  const href = (slug) => `${base}/${encodeURIComponent(slug)}`;
  return (
    <div className="ysk__map" data-skills-map="">
      <svg viewBox={`0 0 ${L.width} ${L.height}`} role="img" aria-label="Your skills against the market">
        {L.nodes.map(n => <line key={`l-${n.kind}-${n.slug}`} x1={L.cx} y1={L.cy} x2={n.x} y2={n.y} className="ysk__edge" />)}
        {L.nodes.map(n => (
          <a key={`n-${n.kind}-${n.slug}`} href={href(n.slug)} data-map-node={n.kind}>
            <circle cx={n.x} cy={n.y} r={n.kind === "have" ? 20 : 15} className={`ysk__dot ysk__dot--${n.kind === "have" ? n.state : n.kind}`} />
            <text x={n.x} y={n.y + (n.kind === "have" ? 36 : 30)} textAnchor="middle" className="ysk__label">{n.name}</text>
          </a>
        ))}
        <circle cx={L.cx} cy={L.cy} r={30} className="ysk__dot ysk__dot--you" />
        <text x={L.cx} y={L.cy + 5} textAnchor="middle" className="ysk__label ysk__label--you">You</text>
      </svg>
      <p className="ysk__key"><span className="ysk__k ysk__k--built">built</span><span className="ysk__k ysk__k--checked">checked</span>
        <span className="ysk__k ysk__k--claimed">claimed</span><span className="ysk__k ysk__k--near">near what you have</span><span className="ysk__k ysk__k--gap">a gap for your target</span></p>
      <div className="ysk__cols">
        <section data-map-list="near"><h3 className="ysk__h3">Near what you have</h3>
          {(data.near || []).length ? <ul className="ysk__plain">{data.near.slice(0, 6).map(n => <li key={n.slug}><a className="ysk__link" href={href(n.slug)}>{n.name}</a> <span className="ysk__quiet">{n.line}</span></li>)}</ul>
            : <p className="ysk__quiet">Nothing near yet.</p>}</section>
        <section data-map-list="opens"><h3 className="ysk__h3">Opens the most roles</h3>
          {(data.opens || []).length ? <ul className="ysk__plain">{data.opens.slice(0, 6).map(r => <li key={r.slug}><a className="ysk__link" href={href(r.slug)}>{r.name}</a> <span className="ysk__quiet">{r.line}</span></li>)}</ul>
            : <p className="ysk__quiet">No other role is close enough yet.</p>}</section>
        <section data-map-list="gaps"><h3 className="ysk__h3">{data.target ? `Gaps for ${data.target.name}` : "Gaps for your target"}</h3>
          {(data.gaps || []).length ? <ul className="ysk__plain">{data.gaps.slice(0, 6).map(g => <li key={g.slug}><a className="ysk__link" href={href(g.slug)}>{g.name}</a> <span className="ysk__quiet">{g.line}</span></li>)}</ul>
            : <p className="ysk__quiet">{data.target ? "Not enough postings read at your level to say yet." : "Choose a target role on your route to see its gaps."}</p>}</section>
      </div>
      {(data.held || []).length > 0 && <p className="ysk__quiet">Not on the Atlas yet (held for the curator): {data.held.map(h => h.name).join(", ")}.</p>}
    </div>
  );
}

/** One row of the list: the skill, its node, its proof; the state as a dot + a word; its one action. */
function SkillRow({ s, open, onOpen, onRemove, base }) {
  return (
    <div className="ysk__row" data-skill-row={s.key} data-skill-state={s.state}>
      <div className="ysk__what">
        <b className="ysk__name">{s.node ? <a className="ysk__link ysk__link--plain" href={`${base}/${encodeURIComponent(s.node.slug)}`}>{s.name}</a> : s.name}</b>
        <small className="ysk__sub">{s.line}{s.held ? " · not on the Atlas yet, held for the curator" : ""}</small>
      </div>
      <span className={`ysk__state ysk__state--${s.state}`} data-state-word={s.state}>{STATE_WORDS[s.state]}</span>
      <span className="ysk__acts">
        {s.action === "check" && <button type="button" className="ysk__quietbtn" aria-expanded={open} onClick={() => onOpen(open ? null : s.key)}>Check it · 1 min</button>}
        {s.action === "proof" && <button type="button" className="ysk__quietbtn" aria-expanded={open} onClick={() => onOpen(open ? null : s.key)}>Add proof</button>}
        <button type="button" className="ysk__quietbtn ysk__quietbtn--dim" onClick={() => onRemove(s)} aria-label={`Remove ${s.name}`}>Remove</button>
      </span>
    </div>
  );
}

export function SkillsList({ list, base = "/app/atlas", onChanged, openKey = null, onOpen }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!list) return <p className="ysk__quiet">Loading…</p>;
  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setNote("");
    try {
      const r = await api("/api/your-skills/skills", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      setNote(r.held ? `${r.skill?.name || name} is added as claimed. It isn't on the Atlas yet, so it's held for the curator.`
        : `${r.skill?.name || name} is added as claimed.`);
      onChanged?.();
    } catch (err) { setNote(err.message || "That skill was not added."); }
    finally { setBusy(false); }
  }
  async function remove(s) {
    try { await api(`/api/your-skills/skills/${encodeURIComponent(s.key)}`, { method: "DELETE" }); onChanged?.(); }
    catch (err) { setNote(err.message || "That skill was not removed."); }
  }
  return (
    <div className="ysk__card" data-skills-list="">
      {!list.skills.length && <p className="ysk__quiet">No skills yet. Add one below, or upload a résumé on your Profile.</p>}
      {list.skills.map(s => (
        <div key={s.key}>
          <SkillRow s={s} base={base} open={openKey === s.key} onOpen={onOpen} onRemove={remove} />
          {openKey === s.key && <SkillCheck skill={s.name} atlasBase={base} startWith={s.action === "proof" ? "proof" : "check"}
            onChange={() => onChanged?.()} onClose={() => onOpen(null)} />}
        </div>
      ))}
      <form className="ysk__add" onSubmit={add}>
        <input className="ysk__input" placeholder="Add a skill, for example Terraform" aria-label="Add a skill" value={name} maxLength={60}
          onChange={e => setName(e.target.value)} />
        <button type="submit" className="ysk__btn dbx-depth" disabled={busy || !name.trim()}>Add</button>
      </form>
      {note && <p className="ysk__quiet" role="status">{note}</p>}
    </div>
  );
}

export default function YourSkillsPanel({ signedIn = true, base = "/app/atlas", view: viewProp = null, onView = null, onCounts = null }) {
  const [own, setOwn] = useState("list");
  const view = viewProp || own;
  const setView = (v) => { setOwn(v); onView?.(v); };
  const [list, setList] = useState(null);
  const [map, setMap] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const [error, setError] = useState("");
  const load = () => api("/api/your-skills").then(r => { setList(r); onCounts?.(r.counts); }).catch(e => setError(e.message || "Your skills could not be read."));
  const loadMap = () => api("/api/your-skills/map").then(setMap).catch(e => setError(e.message || "The map could not be read."));
  useEffect(() => { if (signedIn) load(); }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (signedIn && view === "map") loadMap(); }, [signedIn, view]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!signedIn) return <section className="ysk" data-your-skills=""><p className="ysk__quiet">Sign in to add, check and prove your skills.</p></section>;
  return (
    <section className="ysk" data-your-skills="" data-skills-view={view}>
      <p className="ysk__eyebrow">Your skills</p>
      <h2 className="ysk__h2">What you can show</h2>
      <p className="ysk__lead">Each skill is matched to the Atlas. A skill that isn't on your résumé goes into a tailored résumé only once it's proven.</p>
      <div className="ysk__seg" role="group" aria-label="View">
        <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
        <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button>
      </div>
      {view === "list"
        ? <SkillsList list={list} base={base} openKey={openKey} onOpen={setOpenKey} onChanged={() => { load(); setMap(null); }} />
        : <SkillsMapView data={map} base={base} />}
      {error && <p className="ysk__quiet" role="alert">{error}</p>}
    </section>
  );
}
