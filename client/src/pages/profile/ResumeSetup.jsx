// ⭐ D186 (owner 11-09: "one résumé sets up everything … the manual options should still be there") · the Profile page's
// three D186 pieces: the FOUR THINGS a résumé can't tell us (D186-2), the WEIGHTED TERMS that rank the board (D186-4),
// and the choice a résumé from ANOTHER family offers (D186-3). Automatic by default; every value stays the person's to change.
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { QuestionTicket } from "../../plate/Tickets.jsx";   // 47m: the four things, one at a time
import "./ResumeSetup.css";

/**
 * D186-2 · asked once, each skippable; never inferred. Hidden when nothing is left to ask.
 * ⭐ 47m (D197 #9 / #15 M5): ONE THING AT A TIME — the plate's QuestionTicket (the ledger's Needs-you face), the items as
 * progress squares (answered or skipped = lit, this one = today), Next saves it (PUT /api/profile/four-things { key, value }),
 * "Skip this one" in the foot ({ key, skip: true }). `onOpen(open)` tells the page whether it is showing (the one clay point
 * moves here while it is); `clay` = draw it as that point. Used by Your passport and by Setting out's leg 03.
 */
export function FourThingsTicket({ onChanged = null, onOpen = null, clay = true }) {
  const [s, setS] = useState(null);
  const [val, setVal] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { api("/api/profile/four-things").then(setS).catch(() => setS(null)); }, []);
  const left = s?.open ? s.items.filter(i => !i.set && !i.skipped) : [];
  const open = left.length > 0;
  useEffect(() => { onOpen?.(open); }, [open, onOpen]);
  if (!open) return null;
  const item = left[0];
  const save = async (body) => {
    setMsg("");
    try { setS({ ...s, ...(await api("/api/profile/four-things", { method: "PUT", body: JSON.stringify({ key: item.key, ...body }) })) }); setVal(""); onChanged?.(); }
    catch (e) { setMsg(e.message || "Could not save that."); }
  };
  const choices = Array.isArray(item.choices) && item.choices.length ? item.choices
    : item.key === "willing_to_relocate" ? [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] : null;
  const byLabel = (label) => choices?.find(c => c.label === label)?.value ?? "";
  const shownLabel = choices?.find(c => c.value === val)?.label ?? "";
  const progress = s.items.map(i => (i.set || i.skipped ? "lit" : i.key === item.key ? "today" : "none"));
  const isDate = item.key === "available_start_date";
  return (
    <section className="pl-pp-four" data-four-things={left.length} data-tone={clay ? "clay" : undefined} aria-label="What your résumé can't tell us">
      <QuestionTicket kicker={left.length === 1 ? "ONE THING YOUR RÉSUMÉ CAN'T TELL US" : `${left.length} THINGS YOUR RÉSUMÉ CAN'T TELL US`}
        n="Everything else came from your résumé. These stay unset until you answer — skip any of them."
        text={item.why ? `${item.label} — ${item.why}` : item.label} progress={progress} saveLabel={null}
        kind={choices ? "choice" : "text"} options={choices ? choices.map(c => c.label) : undefined}
        value={choices ? shownLabel : val} onChange={(v) => setVal(choices ? byLabel(v) : String(v).slice(0, 120))}
        canNext={!!String(val ?? "").trim()} onNext={() => save({ value: val })} nextLabel="Save and next"
        rootProps={{ "data-four-thing": item.key }}
        more={<button type="button" className="pl-btn pl-btn--flat" onClick={() => save({ skip: true })} data-four-skip={item.key}>Skip this one</button>}>
        {isDate ? <span className="pl-muted">As a date — for example 2027-01-15.</span> : item.key === "desired_salary" ? <span className="pl-muted">A yearly figure — for example 140000.</span> : null}
        {msg ? <span className="pl-muted" role="alert">{msg}</span> : null}
      </QuestionTicket>
    </section>
  );
}

const SOURCE_WORD = { exact: "from your résumé", alias: "alias of", related: "related to" };
/** D186-4 · each term with its weight and source, removable (removed stays removed across résumé replaces). */
export function RankingTerms({ profileId }) {
  const [d, setD] = useState(null);
  const load = useCallback(() => { if (profileId) api(`/api/domain-profiles/${profileId}/keywords`).then(setD).catch(() => setD(null)); }, [profileId]);
  useEffect(() => { load(); }, [load]);
  if (!profileId) return <p className="rs-four__why">Upload a résumé and the terms that rank your board appear here.</p>;
  if (!d) return null;
  const flip = async (term, removed) => { try { const r = await api(`/api/domain-profiles/${profileId}/keywords`, { method: "PUT", body: JSON.stringify({ term, removed }) }); setD({ ...d, ...r }); } catch { /* left as it was */ } };
  return (
    <div className="rs-terms" data-ranking-terms={d.terms.length}>
      <p className="rs-four__why">The board ranks by these, strongest first. Related terms only help ranking — they are never added to your skills or your résumé.</p>
      <ul className="rs-terms__list">
        {d.terms.map(t => (
          <li key={t.term} data-term-source={t.source}>
            <b>{t.term}</b> <span className="rs-four__why">· weight {t.weight} · {SOURCE_WORD[t.source]}{t.via ? ` ${t.via}` : ""}</span>
            <button type="button" className="rs-btn rs-btn--quiet" onClick={() => flip(t.term, true)} aria-label={`Remove ${t.term}`}>Remove</button>
          </li>
        ))}
      </ul>
      {d.removed.length > 0 && <p className="rs-four__why" data-ranking-removed={d.removed.length}>Removed (kept out when your résumé changes): {d.removed.map((r, i) => (
        <span key={r}>{i ? ", " : ""}{r} <button type="button" className="rs-btn rs-btn--quiet" onClick={() => flip(r, false)}>Put back</button></span>))}</p>}
    </div>
  );
}

/** D186-3 · a résumé from another family: its own job profile (the default) or a replace of the current one. */
export function SecondFamilyChoice({ preview, busy, onNew, onReplace, onCancel }) {
  const to = [preview.subName, preview.categoryName].filter(Boolean).join(" · ");
  return (
    <section className="rs-four" data-second-family="" role="dialog" aria-label="A résumé for another kind of job">
      <h2 className="rs-four__h">This résumé is for {to || "another kind of job"}</h2>
      <p className="rs-four__lead">Your current job profile is {preview.active?.name || "another family"}. Keep both, or replace it?</p>
      <p>
        <button type="button" className="rs-btn" onClick={onNew} disabled={busy} data-second-family-new="">Make this its own job profile</button>{" "}
        <button type="button" className="rs-btn rs-btn--quiet" onClick={onReplace} disabled={busy} data-second-family-replace="">Replace the current one</button>{" "}
        <button type="button" className="rs-btn rs-btn--quiet" onClick={onCancel} disabled={busy}>Cancel</button>
      </p>
    </section>
  );
}
