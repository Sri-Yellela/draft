#!/usr/bin/env node
// ⭐ D155 Part C · decks-v24 — beyond computing (D127): Business and financial analysis (4), Product and project management
// (5), Design (4; accessibility reuses sw-fe-03). Drafted by the agent 2026-11-08 for the owner's review.
// node scripts/decks/decksV24.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const D = (id, stage, title, skills, slides, q) => deck(id, "beyond", stage, title, skills, ["l2"], slides, q);
const Q = (id, role, skills, stem, choices, correct, why) => question(`${id}-q1`, role, "entry", skills, ["l2"], stem, choices, correct, why);
const BA = "business-and-financial-analysis", PM = "product-and-project-management", DE = "design";

writeBatch({
  version: 24,
  title: "beyond computing, Business analysis, Product and project management, Design",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C C.9, to go live once those fields are on the board, D127; D154 P4 format). Stages 'business-and-financial-analysis' (4), 'product-and-project-management' (5), 'design' (4; accessibility reuses sw-fe-03). Nothing is live until approved (status: draft).",
  decks: [
    D("bx-ba-01", BA, "Spreadsheets and SQL", ["excel", "sql", "analysis"], [
      ["What it is", "The analyst's two main tools", [
        "Spreadsheets handle quick models and small data; SQL pulls and summarises large data from databases.",
        "Most business analysis uses both."]],
      ["Core ideas", "Clean structure, traceable logic", [
        "Keep raw data, calculations and outputs on separate sheets.",
        "Use lookups (XLOOKUP), pivot tables and named ranges instead of hard-typed numbers.",
        "In SQL: filter, join, group and aggregate before exporting, so the spreadsheet stays small.",
        "Every number should be traceable back to its source."]],
      ["The trade-offs", "Quick against reliable", [
        "Spreadsheets are fast to build and easy to break silently (a pasted value over a formula).",
        "Large data in spreadsheets gets slow and error-prone; query it instead.",
        "Shared spreadsheets without version control drift."]],
      ["In practice", "What you'll see at work", [
        "A data tab refreshed from a saved query.",
        "Checks: totals that must match the source.",
        "Colour conventions: inputs one colour, formulas another."]],
    ], Q("bx-ba-01", "Business Analyst", ["excel"],
      "A forecast spreadsheet has numbers typed directly into formulas, like =B4*1.07. What's the problem?",
      ["The 7 % assumption is hidden and can't be changed in one place; put it in a labelled input cell and reference it", "Nothing; it's compact", "Formulas should never multiply", "It needs more decimal places"],
      0, ["Hard-coded assumptions are hard to find, check and update.", "Compact but fragile.", "Not a rule.", "Precision isn't the issue."])),

    D("bx-ba-02", BA, "Financial modelling", ["financial modelling", "forecasting"], [
      ["What it is", "Numbers that describe a business's future", [
        "A financial model projects revenue, costs and cash from assumptions, to support a decision: a price, a hire, an investment.",
        "Its value is in clear assumptions and scenarios."]],
      ["Core ideas", "Drivers, statements, scenarios", [
        "Start from drivers (customers, price, churn, cost per unit), not from last year's totals plus a percentage.",
        "Link the three statements: income statement, balance sheet, cash flow.",
        "Build scenarios (base, downside, upside) and sensitivity tables for key assumptions.",
        "Cash matters more than profit for survival."]],
      ["The trade-offs", "Detail against usefulness", [
        "Too much detail hides the few assumptions that matter.",
        "Precise-looking outputs from guessed inputs mislead.",
        "Models need owners and dated versions."]],
      ["In practice", "What you'll see at work", [
        "An assumptions sheet up front.",
        "Sensitivity tables showing which input moves the result most.",
        "Monthly comparison of actuals with the model."]],
    ], Q("bx-ba-02", "Financial Analyst", ["financial modelling"],
      "A model shows a profitable year, but the company runs out of cash in month 7. How?",
      ["Profit isn't cash: customers pay late, inventory and upfront costs use cash before revenue arrives; model cash flow", "The model has a typo", "Profit always equals cash", "Taxes are zero"],
      0, ["Timing of cash in and out can sink a profitable business.", "Possible, but the pattern is a classic cash-timing gap.", "It doesn't.", "Not the explanation."])),

    D("bx-ba-03", BA, "KPIs", ["kpis", "metrics"], [
      ["What it is", "The few numbers that track what matters", [
        "Key performance indicators (KPIs) measure progress toward a goal: revenue growth, retention, cost per acquisition.",
        "Good KPIs drive decisions; bad ones drive gaming."]],
      ["Core ideas", "Leading and lagging", [
        "Lagging indicators show results (revenue); leading indicators predict them (qualified pipeline).",
        "Each KPI has a precise definition, a source, an owner and a target.",
        "Pair a KPI with a counter-metric to prevent gaming (speed with quality).",
        "Few KPIs per team; if everything is key, nothing is."]],
      ["The trade-offs", "What gets measured gets managed", [
        "A target can distort behaviour (closing tickets fast but badly).",
        "Vanity metrics (page views) look good and drive nothing.",
        "Definitions change; record when and why."]],
      ["In practice", "What you'll see at work", [
        "A one-page dashboard per team.",
        "Weekly reviews of trends, not single points.",
        "Definitions documented in a shared glossary."]],
    ], Q("bx-ba-03", "Business Analyst", ["kpis"],
      "A support team's KPI is 'tickets closed per day'. Closures rise, and customer satisfaction falls. What's missing?",
      ["A counter-metric such as reopened tickets or satisfaction, so speed doesn't replace quality", "A higher target", "Fewer tickets", "Nothing; closures are up"],
      0, ["Pairing metrics stops one being gamed at the expense of the goal.", "Worsens the gaming.", "Not controllable.", "The real goal is worse."])),

    D("bx-ba-04", BA, "Presenting findings", ["presentation", "communication"], [
      ["What it is", "Turning analysis into a decision", [
        "Analysis is only useful if decision-makers understand it and act.",
        "Presenting well means leading with the answer."]],
      ["Core ideas", "Answer, evidence, ask", [
        "Start with the conclusion and the recommendation.",
        "Support it with two or three pieces of evidence, each with one clear chart.",
        "State assumptions and risks plainly.",
        "End with the decision or action you need."]],
      ["The trade-offs", "Simple without misleading", [
        "Too much detail loses the audience; too little loses credibility. Keep an appendix.",
        "Charts with truncated axes exaggerate; keep them honest.",
        "Tailor depth to the audience."]],
      ["In practice", "What you'll see at work", [
        "One-page memos before meetings.",
        "Chart titles that state the takeaway.",
        "A clear owner and date for the next step."]],
    ], Q("bx-ba-04", "Business Analyst", ["presentation"],
      "You have five minutes with an executive. How should you open?",
      ["With the recommendation and the one number that supports it", "With your methodology", "With a history of the project", "With a table of all the data"],
      0, ["Executives decide on the answer first, then probe.", "Belongs in the appendix.", "Uses up the time.", "Buries the point."])),

    D("bx-pm-01", PM, "Discovery", ["product discovery", "user research"], [
      ["What it is", "Finding the right problem before building", [
        "Discovery works out what problem is worth solving and whether a solution will work, before committing to build it.",
        "It reduces the risk of building something nobody needs."]],
      ["Core ideas", "Talk, test, learn", [
        "Interview users about their real behaviour and problems, not their opinions of your idea.",
        "Frame opportunities from evidence; generate several solutions.",
        "Test the riskiest assumption cheaply first: a prototype, a fake door, a concierge test.",
        "Decide with evidence: build, change or drop."]],
      ["The trade-offs", "Learning against shipping", [
        "Too little discovery builds the wrong thing; too much never ships.",
        "Users can't always say what they want; watch what they do.",
        "Confirmation bias: seek evidence that could prove you wrong."]],
      ["In practice", "What you'll see at work", [
        "Weekly customer conversations by the product trio (product, design, engineering).",
        "Assumption maps and experiment logs.",
        "Prototypes tested before specs are written."]],
    ], Q("bx-pm-01", "Product Manager", ["product discovery"],
      "In user interviews, which question gives more reliable evidence?",
      ["'Tell me about the last time you did this. What happened?'", "'Would you use a feature that does X?'", "'Do you like our idea?'", "'How much would you pay for it in the future?'"],
      0, ["Past behaviour reveals real needs; hypothetical answers are unreliable.", "People say yes to hypotheticals.", "Politeness bias.", "Future intent is a poor predictor."])),

    D("bx-pm-02", PM, "Prioritisation", ["prioritisation", "product strategy"], [
      ["What it is", "Choosing what to do first", [
        "There's always more to do than capacity allows. Prioritisation decides what goes first, and what doesn't happen.",
        "Saying no is most of it."]],
      ["Core ideas", "Value, effort, confidence", [
        "Tie priorities to goals: what moves the outcome the team owns?",
        "Frameworks like RICE (reach, impact, confidence, effort) make reasoning comparable.",
        "Consider risk and dependencies, not just value.",
        "Revisit priorities as evidence changes."]],
      ["The trade-offs", "Frameworks help, judgement decides", [
        "Scores can give false precision; use them to discuss, not to decide alone.",
        "The loudest stakeholder isn't the most important customer.",
        "Too many top priorities means none."]],
      ["In practice", "What you'll see at work", [
        "A ranked list, not tiers of 'high'.",
        "Clear 'not now' decisions communicated with reasons.",
        "Quarterly reprioritisation against goals."]],
    ], Q("bx-pm-02", "Product Manager", ["prioritisation"],
      "Every item on the backlog is labelled 'P1'. What's the fix?",
      ["Force-rank the items against the goal, so there's one order and an explicit cut line", "Add a 'P0' label", "Work on all of them at once", "Let engineers pick"],
      0, ["A single ranked order makes trade-offs explicit.", "Same problem, new label.", "Everything slows down.", "Abdicates the decision."])),

    D("bx-pm-03", PM, "Product metrics", ["product metrics", "analytics"], [
      ["What it is", "Measuring whether the product works for people", [
        "Product metrics track how people find, use and stay with a product: activation, engagement, retention, conversion.",
        "They show whether changes actually help."]],
      ["Core ideas", "A north star and its inputs", [
        "A north-star metric captures the value users get (for example, weekly active teams collaborating).",
        "Input metrics are the levers that drive it (sign-ups activated, features adopted).",
        "Funnels show where people drop off; cohorts show whether they stay.",
        "Experiments prove whether a change moved the metric."]],
      ["The trade-offs", "Measuring what matters", [
        "Easy-to-measure metrics (clicks) can mislead about value.",
        "Short-term gains can hurt long-term retention.",
        "Too many metrics dilute focus."]],
      ["In practice", "What you'll see at work", [
        "A metrics tree from the north star to team-level inputs.",
        "Retention curves by cohort.",
        "Every launch with a success metric defined in advance."]],
    ], Q("bx-pm-03", "Product Manager", ["product metrics"],
      "A redesign increases clicks on the home page by 30 %, but monthly retention drops. Was it a success?",
      ["Probably not: retention reflects lasting value; investigate why people engage more but stay less", "Yes, clicks rose", "Retention doesn't matter", "Clicks and retention are the same"],
      0, ["The north-star outcome got worse; clicks may show confusion.", "A shallow metric.", "It's central.", "They measure different things."])),

    D("bx-pm-04", PM, "Roadmaps", ["roadmaps", "planning"], [
      ["What it is", "Communicating direction over time", [
        "A roadmap shows what a team plans to work on and why, over the coming months.",
        "Good roadmaps communicate outcomes and priorities, not fixed promises."]],
      ["Core ideas", "Now, next, later", [
        "Organise by problems or outcomes rather than feature lists.",
        "Use time horizons: now (committed), next (likely), later (exploring).",
        "Tie each item to a goal, so trade-offs are visible.",
        "Update regularly and share what changed."]],
      ["The trade-offs", "Clarity against flexibility", [
        "Date-heavy roadmaps become broken promises.",
        "Vague roadmaps leave sales and partners unable to plan.",
        "Different audiences need different detail."]],
      ["In practice", "What you'll see at work", [
        "A public roadmap with themes, an internal one with detail.",
        "Quarterly reviews of what shipped and what moved.",
        "Clear language about confidence levels."]],
    ], Q("bx-pm-04", "Product Manager", ["roadmaps"],
      "Sales keeps promising customers features from the 'later' column with specific dates. What would help?",
      ["Make confidence explicit (committed / likely / exploring), keep dates only on committed work, and align with sales on what can be promised", "Remove the roadmap", "Put dates on everything", "Ignore sales"],
      0, ["Clear confidence levels prevent false promises.", "Leaves them guessing.", "Creates more broken promises.", "They need to plan too."])),

    D("bx-pm-05", PM, "Launches", ["product launch", "release management"], [
      ["What it is", "Getting a product into people's hands well", [
        "A launch coordinates engineering, marketing, sales, support and operations so a release reaches the right people and works.",
        "Many good features fail through poor launches."]],
      ["Core ideas", "Ready, gradual, measured", [
        "Readiness: documentation, support training, sales materials, monitoring.",
        "Release gradually (beta, percentage rollout) where possible.",
        "Define success metrics and watch them from day one.",
        "Have a rollback plan and an owner for launch day."]],
      ["The trade-offs", "Big splash against safe rollout", [
        "A big-bang launch gets attention and concentrates risk.",
        "Launching too quietly means nobody finds the feature.",
        "Delaying for perfection loses momentum and learning."]],
      ["In practice", "What you'll see at work", [
        "A launch checklist and go/no-go meeting.",
        "Internal dogfooding before public release.",
        "A post-launch review at two to four weeks."]],
    ], Q("bx-pm-05", "Product Manager", ["product launch"],
      "On launch day, support is flooded with questions they can't answer about the new feature. What was missed?",
      ["Readiness: support should have been trained and given docs before launch", "The feature was bad", "Too many users", "Marketing worked too well"],
      0, ["Launch readiness includes the people who answer customers.", "Not necessarily.", "Users are the goal.", "Demand isn't the problem."])),

    D("bx-de-01", DE, "Design research", ["user research", "ux research"], [
      ["What it is", "Understanding people before designing for them", [
        "Design research studies users' needs, behaviours and contexts so designs solve real problems.",
        "It ranges from interviews to usability tests to analytics."]],
      ["Core ideas", "Methods for questions", [
        "Generative research (interviews, field studies) explores needs.",
        "Evaluative research (usability tests) checks whether a design works.",
        "Five users in a usability test reveal most major problems.",
        "Synthesise findings into insights the team can act on."]],
      ["The trade-offs", "Rigour against speed", [
        "Small studies are fast and directional, not statistically conclusive.",
        "Recruiting the wrong participants gives misleading answers.",
        "Research that isn't shared changes nothing."]],
      ["In practice", "What you'll see at work", [
        "Research plans with clear questions.",
        "Recorded sessions and highlight reels for the team.",
        "Insight repositories."]],
    ], Q("bx-de-01", "UX Designer", ["user research"],
      "You want to know whether people can complete checkout in the new design. Which method fits best?",
      ["A usability test: watch representative users try the task and note where they struggle", "A survey asking if they like the colours", "Ask the team to vote", "Look only at page views"],
      0, ["Observing real attempts shows whether the design works.", "Preference isn't usability.", "The team isn't the user.", "Views don't show struggle."])),

    D("bx-de-02", DE, "Interaction design", ["interaction design", "ux"], [
      ["What it is", "How people and products talk to each other", [
        "Interaction design shapes how a product responds to people: flows, controls, feedback and states.",
        "Good interaction design feels obvious."]],
      ["Core ideas", "Clarity, feedback, forgiveness", [
        "Make the next action clear; one primary action per screen.",
        "Give immediate feedback for every action (pressed, loading, done, failed).",
        "Design every state: empty, loading, error, partial, success.",
        "Let people undo and recover from mistakes."]],
      ["The trade-offs", "Simple against powerful", [
        "More options give power and add confusion.",
        "Novel interactions can delight and confuse; familiar patterns are learned already.",
        "Hiding things declutters and can make them undiscoverable."]],
      ["In practice", "What you'll see at work", [
        "User flows and wireframes before visual design.",
        "Prototypes tested with users.",
        "Design system components for consistent behaviour."]],
    ], Q("bx-de-02", "Product Designer", ["interaction design"],
      "A form shows no response after 'Submit' while the server works for three seconds, so users click again and submit twice. What's missing?",
      ["Immediate feedback: a loading state and a disabled button while it submits", "A bigger button", "A different colour", "Fewer fields"],
      0, ["Feedback tells users their action registered and prevents repeats.", "Size doesn't communicate state.", "Colour alone doesn't.", "Not the cause."])),

    D("bx-de-03", DE, "Visual systems", ["visual design", "design systems"], [
      ["What it is", "Consistent look across a product", [
        "A visual system defines type, colour, spacing, icons and components so every screen looks and feels like one product.",
        "It speeds design and building, and improves accessibility."]],
      ["Core ideas", "Tokens, scale, components", [
        "Design tokens name values (colours, spacing, type sizes) used everywhere.",
        "A type scale and spacing scale give rhythm and hierarchy.",
        "Colour with purpose and sufficient contrast; never colour alone to convey meaning.",
        "Reusable components with documented usage."]],
      ["The trade-offs", "Consistency against expression", [
        "A rigid system can feel bland; a loose one fragments.",
        "Systems need maintenance and ownership.",
        "Adoption matters more than completeness."]],
      ["In practice", "What you'll see at work", [
        "A shared component library in design tools and code.",
        "Light and dark themes from the same tokens.",
        "Contribution guidelines for new components."]],
    ], Q("bx-de-03", "Product Designer", ["visual design"],
      "Error states are shown only by turning text red. What's the accessibility problem and fix?",
      ["Colour alone isn't perceivable by everyone; add an icon and a text message", "Red is too bright", "Errors should be green", "Nothing"],
      0, ["People with colour vision deficiencies may miss it; text and icons don't rely on colour.", "Brightness isn't the issue.", "Still colour alone.", "It excludes users."])),

    D("bx-de-05", DE, "The portfolio", ["design portfolio", "career"], [
      ["What it is", "Showing how you think, not just what you made", [
        "A design portfolio is the main evidence hiring teams use to judge a designer.",
        "They want to see process and impact, not only polished screens."]],
      ["Core ideas", "Case studies that tell a story", [
        "Three or four strong case studies beat many thin ones.",
        "Each: the problem, your role, the process (research, options, trade-offs), the result.",
        "Show decisions and what you learned, including what didn't work.",
        "Quantify impact where you can."]],
      ["The trade-offs", "Depth against skimmability", [
        "Reviewers skim; lead each case with a short summary.",
        "Confidential work needs anonymising; never share what you can't.",
        "Concept projects are fine if framed honestly."]],
      ["In practice", "What you'll see at work", [
        "A portfolio walkthrough round in interviews.",
        "A one-page summary per case study.",
        "Updated after each significant project."]],
    ], Q("bx-de-05", "Product Designer", ["design portfolio"],
      "Which portfolio case study is strongest?",
      ["One that states the problem, your role, the options you considered, why you chose one, and the measured result", "A gallery of final screens with no text", "Twenty small projects with one image each", "Only award logos"],
      0, ["Reviewers judge thinking and impact.", "Shows output, not process.", "Too thin to judge.", "Not evidence of your work."])),
  ],
});
