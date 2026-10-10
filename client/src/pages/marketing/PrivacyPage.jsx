// client/src/pages/marketing/PrivacyPage.jsx
import { Link } from "react-router-dom";
import ScrollDock from "../../components/ScrollDock.jsx";
import { Footer } from "../../components/Footer.jsx";
import { BRAND, CANONICAL_HOST, LEGACY_HOST, PRIVACY_CONTACT_EMAIL, SUPPORT_EMAIL } from "../../../../shared/brand.js";
import { PolicySection, P, UL, LI, H3, Strong } from "../../components/PolicyProse.jsx";

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
const EFFECTIVE_DATE = 'October 9, 2026';
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
          <p style={{ fontSize: 13, color: "var(--color-text-faint)" }}>
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
            or activity.
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
            <Strong>The extension reads nothing until you invoke it.</Strong> It requests no
            permission for any job site, runs no code on any page automatically, and cannot see what
            you are browsing. When you press its keyboard shortcut or open it from the toolbar, and
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
              recognise whether that page is a supported job posting. When you press{" "}
              <Strong>Read this page</Strong> in the extension's popup (opening the popup alone reads
              nothing), it also sends that one address to {CANONICAL_HOST}, to show you whether the job
              is already on your board and whether an application you drafted is waiting on that
              site; the answer is shown in the popup and not kept by the extension. It cannot see the
              address of any other tab, and it does not record where you go.
            </LI>
            {/* D55 decision B — background.js saveLinkToDraft(), routes/importJob.js POST /link. */}
            <LI>
              If you right-click a link and choose <Strong>Save link to draft</Strong>, the extension
              sends only that link's address to {CANONICAL_HOST} — no page is opened or read. We save
              the job only if the link is to a posting on a job board we read directly, fetching it
              from that board's own listing; we refuse any other link and save nothing.
            </LI>
            <LI>
              If you click <Strong>ATS Score Tool</Strong> in the extension's popup, it copies the
              visible text of the page you are on and opens your {BRAND} ATS Score page with
              the text already filled in. That text travels in the address of the page it opens,
              which means it may appear in our ordinary server logs. Earlier versions also added an
              "ATS Score this job" button into job pages themselves; that button has been removed,
              and the extension no longer changes the appearance of any page except to show you a
              confirmation message after a capture you asked for.
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
              so the question is not which sites it is allowed to read, but which single page you
              chose to point it at.
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
            The extension keeps seven things in your browser's own extension storage. Four are
            ordinary local storage and stay until you uninstall the extension or disconnect it; the
            other three are memory-backed session storage, which your browser discards when you
            restart it. Only one of the seven — the extension's own access token, described last — is
            ever sent anywhere, and it goes only to us. (Earlier versions also stored a custom
            keyboard shortcut; that setting was removed, and any value it left behind is deleted
            when you open the extension's options page. Shortcuts are now managed by Chrome itself.)
          </P>
          <UL>
            <LI>
              <Strong>The result of your most recent capture</Strong> — the job title and whether
              it succeeded — so the popup can show you the outcome of a capture you made with the
              keyboard while the popup was closed. Local storage: overwritten by the next capture,
              and kept until you uninstall the extension.
            </LI>
            <LI>
              <Strong>The prepared answers for an application in progress</Strong>, during a form
              fill only. Session storage: expiring after ten minutes, deleted when that tab closes,
              and gone when you restart your browser.
            </LI>
            <LI>
              <Strong>The result of your most recent form fill</Strong> — whether it succeeded, the
              message you were shown, and which tab it happened in — so the popup can report the
              outcome of a fill you started with the keyboard. Session storage: overwritten by the
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
              <Strong>The account the extension is connected to</Strong> — your username, so the
              popup can tell you whose account a capture would go to before you make one. Local
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
              same browser. You can end it at any time from the extension's popup, or from your
              account, and the extension then holds nothing. Local storage; the ten-minute expiry
              does not apply to it.
            </LI>
            <LI>
              <Strong>Whether automatic capture is switched on</Strong> — a single on/off value,
              nothing else. Local storage: kept until you change it or uninstall the extension. The
              ten-minute expiry does not apply to it.
            </LI>
          </UL>

          {/* ⭐ D64 (owner, 10-07) — automatic capture. extension/autoCapture.js, services/jobs/autoCapture.js. */}
          <H3>Capturing Job Pages Automatically (optional, off by default)</H3>
          <P>
            If you switch on <Strong>Capture job pages automatically</Strong> in the extension's
            settings, Chrome asks you to let the extension read pages on a short list of public job
            sites — Greenhouse, Lever, Ashby and Workable. It never asks for every site, and it does
            not include sites where you sign in to apply. When you open a page on one of those sites:
          </P>
          <UL>
            <LI>
              The extension first checks <Strong>in your browser</Strong> whether the page is a job
              posting. <Strong>If it is not, nothing is sent</Strong> — not the page, not its
              address.
            </LI>
            <LI>
              If it is, the posting's text and web address are sent to us, exactly as a capture you
              press would send them. We check it against your board — whether it is in the United
              States and fits the roles in your active profile. <Strong>If it does not fit, we keep
              nothing</Strong>: not the posting, not its address, not a record that it was sent.
            </LI>
            <LI>
              If it fits, it is added to your board and marked as captured automatically, and the
              extension lists today's automatic captures so you can undo any of them.
            </LI>
            <LI>
              Nothing is filled in or submitted for you. Filling an application still waits for
              your click.
            </LI>
            <LI>
              Switching it off removes the extension's access to those sites. You can also remove
              it from Chrome's own extension settings.
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
              It does <Strong>not</Strong> sign you in, create an account for you, or attempt a
              CAPTCHA, and it never reads or stores any employer's password, session cookie or
              verification code.
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
            {/* D68 (owner, 10-07): the Copy sheet, checked — popup.js renders it with textContent; nothing is injected. */}
            <LI>
              The <Strong>Copy sheet</Strong> shows your own prepared answers — including any
              work-authorisation or voluntary self-identification answers you saved — in the
              extension's popup, to you, while you are signed in. Showing it fills nothing on the
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
            If you press <Strong>Report this form</Strong> in the extension's popup and then{" "}
            <Strong>Send report</Strong>, we receive that site's host name (for example
            jobs.example.com — never the rest of the page address) and the form's field labels,
            never your answers; the report is linked to your account and deleted after 30 days.
          </P>

          <H3>Usage Data</H3>
          <P>
            We collect standard server logs (IP address, browser type, pages visited, timestamps)
            for security and debugging. We do not use third-party analytics services that
            track you across the web.
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
            An application you clear in Draft House stays in its Cleared bin for 7 days, where you can
            restore it. After 7 days its prepared answers, handoff and screenshot are deleted. You can
            delete one sooner with Delete now. An application you have sent is never cleared.
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
              <Strong>Apify</Strong> (optional, and off unless you connect it) — a job-scraping
              service you may link with your own Apify token from your account settings. It is
              <Strong>not</Strong> used by ordinary job search. It is reached only when an
              administrator runs a manual refresh for an account that has connected a token, and
              what is sent is the job titles, locations and filters for that refresh. Your resume,
              your profile and any captured job data are never sent. If you have not connected a
              token, nothing is ever sent to them.
            </LI>
            <LI>
              <Strong>Adzuna</Strong> — job listings via their official publisher API. Your search
              terms and filters are sent to Adzuna when you search; no personal data is included.
            </LI>
            <LI>
              <Strong>Resend</Strong> — sends our account emails (the password-reset link, the new-address
              code and service notices above). It receives your email address and that message, and tells us
              when an address bounces or reports a message as spam, so that we stop sending to it.
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
              sent.
            </LI>
            <LI>
              <Strong>DuckDuckGo Icons</Strong> — company logo images. We build a logo address
              from the company's own domain and your browser loads the image from DuckDuckGo, so
              DuckDuckGo sees that request the way it sees any image request. Only the company
              domain is in the address; we send them no data about you. This replaced the Clearbit
              Logo API, which the operator shut down; we send Clearbit nothing at all any more.
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
            fonts.gstatic.com, and we send Google nothing at all any more. It is named here
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
            fontSize: 18, fontWeight: 400, color: "var(--color-text)",
            marginBottom: 12, fontFamily: "var(--font-display)",
          }}>
            Contact Us
          </h2>
          <P>Questions about this policy or your data:</P>
          <a href={`mailto:${CONTACT_EMAIL}`} style={{
            display: "inline-block",
            fontSize: 14, fontWeight: 600,
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
          fontSize: 13, color: "var(--color-text-faint)",
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
