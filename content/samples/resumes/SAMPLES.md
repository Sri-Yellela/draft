# Sample résumés for testing (D184) — fictional people, real employers

Three one-page PDFs made by the chat assistant on 2026-11-08 (the owner has the PDFs:
`sample-frontend-swe-maya-chen.pdf`, `sample-construction-pm-daniel-okafor.pdf`,
`sample-finance-fpa-elena-marsh.pdf`). **Every person, email (`@example.com`), phone (555)
and profile link (`-sample`) is fictional.** The employers are real Boston-area companies on
purpose, so experience rows can resolve to company records and their technographics (D179).
PDF metadata: `keywords = draft-sample, fictional, test` · `subject = draft sample résumé — a
fictional person, for testing only`.

**Agent (D184 S-1):** register all three as recognised samples in `services/sampleResumes.js`
(fingerprint the text below + the PDF keyword), so the canary scheduler accepts them and their
sends only ever go to the practice form; add them as fixtures for the B-tests; report which of the
six employers resolve to a company record with technographics (Toast, HubSpot, Suffolk Construction,
Shawmut Design and Construction, DraftKings, State Street) — one that doesn't is the unknown-company
path (letter logo, no stack), also worth testing.

## Expected outcomes (the test oracle)

| Résumé | Placement (D179) | Level | Sentence filter after upload |
|---|---|---|---|
| Maya Chen | Software engineering › Frontend | mid (4 yrs, "Software Engineer II") | discovering **frontend software engineering** roles at **mid** levels and **all** workstyles in **Boston** |
| Daniel Okafor | Project and program management › Construction | senior (7 yrs, "Project Manager") | discovering **construction project management** roles at **senior** levels and **all** workstyles in **Boston** |
| Elena Marsh | Business and finance › FP&A and corporate finance | senior ("Senior FP&A Analyst", 5 yrs) | discovering **FP&A and corporate finance** roles at **senior** levels and **all** workstyles in **Boston** |

Switching between any two of them is a **category** change → *Apply for me* pauses with *Keep · Change back* (B-3).
Bold skills in experience bullets (A140): React, TypeScript, Next.js, Storybook, Cypress, GraphQL, Vite… ·
Procore, Primavera P6, Bluebeam Revu, Excel… · Adaptive Insights, SQL, Tableau, NetSuite, Anaplan, Excel…

## Maya Chen — Frontend Software Engineer

```
Maya Chen
Boston, MA · maya.chen@example.com · (617) 555-0134 · github.com/maya-chen-sample · linkedin.com/in/maya-chen-sample

SUMMARY
Frontend software engineer with 4 years building fast, accessible React applications. Shipped design-system
components used across 12 product teams and cut page load times by a third on a high-traffic checkout.

SKILLS
Languages: TypeScript, JavaScript (ES2022), HTML5, CSS3, SQL
Frontend: React, Next.js, Redux Toolkit, React Query, Tailwind CSS, Storybook, Webpack, Vite
Testing: Jest, React Testing Library, Cypress, Playwright
Other: GraphQL, REST APIs, Node.js, Web accessibility (WCAG 2.1 AA), Core Web Vitals, Git, GitHub Actions, Figma

EXPERIENCE
Software Engineer II, Frontend — Toast
Boston, MA · Mar 2023 – Present
• Rebuilt the online-ordering checkout in React and TypeScript with Next.js server rendering; Largest Contentful Paint fell from 3.1 s to 2.0 s.
• Led migration of 140 components into the shared Storybook design system; adopted by 12 product teams.
• Raised React Testing Library and Cypress coverage of checkout flows from 41% to 82%; release rollbacks dropped by half.
• Fixed 60+ WCAG 2.1 AA issues and added automated axe checks to the GitHub Actions pipeline.

Associate Software Engineer — HubSpot
Cambridge, MA · Jul 2021 – Feb 2023
• Built React dashboards for the marketing analytics product, consuming GraphQL APIs with React Query caching.
• Moved the team's build from Webpack 4 to Vite; local dev server start time went from 48 s to 6 s.
• Paired with designers in Figma to ship a responsive email editor used by 30,000+ customers.

EDUCATION
Northeastern University — B.S., Computer Science · Boston, MA · 2021

PROJECTS
a11y-lint-bot — a GitHub App that comments accessibility issues on pull requests (TypeScript, Node.js, axe-core).
```

## Daniel Okafor — Construction Project Manager

```
Daniel Okafor
Boston, MA · daniel.okafor@example.com · (617) 555-0178 · linkedin.com/in/daniel-okafor-sample

SUMMARY
Construction project manager with 7 years delivering commercial and lab projects up to $48M. Runs schedules,
budgets and subcontractors in Procore and Primavera P6; known for closing out on time with clean punch lists.

SKILLS
Project controls: Procore, Primavera P6, Microsoft Project, Bluebeam Revu, Autodesk Construction Cloud, Excel
Delivery: Budgeting and cost control, scheduling, RFIs and submittals, change orders, subcontractor management, owner reporting, closeout
Safety and certifications: OSHA 30, PMP, LEED Green Associate

EXPERIENCE
Project Manager — Suffolk Construction
Boston, MA · Jun 2021 – Present
• Managed a $48M lab and office fit-out from preconstruction to closeout; delivered 2 weeks early and 1.8% under budget.
• Ran RFIs, submittals, daily logs and change orders in Procore across 34 subcontractors; RFI turnaround fell from 9 to 4 days.
• Built and maintained the Primavera P6 baseline schedule; recovered a 3-week steel delay through resequencing.
• Held weekly owner and architect meetings with Procore cost reports and a 3-week look-ahead.

Assistant Project Manager — Shawmut Design and Construction
Boston, MA · Aug 2018 – May 2021
• Supported PMs on $12–25M healthcare and retail projects; owned submittal logs and buyout of 15 trade packages.
• Tracked budgets and forecasts in Excel and Procore; flagged $400K of scope gaps before buyout.
• Marked up drawings in Bluebeam Revu for coordination meetings and punch lists.

EDUCATION
Wentworth Institute of Technology — B.S., Construction Management · Boston, MA · 2018

CERTIFICATIONS
Project Management Professional (PMP), 2023 · OSHA 30-Hour Construction · LEED Green Associate
```

## Elena Marsh — Senior FP&A Analyst

```
Elena Marsh
Boston, MA · elena.marsh@example.com · (617) 555-0151 · linkedin.com/in/elena-marsh-sample

SUMMARY
FP&A analyst with 5 years in forecasting, budgeting and variance analysis for high-growth consumer and
financial-services businesses. Builds driver-based models that leadership actually uses.

SKILLS
Planning and analysis: Forecasting, annual operating plan, variance analysis, driver-based modelling, unit economics, scenario planning
Tools: Excel (advanced: INDEX/MATCH, Power Query), SQL, Adaptive Insights, Anaplan, NetSuite, Tableau, PowerPoint
Corporate finance: Three-statement modelling, DCF, budgeting, board reporting

EXPERIENCE
Senior FP&A Analyst — DraftKings
Boston, MA · Apr 2023 – Present
• Owned the monthly forecast for a $600M marketing budget; built a driver-based model in Adaptive Insights that cut forecast error from 9% to 3%.
• Wrote SQL against the data warehouse to automate cohort revenue reporting; saved 2 days per month-end close.
• Prepared variance analysis and Tableau dashboards for the CFO and quarterly board materials.

Financial Analyst — State Street
Boston, MA · Jul 2020 – Mar 2023
• Supported the annual operating plan for a $1.2B operations cost centre; reconciled actuals in NetSuite and Excel.
• Built a headcount and vendor-spend model in Anaplan used by 8 department heads.
• Produced monthly variance commentary and scenario analyses for senior leadership.

EDUCATION
Boston College — B.S., Finance, Carroll School of Management · Chestnut Hill, MA · 2020

CERTIFICATIONS
CFA Level II candidate · Financial Modeling & Valuation Analyst (FMVA)
```
