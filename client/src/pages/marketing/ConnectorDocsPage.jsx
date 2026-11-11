// client/src/pages/marketing/ConnectorDocsPage.jsx — ⭐ D86 §6 · THE CONNECTOR'S PUBLIC DOCUMENTATION (/docs/claude).
//
// The connector directory requires public documentation: what it is and who it is for, setup, every tool with
// what it reads and writes, what is stored and for how long and who processes it, the daily limit,
// troubleshooting, the AI-assistance notice, how to disconnect, and contacts (docs/CLAUDE_CONNECTOR_COMPLIANCE.md
// §6). ⛔ DR-7: no plan names, prices or "upgrade" here either — this page is part of the listing.
// The tool table is read from the same names the server serves (test/d86ConnectorDocs.test.js holds them equal).
import ScrollDock from "../../components/ScrollDock.jsx";
import { Footer } from "../../components/Footer.jsx";
import { BRAND, SUPPORT_EMAIL, PRIVACY_CONTACT_EMAIL, SECURITY_EMAIL, CANONICAL_ORIGIN } from "../../../../shared/brand.js";
import { BYO_DAILY_CAP_DEFAULT } from "../../../../shared/entitlements.js";
import { PolicySection, P, UL, LI, Strong } from "../../components/PolicyProse.jsx";
import { ts } from "../../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

export const CONNECTOR_URL = `${CANONICAL_ORIGIN}/mcp`;

/** Every tool the connector serves, in plain words. */
export const CONNECTOR_TOOLS = [
  ["draft_search_jobs", "Searches the jobs on your draft board by keyword, location, level and posting age.", "Your board's job listings and your stored ATS scores", "Nothing"],
  ["draft_get_job", "Shows one job's details and a short summary; the posting's text only when asked for.", "One public job posting", "Nothing"],
  ["draft_score_resume_for_job", "Scores your base résumé against one job.", "Your base résumé and one job", "Nothing"],
  ["draft_get_resume_brief", "Gives your assistant what it needs to tailor your résumé for one job.", "Your base résumé (without contact details), your claimed skills, the job's matched keywords", "Nothing"],
  ["draft_submit_resume_patch", "Checks the rewritten bullets and saves the tailored résumé.", "The rewritten bullets", "A new résumé version in your account — never deletes or overwrites one"],
  ["draft_list_my_resumes", "Lists your saved résumés by job and score.", "Your saved résumés' job, score and date — not their content", "Nothing"],
  ["draft_list_my_drafts", "Lists the jobs you queued in draft.", "Your queued jobs' titles and companies", "Nothing"],
];

const cell = { padding: "8px 10px", borderTop: "1px solid var(--color-border)", fontSize: ts(13), color: "var(--color-text-muted)", verticalAlign: "top", textAlign: "left" };

export function ConnectorDocsPage() {
  return (
    <div className="scroll-dock-page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
                  background: "transparent", color: "var(--color-text)", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <ScrollDock variant="marketing" />
      <main style={{ flex: 1, minWidth: 0, width: "100%", maxWidth: 820, margin: "0 auto", padding: "64px 24px", boxSizing: "border-box" }}>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 400, color: "var(--color-text)", marginBottom: 8, lineHeight: 1.1,
                     fontFamily: "var(--font-display)" }}>
          {BRAND} for Claude
        </h1>
        <p style={{ fontSize: ts(13), color: "var(--color-text-faint)", marginBottom: 48 }}>Last updated: October 9, 2026</p>

        <P>
          {BRAND} connects to Claude so you can tailor your résumé to a job on your {BRAND} board in a Claude
          conversation. Claude writes on your own Claude account; {BRAND} supplies your résumé's facts, checks what
          comes back, and saves it. {BRAND} never calls an AI model for these résumés.
        </P>
        <P><Strong>Who it is for:</Strong> people looking for work, preparing their own applications. It is not for employers,
          and it never screens or ranks anyone.</P>

        <PolicySection id="setup" title="Set it up">
          <ol style={{ paddingLeft: 22, margin: "0 0 12px", listStyle: "decimal" }}>
            <LI>In {BRAND}, open <Strong>Settings → Integrations → Connected apps</Strong> and turn on <Strong>Write my résumés in ChatGPT or Claude</Strong>.</LI>
            <LI>In Claude, open <Strong>Settings → Connectors</Strong> and add the {BRAND} connector (or add a custom connector with the URL <code>{CONNECTOR_URL}</code>).</LI>
            <LI>Claude opens {BRAND}'s own sign-in page. Check the account it names, choose whether {BRAND} may save résumés, and press <Strong>Allow</Strong>. Your {BRAND} password never goes to Claude.</LI>
            <LI>Ask Claude, for example: <i>"Tailor my résumé for draft job &lt;id&gt;."</i> The finished résumé appears on that job in {BRAND}.</LI>
          </ol>
        </PolicySection>

        <PolicySection id="tools" title="What each tool reads and writes">
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
              <thead><tr>{["Tool", "What it does", "Reads", "Writes"].map(h => <th key={h} style={{ ...cell, borderTop: 0, fontWeight: 800, color: "var(--color-text)" }}>{h}</th>)}</tr></thead>
              <tbody>
                {CONNECTOR_TOOLS.map(([name, what, reads, writes]) => (
                  <tr key={name} data-tool={name}><td style={cell}><code>{name}</code></td><td style={cell}>{what}</td><td style={cell}>{reads}</td><td style={cell}>{writes}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>No tool applies to a job, contacts an employer or sends anything on your behalf. Claude never receives your
            contact details, passwords, applications or other jobs' data.</P>
        </PolicySection>

        <PolicySection id="checks" title="The checks on every résumé">
          <P>{BRAND} saves a tailored résumé only if it adds no skill, employer, title, date, years of experience or
            seniority that your base résumé or your claimed skills do not already contain. A refused résumé is not
            saved, and Claude is told each reason. A brief allows three attempts and lasts 30 minutes.</P>
        </PolicySection>

        <PolicySection id="data" title="What is stored, for how long, and who processes it">
          <UL>
            <LI><Strong>A saved résumé</Strong> is kept in your account like any other {BRAND} résumé (see the privacy policy for its retention).</LI>
            <LI><Strong>Each request</Strong> is recorded — which tool, which job, the outcome — never the résumé's text. The record is kept for 12 months and is listed in Connected apps.</LI>
            <LI><Strong>While checking a résumé</Strong>, {BRAND} keeps the request's details for a day after it is finished, then empties them.</LI>
            <LI><Strong>Claude</Strong> processes what it reads and writes under <Strong>your own Claude account and Anthropic's terms</Strong>. {BRAND} never uses this content to train a model.</LI>
          </UL>
          <P>The full detail is in the <a href="/privacy">privacy policy</a>.</P>
        </PolicySection>

        <PolicySection id="limit" title="The daily limit">
          <P>Up to {BYO_DAILY_CAP_DEFAULT} résumés a day can be written this way. The count resets at 00:00 UTC. Claude's own
            usage limits for your plan apply too; when Claude cannot finish, <Strong>Write it with {BRAND}</Strong> on the job still works.</P>
        </PolicySection>

        <PolicySection id="ai" title="AI-assisted applications">
          <P>Résumés written this way are AI-assisted. <Strong>Some employers restrict AI-assisted applications — check theirs
            before you apply.</Strong> Read every résumé before you send it.</P>
        </PolicySection>

        <PolicySection id="troubleshooting" title="Troubleshooting">
          <UL>
            <LI><Strong>Claude cannot connect, or sign-in fails:</Strong> check that Connected apps is turned on in {BRAND}, and that you are signed in to the {BRAND} account you meant. Remove the connector in Claude and add it again.</LI>
            <LI><Strong>"Refused — nothing was saved":</Strong> the rewrite named something your résumé does not support. Claude can remove it and resubmit; three attempts per brief.</LI>
            <LI><Strong>"Daily limit reached":</Strong> the count resets at 00:00 UTC.</LI>
            <LI><Strong>"This candidate has no base résumé":</Strong> upload a résumé in {BRAND} first.</LI>
            <LI><Strong>"Could not be scored":</Strong> the posting carries too little detail to score — it is not a poor fit.</LI>
          </UL>
        </PolicySection>

        <PolicySection id="disconnect" title="Disconnect">
          <P>In {BRAND}: <Strong>Settings → Integrations → Connected apps → Disconnect</Strong>. The next request from Claude is refused at
            once. You can also remove the connector in Claude's settings.</P>
        </PolicySection>

        <PolicySection id="security" title="Reporting a security issue">
          <P>Email <a href={`mailto:${SECURITY_EMAIL}`}>{SECURITY_EMAIL}</a> with what you found and how to reproduce it. Please do
            not access other people's data or disrupt the service while testing. We acknowledge reports and keep you told
            of the fix. Our <a href="/.well-known/security.txt">security.txt</a> carries the same contact.</P>
        </PolicySection>

        <PolicySection id="contact" title="Contact">
          <P>Help: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> · Privacy: <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a> · Security: <a href={`mailto:${SECURITY_EMAIL}`}>{SECURITY_EMAIL}</a></P>
        </PolicySection>
      </main>
      <Footer/>
    </div>
  );
}
