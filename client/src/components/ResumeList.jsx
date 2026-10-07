// ⭐ D62 · THE RÉSUMÉ LIST — one list component, two homes (owner 10-07).
//
// The ATS panel's History tab and Settings → Your data → Generated résumés (D57) are the same thing seen
// from two places: a list of résumés, each with when it was made, its tailored score and what you can do
// with it. Each used to be drawn its own way — History as a green letter tile, a "Strong" capsule and an
// eye and a share icon in the old flat dark squares. Now one row:
//
//   [ title / meta ]                            [ number box ]  [ view ] [ download ] …
//
// · the score is the D50 number box (the serif number, its caption) — never a band capsule;
// · every action is a D1 depth square with an icon AND an accessible name (title + aria-label);
// · no letter tile, no pill (D60, D61). The company's mark, where a row needs one, is CompanyLogo.
import CompanyLogo from "./CompanyLogo.jsx";
import "./ResumeList.css";

export const RESUME_ICONS = {
  view: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  download: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14"/></svg>,
  remove: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7m-7 0l1 12.5h8L17 7"/></svg>,
};

/** The D50 box, read-only: a résumé's tailored score. No score → the dashed box, no digits. */
export function ScoreBox({ score, caption = "ATS" }) {
  const has = Number.isFinite(score);
  return (
    <span className={`rl__score${has ? "" : " rl__score--none"}`} data-resume-score={has ? Math.round(score) : ""}
      role="img" aria-label={has ? `ATS match ${Math.round(score)}` : "No ATS score"}>
      {has ? <><b>{Math.round(score)}</b><small>{caption}</small></> : <small>—</small>}
    </span>
  );
}

/** rows: [{ key, title, meta, score, company?, iconUrl?, actions: [{ id, label, icon, onClick, disabled }] }] */
export default function ResumeList({ rows, empty = "No résumés yet.", showLogo = false, scoreCaption = "tailored" }) {
  if (!rows?.length) return <div className="rl__empty" data-resume-list-empty="">{empty}</div>;
  return (
    <ul className="rl" data-resume-list="">
      {rows.map(r => (
        <li key={r.key} className="rl__row" data-resume-row={r.key}>
          {showLogo && <CompanyLogo company={r.company} iconUrl={r.iconUrl} size={36} radius={10} />}
          <div className="rl__text">
            <div className="rl__title">{r.title}</div>
            {r.meta && <div className="rl__meta">{r.meta}</div>}
          </div>
          {r.score !== undefined && <ScoreBox score={r.score} caption={scoreCaption} />}
          <div className="rl__actions">
            {(r.actions || []).map(a => (
              <button key={a.id} type="button" className="rl__sq" data-resume-action={a.id}
                title={a.label} aria-label={a.label} disabled={!!a.disabled} onClick={a.onClick}>
                {a.icon}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
