// client/src/components/MarketingFrame.jsx — ⭐ 46v 0d (owner 11-18: "yes do the other pages too") · THE MARKETING PAGES'
// ONE FRAME, in the landing's treatment (the owner's pick A + the shelf + C): the marketing dock, a serif head with its
// lede and actions, full-width sections with the reading measure kept on text only (46q FULL WIDTH), the footer.
// About, Features, How it works, Extension, FAQ, Pricing and Contact wear it; the landing uses its buttons. Text blocks
// inside are the A233 set (NoteCard / Facts / Promises) and the Library's books (BookShelf). Theme tokens only; no
// capsules (D60).
import { Link } from "react-router-dom";
import ScrollDock from "./ScrollDock.jsx";
import { Footer } from "./Footer.jsx";
import "./MarketingFrame.css";

/** A link drawn as the frame's button — a depth box (D60), the accent one for the page's main action. */
export function MkLink({ primary = false, className = "", children, ...props }) {
  return <Link className={`mk-btn${primary ? " mk-btn--primary" : ""}${className ? ` ${className}` : ""}`} {...props}>{children}</Link>;
}

/** One section: a serif heading, an optional quiet line, then its content. */
export function MkSection({ id, title, lede = null, children, className = "", ...data }) {
  return (
    <section className={`mk-sec${className ? ` ${className}` : ""}`} aria-labelledby={id ? `${id}-h` : undefined} {...data}>
      {title && <h2 id={id ? `${id}-h` : undefined} className="mk-h2">{title}</h2>}
      {lede && <p className="mk-quiet">{lede}</p>}
      {children}
    </section>
  );
}

/** A numbered sequence: [{ key, body }] — the number in the serif beside each body (a step's note card). */
export function MkSteps({ items, ...data }) {
  return (
    <ol className="mk-steps" {...data}>
      {items.map((it, i) => (
        <li key={it.key ?? i} className="mk-step" data-step={i + 1}>
          <span className="mk-step__n" aria-hidden="true">{i + 1}</span>
          {it.body}
        </li>
      ))}
    </ol>
  );
}

/** One plan's card: its badge, name and price, then whatever it lists and its action. */
export function MkPlan({ name, price, badge = null, recommended = false, children, ...data }) {
  return (
    <article className="mk-plan" data-recommended={recommended ? "true" : "false"} {...data}>
      {badge && <p className="mk-eyebrow">{badge}</p>}
      <h2 className="mk-plan__name">{name}</h2>
      <p className="mk-plan__price">{price}</p>
      {children}
    </article>
  );
}

/** The page: the marketing dock, the head (eyebrow · title · lede · actions), the sections, the footer. */
export function MarketingFrame({ eyebrow = null, title, lede = null, actions = null, children, ...data }) {
  return (
    <div className="scroll-dock-page mk-page" {...data}>
      <ScrollDock variant="marketing" />
      <main className="mk">
        <header className="mk-head">
          {eyebrow && <p className="mk-eyebrow">{eyebrow}</p>}
          <h1 className="mk-h1">{title}</h1>
          {lede && <p className="mk-lede">{lede}</p>}
          {actions && <div className="mk-ctas">{actions}</div>}
        </header>
        {children}
      </main>
      <Footer />
    </div>
  );
}
