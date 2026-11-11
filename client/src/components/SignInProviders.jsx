// ⭐ A138 (owner 11-07): ONE sign-in provider block, used by every sign-in surface — the header's
// sign-in panel (InlineLoginPopover) and the /login screen (AuthScreen, both tabs). "Continue with
// Google" first, then LinkedIn and GitHub, each shown only when the operator has configured it.
//
// The defect it replaces: the header panel read `/api/auth/oauth/status` as `{ google: … }`, but the
// endpoint answers `{ providers: { google: … } }`, so the panel never saw a configured provider and
// showed no Google button at all; and neither surface sent a return path, so every OAuth sign-in landed
// on /app instead of the page it was started from.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { providerStartHref, currentReturnPath } from "../lib/signInReturn.js";
import { C } from "../styles/colorTokens.js";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

export const SIGN_IN_PROVIDERS = Object.freeze(["google", "linkedin", "github"]);
const LABEL = { google: "Google", linkedin: "LinkedIn", github: "GitHub" };
const BRAND = { google: C.PROVIDER_GOOGLE, linkedin: C.PROVIDER_LINKEDIN, github: C.PROVIDER_GITHUB };

/** The configured providers: null while loading, then { google: {configured}, … }. */
export function useSignInProviders() {
  const [providers, setProviders] = useState(null);
  useEffect(() => {
    let live = true;
    api("/api/auth/oauth/status")
      .then(d => { if (live) setProviders(d?.providers || {}); })
      .catch(() => { if (live) setProviders({}); });
    return () => { live = false; };
  }, []);
  return providers;
}

/**
 * The provider buttons. `returnTo` defaults to the page the person is on. While the status is
 * loading, Google is shown (it is the one every deployment configures); an unconfigured provider is
 * hidden once the status says so. `divider` draws the "or" line above the buttons when any shows.
 */
export default function SignInProviders({ returnTo, divider = null, buttonStyle = {}, className = "dbx-depth" }) {
  const providers = useSignInProviders();
  const shown = SIGN_IN_PROVIDERS.filter(p =>
    providers === null ? p === "google" : !!providers[p]?.configured);
  if (!shown.length) return null;
  const back = returnTo || currentReturnPath();
  return (
    <>
      {divider}
      {shown.map(p => (
        <a key={p} className={className} href={providerStartHref(p, back)} data-sign-in-provider={p}
          title={`Continue with ${LABEL[p]}`}
          style={{ width: "100%", height: 40, display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, fontSize: ts(13), fontWeight: 700, cursor: "pointer", textDecoration: "none", border: "none",
            boxSizing: "border-box", background: BRAND[p], color: C.ON_PROVIDER, ...buttonStyle }}>
          Continue with {LABEL[p]}
        </a>
      ))}
    </>
  );
}
