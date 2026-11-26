// ⭐ D196 R1 · EVERY COMPONENT HAS ITS STATES — one implementation of the four, so they look the same everywhere:
//   loading  a paper skeleton in the same frame: hatched placeholder blocks, no spinner (aria-busy)
//   empty    the report's dashed "not yet" drawer with one plain next step
//   error    one plain sentence + Try again
//   partial  the component's own reading (it renders normally and says "no data yet" where a part is missing —
//            NoData below); never an invented row
// A component calls PlateState first and renders itself only for "ready" / "partial".

export const STATES = Object.freeze(["ready", "loading", "empty", "error", "partial"]);

export function Skeleton({ label = "Loading", height, radius, lines = 3 }) {
  const style = {};
  if (height) style["--pl-skel-h"] = typeof height === "number" ? `${height}px` : height;
  if (radius) style["--pl-skel-r"] = `var(--pl-r-${radius})`;
  return (
    <div className="pl-state pl-skel" role="status" aria-busy="true" aria-label={label} style={style}>
      {Array.from({ length: lines }, (_, i) => <span key={i} className="pl-skel__block" aria-hidden="true"/>)}
    </div>
  );
}

// ⭐ 47j w1-market (D197 Wave 1 #2): a page's own empty state is this same drawer — `title` (a serif line above the text),
// `kicker` (what the stamp says, NOT YET unless the case is something else — "PAST THE END", "SOMETHING WENT WRONG"),
// `children` (richer text than one string) and `actions` (its own buttons / links, e.g. a router Link or the résumé upload)
// are optional; `role` / data-* pass through. Without them it is exactly the gate's drawer.
export function Drawer({ text, action, title, kicker = "NOT YET", children = null, actions = null, ...rest }) {
  return (
    <div className="pl-state pl-drawer" {...rest}>
      <span className="pl-label">{kicker}</span>
      {title ? <p className="pl-drawer__title">{title}</p> : null}
      {text ? <p className="pl-drawer__text">{text}</p> : null}
      {children ? <div className="pl-drawer__text">{children}</div> : null}
      {action ? (action.href
        ? <a className="pl-btn" href={action.href}>{action.label}</a>
        : <button type="button" className="pl-btn" onClick={action.onClick}>{action.label}</button>) : null}
      {actions ? <div className="pl-drawer__actions">{actions}</div> : null}
    </div>
  );
}

export function ErrorLine({ text = "This didn't load.", onRetry }) {
  return (
    <div className="pl-state pl-error" role="alert">
      <p className="pl-error__text">{text}</p>
      {onRetry ? <button type="button" className="pl-btn" onClick={onRetry}>Try again</button> : null}
    </div>
  );
}

/** A missing part, said plainly: "no data yet" — the stamp of a partial state. */
export function NoData({ children = "NO DATA YET" }) {
  return <span className="pl-nodata">{children}</span>;
}

/**
 * The gate every component runs first. Returns the state's rendering, or null for ready / partial.
 * `s` = { state, emptyText, emptyAction, errorText, onRetry }; `frame` = the skeleton's height / radius.
 */
export function plateState(s = {}, frame = {}) {
  const state = s.state || "ready";
  if (state === "loading") return <Skeleton label={frame.label} height={frame.height} radius={frame.radius} lines={frame.lines}/>;
  if (state === "empty") return <Drawer text={s.emptyText || frame.emptyText || "Nothing here yet."} action={s.emptyAction}/>;
  if (state === "error") return <ErrorLine text={s.errorText} onRetry={s.onRetry}/>;
  return null;
}
