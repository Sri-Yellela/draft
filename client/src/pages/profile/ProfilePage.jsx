// ⭐ D167 (owner 11-06: PROFILE APPROVED — docs/sketches/Profile.html) · PROFILE, WITH ITS OWN NAVIGATION.
//
// The same pattern as Atlas (components/PlaceNav.jsx): a nav card beside the dock, three groups, nine panels, each at
// /app/profile/<id> (pages/profile/profilePanels.js). Every panel is the EXISTING page or card that held it before D167,
// mounted whole or by its own part — nothing re-implemented, nothing dropped:
//   About you      ProfilePanel "about" (contact, address, visa, the D101 sections — ⛔ "Your experience", the work history
//                  with company logos filled from the résumé, RETAINED as it is — Application defaults incl. work
//                  authorisation, the extras) + the line "Your skills now live in Atlas" → /app/atlas/your-skills (D169)
//   Your résumés   ProfilePanel "resumes" (job profiles → the full manager at /app/job-profiles; the active profile's base
//                  résumé, upload, enhance, signals) + Account's "How your résumés are tailored"
//   Saved answers  ProfilePanel "answers" (custom answers) + SavedAnswersPanel (the bank, D55 f / D165 R2 — its own API)
//   Auto-apply     Draft House's settings drawer drawn in the page (Ask me first / Apply for me + D148's folds)
//   Connections    the extension, the Android app, Gmail (D112), Managed portals (D100 / D158), then Integrations whole
//                  (connected apps, LinkedIn import, job feed, form learning) and Account's warm-paths contacts (D138)
//   Appearance     ⛔ the Customise screen (D93), RETAINED exactly as it is — mounted alone, no head, no wrapper style
//   Notifications  Account's Product news + Notifications cards
//   Privacy        Account's Your data (download, base-résumé-only, generated résumés) + Delete account
//   Account        Account's profile photo and name, email, sign-in and security, sessions, merge, plan, help, Sign out
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PlaceNav, { PlaceHead } from "../../components/PlaceNav.jsx";
import { useAutoApply } from "../../contexts/AutoApplyContext.jsx";
import { useTheme } from "../../styles/theme.jsx";
import { autoToggle } from "../../lib/draftHouseExceptions.js";
import { setPicksSwitch } from "../../lib/draftHouseRuns.js";
import { ACTIVE_THEME } from "../../themes/index.js";
import { useExtensionStatus } from "../../components/ExtensionPrompt.jsx";
import AutoSettingsDrawer, { PortalAccounts } from "../../components/AutoSettingsDrawer.jsx";
import { GmailConnection } from "../../components/ApplicationInbox.jsx";
import { ProfilePanel } from "../../panels/ProfilePanel.jsx";
import { SavedAnswersPanel } from "../../panels/SavedAnswersPanel.jsx";
import { IntegrationsPanel } from "../../panels/IntegrationsPanel.jsx";
import { AccountPanel } from "../../panels/AccountPanel.jsx";
import CustomisePanel from "../../panels/CustomisePanel.jsx";
import YourProfile from "./YourProfile.jsx";
import { EXTENSION_PAGE } from "../../../../shared/extension.js";
import { PROFILE_GROUPS, profilePath } from "./profilePanels.js";
import "./ProfilePage.css";

/** The cards of Account each panel draws (AccountPanel `only`). */
export const ACCOUNT_CARDS = Object.freeze({
  about: ["tailoring"],   // A140: "How your résumés are tailored" — in the merged About you
  connections: ["warmpaths"],
  notifications: ["news", "notifications"],
  privacy: ["data", "delete"],
  account: ["profile", "email", "security", "sessions", "merge", "allowance", "help", "signout"],
});

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
    setRound(r => r + 1);
  };
  return (
    <>
      <PlaceHead eyebrow="Auto-apply" title="How draft applies for you"
        lead="The same settings as the tracker's Settings — every change is saved as you make it." />
      <div ref={setHost} data-profile-autoapply="" />
      {host && (
        <AutoSettingsDrawer key={round} open inline={host} onClose={() => {}} runBar={runBar}
          mode={{ fullAuto, selectable: mode.selectable, reason: mode.reason }} onAsk={runBar ? chooseAsk : null}
          onAuto={mode.selectable ? () => setApplyMode?.("auto") : null} modeBusy={holdBusy} held={held} onPauseNow={setStopEverything} />
      )}
    </>
  );
}

const EXTENSION_WORDS = { connected: "Connected on this computer", not_connected: "Installed, not signed in", not_installed: "Not installed" };

function ProfileConnections() {
  const { theme } = useTheme();
  const ext = useExtensionStatus();
  return (
    <>
      <PlaceHead eyebrow="Connections" title="What draft is connected to"
        lead="Each one says what draft does with it, and you can remove it any time." />
      <div className="pf__card" data-profile-connections="">
        <div className="pf__kv" data-connection="extension">
          <span>Browser extension</span>
          <b>{ext ? (EXTENSION_WORDS[ext.state] || EXTENSION_WORDS.not_installed) : "Checking…"}</b>
          <Link className="pf__quiet" to={EXTENSION_PAGE}>{ext?.connected ? "About it" : "Get it"}</Link>
        </div>
        <div className="pf__kv" data-connection="android">
          <span>Android app</span>
          <b>Sites you connect from the draft app show under Managed portals below.</b>
          <span />
        </div>
        <div className="pf__kv pf__kv--wide" data-connection="gmail">
          <span>Gmail</span>
          <div><GmailConnection theme={theme} /></div>
        </div>
      </div>
      <div className="pf__card">
        <h3 className="pf__h4">Managed portals</h3>
        <p className="pf__p">Job sites draft applies on for you: the sessions you connected (sealed — draft cannot read them) and the accounts draft made.</p>
        <PortalAccounts />
      </div>
      <IntegrationsPanel embedded />
      <AccountPanel only={ACCOUNT_CARDS.connections} />
    </>
  );
}

export default function ProfilePage({ panel = "about", onSignedOut }) {
  const navigate = useNavigate();
  const { runBar = null } = useAutoApply() || {};
  const metas = {
    autoapply: runBar ? (runBar?.mode?.current === "auto" ? "Apply for me" : "Ask me first") : null,
    appearance: ACTIVE_THEME?.label || null,
  };
  const groups = PROFILE_GROUPS.map(g => ({ ...g, items: g.items.map(i => ({ ...i, meta: metas[i.id] ?? null })) }));
  useEffect(() => { window.scrollTo?.({ top: 0 }); }, [panel]);

  let body = null;
  // ⭐ A140 (owner 11-08: "merge about you and your resume section … make sure all fields are accounted for"): ONE panel.
  // Everything the two drew is here: About you's résumé view (summary, experience with logos and the skills / keywords
  // bold in it, projects, proof page, education, skills, links, application defaults), its contact / address / visa
  // fields and extras; Your résumés' job profiles, the base résumé (upload, text, enhance), its extracted titles / years /
  // search terms / structured facts / ATS suggestions (the skills and keywords editors folded), and Account's "How your
  // résumés are tailored". /app/profile/resumes lands here (profilePanels.profilePanelFor).
  // ⭐ D183 P1 (owner 11-08, TOP PRIORITY): About you becomes YOUR PROFILE — one page from the résumé, private by default
  // (pages/profile/YourProfile.jsx). Everything A140's panel held is still here: the résumé view's sections are the page's
  // sections (the same editors), and the private machinery — contact fields, the job profiles, the base résumé and its
  // signals, How your résumés are tailored — sits folded under "Behind your profile" (ProfilePanel without its résumé view).
  // The old "Your skills now live in Atlas" line is the Skills section's own link now.
  if (panel === "about") body = (
    <>
      <PlaceHead eyebrow="Your profile" title="Your page, from your résumé"
        lead="Only you can see it until you choose otherwise. Each section has its own eye." />
      {/* ⭐ A153 (45o): Behind your profile is folded rows (YourProfile's BehindRow) — the private parts by key. */}
      <YourProfile behind={{
        contact: <ProfilePanel section="about" resumeView={false} onOpenJobProfiles={() => navigate("/app/job-profiles")} />,
        resumes: <ProfilePanel section="resumes" resumeView={false} onOpenJobProfiles={() => navigate("/app/job-profiles")} />,
        tailoring: <AccountPanel only={ACCOUNT_CARDS.about} />,
      }} />
    </>
  );
  else if (panel === "answers") body = (
    <>
      <PlaceHead eyebrow="Saved answers" title="Answered once, used every time"
        lead="The answers you gave during applications. draft reuses them; it never makes up salary, eligibility or legal answers." />
      <ProfilePanel section="answers" onOpenJobProfiles={() => navigate("/app/job-profiles")} />
      <SavedAnswersPanel />
    </>
  );
  else if (panel === "autoapply") body = <ProfileAutoApply />;
  else if (panel === "connections") body = <ProfileConnections />;
  // ⛔ RETAINED EXACTLY (owner 11-06: "customise screen design is very good right now"): the Customise screen, alone.
  else if (panel === "appearance") body = <CustomisePanel />;
  else if (panel === "notifications") body = (
    <>
      <PlaceHead eyebrow="Notifications" title="When we tell you things" />
      <AccountPanel only={ACCOUNT_CARDS.notifications} />
    </>
  );
  else if (panel === "privacy") body = (
    <>
      <PlaceHead eyebrow="Privacy and your data" title="What we keep, and for how long"
        lead="Application emails in your Inbox are deleted after 6 months. Download everything draft keeps for you, or delete it all." />
      <AccountPanel only={ACCOUNT_CARDS.privacy} onSignedOut={onSignedOut} />
    </>
  );
  else if (panel === "account") body = (
    <>
      <PlaceHead eyebrow="Account" title="Signing in and your plan" />
      <AccountPanel only={ACCOUNT_CARDS.account} onSignedOut={onSignedOut} />
    </>
  );

  return (
    <PlaceNav place="profile" name="Profile" eyebrow="You and your résumé" title="Profile" groups={groups} current={panel}
      hrefFor={profilePath}>
      <div className="pf" data-profile-page={panel}>{body}</div>
    </PlaceNav>
  );
}
