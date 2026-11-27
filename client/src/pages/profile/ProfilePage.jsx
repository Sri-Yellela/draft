// ⭐ D197 Wave 2 #9 / #17 · M5 (47m, lane person) · PROFILE → YOUR PASSPORT, in the plate system (Region V).
//
// The classic place card (D167's PlaceNav) is retired: the passport's area nav runs across the shell's column (App's
// PassportAreaNav — Your passport · Saved answers · Auto-apply · Connections, More = Appearance · Notifications · Privacy and
// your data · Account · Your plan), and every panel is a plate page under one PlateRoot. The addresses are unchanged
// (pages/profile/profilePanels.js — /app/profile/<id>, the legacy forwards, the #hash). Every panel keeps every row it had
// (D200 Rule 1 — docs/revamp/profile.md §1–§6 and settings.md §2–§5 say where each row lives now):
//   about          Your passport (YourProfile.jsx) — the hero, 01 who can see it … 08 the sealed pages; the sealed pages
//                  hold ProfilePanel's contact fields and résumés part and Account's "How your résumés are tailored"
//   answers        Answers on file: ProfilePanel "answers" (custom answers, company overrides) + SavedAnswersPanel (the bank,
//                  Test a question, import / export) + Credit draft
//   autoapply      Standing orders: the tracker's ONE settings drawer drawn in the page (AutoSettingsDrawer `inline`)
//   connections    the extension · the Android app · Gmail as plate rows; Managed portals; Integrations whole; warm paths
//   appearance     ⛔ the Customise screen, RETAINED exactly (owner 11-06) — it now also offers Plate pages: Paper · Night
//   notifications  the plate table (PassportSettings.jsx) + Account's Product news
//   privacy        Account's Your data + Delete account, Ask draft's log (plate)
//   account        the plan line + View plans (lever on), Account's profile / email / plan / security / sessions / merge /
//                  allowance / help / sign out
//   plans          Your plan (D197 #17′: /app/plans folded into Settings) — App renders this panel at /app/plans
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAutoApply } from "../../contexts/AutoApplyContext.jsx";
import { autoToggle } from "../../lib/draftHouseExceptions.js";
import { setPicksSwitch } from "../../lib/draftHouseRuns.js";
import { useExtensionStatus } from "../../components/ExtensionPrompt.jsx";
import AutoSettingsDrawer, { PortalAccounts } from "../../components/AutoSettingsDrawer.jsx";
import { GmailConnection } from "../../components/ApplicationInbox.jsx";
import { useTheme } from "../../styles/theme.jsx";
import { ProfilePanel } from "../../panels/ProfilePanel.jsx";
import { SavedAnswersPanel } from "../../panels/SavedAnswersPanel.jsx";
import { IntegrationsPanel } from "../../panels/IntegrationsPanel.jsx";
import { AccountPanel } from "../../panels/AccountPanel.jsx";
import CustomisePanel from "../../panels/CustomisePanel.jsx";
import YourProfile from "./YourProfile.jsx";
import { PassportNotifications, PassportPlan, AssistantPrivacy, CreditDraftChoice } from "./PassportSettings.jsx";
import { EXTENSION_PAGE } from "../../../../shared/extension.js";
import { useMonetisationEnabled } from "../../lib/monetisation.jsx";
import PlateRoot from "../../plate/PlateRoot.jsx";
import { Kickers } from "../../plate/Marks.jsx";
import { RegionEmblem } from "../../plate/Drawings.jsx";
import { SettingsSheet } from "../../plate/Person.jsx";
import "../../plate/personPages.css";

/** The cards of Account each panel draws (AccountPanel `only`). */
export const ACCOUNT_CARDS = Object.freeze({
  about: ["tailoring"],   // A140: "How your résumés are tailored" — in the passport's sealed pages
  connections: ["warmpaths"],
  notifications: ["news"],   // 47m: the per-event table is the plate's own (PassportSettings.jsx), Product news stays Account's
  privacy: ["data", "delete"],
  account: ["profile", "email", "plan", "security", "sessions", "merge", "allowance", "help", "signout"],   // A167: "plan" — the plan, phone, lead sharing, extension
});

/** A working page's head (D200 Rule 3): the mono kicker and one plain serif line, a lead under it. */
function WorkingHead({ kicker, title, lead = null }) {
  return (
    <header className="pl-page pl-pp-head">
      <Kickers parts={["YOUR PASSPORT", kicker]} />
      <h1 className="pl-pp-working">{title}</h1>
      {lead ? <p className="pl-lead pl-lead--body">{lead}</p> : null}
    </header>
  );
}

function ProfileAutoApply() {
  const { runBar = null, setApplyMode, holdBusy = false, setStopEverything } = useAutoApply() || {};
  const [host, setHost] = useState(null);
  const [round, setRound] = useState(0);   // the drawer re-reads its settings after the mode changes them
  const fullAuto = runBar?.mode?.current === "auto";
  const mode = autoToggle(runBar);
  const held = !!runBar?.hold?.held;
  // The tracker header's own "Ask me first" (panels/AutoApplyPanel.jsx chooseAsk): leave FULL AUTO, turn the picks on.
  const chooseAsk = async () => {
    if (fullAuto) await setApplyMode?.("semi");
    await setPicksSwitch(true);
    setRound((r) => r + 1);
  };
  return (
    <>
      <WorkingHead kicker={`HOW DRAFT APPLIES · ${fullAuto ? "APPLY FOR ME" : "ASK ME FIRST"}`} title="How draft applies for you"
        lead="The same settings as the ledger's Settings — every change is saved as you make it." />
      <div className="pl-page pl-pp-body">
        <SettingsSheet kicker="STANDING ORDERS" title="Your standing orders" lead="When, how many, which jobs, before sending, salary, what you're told, pausing, accounts, the view.">
          <div ref={setHost} data-profile-autoapply="" />
        </SettingsSheet>
        {host && (
          <AutoSettingsDrawer key={round} open inline={host} onClose={() => {}} runBar={runBar}
            mode={{ fullAuto, selectable: mode.selectable, reason: mode.reason }} onAsk={runBar ? chooseAsk : null}
            onAuto={mode.selectable ? () => setApplyMode?.("auto") : null} modeBusy={holdBusy} held={held} onPauseNow={setStopEverything} />
        )}
      </div>
    </>
  );
}

const EXTENSION_WORDS = { connected: "Connected on this computer", not_connected: "Installed, not signed in", not_installed: "Not installed" };

function ProfileConnections({ go }) {
  const { theme } = useTheme();
  const ext = useExtensionStatus();
  return (
    <>
      <WorkingHead kicker="CONNECTIONS" title="What draft is connected to" lead="Each one says what draft does with it, and you can remove it any time." />
      <div className="pl-page pl-pp-body" data-profile-connections="">
        <SettingsSheet kicker="CONNECTIONS · WHAT EACH ONE DOES" title="Connected" drawing={<RegionEmblem kind="net" region="V" size={72} label="Network emblem: what your passport is linked to" />}
          rows={[
            { label: "Browser extension", note: "Reads and fills application forms on this computer.",
              control: <span data-connection="extension"><b>{ext ? (EXTENSION_WORDS[ext.state] || EXTENSION_WORDS.not_installed) : "Checking…"}</b>{" "}
                <a className="pl-btn" href={EXTENSION_PAGE} onClick={(e) => go(e, EXTENSION_PAGE)}>{ext?.connected ? "About it" : "Get it"}</a></span> },
            { label: "Android app", note: "Sites you connect from the draft app show under Managed portals below.", control: <span data-connection="android" className="pl-pp-note">See Managed portals</span> },
          ]}>
          <div className="pl-pp-classic" data-connection="gmail">
            <b>Gmail</b>
            <GmailConnection theme={theme} />
          </div>
        </SettingsSheet>
        <SettingsSheet kicker="MANAGED PORTALS" title="Job sites draft applies on for you"
          lead="The sessions you connected (sealed — draft cannot read them) and the accounts draft made.">
          <div className="pl-pp-classic"><PortalAccounts /></div>
        </SettingsSheet>
        <div className="pl-pp-classic"><IntegrationsPanel embedded /></div>
        <div className="pl-pp-classic"><AccountPanel only={ACCOUNT_CARDS.connections} /></div>
      </div>
    </>
  );
}

// ⭐ 47j w1-shell (D200 Rule 1): the plan line and "View plans" — only while the monetisation lever is on.
const PLAN_LABELS = Object.freeze({ PRO: ["Pro", "Generate + A+ Resume"], PLUS: ["Plus", "Generate"], BASIC: ["Basic", "Your jobs and today's picks"] });
function ProfilePlanLine({ planTier, go }) {
  const [label, tool] = PLAN_LABELS[planTier] || PLAN_LABELS.BASIC;
  return (
    <div data-profile-plan="">
      <SettingsSheet kicker="YOUR PLAN" title={label} lead={tool}
        actions={<a className="pl-btn" href="/app/plans" data-view-plans="" onClick={(e) => go(e, "/app/plans")}>View plans</a>} />
    </div>
  );
}

const plain = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

export default function ProfilePage({ panel = "about", onSignedOut, user = null, onUserChange = null }) {
  const navigate = useNavigate();
  const monetisationEnabled = useMonetisationEnabled();
  useEffect(() => { window.scrollTo?.({ top: 0 }); }, [panel]);
  // a plain press on an in-app link inside a plate piece (they draw plain <a href>) goes through the router
  const go = (e, href) => { if (plain(e)) { e.preventDefault(); navigate(href); } };
  const onClick = (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a || e.defaultPrevented || !plain(e) || a.target || a.hasAttribute("download")) return;
    const href = a.getAttribute("href");
    if (!/^\/(app|atlas|companies)\b/.test(href || "")) return;
    e.preventDefault(); navigate(href);
  };

  let body = null;
  // ⭐ D183 P1 → D197 #9 M5: Your passport — the page from the résumé, private by default; the private machinery sits in the
  // sealed pages (ProfilePanel without its résumé view, Account's tailoring card).
  if (panel === "about") body = (
    <YourProfile behind={{
      contact: <div className="pl-pp-classic"><ProfilePanel section="about" resumeView={false} onOpenJobProfiles={() => navigate("/app/job-profiles")} /></div>,
      resumes: <div className="pl-pp-classic"><ProfilePanel section="resumes" resumeView={false} onOpenJobProfiles={() => navigate("/app/job-profiles")} /></div>,
      tailoring: <div className="pl-pp-classic"><AccountPanel only={ACCOUNT_CARDS.about} /></div>,
    }} />
  );
  else if (panel === "answers") body = (
    <>
      <WorkingHead kicker="SAVED ANSWERS" title="Answers on file"
        lead="Answered once, used every time. draft reuses them; it never makes up salary, eligibility or legal answers." />
      <div className="pl-page pl-pp-body">
        <SettingsSheet kicker="YOUR ANSWERS · COMPANY OVERRIDES" title="Custom answers">
          <div className="pl-pp-classic"><ProfilePanel section="answers" onOpenJobProfiles={() => navigate("/app/job-profiles")} /></div>
        </SettingsSheet>
        <SettingsSheet kicker="REMEMBERED ON PAGES · TEST A QUESTION · IMPORT · EXPORT" title="The bank">
          <div className="pl-pp-classic"><SavedAnswersPanel /></div>
        </SettingsSheet>
        <SettingsSheet kicker="CREDIT DRAFT" title="How did you hear about us?"><div className="pl-settings__rows"><CreditDraftChoice /></div></SettingsSheet>
      </div>
    </>
  );
  else if (panel === "autoapply") body = <ProfileAutoApply />;
  else if (panel === "connections") body = <ProfileConnections go={go} />;
  // ⛔ RETAINED EXACTLY (owner 11-06: "customise screen design is very good right now"): the Customise screen, alone.
  else if (panel === "appearance") body = <CustomisePanel />;
  else if (panel === "notifications") body = (
    <>
      <WorkingHead kicker="NOTIFICATIONS" title="When we tell you things" />
      <div className="pl-page pl-pp-body">
        <PassportNotifications />
        <div className="pl-pp-classic"><AccountPanel only={ACCOUNT_CARDS.notifications} /></div>
      </div>
    </>
  );
  else if (panel === "privacy") body = (
    <>
      <WorkingHead kicker="PRIVACY AND YOUR DATA" title="What we keep, and for how long"
        lead="Application emails in your Inbox are deleted after 6 months. Download everything draft keeps for you, or delete it all." />
      <div className="pl-page pl-pp-body">
        <SettingsSheet kicker="YOUR DATA · DELETE ACCOUNT" title="Your data" drawing={<RegionEmblem kind="lock" region="V" size={72} label="Security emblem: a lock — your data" />}>
          <div className="pl-pp-classic"><AccountPanel only={ACCOUNT_CARDS.privacy} onSignedOut={onSignedOut} /></div>
        </SettingsSheet>
        <AssistantPrivacy />
      </div>
    </>
  );
  else if (panel === "account") body = (
    <>
      <WorkingHead kicker="ACCOUNT" title="Signing in and your plan" />
      <div className="pl-page pl-pp-body">
        {monetisationEnabled ? <ProfilePlanLine planTier={user?.planTier} go={go} /> : null}
        <SettingsSheet kicker="ACCOUNT · SIGN-IN · SESSIONS · HELP" title="Your account" drawing={<RegionEmblem kind="lock" region="V" size={72} label="Security emblem: a lock — signing in" />}>
          <div className="pl-pp-classic"><AccountPanel only={ACCOUNT_CARDS.account} onSignedOut={onSignedOut} /></div>
        </SettingsSheet>
      </div>
    </>
  );
  else if (panel === "plans") body = (
    <>
      <WorkingHead kicker="YOUR PLAN" title="Plans" />
      <div className="pl-page pl-pp-body"><PassportPlan user={user} onUserChange={onUserChange} /></div>
    </>
  );

  return (
    <PlateRoot region="V" className="pl-pp-page" data-profile-page={panel} onClick={onClick}>
      {body}
    </PlateRoot>
  );
}
