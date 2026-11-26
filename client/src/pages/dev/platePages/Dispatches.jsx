// ⭐ D197 Wave 2 #18 · M3 (47j, lane w2-outside) — DISPATCHES: draft's emails in the plate tokens (docs/revamp/emails.md).
// Two dispatches as a mail client would show them — an alert (A2 "A quick check", the count-only words) and the D185-2
// digest (A10, new jobs that fit) — each a 600 px email table (plate/Dispatch.jsx, inline styles only inside the email body)
// beside its plain-text part, which is exactly the text the template sends today (services/notify.js) and stays.
// Fixture data only (synthetic companies, example.com links). Nothing here ships.
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { Kickers, StatusTag } from "../../../plate/Marks.jsx";
import { PageTitle, LegHeader } from "../../../plate/Plates.jsx";
import { CodePlate } from "../../../plate/Lists.jsx";
import { Ticket } from "../../../plate/Tickets.jsx";
import { DispatchFrame, DispatchEntry } from "../../../plate/Dispatch.jsx";

const APP = "https://example.com";
const FOOT = ["You chose to get this by email. Change it in draft → Account → Notifications."];

const ALERT_TEXT = ["An application needs a quick check.", "", `Open draft: ${APP}/app/auto-apply?check=4182`, "", FOOT[0]].join("\n");

const JOBS = [
  { id: "kp-221", title: "Frontend Engineer II, Checkout", company: "Kestrel Payments", ago: "2 hours ago", matched: 4, of: 5, sponsor: true },
  { id: "na-118", title: "Software Engineer, Frontend (Dashboards)", company: "Northwind Analytics", ago: "5 hours ago", matched: 4, of: 5, sponsor: false },
  { id: "hr-063", title: "UI Engineer, Fleet Console", company: "Halcyon Robotics", ago: "9 hours ago", matched: 3, of: 5, sponsor: true },
  { id: "bh-407", title: "Software Engineer, Design Systems", company: "Brightline Health", ago: "14 hours ago", matched: 3, of: 5, sponsor: true },
];
const facts = (j) => [`posted ${j.ago}`, `asks for ${j.matched} of your ${j.of} top skills`, j.sponsor ? "has filed H-1B petitions before" : null].filter(Boolean);
const urlOf = (j) => `${APP}/app/jobs?job=${j.id}`;
const DIGEST_TEXT = [
  "New jobs that fit your résumé — companies with an H-1B filing record first.", "",
  ...JOBS.flatMap((j, i) => [`${i + 1}. ${j.title} — ${j.company}`, `   ${facts(j).join(" · ")}`, `   ${urlOf(j)}`, ""]),
  "A filing record is history, not a promise — confirm with the employer. Not legal advice.", "",
  "Daily digest, or as they arrive: draft → Account → Notifications.", "", FOOT[0],
].join("\n");

/** One dispatch beside its plain-text part: the email (600 px) first, the text plate second; they stack below 1100 px. */
function Pair({ n, meta, title, subject, email, text, wide }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <LegHeader n={n} meta={meta} title={title}/>
      <div className="pl-label pl-muted" style={{ overflowWrap: "anywhere" }}>SUBJECT · {subject}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: wide ? "0 0 640px" : "1 1 100%", minWidth: 0, maxWidth: "100%" }} data-dispatch-html="">
          <div className="pl-label" style={{ marginBottom: 8 }}>HTML PART · NEW</div>
          {email}
        </div>
        <div style={{ flex: "1 1 360px", minWidth: 0 }} data-dispatch-text="">
          <div className="pl-label" style={{ marginBottom: 8 }}>PLAIN-TEXT PART · TODAY'S, UNCHANGED</div>
          <CodePlate file="text/plain" lang="UTF-8" code={text}/>
        </div>
      </div>
    </section>
  );
}

export default function DispatchesMock({ width = 1280 }) {
  const wide = width >= 1100;
  const mailWidth = width < 640 ? width - 32 : 600;
  return (
    <PlateRoot region="IV" style={{ minHeight: "100vh", padding: width < 640 ? "20px 16px 64px" : "32px 24px 72px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Kickers parts={["D197 · WAVE 2 · #18", "M3 MOCK", "EXAMPLE DATA"]}/>
          <PageTitle>Dispatches</PageTitle>
          <p className="pl-lead">Every email draft sends, drawn in the plate tokens: paper, ink rules, a serif title, mono labels and one clay action. The plain-text part each one sends today stays word for word.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><StatusTag kind="drafted">NOT SHIPPED</StatusTag><StatusTag kind="new">AWAITING M4</StatusTag></div>
        </header>

        <Pair n={1} meta="ALERT · A2 · THE COUNT-ONLY WORDS (D100 P4)" title="A quick check" wide={wide}
          subject="draft · A quick check" text={ALERT_TEXT}
          email={(
            <DispatchFrame width={mailWidth} kicker="DISPATCH · ALERT · NOV 26"
              title="A quick check" lead="An application needs a quick check."
              action={{ label: "Open in draft →", href: `${APP}/app/auto-apply?check=4182` }}
              smallPrint={["It waits for you — there is no deadline. Nothing was sent."]}
              foot={FOOT}/>
          )}/>

        <Pair n={2} meta="DIGEST · A10 · D185-2 · NEW JOBS THAT FIT" title="New jobs that fit you" wide={wide}
          subject="draft · 4 new jobs fit you" text={DIGEST_TEXT}
          email={(
            <DispatchFrame width={mailWidth} kicker="DISPATCH · DIGEST · NOV 26"
              title="4 new jobs fit you" lead="New jobs that fit your résumé — companies with an H-1B filing record first."
              stats={[{ value: 4, label: "NEW TODAY" }, { value: 3, label: "FILED H-1B" }, { value: 10, label: "DAILY CAP" }]}
              action={{ label: "See them on the market →", href: `${APP}/app/jobs` }}
              smallPrint={["A filing record is history, not a promise — confirm with the employer. Not legal advice.", "Daily digest, or as they arrive: draft → Account → Notifications."]}
              foot={FOOT}>
              {JOBS.map((j, i) => (
                <DispatchEntry key={j.id} n={i + 1} title={j.title} company={j.company} facts={facts(j)}
                  squares={{ of: j.of, lit: j.matched }} links={[{ label: "Open on the market", href: urlOf(j) }]}/>
              ))}
            </DispatchFrame>
          )}/>

        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <LegHeader n={3} meta="THE OTHER DISPATCHES · SAME FRAME" title="Where every other email goes"/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
            <Ticket kicker="PICKS · A6" title="N jobs picked for you" line="Entries with Apply · Pass links; the clay action is Apply to all." go="emails.md · A6"/>
            <Ticket kicker="RUN SUMMARY · A7" title="Apply for me" line="Sent (green — proven) · need you · need a sign-in, one clay Open the ledger." go="emails.md · A7"/>
            <Ticket kicker="ACCOUNT · B1–B5" title="Codes and links" line="The code in a large mono cell or the link as the button; the expiry in mono." go="emails.md · B"/>
            <Ticket kicker="OPERATOR · C1–C6" title="Stays plain text" line="Support and admin mail — owner to confirm at M4." go="emails.md · C"/>
          </div>
        </section>
      </div>
    </PlateRoot>
  );
}
