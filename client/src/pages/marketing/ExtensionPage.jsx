// client/src/pages/marketing/ExtensionPage.jsx — D12: the extension's page on the site.
//
// Since D11 there is no IMPORT button on Full House: the extension is how a job from anywhere gets
// onto your board. So this page has to do two jobs — explain what the extension does, honestly, and
// install it. Every claim below is one extension/submission/STORE_LISTING.md makes and cites code
// for (single purpose, activeTab, no content script, the one host). If the extension changes, this
// page and that listing change together.
//
// ⛔ The install control reads shared/extension.js. While EXTENSION_STORE_URL is null (the owner has
// not supplied the store item — WORKLOG O55) the page says so and offers nothing to click.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ScrollDock from "../../components/ScrollDock.jsx";
import { Footer } from "../../components/Footer.jsx";
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
    body: "On any job posting — LinkedIn, Indeed, an employer's own careers page — click the extension, or press Ctrl+Shift+K. The job lands on your board on Full House — under +, the jobs you imported." },
  { title: "Fill an application, then check it",
    body: "On an application form you've opened and signed in to, press Ctrl+Shift+Y. It fills in answers you've already given us and shows you every one. You submit it yourself." },
];

const FACTS = [
  ["Only when you ask", "It reads a page only when you click it or press a shortcut, and only the tab you're on. Nothing runs in the background or when a page loads."],
  ["Talks to draft only", `The one site it holds a permission for is ${CANONICAL_HOST}. What it captures goes to your draft account and nowhere else.`],
  ["You submit", "It fills and shows you the answers. It never presses submit for you."],
];

export function ExtensionInstallButton({ compact = false }) {
  if (!EXTENSION_STORE_URL) {
    return (
      <p data-extension-unavailable="" style={{ fontSize: 14, color: "var(--color-text-muted)", margin: 0 }}>
        The Chrome Web Store link isn't published yet. It will be here.
      </p>
    );
  }
  return (
    <a href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer" data-extension-install=""
       className="rm-btn rm-btn-primary"
       style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
                padding: compact ? "8px 16px" : "12px 22px", fontSize: compact ? 13 : 15 }}>
      <DraftMark style={{ fontSize: compact ? 14 : 17 }}/> Add to Chrome
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

const card = { border: "1px solid var(--color-border)", borderRadius: 14, padding: 18, marginBottom: 32 };

export function ExtensionStateCard({ status }) {
  if (status.state === "connected") {
    const seen = agoWords(status.lastSeenAt ? status.lastSeenAt * 1000 : null);
    return (
      <div data-extension-state="connected" style={card}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Your extension is connected</div>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.6, margin: "0 0 12px" }}>
          {seen ? `Last used ${seen}. ` : ""}Here's what to do with it:
        </p>
        <ul style={{ fontSize: 14, lineHeight: 1.7, margin: 0, paddingLeft: 20 }}>
          <li><strong>On a job posting</strong> — click the draft icon, or press Ctrl+Shift+K. It says exactly where the job went.</li>
          <li><strong>On an application you drafted</strong> — press Ctrl+Shift+Y to fill it, check every answer, and submit it yourself.</li>
          <li><strong>Not sure which?</strong> — open it and press <em>Read this page</em>; it picks the action that fits.</li>
        </ul>
      </div>
    );
  }
  if (status.state === "not_connected") {
    return (
      <div data-extension-state="not_connected" style={card}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Your extension isn't connected</div>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.6, margin: 0 }}>
          It has been used on this account, but it holds no live key right now. Click the draft icon in your
          browser's toolbar while you're signed in here and it connects by itself — or press <em>Sign in</em> inside it.
        </p>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "12px 0 0" }}>
          Setting it up on a different browser? <ExtensionInstallButton compact/>
        </p>
      </div>
    );
  }
  return null;
}

// ⛔ D40 (owner, 10-06): this page STOPS LISTING CAPTURES at a random spot. It explains the extension
// and carries the Web Store link; the user's imports live in Full House's `+` view, on the board's
// own card. One line points there.
export function ImportsPointer() {
  return (
    <p data-imports-pointer="" style={{ fontSize: 14, color: "var(--color-text-muted)", margin: "0 0 48px" }}>
      Jobs you capture are on your board — open the <Link to="/app/jobs?view=imported">+ view on Full House</Link> to see them.
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
    <div className="scroll-dock-page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
                  background: "transparent", color: "var(--color-text)",
                  fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <ScrollDock variant="marketing" />
      <main style={{ flex: 1, width: "100%", maxWidth: 800, margin: "0 auto", padding: "64px 24px", boxSizing: "border-box" }}>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 900, letterSpacing: "-1.5px",
                      color: "var(--color-text)", marginBottom: 16, lineHeight: 1.1,
                      fontFamily: "'Barlow Condensed', 'DM Sans', system-ui" }}>
          Add any job to your board
        </h1>
        <p style={{ fontSize: 16, color: "var(--color-text-muted)", lineHeight: 1.6, marginBottom: 28, maxWidth: 560 }}>
          The draft browser extension is how a job you find anywhere gets onto Full House. Capture the
          posting you're viewing, and later fill the application — you review every answer and submit
          it yourself.
        </p>
        {known && offerInstall && (
          <div style={{ marginBottom: 56 }}>
            <ExtensionInstallButton/>
            {signedIn && (
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "10px 0 0" }}>
                Already installed it? Click it once while you're signed in here and it connects.
              </p>
            )}
          </div>
        )}
        {status && <ExtensionStateCard status={status}/>}
        {status?.state === "connected" && <ImportsPointer/>}

        {/* D33: the install-and-set-up steps are for someone setting it up — not for a connected user. */}
        {status?.state !== "connected" && (
        <ol style={{ listStyle: "none", padding: 0, margin: "0 0 56px", display: "flex", flexDirection: "column", gap: 28 }}>
          {STEPS.map((s, i) => (
            <li key={s.title} style={{ display: "flex", gap: 20 }}>
              <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                             background: "var(--color-primary-muted)", border: "2px solid var(--color-primary)",
                             display: "flex", alignItems: "center", justifyContent: "center",
                             fontSize: 16, fontWeight: 900, color: "var(--color-primary-text)" }}>
                {i + 1}
              </div>
              <div style={{ paddingTop: 4, minWidth: 0 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", margin: "0 0 6px" }}>{s.title}</h2>
                <p style={{ fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.7, margin: 0, maxWidth: 560 }}>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
          {FACTS.map(([h, b]) => (
            <div key={h} style={{ border: "1px solid var(--color-border)", borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{h}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.6 }}>{b}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
          What it stores and sends is set out in the <Link to={PRIVACY_POLICY_PATH}>privacy policy</Link>.
        </p>
      </main>
      <Footer/>
    </div>
  );
}
