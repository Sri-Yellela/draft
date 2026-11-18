// client/src/components/BookShelf.jsx — ⭐ 46u (Atlas → Library, owner's pick A, 11-17) · BOOKS ON A SHELF, moved here in
// 46v so the landing's feature shelf (owner 11-18: "instead of the grid type feature list, use the shelf") draws the SAME
// book (A93: one implementation). The Library re-exports these from pages/atlas/LibraryGuides.jsx.
import { Link } from "react-router-dom";
import { pastelIndex, pastelVar } from "../../../shared/pastel.js";
import "./BookShelf.css";

/** The shelf the books stand on: a list (ul, or ol for an order) that scrolls sideways inside itself on a phone. */
export function BookShelf({ as: Tag = "ul", className = "", children, ...data }) {
  return <Tag className={`lib-books${className ? ` ${className}` : ""}`} {...data}>{children}</Tag>;
}

/**
 * ⭐ 46u (owner's pick 11-17: "A", books on a shelf) · ONE BOOK ON THE SHELF — a spine in the item's pastel (stable per
 * id, shared/pastel.js), the kind at the head, the title running up the spine (serif), its drawing and state at the foot.
 * A course's spine is wider (it holds more); an unwritten guide is faint and thin and never a link. `rank` varies the
 * height a little, as books do. One of: `to` (a link), `onClick` (a button), neither (not available).
 */
// A long title runs smaller, so it breaks only between words and stays on its spine (46u walk: "Softwar|e engine|ering").
export const spineFont = (title) => { const n = String(title || "").length; return n <= 12 ? 21 : n <= 20 ? 18 : 16; };

/**
 * ⭐ 46u (owner 11-17, on the first build: "not at all like the sketch and just looks like blocks — the sketch had them
 * different sizes, leaned in various angles") · A BOOK'S SHAPE ON THE SHELF, stable per id (shared/pastel.js's hash, so a
 * book keeps its size and lean on every visit): its height and width vary as books do; about one in three leans against
 * its neighbour (a few degrees, either way), and the last book on a shelf leans on the one before it. A lean takes the room
 * it needs beside it (tan · height), so a leaning book never covers its neighbour's title. Pure.
 */
export function bookShape(id, size = "", last = false) {
  const h = pastelIndex(`${id}:h`) - 1, w = pastelIndex(`${id}:w`) - 1, l = pastelIndex(`${id}:l`);
  const height = size === "wide" ? 244 + h * 7 : size === "thin" ? 176 + h * 6 : 196 + h * 9;
  const width = size === "wide" ? 84 + (w % 3) * 6 : size === "thin" ? 52 + (w % 2) * 4 : 58 + (w % 4) * 5;
  const lean = last ? 7 : l === 1 ? -4 : l === 2 ? 5 : l === 3 ? -2 : 0;
  const room = Math.round(Math.abs(Math.tan((lean * Math.PI) / 180)) * height) + (lean ? 4 : 0);
  return { height, width, lean, before: lean < 0 ? room : 0, after: lean > 0 ? room : 0 };
}

export function BookSpine({ id, kind, title, foot, label, to, onClick, size = "", last = false, art = null, ...data }) {
  const cls = `lib-book__spine${size ? ` lib-book__spine--${size}` : ""}`;
  const shape = bookShape(id, size, last);
  const body = (
    <>
      <span className="lib-book__kind">{kind}</span>
      <span className="lib-book__title">{title}</span>
      <span className="lib-book__foot">{art}<span className="lib-book__state">{foot}</span></span>
    </>
  );
  return (
    <li className={`lib-book${shape.lean ? " lib-book--lean" : ""}`} data-pastel={pastelIndex(id)} data-lean={shape.lean || undefined} {...data}
      style={{ "--book-c": pastelVar(id), "--book-fs": `${spineFont(title)}px`, "--book-h": `${shape.height}px`, "--book-w": `${shape.width}px`,
        "--book-lean": `${shape.lean}deg`, "--book-origin": shape.lean < 0 ? "bottom right" : "bottom left", marginLeft: shape.before, marginRight: shape.after }}>
      {to ? <Link to={to} className={cls} aria-label={label} title={label}>{body}</Link>
        : onClick ? <button type="button" className={cls} onClick={onClick} aria-label={label} title={label}>{body}</button>
          : <div className={`${cls} lib-book__spine--none`} aria-disabled="true" title={label}>{body}</div>}
    </li>
  );
}

