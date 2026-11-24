// ⭐ D196 · the plate system's root: the `.plate` scope that publishes the tokens (styles/plate.css), the components'
// look (plate/plate.css) and the three faces. A plate page renders inside one; nothing outside it changes.
import "../styles/plate.css";
import "./plate.css";
import "./fonts.js";

/** region = the page's palette ("I"–"VIII"; IV is the v3 boards'); plain = D181's no-tints mapping. */
export default function PlateRoot({ region = "IV", plain = false, className = "", children, ...rest }) {
  return (
    <div className={`plate ${className}`.trim()} data-region={region} data-plain={plain ? "" : undefined} {...rest}>
      {children}
    </div>
  );
}
