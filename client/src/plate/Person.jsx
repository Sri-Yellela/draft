// ⭐ D197 Wave 2 (47j, lane w2-person) · THE PERSON'S PIECES — what Your passport (#9), Setting out (#15) and the settings /
// sign-in pages (#17) need that the library lacked (docs/revamp/profile.md, onboarding.md, settings.md):
//   PassportIdentity   the passport's identity page: photo square or letter, name, headline, mono fields, the visa stamp
//   VisibilityControl  Only you · Connections · Public — the page level, or a section's eye (`cap`: it narrows, never widens)
//   PassportStamps     proven skills as green stamps (how · date · proof), résumé skills as dashed "not yet" tiles
//   LabelledField      a mono label over a 1.5 px ink input (or textarea), its note and its error (role="alert")
//   SettingsSheet      a settings card in plain names: strip, serif title, lead, rows of label · control · note
//   SettingOutDrop     Setting out's résumé drop: a dashed "not yet" plate, the clay upload, drop anywhere on it
//   DrawingToCome      a labelled placeholder plate where a drawing is still to be drawn (role="img", "drawing to come: …")
// Each runs plateState() first (R1) and wears only plate tokens (plate/person.css). Synthetic data only (registry.js).
import { useRef, useState } from "react";
import { plateState, NoData } from "./PlateState.jsx";
import { Stamp } from "./Marks.jsx";
import "./person.css";

export const VISIBILITY_LEVELS = Object.freeze([["only_me", "Only you"], ["connections", "Connections"], ["public", "Public"]]);
const RANK = { only_me: 0, connections: 1, public: 2 };
const STAMP_WORD = { only_me: "ONLY YOU", connections: "CONNECTIONS", public: "PUBLIC" };

/**
 * The identity page. `fields` = [{ label, value }] (HANDLE, FITS, LOCATION · YEARS …; a null value says "not set");
 * `level` = who can see the page (its visa stamp); `open` = the open-to-work line; `actions` / `children` = the page's.
 */
export function PassportIdentity({ name, headline, photo, region, fields = [], level = "only_me", open, actions = null, photoAction = null, children = null, ...s }) {
  const gate = plateState(s, { height: 260, radius: "plate", label: "Loading your passport", lines: 4 });
  if (gate) return gate;
  const letter = (String(name || "").trim()[0] || "?").toUpperCase();
  return (
    <section className="pl-passport" aria-label="Identity page" data-region={region}>
      <div className="pl-passport__strip">
        <span className="pl-label">PASSPORT · IDENTITY PAGE</span>
        <Stamp tone={level === "public" ? "ink" : "region"} rotate={-6} land={false}>{`SEEN BY · ${STAMP_WORD[level] || STAMP_WORD.only_me}`}</Stamp>
      </div>
      <div className="pl-passport__body">
        <div className="pl-passport__photo">
          {photo ? <img src={photo} alt="" loading="lazy"/> : <span aria-hidden="true">{letter}</span>}
          {photoAction}
        </div>
        <div className="pl-passport__text">
          <h2 className="pl-passport__name">{name || "Your name"}</h2>
          {headline ? <p className="pl-passport__headline">{headline}</p> : <p className="pl-passport__headline pl-muted">No headline yet — Edit to add one.</p>}
          {fields.length ? (
            <dl className="pl-passport__fields">
              {fields.map((f) => (
                <div key={f.label} className="pl-passport__field">
                  <dt className="pl-label pl-muted">{f.label}</dt>
                  <dd>{f.value == null ? <NoData>NOT SET</NoData> : f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {open ? <p className="pl-passport__open">{open}</p> : null}
        </div>
      </div>
      {children}
      {actions ? <div className="pl-passport__actions">{actions}</div> : null}
    </section>
  );
}

/**
 * Who can see it. `value` = the level; `cap` = the page's level when this is a section's eye — a level wider than the
 * page is disabled and says why (a section narrows, never widens). `compact` = the section header's size.
 */
export function VisibilityControl({ value = "only_me", cap = null, onChange, label = "Who can see your profile", compact = false, ...s }) {
  const gate = plateState(s, { height: compact ? 36 : 48, radius: "input", lines: 1, label: "Loading who can see it" });
  if (gate) return gate;
  return (
    <div className={`pl-visibility${compact ? " pl-visibility--compact" : ""}`} role="group" aria-label={label}>
      {VISIBILITY_LEVELS.map(([k, w]) => {
        const wider = cap != null && RANK[k] > RANK[cap];
        return (
          <button key={k} type="button" className="pl-visibility__opt" aria-pressed={value === k} disabled={wider} data-level={k}
            title={wider ? "Wider than your page — change the page first" : undefined} onClick={() => onChange?.(k)}>{w}</button>
        );
      })}
    </div>
  );
}

/**
 * Stamps — proof, never progress. `proven` = [{ name, how, at, href }] (green: a skill proven in Atlas); `listed` =
 * [{ name, href }] (dashed: on the résumé, not proven yet — `href` = its "Prove it · 5 min").
 */
export function PassportStamps({ proven = [], listed = [], label = "Your stamps", proveLabel = "Prove it · 5 min", ...s }) {
  const gate = plateState(s, { height: 200, radius: "plate", lines: 3, label: "Loading your stamps" });
  if (gate) return gate;
  return (
    <div className="pl-stamps" role="region" aria-label={label}>
      <div className="pl-stamps__group">
        <span className="pl-label pl-tone-lit">PROVEN IN ATLAS · {proven.length}</span>
        {proven.length ? (
          <ul className="pl-stamps__row">
            {proven.map((p, i) => (
              <li key={p.name} className="pl-stamps__stamp">
                <Stamp tone="lit" rotate={i % 2 ? 5 : -7} land={false}>{p.name}</Stamp>
                <span className="pl-stamps__sub">{[p.how, p.at].filter(Boolean).join(" · ").toUpperCase()}{p.href ? <> · <a href={p.href}>PROOF</a></> : null}</span>
              </li>
            ))}
          </ul>
        ) : <NoData>NO STAMPS YET</NoData>}
      </div>
      <div className="pl-stamps__group">
        <span className="pl-label pl-muted">FROM YOUR RÉSUMÉ · NOT YET PROVEN · {listed.length}</span>
        {listed.length ? (
          <ul className="pl-stamps__row">
            {listed.map((l) => (
              <li key={l.name} className="pl-stamps__yet">
                <b>{l.name}</b>{l.href ? <a href={l.href}>{proveLabel}</a> : null}
              </li>
            ))}
          </ul>
        ) : <NoData>NOTHING LEFT TO PROVE</NoData>}
      </div>
    </div>
  );
}

/** A labelled field: mono label, a 1.5 px ink input (or a textarea when `multiline`), a note, an error said in words. */
export function LabelledField({ label, id, value, onChange, type = "text", placeholder, note, error, multiline = false, autoComplete, required = false, ...s }) {
  const auto = useRef(`pl-f-${Math.random().toString(36).slice(2, 8)}`);
  const gate = plateState(s, { height: 64, radius: "input", lines: 1, label: `Loading ${label || "the field"}` });
  if (gate) return gate;
  const fid = id || auto.current;
  const common = { id: fid, className: "pl-field__input", value: value ?? "", placeholder, required, "aria-invalid": error ? true : undefined,
    onChange: (e) => onChange?.(e.target.value), readOnly: onChange ? undefined : true };
  return (
    <div className="pl-field">
      <label className="pl-label" htmlFor={fid}>{label}{required ? <span aria-hidden="true"> *</span> : null}</label>
      {multiline ? <textarea rows={4} {...common}/> : <input type={type} autoComplete={autoComplete} {...common}/>}
      {note ? <span className="pl-field__note">{note}</span> : null}
      {error ? <span className="pl-field__error" role="alert">{error}</span> : null}
    </div>
  );
}

/**
 * A settings card in plain names (D197 #17). `rows` = [{ label, value, note, control }] — `control` (a node) wins over
 * `value`; `tone` "danger" says so in words and dashes the border (the plate palette has no red). `drawing` = a node.
 */
export function SettingsSheet({ kicker, title, lead, rows = [], actions = null, tone, drawing = null, children = null, ...s }) {
  const gate = plateState(s, { height: 220, radius: "plate", lines: 4, label: `Loading ${title || "the setting"}` });
  if (gate) return gate;
  return (
    <section className="pl-card pl-settings" data-tone={tone} aria-label={title}>
      <div className="pl-card__strip"><span className="pl-label">{kicker}</span>{tone === "danger" ? <span className="pl-label">CAN’T BE UNDONE</span> : null}</div>
      <div className="pl-settings__body">
        <div className="pl-settings__head">
          <div className="pl-settings__words">
            {title ? <h3 className="pl-settings__title">{title}</h3> : null}
            {lead ? <p className="pl-settings__lead">{lead}</p> : null}
          </div>
          {drawing ? <div className="pl-settings__drawing">{drawing}</div> : null}
        </div>
        {rows.length ? (
          <div className="pl-settings__rows" role="list">
            {rows.map((r, i) => (
              <div key={`${r.label}-${i}`} className="pl-settings__row" role="listitem">
                <div className="pl-settings__label">
                  <b>{r.label}</b>
                  {r.note ? <span className="pl-settings__note">{r.note}</span> : null}
                </div>
                <div className="pl-settings__control">{r.control ?? (r.value == null ? <NoData>NOT SET</NoData> : <span>{r.value}</span>)}</div>
              </div>
            ))}
          </div>
        ) : null}
        {children}
        {actions ? <div className="pl-actions">{actions}</div> : null}
      </div>
    </section>
  );
}

/**
 * Setting out's drop: a dashed "not yet" plate; the clay Upload button (the page's one clay point) opens the file picker,
 * and a file dropped anywhere on the plate is taken the same way. `status` is said politely (aria-live).
 */
export function SettingOutDrop({ title = "Hand over your résumé", line = "PDF or Word — or drop it here. draft reads your field, level, titles and skills from it and sets up your first job profile.",
  button = "Upload your résumé", accept = ".pdf,.docx,.txt", onFile, busy = false, status, aside = null, ...s }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const gate = plateState(s, { height: 220, radius: "plate", lines: 3, label: "Loading" });
  if (gate) return gate;
  return (
    <div className="pl-drop" data-over={over ? "" : undefined}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer?.files?.[0]; if (f) onFile?.(f); }}>
      <span className="pl-label">NOT YET · ONE RÉSUMÉ SETS UP EVERYTHING</span>
      <h3 className="pl-drop__title">{title}</h3>
      <p className="pl-drop__line">{line}</p>
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile?.(f); }}/>
      <div className="pl-actions">
        <button type="button" className="pl-btn pl-btn--primary" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Reading…" : button}</button>
        {aside}
      </div>
      <p className="pl-drop__status" role="status" aria-live="polite">{status || ""}</p>
    </div>
  );
}

/** A placeholder plate where a drawing is still to come — labelled, never blank art: "drawing to come: <what>". */
export function DrawingToCome({ what, aspect = "640 / 520", kicker = "DRAWING TO COME", ...s }) {
  const gate = plateState(s, { height: 240, radius: "hero", lines: 2, label: "Loading the plate" });
  if (gate) return gate;
  return (
    <div className="pl-tocome" role="img" aria-label={`drawing to come: ${what}`} style={{ "--pl-aspect": aspect }}>
      <span className="pl-label">{kicker}</span>
      <span className="pl-tocome__what">{what}</span>
    </div>
  );
}
