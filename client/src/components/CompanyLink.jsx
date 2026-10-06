import { api } from "../lib/api.js";
import "./CompanyLink.css";

// ── D38 (owner, 10-06) · ONE COMPANY LINK, ON EVERY SURFACE ───────────────────────────────────────────
//
// ⭐ A63: APPLY IS THE COMPANY NAME — the name links to the posting, and opening it tags the job Pending.
// A78 gave the board card its treatment (bold italic in the logo face, no underline, no arrow); the posting
// panel never got it, and two more surfaces carried their own copy. Three implementations of one mark is
// how the legacy brand shipped on every page while the guard passed green — so there is ONE, here.
//
// ⛔ THE HIT AREA IS THE TEXT. The card's anchor was a flex child of a column, so it stretched across the
// whole line and a click on empty space beside the name followed the link; the panel's was display:block,
// the same. CompanyLink.css makes the anchor exactly as wide as its text (inline-block, fit-content,
// align-self: flex-start), with no overlay. The card's own click (open the posting) works everywhere else.
//
// ⚠ A non-colour hover affordance (A78): the underline returns on hover and keyboard focus.
//
// Props: company, href (no href → plain text, same face), jobId (tags Pending on open), size
//        ("card" | "panel" | "row"), className, onOpen (replaces the default Pending tag — the posting
//        panel keeps its own state from the answer)
export default function CompanyLink({ company, href = null, jobId = null, size = "card", className = "", onOpen = null }) {
  const cls = `company-link company-link--${size}${className ? ` ${className}` : ""}`;
  if (!href) return <span className={cls}>{company}</span>;
  return (
    <a className={cls} href={href} target="_blank" rel="noopener noreferrer" data-apply-link=""
      title={`Apply at ${company} — opens the posting`}
      onClick={(e) => {
        e.stopPropagation();
        if (onOpen) onOpen();
        else if (jobId) api("/api/applications/pending", { method: "POST", body: JSON.stringify({ jobId, origin: "opened_posting" }) }).catch(() => {});
      }}>
      {company}
    </a>
  );
}
