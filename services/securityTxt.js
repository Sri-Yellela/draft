// services/securityTxt.js — ⭐ D86 §6 · /.well-known/security.txt (RFC 9116).
//
// The connector directory requires a security contact and a vulnerability-disclosure route. RFC 9116 requires
// Contact and Expires; Expires is computed per request as a rolling 180 days so the file never goes stale
// (the RFC advises less than a year). The contact is shared/brand.js's SECURITY_EMAIL — one source.
import { SECURITY_EMAIL, CANONICAL_ORIGIN } from "../shared/brand.js";

export const SECURITY_TXT_DAYS = 180;

export function securityTxt(now = new Date()) {
  const expires = new Date(now.getTime() + SECURITY_TXT_DAYS * 86400_000);
  expires.setUTCMilliseconds(0);
  return [
    `Contact: mailto:${SECURITY_EMAIL}`,
    `Expires: ${expires.toISOString().replace(".000Z", "Z")}`,
    "Preferred-Languages: en",
    `Policy: ${CANONICAL_ORIGIN}/docs/claude#security`,
    `Canonical: ${CANONICAL_ORIGIN}/.well-known/security.txt`,
    "",
  ].join("\n");
}
