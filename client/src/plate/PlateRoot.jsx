// ⭐ D196 · the plate system's root: the `.plate` scope that publishes the tokens (styles/plate.css), the components'
// look (plate/plate.css) and the three faces. A plate page renders inside one; nothing outside it changes.
import "../styles/plate.css";
import "./plate.css";
import "./fonts.js";
import { NO_TINTS } from "../themes/index.js";

/** region = the page's palette ("I"–"VIII"; IV is the v3 boards'); plain = D181's no-tints mapping — by default the live
 *  theme's (47h: Plain's people get no tints on plate pages; themes/index.js decides, never this file). */
export default function PlateRoot({ region = "IV", plain = NO_TINTS, className = "", children, ...rest }) {
  return (
    <div className={`plate ${className}`.trim()} data-region={region} data-plain={plain ? "" : undefined} {...rest}>
      {children}
    </div>
  );
}
