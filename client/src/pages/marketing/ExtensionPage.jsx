// client/src/pages/marketing/ExtensionPage.jsx — D12: the extension's page on the site.
//
// Since D11 there is no IMPORT button on Full House: the extension is how a job from anywhere gets
// onto your board. So this page has to do two jobs — explain what the extension does, honestly, and
// install it. ⭐ 46v 0d (owner 11-18: "yes do the other pages too"): the landing's treatment — the frame
// (components/MarketingFrame.jsx), the setup as numbered note cards, the three facts as a ✓ list (A233).
// Every claim below is one extension/submission/STORE_LISTING.md makes and cites code
// for (single purpose, activeTab, no job-site content script — only D99's bridge on our own site — the one host). If the extension changes, this
// page and that listing change together.
//
// ⛔ The install control reads shared/extension.js. While EXTENSION_STORE_URL is null (the owner has
// not supplied the store item — WORKLOG O55) the page says so and offers nothing to click.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MarketingFrame, MkSection, MkSteps, MkNote, MkPromises } from "../../components/MarketingFrame.jsx";   // 47m: the notes and promises on the plate
import { ts } from "../../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size
import { DraftMark } from "../../components/DraftMark.jsx";
import { EXTENSION_STORE_URL } from "../../../../shared/extension.js";
import { CANONICAL_HOST, PRIVACY_POLICY_PATH } from "../../../../shared/brand.js";
import { api } from "../../lib/api.js";
import { useExtensionStatus } from "../../components/ExtensionPrompt.jsx";

const STEPS = [
  { title: "Add it to Chrome",
    body: "It's free, from the Chrome Web Store." },
  { title: "Sign it in once",
    body: "Open it while you're signed in to draft. It gets a key of its own — not your password, not your browser session — and you can disconnect it at any time." },
  { title: "Capture a job",
    body: "On any job posting — LinkedIn, Indeed, an employer's own careers page — click the extension, or press Ctrl+Shift+K. The job lands on your jobs board — under +, the jobs you imported." },
  { title: "Fill an application, then check it",
    body: "On an application form you've opened and signed in to, press Ctrl+Shift+Y. It fills in answers you've already given us and shows you every one. You submit it yourself." },
];

const FACTS = [
  ["You choose what it reads", "Every read starts with your click or a shortcut — unless you agree once to let it read and prepare application forms on the job sites it knows. Saving and filling on their own stay off until you switch them on, site by site, and never run on LinkedIn, Indeed or Glassdoor."],
  ["Talks to draft only", `What it reads goes to your draft account at ${CANONICAL_HOST} and nowhere else. It asks Chrome before it reads a new site.`],
  ["You press submit", "It fills and shows you every answer. It submits only when you press Submit application in its panel — never on its own."],
];

export function ExtensionInstallButton({ compact = false }) {
  if (!EXTENSION_STORE_URL) {
    return (
      <p data-extension-unavailable="" className="mk-quiet">
        The Chrome Web Store link isn't published yet. It will be here.
      </p>
    );
  }
  return (
    <a href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer" data-extension-install=""
       className="mk-btn mk-btn--primary" style={{ gap: 8, ...(compact ? { minHeight: 38, fontSize: ts(13) } : null) }}>
      <DraftMark style={{ fontSize: ts(compact ? 14 : 17) }}/> Add to Chrome
    </a>
  );
}

// ── D33 · THE PAGE KNOWS WHICH OF THREE PEOPLE IS READING IT ─────────────────────────────────────
// Signed out, or no sign of the extension on this account -> install (as before). Used on this
// account but not connected now -> connect it, and the install control steps back. Connected -> what
// to do with it, and what happened to your last captures, in the server's own words
// (services/jobs/captureOutcome.js) — the site half of "the gateway says why".
//
// /api/auth/me first: it answers 200 signed in or out, where a signed-out call to the status route
// would be a 401, and lib/api.js treats every 401 as an expired session.
function useSignedIn() {
  const [signedIn, setSignedIn] = useState(null);
  useEffect(() => {
    let live = true;
    api("/api/auth/me").then(d => { if (live) setSignedIn(!!d?.authenticated); }).catch(() => { if (live) setSignedIn(false); });
    return () => { live = false; };
  }, []);
  return signedIn;
}

function agoWords(ms) {
  if (!ms) return null;
  const mins = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (mins < 60) return mins <= 1 ? "just now" : `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}


export function ExtensionStateCard({ status }) {
  if (status.state === "connected") {
    const seen = agoWords(status.lastSeenAt ? status.lastSeenAt * 1000 : null);
    return (
      <MkNote id="ext-connected" title="Your extension is connected" data-extension-state="connected">
        <p style={{ margin: "0 0 8px" }}>
          {seen ? `Last used ${seen}. ` : ""}Here's what to do with it:
        </p>
        <ul style={{ lineHeight: 1.7, margin: 0, paddingLeft: 20 }}>
          <li><strong>On a job posting</strong> — click the draft icon, or press Ctrl+Shift+K. It says exactly where the job went.</li>
          <li><strong>On an application you drafted</strong> — press Ctrl+Shift+Y to fill it, check every answer, and submit it yourself.</li>
          <li><strong>Not sure which?</strong> — open it and press <em>Read this page</em>; it picks the action that fits.</li>
        </ul>
      </MkNote>
    );
  }
  if (status.state === "not_connected") {
    return (
      <MkNote id="ext-not-connected" title="Your extension isn't connected" data-extension-state="not_connected">
        <p style={{ margin: 0 }}>
          It has been used on this account, but it holds no live key right now. Click the draft icon in your
          browser's toolbar while you're signed in here and it connects by itself — or press <em>Sign in</em> inside it.
        </p>
        <p style={{ margin: "12px 0 0" }}>
          Setting it up on a different browser? <ExtensionInstallButton compact/>
        </p>
      </MkNote>
    );
  }
  return null;
}

// ⛔ D40 (owner, 10-06): this page STOPS LISTING CAPTURES at a random spot. It explains the extension
// and carries the Web Store link; the user's imports live in Full House's `+` view, on the board's
// own card. One line points there.
export function ImportsPointer() {
  return (
    <p data-imports-pointer="" className="mk-quiet">
      Jobs you capture are on your board — open the <Link to="/app/jobs?view=imported">Imported view on /draft</Link> to see them.
    </p>
  );
}

export function ExtensionPage() {
  const signedIn = useSignedIn();
  const status = useExtensionStatus({ enabled: signedIn === true });
  // Install is the page's control only when there is no sign of the extension on this account (or
  // nobody is signed in). For someone who has it, offering a download is the D33 defect.
  const known = signedIn === false || !!status;
  const offerInstall = signedIn === false || status?.state === "not_installed";
  return (
    <MarketingFrame eyebrow="The extension" title="Add any job to your board"
      lede="The draft browser extension is how a job you find anywhere gets onto your jobs board. Capture the posting you're viewing, and later fill the application — you review every answer and submit it yourself."
>
      {known && offerInstall && (
        <div className="mk-ctas" data-extension-offer="">
          <ExtensionInstallButton/>
          {signedIn && <p className="mk-quiet" style={{ alignSelf: "center" }}>Already installed it? Click it once while you're signed in here and it connects.</p>}
        </div>
      )}
      {status && <div className="mk-measure"><ExtensionStateCard status={status}/></div>}
      {status?.state === "connected" && <ImportsPointer/>}
      {/* D33: the install-and-set-up steps are for someone setting it up — not for a connected user. */}
      {status?.state !== "connected" && (
      <MkSteps data-extension-setup="" items={STEPS.map((s, i) => ({ key: s.title, body: <MkNote id={`ext-step-${i + 1}`} title={s.title}>{s.body}</MkNote> }))} />
      )}
      <MkSection id="ext-facts" title="What it does, and never does" className="mk-sec--rule">
        <MkPromises className="mk-measure" items={FACTS.map(([h, b]) => ({ ok: true, text: <><strong>{h}.</strong> {b}</> }))} />
        <p className="mk-quiet">What it stores and sends is set out in the <Link to={PRIVACY_POLICY_PATH}>privacy policy</Link>.</p>
      </MkSection>
    </MarketingFrame>
  );
}
