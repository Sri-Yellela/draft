// A111 P2 — synthetic postings and résumés for every professional category beyond computing / engineering.
// Every posting, employer, person, school and contact below is INVENTED for draft's tests (example.com, 555-01xx);
// none describes a real person or a real opening. Postings are written the way real ones read — duties, prose and
// requirements — not as keyword lists, so what the scorer extracts from them is a fair reading of the vocabulary.

const contact = (name, city) => `${name}\n${city} | ${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com | (555) 010-0000\n`;

export const PAIRS = [
  // ── business ──────────────────────────────────────────────────────────────────────────────────────────────────
  {
    category: "business", role: "financial analyst",
    posting: { title: "Financial Analyst, FP&A", description: `Halvorsen Home Goods is looking for a Financial Analyst to join our FP&A team. You will own the monthly forecast and annual budget for two business units and partner with operations leaders on the drivers behind the numbers.
What you'll do: build and maintain driver-based financial models; run variance analysis at month-end close and explain budget-to-actual gaps to leadership; prepare the monthly management reporting package; support capital budgeting decisions with NPV and payback analysis; help move our planning from spreadsheets into Anaplan.
What you bring: 2-4 years in FP&A, corporate finance or investment banking; advanced Excel and financial modeling; experience with an ERP such as NetSuite; Power BI or Tableau dashboards; working knowledge of GAAP. CPA or CFA progress is a plus.` },
    resume: contact("Priya Vandermeer", "Columbus, OH") + `
EXPERIENCE
Financial Analyst, Brightwater Foods, Columbus, OH | 2022 - Present
- Own the rolling forecast and annual budget for a $240M division; built driver-based financial models in Excel and Anaplan
- Run variance analysis at month-end close and present budget-to-actual explanations to the VP of Finance
- Built the capital budgeting template (NPV, IRR, payback) used for 12 equipment requests
Financial Analyst Intern, Ridgeway Capital | Summer 2021
- Supported DCF valuation and comparable-company analysis for two middle-market deals

EDUCATION
B.S. Finance, Lakeshore State University | 2022

SKILLS
Finance: financial modeling, forecasting, budgeting, variance analysis, DCF, GAAP, management reporting
Tools: Excel, Anaplan, NetSuite, Power BI, Tableau, SQL
` },
  {
    category: "business", role: "accountant / auditor",
    posting: { title: "Senior Accountant", description: `Corrigan Medical Supply is hiring a Senior Accountant to own key parts of the month-end close. You'll prepare journal entries and account reconciliations, maintain the fixed asset subledger, and work with our external auditors during the annual audit.
Responsibilities: manage month-end and year-end close for assigned entities; prepare balance sheet reconciliations and accruals; maintain SOX controls documentation and test key controls; support revenue recognition under ASC 606 and lease accounting under ASC 842; prepare audit schedules and PBC requests; assist with sales and use tax filings.
Qualifications: Bachelor's in Accounting; CPA preferred; 3+ years of public accounting or corporate accounting experience; strong knowledge of US GAAP; experience with NetSuite or another ERP; BlackLine experience a plus.` },
    resume: contact("Marcus Ellery-Tan", "Tampa, FL") + `
EXPERIENCE
Staff Accountant, Seabright Logistics, Tampa, FL | 2021 - Present
- Close the books monthly for 3 entities: journal entries, accruals, prepaids and balance sheet reconciliations in BlackLine
- Documented and tested 22 SOX controls over the procure-to-pay cycle; zero deficiencies in the last audit
- Led the ASC 842 lease accounting adoption for 40 leases
Audit Associate, Pembrook & Vale CPAs | 2019 - 2021
- Performed audit procedures and prepared audit workpapers for manufacturing and nonprofit clients

EDUCATION
B.S. Accounting, Gulf Coast University | 2019 · CPA (Florida)

SKILLS
Accounting: US GAAP, month-end close, account reconciliations, journal entries, accruals, SOX, ASC 606, ASC 842, external audit
Tools: NetSuite, BlackLine, QuickBooks, Excel
` },
  {
    category: "business", role: "management consultant",
    posting: { title: "Strategy Consultant", description: `Northgate Advisory is a boutique strategy consultancy serving mid-market healthcare and consumer companies. As a Consultant you will work in small case teams on growth strategy, operating model and cost transformation engagements.
You will: structure ambiguous client problems and build issue trees; conduct market sizing and competitive analysis; run customer interviews and synthesize findings; build Excel models and turn analysis into clear PowerPoint storylines; present recommendations to client executives; support business development and proposal writing.
You have: 2+ years at a consulting firm or in corporate strategy; strong financial modeling and market research skills; excellent written and verbal communication; an MBA or equivalent is a plus.` },
    resume: contact("Elena Strauss-Mbeki", "Chicago, IL") + `
EXPERIENCE
Senior Associate, Corbel Partners (strategy consulting), Chicago, IL | 2021 - Present
- Led workstreams on 9 engagements in growth strategy, cost transformation and operating model redesign
- Built market sizing and competitive analysis for a $2B specialty pharmacy client; recommendation adopted by the board
- Ran 40 customer interviews and synthesized them into a pricing strategy that lifted margin 3 points
- Wrote and presented executive readouts; supported 6 proposals in business development
Business Analyst, Corbel Partners | 2019 - 2021

EDUCATION
B.A. Economics, Lakemont College | 2019

SKILLS
Strategy: market sizing, competitive analysis, issue trees, operating model design, cost transformation, pricing strategy
Analysis: financial modeling, market research, customer interviews
Tools: Excel, PowerPoint, Tableau, Alteryx
` },
  {
    category: "business", role: "business analyst",
    posting: { title: "Business Analyst", description: `Wexley Insurance Group is seeking a Business Analyst to bridge our claims operations and technology teams. You will elicit and document business requirements, model current and future-state processes, and help deliver changes to our claims platform.
Key responsibilities: facilitate requirements gathering workshops with stakeholders; write business requirements documents, user stories and acceptance criteria; create process maps (BPMN) and gap analysis; support user acceptance testing and training; analyze data with SQL to size problems and measure outcomes; maintain the product backlog with the product owner.
Requirements: 3+ years as a business analyst; strong requirements elicitation and process mapping skills; SQL; experience with Jira and Visio or Lucidchart; CBAP or ECBA a plus; insurance or financial services experience preferred.` },
    resume: contact("Daniel Okafor-Brandt", "Hartford, CT") + `
EXPERIENCE
Business Analyst, Meridian Mutual, Hartford, CT | 2021 - Present
- Ran requirements gathering workshops for a policy administration upgrade; wrote 140 user stories with acceptance criteria
- Built current-state and future-state process maps in BPMN and Visio and led the gap analysis
- Coordinated user acceptance testing with 30 underwriters; defects at go-live fell by half
- Wrote SQL to measure quote-to-bind times before and after release
Operations Analyst, Meridian Mutual | 2019 - 2021

EDUCATION
B.S. Information Systems, Connecticut Valley University | 2019 · ECBA

SKILLS
Business analysis: requirements elicitation, business requirements documents, user stories, acceptance criteria, process mapping, BPMN, gap analysis, user acceptance testing
Tools: SQL, Jira, Confluence, Visio, Lucidchart, Excel
` },
  {
    category: "business", role: "buyer / procurement",
    posting: { title: "Procurement Specialist", description: `Ashcombe Manufacturing is looking for a Procurement Specialist to manage sourcing for indirect and MRO categories across three plants.
In this role you will: run RFQs and RFPs and evaluate supplier bids; negotiate pricing and contract terms; manage supplier performance and quarterly business reviews; drive strategic sourcing and cost savings initiatives; issue and manage purchase orders in SAP; perform spend analysis to find consolidation opportunities; maintain the approved supplier list.
Qualifications: Bachelor's degree in supply chain, business or related field; 3+ years in purchasing or procurement; experience with SAP Ariba or Coupa; strong negotiation skills; CPSM or CPIM certification preferred.` },
    resume: contact("Rosa Lindqvist-Achebe", "Milwaukee, WI") + `
EXPERIENCE
Buyer, Halden Industrial, Milwaukee, WI | 2020 - Present
- Source MRO, packaging and facilities categories worth $28M a year; ran 35 RFQs and RFPs
- Negotiated supplier contracts that saved $1.9M over two years; ran quarterly business reviews with 12 key suppliers
- Led a spend analysis that consolidated 140 suppliers to 60
- Issue purchase orders and manage the approved supplier list in SAP and Coupa

EDUCATION
B.B.A. Supply Chain Management, Great Lakes University | 2020 · CPSM

SKILLS
Procurement: strategic sourcing, RFQs, RFPs, supplier negotiation, contract terms, spend analysis, supplier performance, purchase orders
Tools: SAP, Coupa, SAP Ariba, Excel, Power BI
` },
  {
    category: "business", role: "compliance analyst",
    posting: { title: "Compliance Analyst, BSA/AML", description: `Thornbury Community Bank is hiring a Compliance Analyst for our BSA/AML program. You will review alerts, investigate unusual activity and help keep our program aligned with regulatory expectations.
Responsibilities: review transaction monitoring alerts and escalate unusual activity; conduct KYC and customer due diligence, including enhanced due diligence for high-risk customers; draft SAR narratives; perform OFAC sanctions screening reviews; support regulatory exams and internal audits; help maintain policies and procedures and compliance training.
Requirements: 2+ years in BSA/AML, KYC or financial crimes compliance; knowledge of the Bank Secrecy Act, USA PATRIOT Act and OFAC; experience with Actimize or Verafin; CAMS certification preferred.` },
    resume: contact("Jonah Whitcombe-Rao", "Charlotte, NC") + `
EXPERIENCE
AML Analyst, Piedmont Federal Bank, Charlotte, NC | 2021 - Present
- Review 60 transaction monitoring alerts a week in Verafin and escalate unusual activity
- Conduct KYC, customer due diligence and enhanced due diligence on high-risk commercial accounts
- Drafted 45 SAR narratives; supported two regulatory exams with no findings
- Run OFAC sanctions screening reviews and update the BSA/AML procedures

EDUCATION
B.A. Criminal Justice, Blue Ridge University | 2021 · CAMS

SKILLS
Compliance: BSA/AML, KYC, CDD, EDD, SAR filing, OFAC sanctions screening, transaction monitoring, regulatory exams
Tools: Verafin, Actimize, Excel
` },
  {
    category: "business", role: "HR specialist",
    posting: { title: "HR Generalist", description: `Linden Health Partners is looking for an HR Generalist to support 400 employees across four clinics. You will be the first point of contact for employee relations questions and run core HR processes end to end.
What you'll do: partner with managers on employee relations, investigations and performance management; administer benefits enrollment and leaves of absence (FMLA, ADA); run new-hire onboarding and maintain employee records in Workday; support annual compensation reviews; keep us compliant with federal and state employment law; prepare HR metrics reports.
What you bring: 3+ years as an HR generalist; working knowledge of FMLA, ADA and FLSA; experience with an HRIS such as Workday or ADP; SHRM-CP or PHR preferred.` },
    resume: contact("Aisha Moreland-Kim", "Denver, CO") + `
EXPERIENCE
HR Generalist, Summit Ridge Senior Living, Denver, CO | 2020 - Present
- HR partner for 350 employees: employee relations, investigations and performance management coaching for managers
- Administer benefits enrollment, FMLA and ADA leaves; cut leave processing time from 9 days to 4
- Run onboarding for 120 hires a year and maintain records in Workday
HR Coordinator, Front Range Staffing | 2018 - 2020

EDUCATION
B.S. Human Resource Management, Colorado Plains University | 2018 · SHRM-CP

SKILLS
HR: employee relations, investigations, performance management, benefits administration, FMLA, ADA, FLSA, onboarding, compensation
Tools: Workday, ADP, Excel
` },
  // ── management ────────────────────────────────────────────────────────────────────────────────────────────────
  {
    category: "management", role: "operations manager",
    posting: { title: "Operations Manager", description: `Brennan Distribution is hiring an Operations Manager for our 300,000 sq ft fulfillment center. You will lead three shifts of associates and supervisors and own safety, quality, productivity and cost for the building.
Responsibilities: lead daily operations across inbound, outbound and inventory control; set and track KPIs for throughput, accuracy and labor productivity; drive continuous improvement using Lean and Six Sigma tools; manage labor planning and the operating budget; partner with transportation and customer service; maintain OSHA compliance and a strong safety culture.
Requirements: 5+ years in warehouse, distribution or manufacturing operations, including 3+ years managing supervisors; experience with a WMS such as Manhattan; Lean Six Sigma Green Belt preferred; bachelor's degree in supply chain or business preferred.` },
    resume: contact("Gareth Abernathy-Osei", "Indianapolis, IN") + `
EXPERIENCE
Operations Manager, Crossroads Fulfillment, Indianapolis, IN | 2019 - Present
- Lead 4 supervisors and 180 associates across inbound, outbound and inventory control
- Raised units per hour 18% with Lean standard work and kaizen events; held order accuracy at 99.8%
- Own a $14M operating budget and weekly labor planning; zero OSHA recordables in 2023
- Rolled out Manhattan WMS slotting changes with the engineering team
Operations Supervisor, Crossroads Fulfillment | 2016 - 2019

EDUCATION
B.S. Supply Chain Management, Hoosier State University | 2016 · Lean Six Sigma Green Belt

SKILLS
Operations: warehouse operations, labor planning, inventory control, KPIs, Lean, Six Sigma, kaizen, OSHA compliance, budget management
Tools: Manhattan WMS, SAP, Excel, Power BI
` },
  {
    category: "management", role: "project / program manager",
    posting: { title: "Project Manager", description: `Calder Energy Services is hiring a Project Manager to lead capital and process-improvement projects across our field operations.
You will: own project scope, schedule and budget from initiation to closeout; build and maintain project plans in MS Project or Smartsheet; manage risks, issues and change requests; lead cross-functional teams and report status to steering committees; manage vendors and contractors; apply PMI best practices and stage-gate reviews.
You have: 5+ years managing projects; PMP certification required; strong stakeholder management and communication; experience with earned value management a plus.` },
    resume: contact("Ingrid Castellanos-Pyle", "Houston, TX") + `
EXPERIENCE
Senior Project Manager, Gulfstream Utilities, Houston, TX | 2019 - Present
- Manage a portfolio of 6 capital projects worth $30M from initiation to closeout
- Built integrated schedules in MS Project and tracked cost with earned value management
- Run steering committees, risk registers and change requests; delivered 5 of 6 projects under budget
Project Coordinator, Gulfstream Utilities | 2016 - 2019

EDUCATION
B.S. Business Administration, Texas Coastal University | 2016 · PMP

SKILLS
Project management: scope management, scheduling, budgeting, risk management, change requests, stakeholder management, stage-gate, earned value management
Tools: MS Project, Smartsheet, Excel, SharePoint
` },
  {
    category: "management", role: "product manager",
    posting: { title: "Product Manager, Consumer Payments", description: `Fenwick Financial is looking for a Product Manager to own our consumer payments experience. You'll define the roadmap, work with design and engineering, and measure outcomes.
What you'll do: own the product roadmap and prioritize the backlog; conduct user research and customer discovery; write PRDs and define success metrics and OKRs; partner with design on prototypes and run A/B tests; work with marketing on go-to-market launches; analyze funnels in Amplitude.
What we're looking for: 3+ years of product management experience; strong analytical skills (SQL a plus); experience shipping consumer products; excellent communication with stakeholders.` },
    resume: contact("Noor Haddad-Fischer", "Austin, TX") + `
EXPERIENCE
Product Manager, Peregrine Banking App, Austin, TX | 2021 - Present
- Own the roadmap for card controls and P2P payments used by 1.2M customers
- Ran customer discovery and user research with 50 customers; wrote PRDs and defined OKRs with engineering and design
- Ran 14 A/B tests on onboarding; activation rose 11%
- Led go-to-market for two launches with marketing; analyze funnels in Amplitude and SQL
Associate Product Manager, Peregrine | 2019 - 2021

EDUCATION
B.S. Economics, Hill Country University | 2019

SKILLS
Product: product roadmap, prioritization, user research, customer discovery, PRDs, OKRs, A/B testing, go-to-market
Tools: Jira, Amplitude, SQL, Figma
` },
  {
    category: "management", role: "general manager",
    posting: { title: "General Manager", description: `Ostrander Hospitality Group is seeking a General Manager for a 180-room full-service hotel. The GM leads all departments and is accountable for guest satisfaction, team engagement and financial results.
Responsibilities: own the hotel's P&L and annual budget; lead department heads across rooms, food and beverage, sales and engineering; drive revenue management with the regional team; improve guest satisfaction scores; hire, coach and develop leaders; ensure brand standards and safety compliance.
Requirements: 7+ years in hotel management including 3+ as GM or assistant GM; P&L responsibility; experience with Opera PMS; a hospitality degree is preferred.` },
    resume: contact("Victor Halloran-Diaz", "Nashville, TN") + `
EXPERIENCE
General Manager, Riverbend Hotel (210 rooms), Nashville, TN | 2019 - Present
- Accountable for a $19M P&L; grew GOP margin 4 points through labor planning and revenue management
- Lead 7 department heads across rooms, food and beverage, sales and engineering
- Raised guest satisfaction scores from 82 to 89; cut manager turnover by a third
Assistant General Manager, Lakeside Inn | 2015 - 2019

EDUCATION
B.S. Hospitality Management, Cumberland University | 2015

SKILLS
Management: P&L management, budgeting, revenue management, guest satisfaction, team leadership, brand standards
Tools: Opera PMS, Excel
` },
  // ── marketing ─────────────────────────────────────────────────────────────────────────────────────────────────
  {
    category: "marketing", role: "digital marketing manager",
    posting: { title: "Digital Marketing Manager", description: `Juniper Outdoor Co. is hiring a Digital Marketing Manager to grow our e-commerce business. You'll own paid search, paid social, email and SEO and report on what each channel returns.
You will: plan and manage paid search and paid social budgets in Google Ads and Meta Ads; own SEO strategy and keyword research with Semrush; build email and lifecycle campaigns in Klaviyo; run A/B tests on landing pages to improve conversion rate; report on ROAS, CAC and attribution in Google Analytics 4; brief creative and copy with the brand team.
You have: 4+ years in digital marketing or growth marketing; hands-on with Google Ads, Meta Ads and GA4; e-commerce experience; strong analytical skills.` },
    resume: contact("Chloe Brandvold-Asante", "Portland, OR") + `
EXPERIENCE
Digital Marketing Manager, Cascade Running Supply, Portland, OR | 2021 - Present
- Manage a $3M paid media budget in Google Ads and Meta Ads; ROAS up from 3.1 to 4.4
- Own SEO: keyword research in Semrush and Ahrefs; organic sessions up 70% in 18 months
- Built lifecycle email flows in Klaviyo worth 22% of online revenue
- Run A/B tests on landing pages and report CAC and attribution in Google Analytics 4
Marketing Specialist, Cascade Running Supply | 2019 - 2021

EDUCATION
B.A. Marketing, Willamette State University | 2019

SKILLS
Marketing: paid search, paid social, SEO, SEM, email marketing, conversion rate optimization, A/B testing, marketing attribution
Tools: Google Ads, Meta Ads, Google Analytics, Semrush, Ahrefs, Klaviyo, HubSpot
` },
  // ── sales ─────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    category: "sales", role: "account executive",
    posting: { title: "Account Executive, Mid-Market", description: `Larkspur Software sells workforce scheduling to healthcare and retail organizations. We're hiring a Mid-Market Account Executive to run full-cycle sales.
What you'll do: prospect and build pipeline with your SDR; run discovery calls and product demos; manage a full sales cycle from first meeting to close; build mutual action plans and navigate procurement; forecast accurately in Salesforce; consistently meet or exceed quota.
What you bring: 3+ years of B2B SaaS closing experience; a record of quota attainment; experience with MEDDIC or a similar sales methodology; Salesforce, Gong and Outreach.` },
    resume: contact("Brandon Iwasaki-Clarke", "Atlanta, GA") + `
EXPERIENCE
Account Executive, Mid-Market, Tallowfield HR Software, Atlanta, GA | 2021 - Present
- Closed $1.4M in new ARR in 2023 (128% of quota); President's Club
- Run the full sales cycle: discovery, product demos, mutual action plans, procurement and close
- Qualify with MEDDIC; forecast in Salesforce and review calls in Gong
Sales Development Representative, Tallowfield | 2019 - 2021
- Booked 25 qualified meetings a month through cold calling and Outreach sequences

EDUCATION
B.B.A. Marketing, Peachtree University | 2019

SKILLS
Sales: full-cycle sales, prospecting, discovery calls, product demos, pipeline management, forecasting, quota attainment, MEDDIC, negotiation
Tools: Salesforce, Gong, Outreach, LinkedIn Sales Navigator
` },
  {
    category: "sales", role: "sales representative",
    posting: { title: "Territory Sales Representative", description: `Abbott & Rhee Dental Supply is looking for a Territory Sales Representative to grow accounts with dental practices across Northern Virginia.
Responsibilities: manage and grow a territory of existing accounts while prospecting new practices; conduct in-person sales calls and product demonstrations; develop account plans and hit quarterly sales targets; log activity and pipeline in Salesforce; work trade shows and lunch-and-learns; partner with service technicians on equipment sales.
Requirements: 2+ years of outside B2B sales; proven territory management and account management; a valid driver's license; dental or medical sales experience preferred.` },
    resume: contact("Leah Santangelo-Burke", "Richmond, VA") + `
EXPERIENCE
Territory Sales Representative, Coastal Medical Products, Richmond, VA | 2021 - Present
- Grew a 140-account territory 19% year over year; 112% of annual sales target
- Run 15 in-person sales calls and product demonstrations a week; built account plans for the top 30 practices
- Prospected 22 new practices through lunch-and-learns and trade shows; manage pipeline in Salesforce
Inside Sales Representative, Coastal Medical Products | 2019 - 2021

EDUCATION
B.S. Business, James River University | 2019

SKILLS
Sales: territory management, account management, prospecting, outside sales, product demonstrations, pipeline management, negotiation
Tools: Salesforce, Excel
` },
  // ── legal ─────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    category: "legal", role: "lawyer",
    posting: { title: "Corporate Associate Attorney", description: `Whitlock Barrow LLP is seeking a corporate associate with 3-5 years of experience to join our transactional practice.
The associate will: draft and negotiate purchase agreements, merger agreements and ancillary documents for M&A transactions; lead due diligence reviews and prepare disclosure schedules; advise clients on corporate governance and entity formation; draft board resolutions and stockholder consents; support venture capital financings.
Qualifications: J.D. from an accredited law school; admission to the Massachusetts bar; 3-5 years of corporate transactional experience at a law firm; strong drafting and legal research skills (Westlaw).` },
    resume: contact("Samuel Okonkwo-Reyes", "Boston, MA") + `
EXPERIENCE
Corporate Associate, Ashford & Lyle LLP, Boston, MA | 2020 - Present
- Drafted and negotiated purchase agreements and merger agreements for 15 M&A transactions up to $400M
- Led due diligence reviews and prepared disclosure schedules; drafted board resolutions and stockholder consents
- Advised startups on entity formation, corporate governance and venture capital financings

EDUCATION
J.D., Bay State School of Law | 2020 · Admitted to the Massachusetts bar
B.A. Political Science, New England College of Arts | 2017

SKILLS
Legal: M&A, contract drafting, contract negotiation, due diligence, corporate governance, venture capital financings, legal research
Tools: Westlaw, LexisNexis, iManage
` },
  {
    category: "legal", role: "paralegal",
    posting: { title: "Litigation Paralegal", description: `Pryor Castellan PC is hiring a Litigation Paralegal to support attorneys in commercial litigation from pleadings through trial.
Responsibilities: draft discovery requests and responses; manage document productions and privilege logs; run e-discovery review in Relativity; e-file pleadings in state and federal courts and maintain the litigation calendar; prepare deposition and trial binders; cite-check briefs; conduct legal research in Westlaw.
Requirements: paralegal certificate or bachelor's degree; 3+ years of litigation paralegal experience; experience with Relativity, PACER and e-filing; strong organization.` },
    resume: contact("Megan Talbot-Nguyen", "Philadelphia, PA") + `
EXPERIENCE
Litigation Paralegal, Harrow & Quince LLP, Philadelphia, PA | 2020 - Present
- Support 4 attorneys in commercial litigation: discovery requests and responses, document productions, privilege logs
- Run e-discovery review sets in Relativity; e-file in state and federal court through PACER; keep the litigation calendar
- Prepare deposition and trial binders and cite-check briefs
Legal Assistant, Harrow & Quince LLP | 2018 - 2020

EDUCATION
Paralegal Certificate, Delaware Valley College | 2018 · B.A. English, Keystone University | 2017

SKILLS
Litigation: discovery, document production, privilege logs, e-discovery, e-filing, litigation calendar, cite-checking, legal research
Tools: Relativity, PACER, Westlaw, Clio
` },
  {
    category: "legal", role: "contracts manager",
    posting: { title: "Contracts Manager", description: `Ellsworth Biotech is looking for a Contracts Manager to own the drafting, review and negotiation of commercial agreements.
You will: draft, review and negotiate NDAs, master services agreements, statements of work and clinical trial agreements; maintain contract templates and a clause library; manage the contract lifecycle in our CLM (Ironclad); track obligations and renewals; escalate risk to the legal team; train business teams on contracting process.
Requirements: 5+ years of contract management experience, in life sciences preferred; strong knowledge of commercial contract terms (indemnification, limitation of liability, IP); experience with a CLM system; a paralegal certificate or J.D. is a plus.` },
    resume: contact("Oliver Petrakis-Lund", "San Diego, CA") + `
EXPERIENCE
Contracts Manager, Torrey Pines Diagnostics, San Diego, CA | 2019 - Present
- Draft, review and negotiate 300 agreements a year: NDAs, master services agreements, statements of work, clinical trial agreements
- Built the contract templates and clause library; cut average turnaround from 21 days to 9
- Manage the contract lifecycle in Ironclad and track obligations and renewals
Contracts Specialist, Coastline CRO | 2016 - 2019

EDUCATION
B.A. Legal Studies, Pacific Coast University | 2016 · Paralegal Certificate

SKILLS
Contracts: contract drafting, contract negotiation, contract lifecycle management, NDAs, MSAs, SOWs, clinical trial agreements, indemnification, limitation of liability
Tools: Ironclad, DocuSign, Salesforce
` },
  // ── arts & media ──────────────────────────────────────────────────────────────────────────────────────────────
  {
    category: "arts_media", role: "UX / graphic designer",
    posting: { title: "Product Designer", description: `Marlow Health is hiring a Product Designer to shape our patient app. You will own design end to end, from research and flows through high-fidelity UI and handoff.
What you'll do: run user research and usability testing; create user flows, wireframes and interactive prototypes in Figma; contribute to and extend our design system; design accessible interfaces that meet WCAG 2.1 AA; partner with product managers and engineers; present work in design critiques.
What you bring: 3+ years of product design experience; a portfolio showing interaction design and visual design; expert in Figma; experience with design systems and accessibility.` },
    resume: contact("Isla Montgomery-Achterberg", "Seattle, WA") + `
EXPERIENCE
Product Designer, Kestrel Telehealth, Seattle, WA | 2021 - Present
- Own end-to-end design for the appointment and messaging flows used by 400K patients
- Run user research and usability testing; turn findings into user flows, wireframes and prototypes in Figma
- Extended the design system with 30 components that meet WCAG 2.1 AA
Visual Designer, Brightline Studio | 2019 - 2021
- Brand identity, typography and illustration work for 12 clients in Illustrator and Photoshop

EDUCATION
B.F.A. Graphic Design, Puget Sound School of Art | 2019

SKILLS
Design: interaction design, visual design, user research, usability testing, wireframing, prototyping, design systems, accessibility, typography
Tools: Figma, Illustrator, Photoshop, InDesign, Maze
` },
  {
    category: "arts_media", role: "content writer",
    posting: { title: "Content Writer", description: `Pinecrest Software is looking for a Content Writer to produce the articles, guides and case studies that bring buyers to us.
You will: write long-form blog posts, ebooks and customer case studies; interview subject-matter experts and customers; optimize content for SEO with keyword research; manage the editorial calendar; edit and proofread to AP style; publish in WordPress and measure performance.
You have: 3+ years of content writing or journalism; a portfolio of published B2B writing; strong editing skills and command of AP style; SEO experience; familiarity with WordPress and Google Analytics.` },
    resume: contact("Theo Ravensworth-Ali", "Minneapolis, MN") + `
EXPERIENCE
Content Writer, Northstar SaaS, Minneapolis, MN | 2021 - Present
- Write 6 long-form blog posts and one ebook a month; organic traffic up 2.4x in two years
- Interview customers for 20 case studies; manage the editorial calendar and publish in WordPress
- Edit and proofread to AP style; keyword research and on-page SEO with Semrush
Reporter, Lakes Region Gazette | 2018 - 2021
- Covered business and local government; 400 published articles

EDUCATION
B.A. Journalism, Twin Rivers University | 2018

SKILLS
Writing: content writing, copywriting, editing, proofreading, AP style, case studies, SEO, editorial calendar, interviewing
Tools: WordPress, Google Analytics, Semrush, HubSpot
` },
  {
    category: "arts_media", role: "PR / communications",
    posting: { title: "Communications Manager", description: `Halcyon Clean Energy is seeking a Communications Manager to lead media relations and corporate communications.
Responsibilities: develop and execute PR campaigns and communications plans; pitch stories and build relationships with reporters; write press releases, executive talking points and internal communications; manage crisis communications with leadership; own social media strategy and monitor coverage in Cision and Meltwater; measure share of voice.
Qualifications: 5+ years in public relations, agency or in-house; strong media relations network; excellent writing in AP style; crisis communications experience; a degree in communications, journalism or public relations.` },
    resume: contact("Grace Donnelly-Osei", "Denver, CO") + `
EXPERIENCE
Senior PR Manager, Summit Public Relations (agency), Denver, CO | 2019 - Present
- Lead PR campaigns and media relations for 6 energy and climate clients; 300 earned media placements in 2023
- Write press releases, executive talking points and bylines; managed crisis communications during two product recalls
- Track coverage and share of voice in Cision and Meltwater; run social media strategy for two clients
Account Executive, Summit Public Relations | 2016 - 2019

EDUCATION
B.A. Communications, Rocky Mountain University | 2016

SKILLS
Communications: media relations, press releases, crisis communications, internal communications, PR campaigns, social media strategy, AP style
Tools: Cision, Meltwater, Muck Rack, Hootsuite
` },
  // ── science ───────────────────────────────────────────────────────────────────────────────────────────────────
  {
    category: "science", role: "research scientist",
    posting: { title: "Scientist, Cell Biology", description: `Arden Therapeutics is hiring a Scientist to join our cell biology group advancing antibody therapeutics for autoimmune disease.
You will: design and execute cell-based assays to characterize lead molecules; run flow cytometry, ELISA and qPCR; culture primary cells and cell lines; analyze data in GraphPad Prism and FlowJo; maintain detailed records in an electronic lab notebook; present results at team meetings and contribute to publications.
Requirements: Ph.D. in cell biology, immunology or a related field, plus 0-3 years of postdoctoral or industry experience; hands-on expertise in cell culture, flow cytometry and assay development; strong publication record.` },
    resume: contact("Dr. Mei-Lin Halvorsen", "Cambridge, MA") + `
EXPERIENCE
Postdoctoral Fellow, Charles River Institute of Immunology, Boston, MA | 2021 - Present
- Developed cell-based assays to measure T-cell activation; ran multi-color flow cytometry and analyzed in FlowJo
- Cultured primary human cells and cell lines; ran ELISA and qPCR for cytokine readouts; statistics in GraphPad Prism
- 4 first-author publications; presented at two international conferences

EDUCATION
Ph.D. Immunology, Northeastern Plains University | 2021

SKILLS
Laboratory: cell culture, flow cytometry, ELISA, qPCR, Western blot, assay development, primary cells
Tools: FlowJo, GraphPad Prism, ImageJ, Benchling
` },
  {
    category: "science", role: "lab scientist",
    posting: { title: "QC Chemist", description: `Pellham Pharmaceuticals is hiring a QC Chemist for our GMP quality control laboratory.
Responsibilities: perform release and stability testing of raw materials and finished products by HPLC, GC and dissolution; follow SOPs and USP methods; document results under GMP and GDP; investigate OOS and OOT results; support method validation and method transfer; maintain and calibrate laboratory instruments; review data in Empower and LIMS.
Requirements: B.S. in chemistry or related science; 2+ years in a GMP quality control laboratory; hands-on HPLC with Empower; knowledge of cGMP, GLP and USP.` },
    resume: contact("Rahul Desrosiers-Kato", "Raleigh, NC") + `
EXPERIENCE
QC Analyst II, Triangle Generics, Durham, NC | 2021 - Present
- Run release and stability testing on HPLC, GC and dissolution under cGMP; review data in Empower and LIMS
- Led 6 OOS investigations to root cause; supported method validation and method transfer for 3 products
- Calibrate and maintain HPLC and GC instruments; wrote 4 SOPs
QC Lab Technician, Triangle Generics | 2019 - 2021

EDUCATION
B.S. Chemistry, Carolina Central College | 2019

SKILLS
Laboratory: HPLC, GC, dissolution testing, stability testing, method validation, OOS investigations, cGMP, GLP, USP, GDP
Tools: Empower, LIMS, ChemStation
` },
  {
    category: "science", role: "economist",
    posting: { title: "Economist", description: `Fairhaven Economics is an economic consulting firm supporting litigation and regulatory matters. We're hiring an Economist to lead empirical analysis.
You will: design and carry out econometric analysis of large datasets; build regression models, panel data and causal inference analyses (difference-in-differences, instrumental variables); estimate damages; write reports and present findings to attorneys and clients; supervise research analysts.
Requirements: Ph.D. in economics; strong applied econometrics; fluency in Stata and R (Python a plus); excellent writing; industrial organization or labor economics a plus.` },
    resume: contact("Dr. Tobias Engelhardt-Mensah", "Washington, DC") + `
EXPERIENCE
Senior Associate (Economist), Potomac Analytics Group, Washington, DC | 2020 - Present
- Lead econometric analysis for antitrust and labor matters: regression models, panel data, difference-in-differences, instrumental variables
- Estimated damages in 8 litigation matters; wrote expert reports and presented findings to counsel
- Supervise 4 research analysts; maintain the team's Stata and R code base

EDUCATION
Ph.D. Economics, Chesapeake University | 2020 · fields: industrial organization, labor economics

SKILLS
Economics: econometrics, causal inference, difference-in-differences, instrumental variables, panel data, damages estimation, industrial organization
Tools: Stata, R, Python, SQL
` },
];
