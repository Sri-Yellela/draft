// client/src/components/MarketingFrame.jsx — THE MARKETING PAGES' ONE FRAME. ⭐ D197 · 47m (lane public, M5 — the
// marketing.md proposed M2, owner approved the mocks 11-27): the frame is the PLATE now — the public nav + the public
// footer (components/PublicChrome.jsx PublicPage, replacing the marketing ScrollDock and the classic footer), paper ground,
// the one-line header (D200 Rule 3: kicker · the serif line · the lead · the actions), MkLink → the plate button (primary =
// the page's one clay point), MkSection → a plate leg (serif title, mono meta), MkSteps → a numbered plate route, MkPlan →
// a plate ticket. About, Features, How it works, Extension, FAQ, Pricing and Contact wear it; every page keeps its route,
// its words and its data-* hooks. The class names (mk-*) stay as the pages' hooks; their look is plate tokens only
// (MarketingFrame.css). No capsules (D60).
import { Link } from "react-router-dom";
import { Kickers } from "../plate/Marks.jsx";
import { PublicPage } from "./PublicChrome.jsx";
import "./MarketingFrame.css";

/** A link drawn as the plate button — `primary` is the page's ONE clay point; the rest are paper. */
export function MkLink({ primary = false, className = "", children, ...props }) {
  return <Link className={`pl-btn ${primary ? "pl-btn--primary" : "pl-btn--secondary"} mk-btn${primary ? " mk-btn--primary" : ""}${className ? ` ${className}` : ""}`} {...props}>{children}</Link>;
}

/** One section: a plate leg — a serif heading, an optional quiet mono line, then its content. */
export function MkSection({ id, title, lede = null, children, className = "", ...data }) {
  return (
    <section className={`mk-sec${className ? ` ${className}` : ""}`} aria-labelledby={id ? `${id}-h` : undefined} {...data}>
      {title && <h2 id={id ? `${id}-h` : undefined} className="mk-h2 pl-leg__title">{title}</h2>}
      {lede && <p className="mk-quiet">{lede}</p>}
      {children}
    </section>
  );
}

/** A numbered sequence: [{ key, body }] — a plate route: the stop's number in an outlined serif beside each body. */
export function MkSteps({ items, ...data }) {
  return (
    <ol className="mk-steps" {...data}>
      {items.map((it, i) => (
        <li key={it.key ?? i} className="mk-step" data-step={i + 1}>
          <span className="mk-step__n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
          {it.body}
        </li>
      ))}
    </ol>
  );
}

/** One plan: a plate ticket — its badge as the kicker, name and price, then whatever it lists and its action. */
export function MkPlan({ name, price, badge = null, recommended = false, children, ...data }) {
  return (
    <article className="mk-plan pl-ticket" data-recommended={recommended ? "true" : "false"} {...data}>
      {badge && <p className="mk-eyebrow pl-label">{badge}</p>}
      <h2 className="mk-plan__name">{name}</h2>
      <p className="mk-plan__price">{price}</p>
      {children}
    </article>
  );
}

/** A note on the plate (47m — the marketing pages' NoteCard, marketing.md: "NoteCard → the library Ticket / pl-card"): a
 *  plate card with its title as the serif head, the text, and its actions under a ruled line. Same props as NoteCard. */
export function MkNote({ id = "note", title, children = null, actions = null, className = "", style = null, ...data }) {
  return (
    <div className={`pl-card mk-note${className ? ` ${className}` : ""}`} style={style || undefined} data-note-card={id} {...data}>
      <div className="pl-card__body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {title && <p className="mk-note__t">{title}</p>}
        {children && <div className="mk-note__s">{children}</div>}
        {actions && <div className="pl-actions" style={{ marginTop: 4 }}>{actions}</div>}
      </div>
    </div>
  );
}

/** What happens (✓) and what never does (✗) — a ruled list in ink (a promise isn't a proof, so no green). Same props as
 *  TextBlocks' Promises; each item keeps its full meaning (and its words for a screen reader). */
export function MkPromises({ title = null, items, className = "", ...data }) {
  return (
    <ul className={`pl-card mk-prom${className ? ` ${className}` : ""}`} data-promises="" aria-label={title || undefined} {...data}>
      {title && <li className="pl-label" aria-hidden="true">{title}</li>}
      {(items || []).map((it, i) => (
        <li key={i} className="pl-card__item" data-promise={it.ok ? "does" : "never"}>
          <span aria-hidden="true" className="pl-label" style={{ minWidth: 14 }}>{it.ok ? "✓" : "✗"}</span>
          <span><span className="pl-sr">{it.ok ? "Yes: " : "Never: "}</span>{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** The page: the public nav, the one-line header (eyebrow · title · lede · actions), the sections, the public footer. */
export function MarketingFrame({ eyebrow = null, title, lede = null, actions = null, region = "I", children, ...data }) {
  return (
    <PublicPage region={region} className="mk-page" {...data}>
      <main className="mk pl-page">
        <header className="mk-head">
          {eyebrow && <div className="mk-eyebrow"><Kickers parts={[String(eyebrow).toUpperCase()]}/></div>}
          <h1 className="mk-h1 pl-mk-hero__title">{title}</h1>
          {lede && <p className="mk-lede pl-mk-hero__line">{lede}</p>}
          {actions && <div className="mk-ctas pl-actions">{actions}</div>}
        </header>
        {children}
      </main>
    </PublicPage>
  );
}
