// client/src/lib/monetisation.jsx
//
// The client's ONE reader of the monetisation lever. Every commercial surface asks this hook;
// none of them decides for itself, and none of them reads an env var of its own. The value comes
// from the server (GET /api/config), never from the build — see shared/monetisation.js for why a
// build-time client flag would be the second source of truth that whole file exists to forbid.
//
// ⛔ UNKNOWN IS TREATED AS OFF, AND THAT DIRECTION IS DELIBERATE.
// The fetch is asynchronous, so there is a window on first paint where the client does not yet
// know. Defaulting to ON during that window would flash pricing copy, tier badges and an upgrade
// button onto the screen of a product that presents as free — briefly making the commercial claim
// the lever exists to remove, on exactly the marketing pages a Web Store reviewer would open.
// Defaulting to OFF costs a hidden pricing page for a few hundred milliseconds when monetisation
// is genuinely on, which is the harmless direction of the same mistake.

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const PHASE1_OFF = Object.freeze({ billingEnabled: false, signupVerification: false, extension: { storeUrl: null, downloadUrl: null } });
const MonetisationContext = createContext({ enabled: false, known: false, studioForUsers: false, duskForUsers: false, phase1: PHASE1_OFF });

export function MonetisationProvider({ children }) {
  // null = not yet known. Kept distinct from `false` so a surface that genuinely needs to wait
  // (rather than hide) can tell the two apart; most surfaces simply hide, via `enabled`.
  const [enabled, setEnabled] = useState(null);
  // ⭐ D133: the same one /api/config read also says whether users are offered the Studio theme (off until the owner
  // turns it on) — Settings → Appearance reads it here instead of calling a route of its own.
  const [studioForUsers, setStudioForUsers] = useState(false);
  // ⭐ D144: and Dusk, behind its own switch.
  const [duskForUsers, setDuskForUsers] = useState(false);
  // ⭐ A167: phase 1's switches — billing (only Apply through draft is gated), sign-up verification, the extension's links.
  const [phase1, setPhase1] = useState(PHASE1_OFF);

  useEffect(() => {
    let cancelled = false;
    // Through api(), not a bare fetch. /api/config is public and could not leak anything to the
    // wrong account, but "this one is harmless" is how the cookie-only call sites got there in the
    // first place — the rule is every /api call site, so that the rule stays checkable.
    api("/api/config")
      .then(d => { if (!cancelled) { setEnabled(d?.monetisationEnabled === true); setStudioForUsers(d?.studioForUsers === true); setDuskForUsers(d?.duskForUsers === true);
        setPhase1({ billingEnabled: d?.billingEnabled === true, signupVerification: d?.signupVerification === true,
          extension: { storeUrl: d?.extension?.storeUrl || null, downloadUrl: d?.extension?.downloadUrl || null } }); } })
      // A failed or blocked config fetch lands on OFF for the same reason the initial state does:
      // the product presenting as free when it is actually paid is recoverable, the reverse makes
      // a commercial claim the trader declaration says is not being made.
      .catch(() => { if (!cancelled) setEnabled(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <MonetisationContext.Provider value={{ enabled: enabled === true, known: enabled !== null, studioForUsers, duskForUsers, phase1 }}>
      {children}
    </MonetisationContext.Provider>
  );
}

/** `{ enabled, known }`. Hide any commercial surface when `enabled` is false. */
export function useMonetisation() {
  return useContext(MonetisationContext);
}

/** D133: whether Settings → Appearance offers the Studio theme to users (GET /api/config studioForUsers). */
export function useStudioForUsers() {
  return useContext(MonetisationContext).studioForUsers === true;
}

/** D144: whether Settings → Appearance offers the Dusk theme to users (GET /api/config duskForUsers). */
export function useDuskForUsers() {
  return useContext(MonetisationContext).duskForUsers === true;
}

/** Convenience for the common case: "is this commercial surface allowed to render at all?" */
export function useMonetisationEnabled() {
  return useContext(MonetisationContext).enabled;
}

/** ⭐ A167: phase 1's switches, from GET /api/config — { billingEnabled, signupVerification, extension: { storeUrl, downloadUrl } }. */
export function usePhase1() {
  return useContext(MonetisationContext).phase1 || PHASE1_OFF;
}
