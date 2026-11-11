// client/src/pages/marketing/PrivacyPage.jsx
import { Link } from "react-router-dom";
import ScrollDock from "../../components/ScrollDock.jsx";
import { Footer } from "../../components/Footer.jsx";
import { BRAND, CANONICAL_HOST, LEGACY_HOST, PRIVACY_CONTACT_EMAIL, SUPPORT_EMAIL } from "../../../../shared/brand.js";
import { PolicySection, P, UL, LI, H3, Strong } from "../../components/PolicyProse.jsx";
import { ts } from "../../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

// Effective date, not just "last touched". The Chrome Web Store rules that took effect on
// 2026-08-01 require a policy to state when it takes effect and to commit to telling users about
// material changes to data handling — see the "Changes to This Policy" section.
// 2026-09-15: bumped for two changes, both of which REDUCE what leaves the browser, so neither
// triggers the advance-notice commitment below — that covers changes adverse to a user, and these
// are a disclosure the policy was missing and the removal of a recipient. (1) The extension storage
// section now enumerates all four keys it writes rather than the two it used to claim. (2) Web
// fonts were pulled off Google Fonts and self-hosted, retiring a recipient this policy had never
// named. Leaving the date at August 19 would have been the inaccuracy, not the fix.
// 2026-09-23: bumped for the rebrand and the domain migration. The operator is the same legal
// person and the server is the same server, so nothing about data handling changed and the
// advance-notice commitment is not triggered — but the name a user is asked to trust and the
// host their data is sent to are both stated IN this policy, so leaving them stale would make
// the policy wrong on its own face. BOTH hosts are named below on purpose: the reviewed
// extension still posts to the legacy origin and will until its P4 update is LIVE, so naming
// only the new one would describe software nobody is running yet.
// 2026-09-26: bumped for P4, and this one is the closest any bump has come to the advance-notice
// commitment. Two of the three changes REDUCE exposure: the extension no longer sends the browser's
// session cookie, so it can no longer act as whatever account is signed in elsewhere in the same
// browser, and it names the account it IS connected to. The third is a correction, not a change in
// behaviour — the storage section said four keys and the extension wrote six, because auth.js was
// added after the sentence was. ⛔ The retracted sentence matters more than the count: "None of them
// is sent anywhere by the extension" was FALSE once the extension carried its own token, and a
// reader could falsify it by watching one request. It now says which single value is transmitted
// and to whom. Advance notice is not triggered — no new data leaves, and one recipient path closed
// — but this is the bump to point at if anyone asks when the token was first disclosed.
// 2026-09-28: bumped for A4, and unlike every bump above this one ADDS a recipient. Résumé
// generation and enhancement moved to the résumé tools service (Resume Master), so the résumé, the
// profile details it draws on and the job description now pass through it on their way to
// Anthropic. (PDF reading moved there too at the time and has since come back: A80 V1 — draft reads
// an uploaded PDF's text layer itself and sends it nowhere. See the 2026-10-05 entry.) Same operator, and it processes without storing — but it is a new place the data
// goes, which is the kind of change the advance-notice commitment exists for. It is not triggered
// in practice only because there are no users to notify yet (docs/WORKLOG.md: users — none); from
// the first user on, a change of this shape needs the notice, not just a date.
// Same day, B step 4: the former address stopped serving this application and moved to the tools
// service. The Overview and the extension paragraph said both addresses reached the same servers,
// which the move made false; both now say where each address goes. v1.0.0 was published UNLISTED
// (owner, 09-28) and posts to the former address, so the policy says its captures are no longer
// received rather than implying they are.
// 2026-10-05: bumped for O72(b) — five places described flows that no longer exist, or left out
// ones that do. (1) Captured job descriptions are NOT sent to Anthropic for ATS scoring: scoring is
// local (@draft/ats-scorer). (2) The tools service no longer reads uploaded PDFs, and there is no
// fallback, because draft reads them itself. (3) Anthropic does no "ATS analysis". (4) The Anthropic
// paragraph now names the two direct calls it left out: cover letters (résumé text, job title, company,
// job description and tone, sent from draft, not through the tools service — D44.1 traced both calls) and the profile wizard's chip
// suggestions (the domain, role family and chips already chosen). (5) This comment block. Advance
// notice is not triggered: nothing new leaves. (4) discloses flows that already existed, and the
// others retract claims about flows that don't. test/privacyO72Corrections.test.js pins all five.
// 2026-10-07: bumped at the extension v1.5.0 release finalisation (F 1). The text changed on 10-07 without
// the date moving: D64's automatic capture (opt-in; five public posting hosts; only postings are sent;
// an irrelevant one is discarded unstored), D55's Report this form, D56's page address on a fill /
// Prepare / I submitted, and D68's Copy sheet with the Limited Use affirmation. ⛔ Automatic capture
// COLLECTS SOMETHING NEW, which is what the "Changes to This Policy" commitment is for: whether
// registered users must be emailed before it takes effect is the OWNER's call (WORKLOG O85), not code's.
// 2026-10-08: bumped for D86 — the user's own ChatGPT or Claude, connected by the user, receives the base
// résumé (no contact details), claims and the job's details under the user's own account. Off unless the
// user turns it on, and off for everyone until the operator's switch is on. Whether registered users are
// emailed before it is switched on is the OWNER's call (WORKLOG O87), as O85 was for automatic capture.
// 2026-10-09: bumped at the extension release check (Task A2). Corrections, nothing new collected: the
// email line said "account confirmation" (there is none — the two emails are the reset link and the
// new-address code) and "no marketing emails without explicit opt-in" (there is no marketing email at
// all); Resend (outbound) and Cloudflare Email Routing (inbound contact mail) were recipients the policy
// never named; support@ is published beside privacy@.
// 2026-10-09 (later, 39d — the same date): D88 support requests and account administration disclosed — what a
// request from Settings → Help keeps (the messages, the page and the app version; never a form answer), that it is
// deleted with the account or 24 months after it is solved, and that an admin's changes to an account are kept
// with the reason given. Nothing new is collected from anyone who does not write to support.
// 2026-10-09 (later, D86 compliance — the same date): the connected-app paragraph gains its retention (a request's
// copy of the base résumé emptied a day after it is finished; the activity record — ids and outcomes, never content —
// kept 12 months) and the statement that connector content is never used to train a model. Nothing new is collected.
// 2026-10-09 (later, D86 v1 tools — the same date): the connected app can also search the user's board, read one
// public posting and see the user's own ATS scores (draft_search_jobs, draft_get_job, draft_score_resume_for_job);
// the paragraph names them. Read-only, the user's own data and public postings — nothing new is collected.
// 2026-10-10 (D90): the uploaded résumés are all kept, not only the newest, so a tailored version can be compared with
// the one it was made from (Data Storage and Security). Nothing new is collected — the same text, kept longer.
// 2026-10-14 (D96–D98, the extension run): THREE NEW THINGS ARE KEPT, each only after the user acts. (1) Answer memory
// (services/answerLifecycle.js, migration 164): an answer the user acknowledges on an application page, with a history
// of changes; never terms / consent / attestation / signature, passwords, payment details or SSNs. (2) The on-page
// résumé (services/extensionResume.js, migrations 165–166): a record of each generation request and, on Attach, the
// PDF linked to the job and the application. (3) D97's automatic reading (extension/autoRead.js): four per-site
// switches, all off, Workday's two public hosts added to the optional list; the extension-storage item for D64's
// switch is now the automatic-reading settings (labels and counts while Read is on, 30 days, never sent).
// October 15, 2026 (owner, 10-15 — yes to T14's decision 2; T11): (1) "Where each application stands" also keeps up to
// eight addresses of the job's pages (trackers and fragments dropped), local, 30 days, never sent — so a new tab on the
// same job binds without a server call (extension/tabState.js, progress.js). (2) A fill on a form inside another site's
// frame (Stripe → Greenhouse) also sends that frame's address, checked against the job before anything is filled.
// (3) Same date, D97 REVISED + T12 (owner 10-15): automatic reading is offered by a one-time card in the popup (one
// Chrome prompt for the preset job sites, which now include SmartRecruiters; Read and Prepare only — Capture and Fill
// stay off), and "Always read here" adds one employer careers site at a time from a click. The settings item also keeps
// the sites chosen that way and which job site's form a careers site embeds (an address and a site name, no path).
// October 25, 2026 (owner, 10-25 — T31: the toolbar popup is retired; "one press reads"): (1) the tab's address is sent
// when the TOOLBAR BUTTON (or its shortcut) is pressed on a page — before, the popup opened reading nothing and a
// second press, "Read this page", sent it. The same one address, the same answer, still only on a press, still not
// kept — but one click sooner: a MATERIAL change, so the advance-notice commitment below applies (an owner action
// before the extension ships it). (2) The last capture's result is no longer stored (nothing reads it any more).
// (3) The popup's places — the account and Disconnect, automatic reading's one-time offer, "Always read here", the Copy
// sheet, Report this form — are named where they are now: the settings page and draft's panel on the page.
// November 8, 2026 (owner, 11-08 — 45n, decision (5)): the push that applies D183 (the profile is private unless the person
// makes it public; what a public page shows; search engines only when switched on; a replaced résumé re-fills it; reports),
// the Google sign-in and crawl-sources lines, and people search (a public profile can be found by name in draft's search
// with the workplace and school it shows). ⚠ MATERIAL — a new way information becomes visible, always by the person's choice.
// October 31, 2026 (owner, 10-30 — D112 item 3, from docs/privacy/PENDING_D100_D103.md): FIVE NEW THINGS, all MATERIAL
// (draft starts keeping or sending new kinds of data), each only after the user turns it on. (1) D100 · Applying for You —
// the apply worker (SEMI default / FULL AUTO), sealed portal sessions only the separate apply service can open, portal
// accounts created with the user's own email, the opt-in terms box, and what the worker never does. (2) D103 · the
// Application Inbox — a forwarding address, the message's sender / subject / time / text (20,000 characters, no
// attachments), rule-sorted, no model; ⭐ inbox mail deleted after 180 DAYS (owner: "6 months"; services/inbox.js
// INBOX_RETENTION_DEFAULT_DAYS, swept at boot and daily from server.js). The opted-in portal verification-code read.
// (3) D112 item 2 · Connecting Gmail — Google OAuth gmail.readonly, only messages matching applicant-tracking senders and
// the user's applications' companies, text only, no attachments, the same path as a forwarded message; disconnect revokes
// the token. Google's Limited Use affirmation, in the example wording of Google's Workspace API User Data and Developer
// Policy (verified 10-30 against developers.google.com/workspace/workspace-api-user-data-developer-policy, last updated
// 2026-09-03). Google becomes a recipient again, so the fonts paragraph's "we send Google nothing" is narrowed to fonts.
// (4) D101 · the profile in sections and Application defaults. (5) D112 item 4 (T35 = A) · global read — asked ONCE, an
// optional permission for every site; a page that is not a posting sends nothing (not its address, not a hash); an
// irrelevant posting is discarded unstored; never LinkedIn / Indeed / Glassdoor. The "it never asks for every site"
// sentence is retracted with it. ⛔ The advance-notice commitment is NOT triggered in practice: there are no registered
// users yet (owner, 10-30: "we have no users yet today so we can finalise before we push") — so the owner chose no notice
// period, and the effective date is the date of the push that applies this text. ⚠ If that push is not 2026-10-31, move
// this date to the push day. From the first registered user on, a change of this shape needs the notice, not just a date.
// October 31, 2026 (the same date, D112 item 8 — Web Push, merged 10-30 before the push): a Notifications paragraph and the
// browsers' push services as a recipient. Optional and per event (Account → Notifications); the push address and keys
// the browser gives are kept; each message is encrypted to the browser (RFC 8291) and the push service sees only that
// one was sent; no message names a company or shows a value (services/notify.js eventText); email only for the events
// the user turns it on for; turning push off or the browser unsubscribing deletes the subscription. The date does not
// move — this text ships in the same push as the rest of the October 31 changes.
// D113 (owner 10-31 — remote auto-apply, services/picks.js, routes/picksConfirm.js): Applying for You gains the PICKS —
// at the user's run times draft picks jobs and, in Ask me first, sends ONE picks message per run (an email that names
// each job and company, with Apply / Pass links, and a push that does not); a tap on Apply, then Confirm, SENDS that
// application (unless "Show me the form before sending" is on); a link never acts on its own; links expire at the next run
// time and work once; Apply for me sends without asking and mails one summary per run; a question it cannot answer comes
// back by message. The Notifications paragraph's "a notification never names a company" now carves out the picks email.
// ⚠ MATERIAL (a new kind of message, and a tap that sends). EFFECTIVE_DATE is NOT moved here: the convention is "the date
// of the push that applies it", and this lane does not push. ⛔ The push that ships D113 must set EFFECTIVE_DATE to that
// day — and, if any user is registered by then, give the advance notice this policy commits to before it takes effect.
// D183 (owner 11-08 — Profile = your page, services/profilePage.js, routes/publicProfile.js): the profile paragraph says
// the page is PRIVATE unless the person makes it public; what a public page shows and never shows (contact details,
// application defaults, job profiles, saved answers); search engines only when they switch it on; a replace of the
// résumé re-fills the page and can be undone for 30 days; anyone can report a public page. ⚠ MATERIAL (a new way
// information becomes visible to others, always by the person's own choice). EFFECTIVE_DATE is NOT moved here (the
// convention: the date of the push that applies it) — ⛔ the push that ships D183 sets it.
// 45n (owner 11-08, decision (5)): the two approved lines added — Google sign-in (Account Information) and the crawl's
// sources (the job-boards recipient). ⛔ EFFECTIVE_DATE = the day the push carrying D183 goes live; the agent sets it IN
// that push (the owner's word), not before — it is still the 10-31 date until then.
// ⭐ 45n push (owner 11-08, decision (5)): the push carrying D183's profile lines, the Google sign-in and crawl-sources
// lines, and people search (a public profile findable by name) — effective the day it goes live.
const EFFECTIVE_DATE = 'November 8, 2026';
const CONTACT_EMAIL  = PRIVACY_CONTACT_EMAIL;

export function PrivacyPage() {
  return (
    <div className="scroll-dock-page" style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      background: "transparent", color: "var(--color-text)",
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <ScrollDock variant="marketing" />

      <main style={{ flex: 1, maxWidth: 720, margin: "0 auto", padding: "64px 24px 80px" }}>

        {/* Header */}
        <header style={{ marginBottom: 48, paddingBottom: 24, borderBottom: "1px solid var(--color-border)" }}>
          <h1 style={{
            fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 400, color: "var(--color-text)", marginBottom: 8,
            lineHeight: 1.1, fontFamily: "var(--font-display)",
          }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: ts(13), color: "var(--color-text-faint)" }}>
            Effective: {EFFECTIVE_DATE}
          </p>
        </header>

        {/* Overview */}
        <PolicySection title="Overview">
          <P>
            {BRAND} ("we", "us", "our") operates {CANONICAL_HOST} and the {BRAND} browser
            extension. Our former address, {LEGACY_HOST}, no longer serves this application: it now
            hosts our separate résumé tools service, described under Third-Party Services below.
            This policy explains what data we collect, how we use it, and your rights over your
            information.
          </P>
          <P>
            <Strong>We do not sell your personal data.</Strong> We do not share it
            with third parties except as described in this policy.
          </P>
        </PolicySection>

        {/* Information We Collect */}
        <PolicySection title="Information We Collect">
          <H3>Account Information</H3>
          <P>
            When you create an account, we collect your email address and a hashed password
            (we never store plaintext passwords). If you sign in with LinkedIn OAuth, we receive
            your name and email address only — no LinkedIn profile data, posts, connections,
            or activity.{" "}
            {/* ⭐ A138 (owner-approved line, 11-08): Google sign-in in the shared sign-in panel. */}
            If you sign in with Google, we receive your name, email address and profile picture from
            Google to create and secure your account. We don't receive your Google password.
          </P>

          <H3>Resume Data</H3>
          <P>
            We store the resume content you create or upload: work history, education, skills,
            and contact information. This data is stored solely to provide the resume-building
            service to you. You can delete it at any time from your account settings.
          </P>

          <H3>Job Listings</H3>
          <P>
            When you search for jobs on our site, or capture the job you are viewing with the
            browser extension, we store job listing data (title, company, location, description,
            URL) in association with your account. This data comes from public job boards and
            pages you actively visit — we do not access job data without your interaction.
          </P>
          <P>
            The extension has <Strong>one</Strong> capture action, and the toolbar button, the
            keyboard shortcut and the right-click <Strong>Save this page to draft</Strong> are three
            ways of triggering it. They send the same data to the same place, so capturing a job
            twice updates one record rather than creating a second.
          </P>

          <H3>Browser Extension</H3>
          <P>
            <Strong>The extension reads nothing until you invoke it</Strong> — unless you switch on
            automatic reading yourself (below): for a list of job sites, for one careers site at a time, or,
            if you allow it once, for job postings on any site. Out of the box it holds no permission for
            any job site, runs no code on any page automatically, and cannot see what you are
            browsing. When you press its keyboard shortcut or open it from the toolbar, and
            only then, it reads the one tab you are looking at — and its access to that tab ends
            when you navigate away from that site.
          </P>
          <P>
            This is a change from earlier versions, and it is worth being exact about what changed
            in each direction. Previously the extension held standing permission for six named job
            boards and ran a script on their pages automatically whenever one was open; it could not
            read anything else. Now it holds no standing permission for any site, reads nothing
            automatically anywhere — and the page it reads when you do invoke it can be any job
            posting, including employers' own careers pages. It trades constant access to six sites
            for momentary access to the one you point it at.
          </P>
          <UL>
            <LI>
              It reads the <Strong>visible text</Strong> of the page you invoke it on, to extract
              title, company, location, and description. It does this when you capture the job, by
              clicking the toolbar button or pressing the keyboard shortcut — never before.
            </LI>
            <LI>
              It reads the <Strong>address (URL) of the tab you invoke it on</Strong>, to
              recognise whether that page is a supported job posting. When you press the extension's{" "}
              <Strong>toolbar button</Strong> (or its keyboard shortcut) on a page, it opens draft's
              panel there and also sends that one address to {CANONICAL_HOST}, to show you whether the job
              is already on your board and whether an application you drafted is waiting on that
              site; nothing is read or sent before you press it, and the answer is shown on that page
              and not kept by the extension. When that address
              alone does not identify the job, the same press also sends the posting's text it read
              (the title, company and description a capture would send), so draft can tell which job on
              your board it is and score your résumé against it; that text is used for the answer and
              not kept, and no job is saved unless you capture it. When the application form on that
              page sits inside another site's frame (an employer's page showing Greenhouse's form, say),
              filling it also sends that frame's address, so draft can check the form belongs to the
              same job before anything is filled. It cannot see the address of any other tab, and it
              does not record where you go — only the addresses of job pages you used it on, kept in
              your browser as described below.
            </LI>
            {/* D55 decision B — background.js saveLinkToDraft(), routes/importJob.js POST /link. */}
            <LI>
              If you right-click a link and choose <Strong>Save link to draft</Strong>, the extension
              sends only that link's address to {CANONICAL_HOST} — no page is opened or read. We save
              the job only if the link is to a posting on a job board we read directly, fetching it
              from that board's own listing; we refuse any other link and save nothing.
            </LI>
            <LI>
              Earlier versions had an <Strong>ATS Score Tool</Strong> button in the extension's popup that
              copied the visible text of the page you were on into the address of your {BRAND} ATS
              Score page, where it could appear in our ordinary server logs. That button has been
              removed: the extension now shows {BRAND}'s own report for a job in its panel on the page,
              and sends no page text in an address. Earlier versions also added an "ATS Score this job"
              button into job pages themselves; that button has been removed too, and the extension no
              longer changes the appearance of any page except to show you its own panel and a
              confirmation message after something you asked for.
            </LI>
            <LI>
              Data extracted by the extension is sent to {CANONICAL_HOST}, our server, and
              associated with the account you connected the extension to. (An earlier, unlisted
              build, version 1.0.0, sent it to our former address, {LEGACY_HOST}; that address no
              longer reaches this application, so captures from that build are not received or
              stored.) Because it is attached to your account, captured job data
              is personal information, and we treat it as such. The extension identifies itself with
              an access token of its own rather than with your website session: it asks for that
              token once, when you connect it, and from then on it sends the token and not the
              browser cookie. That is deliberate — it means the extension acts only as the account
              you connected it to, and never as some other account you happen to be signed in to in
              the same browser.
            </LI>
            <LI>
              Job descriptions you capture are sent to Anthropic's API only when you use them to
              generate a résumé (through our résumé tools service) or a cover letter, as described
              under Third-Party Services below. ATS scoring is <Strong>not</Strong> one of those
              uses: we score on our own server, and a captured job description is not sent
              anywhere to be scored.
            </LI>
            <LI>
              It does <Strong>not</Strong> read, store, or transmit your session cookies, login
              credentials, or any authentication token belonging to any other site. The one
              credential it holds is its own — the access token described above, which it obtained
              from us, for us, when you connected it.
            </LI>
            <LI>
              It does <Strong>not</Strong> read any page you have not navigated to yourself, and
              does <Strong>not</Strong> collect your browsing history.
            </LI>
            <LI>
              It does <Strong>not</Strong> read your messages, connections, or profile feed on any
              site. It reads a page only when you invoke it on that page, and only that one tab —
              or, once you have switched automatic reading on, a job posting or application page
              you open yourself, as described below.
            </LI>
            <LI>
              It does <Strong>not</Strong> collect lists of jobs. It reads the one posting you are
              looking at. It does not gather search results, job lists, or your saved-jobs list on
              any site — an earlier version of the extension could read a LinkedIn saved-jobs
              list, and that capability was removed.
            </LI>
            <LI>
              It contains <Strong>no remotely hosted code</Strong>. Everything it runs is in the
              package you install from the Chrome Web Store; it never downloads or executes code
              fetched from a server.
            </LI>
          </UL>

          <H3>What the Extension Stores in Your Browser</H3>
          <P>
            The extension keeps nine things in your browser's own extension storage. Five are
            ordinary local storage and stay until you uninstall the extension or disconnect it; the
            other four are memory-backed session storage, which your browser discards when you
            restart it. Only one of the nine — the extension's own access token, described below — is
            ever sent anywhere, and it goes only to us. (Earlier versions also stored a custom
            keyboard shortcut; that setting was removed, and any value it left behind is deleted
            when you open the extension's options page. Shortcuts are now managed by Chrome itself.)
          </P>
          <UL>
            <LI>
              <Strong>The prepared answers for an application in progress</Strong>, during a form
              fill only. Session storage: expiring after ten minutes, deleted when that tab closes,
              and gone when you restart your browser.
            </LI>
            <LI>
              <Strong>The result of your most recent form fill</Strong> — whether it succeeded, the
              message you were shown, and which tab it happened in — so the outcome of a fill you
              started with the keyboard is on record for the rest of the session. Session storage: overwritten by the
              next fill and gone when you restart your browser. The ten-minute expiry above does
              not apply to it.
            </LI>
            <LI>
              <Strong>Which employer's site you are part-way through applying on</Strong>, when you
              have more than one application queued for the same site — that site's web address and
              how many are left to do, so the extension can carry on where it stopped without
              sending you through the sign-in again. This one records an employer, so it is worth
              stating plainly: it holds no answers and nothing about you. Session storage: deleted
              when that tab closes or when the queue for that site empties, and gone when you
              restart your browser. The ten-minute expiry does not apply to it either.
            </LI>
            <LI>
              <Strong>Which job a tab is on</Strong> — the job's draft id, its title and company, and the
              time it was linked; for a tab opened from your board, whether it was opened to apply or to
              view; and, once you choose, whether you are drafting that job or filling it in yourself — once you capture
              a job in that tab or draft recognises the posting there, so the later pages of the same
              application (signing in, the application's steps) are known to be that job. It holds no
              answers and nothing about you, and it is never shared between tabs. Session storage:
              deleted when that tab closes, when the tab shows a different job, or when you press
              "Unlink this page", and gone when you restart your browser. The ten-minute expiry does
              not apply to it.
            </LI>
            <LI>
              <Strong>The account the extension is connected to</Strong> — your username, so the
              extension's settings page can tell you whose account a capture would go to before you make one. Local
              storage: refreshed when the extension checks in with us, and deleted the moment you
              disconnect it. The ten-minute expiry does not apply to it.
            </LI>
            <LI>
              <Strong>The extension's own access token</Strong>, which is how it identifies itself
              to us. <Strong>This is the one stored value that is transmitted</Strong>: it is sent
              with each request the extension makes to {CANONICAL_HOST}, and to nowhere else. It is
              not your password and it is not your website session — the extension obtains a token
              of its own the first time you connect it, precisely so that it acts only as the
              account you connected and never as whatever else you happen to be signed in to in the
              same browser. You can end it at any time from the extension's settings page (Account → Disconnect), or from your
              account, and the extension then holds nothing. Local storage; the ten-minute expiry
              does not apply to it.
            </LI>
            <LI>
              <Strong>Where each application stands</Strong> — for each job you capture, read, prepare,
              draft, fill or submit with the extension: the job's draft id, its title and company, the address
              of its posting, up to eight addresses of that job's pages you used the extension on (with
              tracking parameters and anything after "#" removed — so a new tab on the same job picks up
              where you left off without asking us), when each of those steps happened, and how many
              fields were filled and how many still need you — so draft's panel on the page can show where you left off. It holds no answers — never
              what you typed, chose or filled — and nothing else of the page. It is never sent anywhere.
              Local storage: each job is kept 30 days from its last change, and all of it is deleted when
              you disconnect the extension, when you sign out, or when a different account is connected.
              The ten-minute expiry does not apply to it. If you generate a résumé on the page, the
              same record also remembers that résumé's ID, its status and when you attached it — no
              résumé text, file or file name — so the panel comes back after you close it or
              reload, and a later fill attaches the same file.
            </LI>
            <LI>
              <Strong>Your automatic-reading settings</Strong> — which of Read, Prepare, Capture and
              Fill you switched on for each site (including the sites you chose with Always read here),
              when you agreed to the explanation shown before any of them can be switched on, which job
              site's form a careers site you used draft on embeds (that site's address and the job
              site's name — never a page's path), and — while Read is on — the question labels (never your
              answers) and field counts of application pages draft read, kept on this computer for 30
              days to show how well a page was read. Local storage; never sent anywhere. The
              ten-minute expiry does not apply to it.
            </LI>
            <LI>
              <Strong>Where draft's panel sits on each site</Strong> — for each site you used the
              extension's on-page panel on: that site's address (never a page's path), and the panel's
              position, size, which edge it is snapped to, whether it is collapsed, which tab it shows and
              which tabs are in their own windows — so it opens where you left it. It holds nothing of
              the page and nothing about you. Local storage; never sent anywhere; the 50 most recent
              sites, each kept 30 days from its last change. The ten-minute expiry does not apply to it.
            </LI>
          </UL>

          {/* ⭐ D64 (owner, 10-07) → D97 (owner, 10-13) — automatic reading. extension/autoRead.js, services/jobs/autoCapture.js. */}
          <H3>Reading Application Pages Automatically (optional, off by default)</H3>
          <P>
            You can let draft work on job sites without a click. The extension's settings page offers
            it — and draft's panel points you there when you are on one of those sites — for a short list of job sites — Greenhouse, Lever, Ashby, Workable,
            SmartRecruiters and Workday (including Workday's shared myworkdaysite.com pages) — with one
            prompt from Chrome for that list. Agreeing turns on <Strong>Read</Strong> and{' '}
            <Strong>Prepare</Strong> (below) on those sites; <Strong>Capture</Strong> and{' '}
            <Strong>Fill</Strong> stay off until you turn them on in the settings. On an employer's own
            careers site, the settings page's <Strong>Always read</Strong> switch for that site (draft's panel offers it there) does the same for that one
            site: it asks Chrome for that site — and, when its application form is another job site's
            frame, that job site — and nothing else. <Strong>Nothing is on until you agree</Strong>, after
            the extension has shown you what it does. These two never ask for every site — only the
            separate choice below does — and nothing ever reads LinkedIn, Indeed or Glassdoor. In the
            settings there are four separate switches per site:
          </P>
          <UL>
            <LI>
              <Strong>Read</Strong> — notices when an application page or step opens and reads the
              form's structure (its questions and fields, never what you have typed). Nothing is sent.
            </LI>
            <LI>
              <Strong>Prepare</Strong> — prepares your answers for that application, only on a tab
              already linked to one of your own jobs; the page's address is sent to us to do it, as
              when you press Prepare.
            </LI>
            <LI>
              <Strong>Capture</Strong> — on a job posting (never an application step), checks{' '}
              <Strong>in your browser</Strong> whether the page is a posting. <Strong>If it is not,
              nothing is sent</Strong> — not the page, not its address. If it is, its text and address
              are sent to us and checked against your board. <Strong>If it does not fit, we keep
              nothing</Strong>: not the posting, not its address, not a record that it was sent. If it
              fits, it is added to your board, and the extension lists today's automatic captures so
              you can undo any of them.
            </LI>
            <LI>
              <Strong>Fill</Strong> — fills the prepared answers and may press the form's own
              "Save and Continue" between steps. <Strong>It never submits an application</Strong>, never
              ticks a terms, consent, attestation or signature box, and never saves the form's
              structure for anyone else.
            </LI>
            <LI>
              One button switches everything off at once and gives back the extension's access to
              every site. You can also remove it from Chrome's own extension settings.
            </LI>
          </UL>

          {/* ⭐ D112 item 4 (owner 10-30, T35 = A) — global read: the optional any-site (https, every host) permission, asked once (b2:
              a small window that closes itself). The listing and PRIVACY_RECONCILIATION.md change with it. */}
          <H3>Reading Job Postings on Any Site (optional, asked once)</H3>
          <P>
            The extension can also offer, <Strong>once</Strong>, to read job postings on any site — not only
            the job sites above — so that draft's panel appears on a posting by itself, with no click. It
            shows you what it does in a small window over the posting (<Strong>Allow</Strong> or{' '}
            <Strong>Not now</Strong>); only Allow raises Chrome's own prompt, for the optional permission to
            read pages on any site, and either answer closes the window. Not now asks Chrome nothing. Once
            you allow it:
          </P>
          <UL>
            <LI>
              On each page you open, the extension checks <Strong>in your browser</Strong> whether the page
              is a job posting. <Strong>A page that is not a posting sends nothing</Strong> — not the page,
              not its address, not a hash of it — and nothing about it is kept, in your browser or by us.
              The extension does not record where you go.
            </LI>
            <LI>
              On a posting, its text and address are sent to us and checked against your board, as Capture
              does above. <Strong>An irrelevant posting is discarded and not stored</Strong> — not the
              posting, not its address, not a record that it was sent. A posting that fits is shown to you
              in draft's panel.
            </LI>
            <LI>
              It <Strong>never</Strong> reads LinkedIn, Indeed or Glassdoor, and what it reads in your
              browser is used for your own account only — it is never added to a board other people see.
            </LI>
            <LI>
              Fill still never submits an application, and the per-site switches above still apply. The
              same one button switches everything off and gives the permission back; you can also remove it
              in Chrome's own extension settings.
            </LI>
          </UL>

          <H3>Filling an Application</H3>
          <P>
            Some employers require an account, or a CAPTCHA, before they will accept an
            application. You cross that sign-in yourself, in your own browser. Once you are
            through it and looking at the application form, you can invoke the extension to fill
            it in. Specifically:
          </P>
          <UL>
            <LI>
              The extension only reaches that page because <Strong>you invoked it there</Strong>.
              It holds no standing permission for any employer or job-portal site; pressing the
              shortcut is what grants it access, to that one tab, at that moment.
            </LI>
            <LI>
              It fetches from your {BRAND} account the details you have already saved there
              — your name, email, phone, postal address, work-authorization answers and your
              resume — and enters them into that employer's form. This is{" "}
              <Strong>your own data, going to the employer you chose</Strong>, and it goes nowhere
              else.
            </LI>
            <LI>
              It shows you every answer it filled in, and where each one came from, before you do
              anything. You can change any of them.
            </LI>
            <LI>
              It does <Strong>not</Strong> submit the application. You press the employer's own
              submit button.
            </LI>
            <LI>
              The extension does <Strong>not</Strong> sign you in, create an account for you, or attempt a
              CAPTCHA, and it never reads or stores any employer's password, session cookie or
              verification code. (draft's separate apply service can do some of those for you, only if you
              turn them on — see Applying for You, below.)
            </LI>
            <LI>
              The prepared answers are held only while you are working on that application: in
              memory-backed browser storage, for ten minutes, and cleared when the tab closes.
            </LI>
            {/* D56: gated-handoff.js runGatedHandoff / prepareAndFill / copySheetFor / recordSubmitted —
                routes/apply.js /handoff/match, /gate-packets/:id/token, /prepare, /copy-sheet, /handoff/submitted. */}
            <LI>
              When you fill, prepare or copy answers for an application, the extension sends that
              page's <Strong>full address</Strong> (including its path and any query) to{" "}
              {CANONICAL_HOST}, to work out which of your applications the page belongs to; it is
              used for that check and not kept. When you press <Strong>I submitted</Strong>, that
              address is kept with the application's record, as the evidence of where you sent it —
              its path and only the parts of the query that identify the application (a job or
              application number). Anything else in the query, such as a session or tracking code or
              an email address, is <Strong>dropped before it is stored</Strong>.
            </LI>
            {/* D67 (2): services/learnedOrigins.js — hostnames only, the shared row carries no identity. */}
            <LI>
              If the page you press <Strong>I submitted</Strong> on is on a site draft did not yet know
              for that job, we remember the <Strong>two site names</Strong> — the posting's and the
              application's, never their full addresses — so your next application there can be
              filled. Once three different people have shown the same pair, it is used for everyone;
              the shared record holds only the two site names and a count, never who showed it.
            </LI>
            {/* D68 (owner, 10-07): the Copy sheet, checked — copy-sheet-panel.js renders it with textContent; nothing is injected. */}
            <LI>
              The <Strong>Copy sheet</Strong> shows your own prepared answers — including any
              work-authorisation or voluntary self-identification answers you saved — in draft's
              panel on the page, to you, while you are signed in. Showing it fills nothing on the
              page, stores nothing in your browser and sends your answers nowhere else. Pressing
              <Strong> copy</Strong> puts that one answer on your clipboard; we do not record what
              you copied — only that the sheet was opened and how many answers it held.
            </LI>
          </UL>

          <H3>Learning an Application Form (optional, off by default)</H3>
          <P>
            If you turn it on, the extension can report back the <Strong>structure</Strong> of an
            application form it filled — the questions it asks, their types, which are required,
            and the options in any dropdowns. We use this so the same employer's form is
            recognised for other candidates. This setting is <Strong>off unless you switch it
            on</Strong>, and it is enforced on our servers, not just in the extension.
          </P>
          <UL>
            <LI>
              We store the form's <Strong>questions</Strong>, never your{" "}
              <Strong>answers</Strong> — not the values you typed, not anything about you, and
              nothing from the page other than the form's shape.
            </LI>
            <LI>
              What is stored is a fact about the employer's form, not about you. It is not linked
              to your account.
            </LI>
          </UL>

          {/* D55 decision E — the one disclosure line. services/formReports.js, migration 136_form_reports. */}
          <H3>Reporting a Form That Isn't Recognised</H3>
          <P>
            If you press <Strong>Report</Strong> on a form draft did not recognise, in draft's panel on
            the page, and then <Strong>Send</Strong>, we receive that site's host name (for example
            jobs.example.com — never the rest of the page address) and the form's field labels,
            never your answers; the report is linked to your account and deleted after 30 days.
          </P>

          {/* ⭐ D100 (owner 10-30) — the apply worker: services/applyWorker.js, the sealed portals (routes/portals),
              the separate apply service. Text from docs/privacy/PENDING_D100_D103.md §1. */}
          <H3>Applying for You (the apply service)</H3>
          <P>
            If you choose to, draft can fill in and send applications for you on employer portals,
            including ones that require you to be signed in. You choose the mode: <Strong>SEMI</Strong> (the
            default — draft fills the application and waits for you to approve the answers it will send) or{' '}
            <Strong>FULL AUTO</Strong> (draft sends applications that match the filters, times and daily limit
            you set, without asking each time). Every application records whether you approved it or your
            FULL AUTO setting sent it.
          </P>
          <UL>
            <LI>
              <Strong>Signed-in portal sessions.</Strong> To apply on a portal that requires sign-in, you can
              connect it. Your app seals the portal's session (its cookies) with a key that only our separate
              apply service holds; <Strong>draft's own servers store it only in that sealed form and cannot read
              it</Strong>. The apply service opens it only while it is applying for you. When you remove a
              portal, the key is destroyed, and every stored copy becomes unreadable.
            </LI>
            <LI>
              <Strong>Portal accounts draft creates for you.</Strong> If you agree for a portal, draft can create
              an account there for you, using <Strong>your own email address</Strong> and a password our apply
              service generates. The password is sealed the same way — draft's servers never see it. The account
              is yours: you can sign in to it with the portal's own "forgot password". Removing it in draft
              destroys our copy of the key; the account at the portal stays yours.
            </LI>
            <LI>
              <Strong>Agreeing to a portal's terms for you.</Strong> Only if you switch it on in Auto settings,
              draft ticks a portal's terms of service, privacy policy or data-processing consent box when an
              application or a sign-up requires it — never a signature, a statement that your answers are true,
              or a box that signs you up for marketing. Off (the default), the application waits for you to tick
              it yourself.
            </LI>
            <LI>
              <Strong>What the apply service will not do:</Strong> it never answers a CAPTCHA or other human
              check, and never guesses an eligibility answer (work authorisation, sponsorship, citizenship,
              clearance, criminal history) — those stop the application and wait for you. It never stores a
              screenshot of a page you are signed in to; it keeps the list of fields and the values it filled,
              with the application.
            </LI>
          </UL>

          {/* ⭐ D113 (owner 10-31) — the picks: services/picks.js (the run, the one line, the tap's send authority),
              services/autoScheduler.js (the run times), routes/picksConfirm.js (the confirm page), services/notify.js
              (the picks / picks_summary / pick_question messages). Tables picks_runs, picks, picks_left_out (migration 188). */}
          <H3>Picks by Message (optional)</H3>
          <P>
            If you turn on <Strong>Ask me first</Strong>, then at each of your run times draft looks at the new
            postings on your board, leaves out the ones outside your filters, the ones a requirement you set rules
            you out of, the ones that look stale or reposted, and the ones over your daily limit, and{' '}
            <Strong>sends you one picks message per run</Strong>: an email to your own address that names each picked
            job and its company with a one-line reason, and a push notification that says only how many picks are
            ready. Each pick has an Apply link and a Pass link. <Strong>Opening a link never does anything by
            itself</Strong> — it shows the job and one Confirm button. <Strong>A tap on Apply, then Confirm, sends
            the application</Strong> to the employer, the same as if you had approved it in draft, unless you turn
            on "Show me the form before sending", in which case draft fills it and waits for your review. Your
            résumé for the job is written only after you tap Apply. Links are signed, work once and expire at your
            next run time; anyone who has the email can use its links, so treat it like your other account email.
            If the application stops on a question only you can answer, draft sends you a message with that
            question and a link to answer it. With <Strong>Apply for me</Strong> (FULL AUTO), the picks are sent
            without asking and you get one summary after each run. For each run we keep what it looked at, what it
            picked and how many it left out for each reason; the list of left-out postings is deleted after 14
            days.
          </P>

          {/* ⭐ T5 (owner 11-10) — services/assistant/assistant.js. ⚠ PLACEHOLDER wording until counsel's (owner list 6). */}
          <H3>Ask draft, the assistant</H3>
          <P>
            When you ask Ask draft a question, your question and the parts of Atlas and draft's help that match it are sent to
            an AI model (Anthropic's Claude) to write the answer, together with your skills and how many applications you have
            in each state. The conversation is not kept: closing the panel forgets it. If you leave{' '}
            <Strong>Use my questions to improve Atlas</Strong> on, we keep your question with your name, email addresses,
            phone numbers and links removed, and <Strong>not linked to your account</Strong>, to find what Atlas is missing;
            switch it off in Ask draft or in Profile → Privacy and your data. Ask draft never acts on its own: it can suggest
            an action, and it runs only when you press Confirm. Every action is listed in Profile → Privacy and your data.
          </P>

          {/* ⭐ D103 (owner 10-30) — services/inbox.js, routes/inbox.js; 180 days = INBOX_RETENTION_DEFAULT_DAYS (D112 item 3). */}
          <H3>Your Application Inbox</H3>
          <P>
            If you turn it on, draft gives you a private forwarding address (…@in.jobsviadraft.com). You add a
            filter in your own email that forwards replies from job application systems to it;{' '}
            <Strong>employers keep writing to your real address</Strong>. (Or you can connect Gmail instead —
            below.) For each message we keep the sender, the subject, the time it arrived and its text (up to
            20,000 characters; formatting removed; <Strong>attachments are never stored</Strong>), sort it into a
            category (applied, interview, assessment, offer, rejection and so on) by fixed rules —{' '}
            <Strong>no AI model reads your mail</Strong> — and link it to the application it is about. An
            interview or offer email updates that application's status. You can re-file, detach or delete a
            message. Revoking your address stops new mail at once.
          </P>
          <P>
            <Strong>Inbox messages are deleted 180 days (6 months) after they arrive</Strong>, or sooner if you
            delete them or your account.
          </P>
          <P>
            <Strong>Verification codes.</Strong> If you allow it for a specific portal, our apply service may
            read a verification code that portal emails you, within 10 minutes of asking for it, to finish an
            application or an account it is creating for you. Each such read is logged and shown to you.
          </P>

          {/* ⭐ D112 item 2 (owner 10-30) — the Gmail connection: OAuth gmail.readonly; callback /api/gmail/callback;
              the refresh token encrypted at rest; each matched message takes ingestMessage's path (D103 P1–P5). */}
          <H3>Connecting Gmail (optional)</H3>
          <P>
            Instead of forwarding, you can connect your Gmail account with Google's own sign-in. draft asks
            Google for one permission, <Strong>read-only access to Gmail</Strong> (the gmail.readonly scope), and
            uses it narrowly:
          </P>
          <UL>
            <LI>
              draft searches your mailbox <Strong>only for messages from applicant-tracking systems and from the
              companies of your own applications</Strong> — a search built from that list of senders and those
              companies — and reads only the messages that match. It never reads, lists or keeps the rest of your
              mailbox.
            </LI>
            <LI>
              Each matched message is handled exactly as a forwarded one above: the sender, subject, time and{' '}
              <Strong>text only</Strong> (up to 20,000 characters), <Strong>never an attachment</Strong>, sorted by
              rules with no AI model, linked to the application, and deleted after 180 days.
            </LI>
            <LI>
              draft cannot send, delete, label or change anything in your Gmail. The access token Google gives us
              is stored encrypted.
            </LI>
            <LI>
              <Strong>Disconnect</Strong> (in draft's settings) revokes draft's access with Google and stops
              intake at once. You can also remove draft's access from your Google Account's security settings.
            </LI>
          </UL>
          <P>
            <Strong>Google's Limited Use requirements.</Strong> The use of information received from Google
            Workspace scopes will adhere to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy"
              style={{ color: "var(--color-primary-text)" }}>Google User Data Policy</a>, including the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
              style={{ color: "var(--color-primary-text)" }}>Limited Use requirements</a>. In plain terms: we use
            Gmail data only to provide the inbox features described here; we do not transfer it to anyone except
            as needed to provide them, for security, to comply with the law, or as part of a merger or sale with
            your prior consent; we do not sell it, use it for advertising, or use it to decide credit-worthiness
            or lending; no person at draft reads it unless you ask us to, for security, to comply with the law,
            or in aggregated and anonymised form for running the service; and it is never used to train an AI
            model.
          </P>

          {/* ⭐ D112 item 8 (owner 10-30) — Web Push (services/webPush.js: VAPID + RFC 8291 on node:crypto, no vendor),
              services/notify.js (per-event switches, the words of each message), client/public/sw.js; push_subscriptions
              (migration 183). Email copies go through Resend, already named under Third-Party Services. */}
          <H3>Notifications</H3>
          <P>
            Updates always appear in the bell inside draft. <Strong>Browser push notifications are optional and
            chosen per event</Strong>: you switch them on, for each kind of update, in Account → Notifications. When
            you turn push on, your browser gives draft a push address and encryption keys, which we keep with your
            account. Each push message is <Strong>encrypted end to end to your browser</Strong> and carried by your
            browser maker's push service (Google, Mozilla, Microsoft or Apple), which can see only that a message
            was sent, not what it says. <Strong>A notification never names a company or shows a value</Strong> — it
            says only what kind of thing happened (for example, "A job is ready for your approval"). Email copies
            are sent only for the events you turn email on for; the picks email (Picks by Message, above) is the one
            message that names jobs and companies, because it goes to your own inbox and you act from it. Turning push off, or your browser unsubscribing,
            deletes that browser's subscription.
          </P>

          {/* ⭐ D101 (owner 10-30) — services/structuredProfile.js. */}
          <H3>Your Profile and Application Defaults</H3>
          <P>
            Your profile is kept in sections (summary, experience, education, skills, links), filled from your
            résumé when you first open it; editing it never changes the résumé file you uploaded.{' '}
            <Strong>Application defaults</Strong> hold the answers you set for common questions (work
            authorisation, sponsorship, relocation, start date, voluntary self-identification); an answer you
            have not set is left blank and draft asks you, rather than assuming one.
          </P>
          {/* ⭐ D183 (owner 11-08) — services/profilePage.js, routes/publicProfile.js. */}
          <P>
            <Strong>Your profile is private unless you make it public.</Strong> You choose who can see it — only you
            (the setting every account starts with), your connections, or the public — and each section can be kept
            narrower. A public profile has its own address; it never shows your contact details, application
            defaults, job profiles or saved answers, whatever you choose, and search engines are asked not to list it
            unless you switch that on. A public profile can also be found by name in draft's own search, shown with the workplace and school it already displays; making it private removes it from the search. Replacing your résumé re-fills your profile from the new one, keeps what you
            added yourself, and can be undone for 30 days. Anyone can report a public profile to draft's moderators;
            a report records the reason given, and the person reported is not told who sent it. No AI model reads
            your profile for anyone but you.
          </P>

          <H3>Usage Data</H3>
          <P>
            We collect standard server logs (IP address, browser type, pages visited, timestamps)
            for security and debugging. We do not use third-party analytics services that
            track you across the web.
          </P>
          <P>
            For accounts that took part in our early testing, draft holds, with the account, which steps of the walkthrough
            were reached and how long each took, which features were tried (by name), any errors met, the device type (phone
            or laptop), and the in-app survey's answers. draft no longer collects these. We use them only to see where the
            product helps or loses people. Nothing typed was recorded in these steps; the survey's friend's-email field was
            optional and was used only to send that person one note about draft. They are kept with your account for 90 days and then
            deleted automatically; survey answers are kept.
          </P>
          <P>
            The survey at jobsviadraft.com/survey needs no account. It records your name, your email and your answers, and
            the address you sent them from only long enough to stop more than a few submissions an hour. We use your email
            only to follow up on that survey and to tell you when draft is ready for you; we never share it. One response is
            kept per email: answering again replaces your earlier answers.
          </P>
        </PolicySection>

        {/* How We Use Your Data */}
        <PolicySection title="How We Use Your Data">
          <UL>
            <LI>To provide the resume builder, ATS scoring, and job search features.</LI>
            <LI>To save your work and sync it across devices.</LI>
            <LI>To authenticate you securely.</LI>
            <LI>
              To send account emails: a password-reset link when you ask for one, a one-time code that
              confirms a new email address when you change yours, and <Strong>service notices</Strong> —
              about this policy, the terms or the service — sent to every account they concern. A service
              notice says why you are receiving it, and it is not marketing.
            </LI>
            <LI>
              <Strong>Product news, only if you ask for it.</Strong> An optional box at sign-up — unticked
              unless you tick it, and separate from accepting the terms — or Settings → Account → Product
              news. We record when and where you said yes. Every product email would carry a one-click
              unsubscribe link, and switching it off never stops account emails. We have not sent any yet.
            </LI>
            <LI>
              To improve the service using aggregate, anonymized usage patterns only.
            </LI>
            <LI>
              We do <Strong>not</Strong> use your resume content or job data
              to train AI models.
            </LI>
          </UL>
          {/* D68: the Chrome Web Store User Data Policy's Limited Use affirmation — required wording. */}
          <P>
            The browser extension's use of information it receives adheres to the{" "}
            <Strong>Chrome Web Store User Data Policy, including the Limited Use requirements</Strong>.
            We use that information only to provide the extension's features described above; we do
            not sell it, do not use or transfer it for advertising, credit-worthiness or lending,
            and do not let people read it except with your consent, for security purposes, to comply
            with the law, or in aggregated and anonymised form for running the service.
          </P>
        </PolicySection>

        {/* Data Storage & Security */}
        <PolicySection title="Data Storage and Security">
          <P>
            Your data is stored on servers hosted by Railway (railway.app). Data is encrypted
            in transit via TLS. Passwords are hashed using bcrypt. Session tokens are stored
            server-side only. LinkedIn access tokens are discarded after the OAuth flow and
            are not written to the database or logs.
          </P>
          <P>
            We retain your data for as long as your account is active. If you delete your
            account, all associated data is permanently deleted within 30 days.
          </P>
          {/* D90 (10-10): services/baseResumeHistory.js — every distinct upload kept; migration 157. */}
          <P>
            We keep each résumé you upload — not only the newest — so a tailored résumé can always be compared
            with the one it was made from. Uploading the same résumé again adds nothing. They are deleted with
            your account.
          </P>
          {/* D96 §4 (J8, J4): services/answerLifecycle.js, migration 164; extension/answerMemory.js. */}
          <P>
            When you acknowledge an answer on an application page — or type one and keep "Remember for next
            time" ticked — the extension sends it to your account and draft remembers it: the question as the
            form words it, the type of control and its options, your answer, the date you acknowledged it and
            whether you typed it or confirmed a prepared value. It is used to fill the same question next time.
            This includes eligibility and voluntary-disclosure answers you choose to acknowledge. If you change
            a remembered answer, draft records the change (the previous and the new value, when, and which job)
            and stops using the old value; the new value is not remembered until you acknowledge it. Terms,
            consent, privacy-notice, attestation and signature boxes, passwords, payment details and social
            security numbers are never remembered. You can see, edit and delete every remembered answer and its
            history in Settings → Saved answers; deleting an answer deletes its history. Remembered answers and
            their history are included in your account export and are deleted with your account.
          </P>
          {/* D98 (J3): services/extensionResume.js, services/resumePdfArtifacts.js, migrations 165–166. */}
          <P>
            When you generate a résumé from the extension and attach it to an application page, we keep the PDF
            file you attached, linked to that job — and, once you record the application, to that application —
            so you can see exactly what you sent. It is deleted with the job's résumé, with the application
            record, or with your account. We also keep a short record of each request (the job, when it was
            made, whether it finished, and whether it used one of your drafts) — never the posting page's
            content.
          </P>
          {/* D88 P3 (39d): services/tickets.js — retention RETENTION_SECONDS, the cascade in migration 156. */}
          <P>
            If you contact support from Settings → Help, we keep your request and the replies, with the page you
            were on and the app's version — never your profile or form answers. A request is deleted with your
            account, or 24 months after it is solved. Replies come by email from support@jobsviadraft.com.
            When we change something on your account for you (your allowance, your plan, a suspension), we keep
            a record of the change and why it was made.
          </P>
          {/* D53 (10-07): the Draft House bin — services/draftBin.js, purgeSweep scheduled in server.js. */}
          <P>
            An application you clear in Home stays in its Cleared bin for 7 days, where you can
            restore it. After 7 days its prepared answers, handoff and screenshot are deleted. You can
            delete one sooner with Delete now. An application you have sent is never cleared.
          </P>
          {/* ⭐ D100 / D103 / D112 — PENDING_D100_D103.md §3, with the owner's 180 days. */}
          <P>
            A sealed portal session or portal-account password is kept until you remove it (or the session
            expires at the portal); removing it destroys the key, and it is deleted with your account. The fields
            an application filled are kept with the application. Inbox messages, forwarded or read from Gmail,
            are deleted 180 days after they arrive; the log of verification-code reads (which message, which
            portal, when) is kept with your account. Disconnecting Gmail deletes draft's Google token. All of it
            is deleted with your account.
          </P>
        </PolicySection>

        {/* Third-Party Services */}
        <PolicySection title="Third-Party Services">
          <P>We use the following third-party services:</P>
          <UL>
            <LI>
              <Strong>Railway</Strong> — infrastructure hosting. Subject to Railway's
              privacy policy.
            </LI>
            <LI>
              <Strong>Resume Master</Strong> (resumemaster.one) — our résumé tools service. It is a
              separate service that we operate, and it is what generates, enhances and formats
              résumés. When you use one of those features, the material it needs is sent to it:
              your résumé text, the profile details the
              résumé draws on (your name, contact details, stated years of experience, job profile
              and any skills you have claimed) and the job description. It{" "}
              <Strong>processes that and returns the result; it does not store it</Strong> — it has
              no database, and it records only token counts for each request, never its content.
              It sends the material to Anthropic for the model step, below. It does{" "}
              <Strong>not</Strong> read résumé PDFs you upload: our own server extracts their text,
              and the PDF is not sent anywhere.
            </LI>
            <LI>
              <Strong>Anthropic</Strong> — the AI model behind three features, and only these.
              Résumé generation and enhancement: your résumé, the profile details it draws on and
              the job description, through our résumé tools service above. Cover letters: the
              text of your résumé, the job title and company, the job description and the tone you
              pick, sent from our server directly to Anthropic, not through the tools service. "Load more AI
              suggestions" in the job-profile setup: the domain and role family you picked, and the
              keywords, action verbs and tools you have already chosen, so the suggestions don't
              repeat them. Nothing else is sent to Anthropic. ATS scoring runs on our own server. Anthropic does
              not use API inputs to train models.
            </LI>
            <LI>
              <Strong>Your own ChatGPT or Claude</Strong> (optional, and off unless you turn it on in
              Settings → Integrations → Connected apps, then connect the app yourself from inside it) — the
              app writes a tailored résumé on your own account, and we check and save what it returns. When
              it asks, we give it your base résumé's work history and skills <Strong>without your contact
              details</Strong>, the skills you have claimed, and the job's title, company, level, location
              and the keywords your résumé matched. It can also search the jobs on your draft board, read a
              job's public posting, and see the ATS scores draft has worked out for you. If you use draft through ChatGPT or Claude, that résumé
              content and those job details are processed by that provider{" "}
              <Strong>under your own account and its terms</Strong>, not ours. The app never receives your
              contact details, passwords, applications or other jobs. We make no model call for these
              résumés, and we never use what the app sends or receives to train a model. To check what the
              app returns, we keep a copy of your base résumé with each request and empty it a day after the
              request is finished; the record of each request (which tool, which job, the outcome — never the
              résumé text) is kept for 12 months. Disconnect the app in the same settings and its next request
              is refused.
            </LI>
            <LI>
              <Strong>SerpApi</Strong> — job search results. Search queries are
              sent to SerpApi's servers; no personal data is included in search queries.
            </LI>
            <LI>
              <Strong>Adzuna</Strong> — job listings via their official publisher API. Your search
              terms and filters are sent to Adzuna when you search; no personal data is included.
            </LI>
            <LI>
              <Strong>Resend</Strong> — sends our account emails (the password-reset link, the new-address
              code and service notices above). It receives your email address and that message, and tells us
              when an address bounces or reports a message as spam, so that we stop sending to it. If you turn on
              the Application Inbox, Resend also receives the mail forwarded to your inbox address and passes it
              to us.
            </LI>
            {/* ⭐ D100 — the apply worker's service (its own Railway project; holds the session keys, no database credentials). */}
            <LI>
              <Strong>Our apply service</Strong> (only if you use Applying for You) — a separate service we run,
              on Railway in its own project. It holds the keys to your sealed portal sessions and opens them only
              while it applies for you; it holds no database credentials.
            </LI>
            <LI>
              <Strong>Employer portals you apply to</Strong> — receive what an application sends them (your
              answers and résumé), as they would if you applied by hand.
            </LI>
            {/* ⭐ D112 item 2 — Google OAuth for gmail.readonly. */}
            <LI>
              <Strong>Google (Gmail)</Strong> (optional, only if you connect Gmail) — Google signs you in and
              gives draft read-only access to your Gmail; draft sends Google only the search for the matching
              messages described under Connecting Gmail, and its requests for those messages.
            </LI>
            {/* ⭐ D112 item 8 — the browsers' own push services (services/webPush.js PUSH_HOSTS). */}
            <LI>
              <Strong>Your browser's push service</Strong> (only if you turn on push notifications) — Google, Mozilla,
              Microsoft or Apple, depending on your browser, delivers each push message. The message is encrypted to
              your browser, so the push service sees only that a message was sent.
            </LI>
            <LI>
              <Strong>Cloudflare Email Routing</Strong> — receives mail you send to {CONTACT_EMAIL} or{" "}
              {SUPPORT_EMAIL} and forwards it to the inbox we read. It handles the message as you wrote it,
              including your address; we send nothing to it ourselves.
            </LI>
            <LI>
              <Strong>Job boards we search directly</Strong> — Greenhouse, Lever, Ashby, Workday,
              SmartRecruiters, Workable and Recruitee. When you run a job search we query these
              boards' public APIs, which means your search terms and filters reach them. No
              personal data is included, and nothing about your resume, profile or saved jobs is
              sent.{" "}
              {/* ⭐ owner-approved line, 11-08: the crawl's sources. */}
              We collect public job postings from employers' career sites and job boards, including
              Greenhouse, Lever, Ashby, BambooHR, Gem and Rippling. We don't send your information to
              these boards unless you apply to a job through them.
            </LI>
            <LI>
              <Strong>DuckDuckGo Icons</Strong> — company logo images. We build a logo address
              from the company's own domain and your browser loads the image from DuckDuckGo, so
              DuckDuckGo sees that request the way it sees any image request. Only the company
              domain is in the address; we send them no data about you. This replaced the Clearbit
              Logo API, which the operator shut down; we send Clearbit nothing at all any more.
              When a company's own site has no usable icon, our server may also fetch it once from
              Google's public favicon service; that request carries only the company's domain,
              never anything about you, and the image is then stored and served by us.
            </LI>
            <LI>
              <Strong>LinkedIn OAuth</Strong> (optional) — if you choose to sign in
              with LinkedIn, LinkedIn provides your name and email to us under their OAuth
              terms. We do not receive any other LinkedIn data.
            </LI>
          </UL>
          <P>
            <Strong>Web fonts are served from our own origin, and Google Fonts is not used.</Strong>{" "}
            Until September 15, 2026 the four typefaces this site uses — Barlow Condensed, DM Sans,
            Instrument Serif and Inter — were downloaded from Google Fonts by your browser on every
            page. That meant Google received your IP address and browser user-agent every time you
            visited, including on this page, and this policy did not tell you so. The fonts are now
            part of the site itself: nothing is requested from fonts.googleapis.com or
            fonts.gstatic.com, and no page you visit sends Google anything for fonts (Google is reached
            only if you connect Gmail, above). It is named here
            because it was a real recipient until that
            date, and because a reader who checks what this page loads should find it accounted for.
          </P>
        </PolicySection>

        {/* Your Rights */}
        <PolicySection title="Your Rights">
          <UL>
            <LI>
              <Strong>Access:</Strong> You can view data we hold about you
              in your account settings.
            </LI>
            <LI>
              <Strong>Export:</Strong> You can export your resumes and job list
              at any time.
            </LI>
            <LI>
              <Strong>Delete:</Strong> You can delete your account and all
              associated data from account settings or by emailing us.
            </LI>
            <LI>
              <Strong>Correction:</Strong> You can update your profile information
              at any time.
            </LI>
            <LI>
              <Strong>GDPR / CCPA:</Strong> If you are located in the EU or
              California, you have additional rights under GDPR and CCPA respectively.
              Contact us to exercise these rights.
            </LI>
          </UL>
        </PolicySection>

        {/* Cookies */}
        <PolicySection title="Cookies">
          <P>
            We use a single session cookie to keep you logged in. This cookie is HttpOnly
            and Secure — JavaScript cannot read it. We do not use advertising cookies,
            tracking pixels, or third-party analytics cookies.
          </P>
        </PolicySection>

        {/* Children */}
        <PolicySection title="Children's Privacy">
          <P>
            {BRAND} is not directed at children under 13. We do not knowingly collect
            data from anyone under 13. If you believe a child has provided us data, contact
            us and we will delete it promptly.
          </P>
        </PolicySection>

        {/* Changes */}
        <PolicySection title="Changes to This Policy">
          <P>
            We may update this policy from time to time. The "Effective" date at the top reflects
            when the current version took effect.
          </P>
          <P>
            If we make a <Strong>material change to how we handle your data</Strong> — collecting
            something new, using it for a new purpose, or sharing it with someone new — we will
            tell registered users by email <Strong>before that change takes effect</Strong>, and
            we will not apply it retroactively to data already collected under an earlier version
            of this policy. This applies to the browser extension as well as the website: if a new
            version of the extension would collect something this policy does not already
            describe, the policy is updated and users are notified first.
          </P>
        </PolicySection>

        {/* Contact */}
        <section style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: "24px 28px",
          marginBottom: 40,
        }}>
          <h2 style={{
            fontSize: ts(18), fontWeight: 400, color: "var(--color-text)",
            marginBottom: 12, fontFamily: "var(--font-display)",
          }}>
            Contact Us
          </h2>
          <P>Questions about this policy or your data:</P>
          <a href={`mailto:${CONTACT_EMAIL}`} style={{
            display: "inline-block",
            fontSize: ts(14), fontWeight: 600,
            color: "var(--color-primary-text)", textDecoration: "none",
            borderBottom: "1px solid transparent",
            transition: "border-color 180ms ease",
          }}
          onMouseEnter={e => e.currentTarget.style.borderBottomColor = "var(--color-primary)"}
          onMouseLeave={e => e.currentTarget.style.borderBottomColor = "transparent"}>
            {CONTACT_EMAIL}
          </a>
          <P>For help with the app or the extension: <a href={`mailto:${SUPPORT_EMAIL}`}
            style={{ color: "var(--color-primary-text)", fontWeight: 600, textDecoration: "none" }}>{SUPPORT_EMAIL}</a>.</P>
        </section>

        {/* Footer nav */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          paddingTop: 24, borderTop: "1px solid var(--color-border)",
          fontSize: ts(13), color: "var(--color-text-faint)",
        }}>
          <Link to="/" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--color-primary)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--color-text-muted)"}>
            ← Back to {BRAND}
          </Link>
          <span>·</span>
          <Link to="/terms" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--color-primary)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--color-text-muted)"}>
            Terms of Service
          </Link>
          <span>·</span>
          <Link to="/contact" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--color-primary)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--color-text-muted)"}>
            Contact
          </Link>
        </div>

      </main>

      <Footer />
    </div>
  );
}
