// ⭐ D169 (owner 11-06, APPROVED, revisable) · YOUR SKILLS, IN ATLAS (sketch docs/sketches/Atlas.html, its "Your skills"
// panel). ⭐ A228 (46r, owner 11-16 "Build it"): the second view, the ring MAP, is retired — Your map (SkillMap.jsx) draws
// the same skills against the market.
//   · LIST (manage): each of the person's skills resolved to its Atlas node (an unknown one is HELD FOR THE CURATOR — never
//     invented as a node), its state as a 6px dot + a plain word — claimed · checked · built (no chips, D152 (7b)) — its
//     proof, and add · remove · prove: "Check it · 1 min" opens the quick check IN PLACE; "Add proof" where no questions
//     exist (components/SkillCheck.jsx, the same thing the ATS panel's "That's true of me" opens).
//   ⛔ Adding stays open (a new skill lands as claimed and counts on the map); a skill not on the résumé goes into a
//     tailored résumé only once proven (services/yourSkills.js resumeClaims).
// MOUNT (the Atlas shell, D167): import YourSkillsPanel from "./YourSkillsPanel.jsx";
//   <YourSkillsPanel signedIn={…} base="/app/atlas" onCounts={(c) => …} />
//   every prop optional; `onCounts` hands the shell the nav's "9 checked".
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import SkillCheck from "../../components/SkillCheck.jsx";
import "./YourSkillsPanel.css";

export const STATE_WORDS = Object.freeze({ claimed: "claimed", checked: "checked", built: "built" });

/** One row of the list: the skill, its node, its proof; the state as a dot + a word; its one action. */
function SkillRow({ s, open, onOpen, onRemove, base }) {
  return (
    <div className="ysk__row" data-skill-row={s.key} data-skill-state={s.state}>
      <div className="ysk__what">
        <b className="ysk__name">{s.node ? <a className="ysk__link ysk__link--plain" href={`${base}/${encodeURIComponent(s.node.slug)}`}>{s.name}</a> : s.name}</b>
        <small className="ysk__sub">{s.line}{s.held ? " · not on the Atlas yet — we'll review it" : ""}</small>
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
      setNote(r.held ? `${r.skill?.name || name} is added as claimed. It isn't on the Atlas yet; we'll review it and add it.`
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

export default function YourSkillsPanel({ signedIn = true, base = "/app/atlas", onCounts = null }) {
  const [list, setList] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const [error, setError] = useState("");
  const load = () => api("/api/your-skills").then(r => { setList(r); onCounts?.(r.counts); }).catch(e => setError(e.message || "Your skills could not be read."));
  useEffect(() => { if (signedIn) load(); }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  // ⭐ D172 (3): a skill card's "Prove it" and Your run's quest arrive with ?prove=<skill> — that skill's own quick check
  // (or its proof form) opens, once, as soon as the list is read.
  useEffect(() => {
    if (!list || openKey) return;
    const want = (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("prove") : "")?.trim().toLowerCase();
    const s = want ? list.skills.find(x => x.name.toLowerCase() === want && x.action) : null;
    if (s) setOpenKey(s.key);
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!signedIn) return <section className="ysk" data-your-skills=""><p className="ysk__quiet">Sign in to add, check and prove your skills.</p></section>;
  return (
    <section className="ysk" data-your-skills="">
      <h2 className="ysk__h2">What you can show</h2>
      <p className="ysk__lead">Each skill is matched to the Atlas. A skill that isn't on your résumé goes into a tailored résumé only once it's proven.</p>
      <SkillsList list={list} base={base} openKey={openKey} onOpen={setOpenKey} onChanged={() => load()} />
      {error && <p className="ysk__quiet" role="alert">{error}</p>}
    </section>
  );
}
