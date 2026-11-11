// ⭐ A167 (owner 11-10) · PHASE 1 IN SETTINGS — four cards, each shown only while its switch is on (GET /api/config):
//   Your plan            the trial (10 drafts) and the tiers at their prices (TEST prices until the owner sets real ones),
//                        Choose → Stripe Checkout, Manage billing → the Stripe customer portal. Only Apply through draft
//                        needs a plan; the card says so.
//   Your phone           proven by a one-time code (one account per phone)
//   Sharing your details with employers   the explicit, OFF-by-default consent to share leads (f)
//   The draft extension  where to get it and how it helps (h)
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { usePhase1 } from "../lib/monetisation.jsx";
import { planWords } from "../lib/planWords.js";
import SettingsSection from "./SettingsSection.jsx";
import { ExtensionPanelBody, extensionLinksOf } from "./ExtensionPanel.jsx";
import OtpVerify from "./OtpVerify.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const muted = { color: "var(--color-text-muted)", fontSize: ts(13), lineHeight: 1.5 };
const money = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

function PlanCard({ say }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState("");
  useEffect(() => { api("/api/billing/status").then(setStatus).catch(() => setStatus(null)); }, []);
  const w = planWords(status);
  if (!w) return null;
  const go = async (path, body) => {
    setBusy(path);
    try { const r = await api(path, { method: "POST", body: JSON.stringify(body || {}) }); if (r?.url) window.location.assign(r.url); }
    catch (e) { say?.("error", e.message || "That didn't work — try again."); }
    finally { setBusy(""); }
  };
  return (
    <SettingsSection title="Your plan" subtitle={w.line}>
      <p style={{ margin: 0, fontWeight: 600 }} data-plan-headline="">{w.headline}</p>
      {!status.subscription && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }} data-plan-tiers="">
          {status.tiers.map(t => (
            <div key={t.id} data-plan-tier={t.id} style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 12, minWidth: 200, flex: "1 1 200px" }}>
              <b>{t.name}</b> <span>{money(t.priceCents)} / {t.interval}</span>
              {status.testPrices && <span style={muted} data-test-price=""> · test price</span>}
              <div style={muted}>{t.blurb}</div>
              <button type="button" className="rm-btn rm-btn-sm" style={{ marginTop: 8 }} disabled={!t.available || !status.stripeReady || !!busy}
                title={!t.available || !status.stripeReady ? "Not on sale yet" : undefined}
                onClick={() => go("/api/billing/checkout", { tier: t.id })}>{busy === "/api/billing/checkout" ? "Opening…" : `Choose ${t.name}`}</button>
            </div>
          ))}
        </div>
      )}
      {status.hasCustomer && (
        <button type="button" className="rm-btn rm-btn-ghost rm-btn-sm" disabled={!!busy} onClick={() => go("/api/billing/portal")}>
          {busy === "/api/billing/portal" ? "Opening…" : "Manage billing"}</button>
      )}
    </SettingsSection>
  );
}

function PhoneCard({ say }) {
  const [v, setV] = useState(null);
  const [phone, setPhone] = useState("");
  useEffect(() => { api("/api/verify/status").then(setV).catch(() => setV(null)); }, []);
  if (!v) return null;
  const onProof = async (proof) => {
    try { await api("/api/account/phone", { method: "POST", body: JSON.stringify({ proof }) }); setV({ ...v, phone: true }); say?.("ok", "Your phone is confirmed."); }
    catch (e) { say?.("error", e.message); }
  };
  return (
    <SettingsSection title="Your phone" subtitle="Confirmed by a one-time code. One draft account per phone number. Never used for marketing.">
      {v.phone ? <p style={{ margin: 0 }} data-phone-verified="">Confirmed.</p> : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }} data-phone-verify="">
          <input aria-label="Phone number" placeholder="(617) 555-0142" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          <OtpVerify channel="sms" target={phone} onProof={onProof} disabled={!v.smsReady} />
          {!v.smsReady && <span style={muted}>Phone codes aren't set up yet.</span>}
        </div>
      )}
    </SettingsSection>
  );
}

function LeadSharingCard({ say }) {
  const [c, setC] = useState(null);
  useEffect(() => { api("/api/account/lead-sharing").then(setC).catch(() => setC(null)); }, []);
  if (!c) return null;
  const set = async (consent) => {
    try { setC(await api("/api/account/lead-sharing", { method: "PUT", body: JSON.stringify({ consent }) })); }
    catch (e) { say?.("error", e.message); }
  };
  return (
    <SettingsSection title="Sharing your details with employers"
      // ⚠ Placeholder wording until counsel's (A167 — the owner's step).
      subtitle="Off unless you turn it on. When on, draft may pass your name, contact details and résumé to an employer hiring for roles you match. Turn it off any time. draft sends no marketing email either way — only the job suggestions you choose in Notifications.">
      <label style={{ display: "flex", gap: 8, alignItems: "center" }} data-lead-sharing="">
        <input type="checkbox" checked={c.consent} onChange={e => set(e.target.checked)} />
        Share my details with employers hiring for roles I match
      </label>
    </SettingsSection>
  );
}

export default function PlanSettings({ say }) {
  const phase1 = usePhase1();
  const links = extensionLinksOf(phase1);
  return (
    <>
      {phase1.billingEnabled && <PlanCard say={say} />}
      {(phase1.signupVerification || phase1.billingEnabled) && <PhoneCard say={say} />}
      {phase1.billingEnabled && <LeadSharingCard say={say} />}
      {links.any && (
        <SettingsSection title="The draft extension" subtitle="For applying on the company's own site, with draft beside you.">
          <ExtensionPanelBody links={links} />
        </SettingsSection>
      )}
    </>
  );
}
