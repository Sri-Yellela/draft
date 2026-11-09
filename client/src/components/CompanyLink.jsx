import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { postingClick } from "../lib/openPosting.js";
import { companyPath } from "../lib/companySlug.js";
import "./CompanyLink.css";

// ── D38 (owner, 10-06) · ONE COMPANY LINK, ON EVERY SURFACE ─────────────────────────────────────
//
// ⭐ A157 (45q, owner 11-09): "companies should have their own page … currently not opening when clicked … move the direct
// apply link into the company page." THE NAME NOW OPENS THE COMPANY'S PAGE (inside the shell, /app/companies/<slug>; the
// public address is /<company>), carrying the posting the reader came from (?job=) — the page puts that job first with its
// Apply link. A63's "Apply is the company name" is retired: applying is ApplyLink below, on the company page (and on the
// Pending list, where re-opening the employer's form is the point).
//
// ⛔ THE HIT AREA IS THE TEXT (CompanyLink.css: inline-block, fit-content) — the card's own click works everywhere else.
// ⚠ A non-colour hover affordance (A78): the underline returns on hover and keyboard focus.
//
// Props: company, jobId (the posting the reader came from), size ("card" | "panel" | "row"), className, inApp (default true).
export default function CompanyLink({ company, jobId = null, size = "card", className = "", inApp = true }) {
  const cls = `company-link company-link--${size}${className ? ` ${className}` : ""}`;
  const to = companyPath(company, { inApp, job: jobId });
  if (!to) return <span className={cls}>{company}</span>;
  return (
    <Link className={cls} to={to} data-company-page-link="" title={`${company} — the company's page`}
      onClick={(e) => e.stopPropagation()}>
      {company}
    </Link>
  );
}

/**
 * The employer's own apply link — what the company name used to be (A63): it opens the posting at the employer, tags the
 * job Pending (it stays Pending until the submission is recorded and verified), and with the draft extension installed a
 * plain click hands the job to it (D99 J11, lib/openPosting.js). A modified click, or no extension, follows the link.
 */
export function ApplyLink({ href, jobId = null, company = "", className = "", onOpen = null, children = null, size = "row" }) {
  const cls = `company-link company-link--${size}${className ? ` ${className}` : ""}`;
  if (!href) return children ? <span className={cls}>{children}</span> : null;
  return (
    <a className={cls} href={href} target="_blank" rel="noopener noreferrer" data-apply-link=""
      title={`Apply at ${company || "the employer"} — opens the posting`}
      onClick={(e) => {
        e.stopPropagation();
        if (onOpen) onOpen();
        else if (jobId) api("/api/applications/pending", { method: "POST", body: JSON.stringify({ jobId, origin: "opened_posting" }) }).catch(() => {});
        postingClick({ jobId, url: href }, e, { url: href });
      }}>
      {children ?? company}
    </a>
  );
}
