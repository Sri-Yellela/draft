#!/usr/bin/env node
// ⭐ D155 Part C · decks-v9 — data: Case studies (4) and Interview (4), drafted by the agent 2026-11-08 for the owner's
// review. node scripts/decks/decksV9.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const C = (n, title, skills, pieces, slides, q) => deck(`da-c-0${n}`, "data", "case-studies", title, skills, pieces, slides, q);
const I = (n, title, skills, pieces, slides, q) => deck(`da-iv-0${n}`, "data", "interview", title, skills, pieces, slides, q);
const Q = (id, role, level, skills, pieces, stem, choices, correct, why) => question(`${id}-q1`, role, level, skills, pieces, stem, choices, correct, why);

writeBatch({
  version: 9,
  title: "data, Case studies and Interview",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C, approved; D154 P4 format). Pathway 'data', stages 'case-studies' (4) and 'interview' (4), in Part C's order. Nothing is live until approved (status: draft).",
  decks: [
    C(1, "A revenue pipeline", ["pipelines", "data modelling", "reconciliation"], ["b2"], [
      ["What it is", "The number everyone argues about", [
        "A revenue pipeline turns orders, refunds, currencies and payments into the revenue figure finance reports.",
        "It has to match the accounting system to the cent, so it's built for correctness first."]],
      ["Core ideas", "Sources, rules, reconciliation", [
        "Sources: orders from the app database (via CDC), payments and refunds from the payment provider, exchange rates.",
        "Rules written down with finance: when revenue counts (paid, shipped, or delivered), how refunds and discounts apply.",
        "A fact table at order-line grain, in original and reporting currency, with the rate used.",
        "Daily reconciliation against the provider's settlement report; differences raise an alert."]],
      ["The trade-offs", "Fast numbers or final numbers", [
        "Preliminary daily figures help the business; the month closes on final, reconciled ones.",
        "Late refunds change past periods; agree whether to restate them or book them when they happen.",
        "Currency conversion at the order date or the settlement date gives different totals; pick one."]],
      ["In practice", "What it looks like", [
        "dbt models with tests on keys, amounts and totals against the source.",
        "Every change to the rules reviewed by someone from finance.",
        "A 'revenue' metric defined once in the semantic layer."]],
    ], Q("da-c-01", "Data Engineer", "mid", ["reconciliation"], ["b2"],
      "Your monthly revenue is 0.8 % higher than the finance system's. What's the most useful first step?",
      ["Reconcile at the transaction level: match orders to settlements and list the ones that differ", "Scale your number down by 0.8 %", "Assume finance is wrong", "Round both to millions"],
      0, ["Matching records shows exactly which transactions (refunds? currency? timing?) cause the gap.", "That hides the cause and will be wrong next month.", "Unverified, and not how trust is built.", "That hides the problem."])),

    C(2, "Product event analytics", ["event tracking", "funnels", "product analytics"], ["l2"], [
      ["What it is", "What people actually do in the product", [
        "Product analytics records events (viewed, clicked, signed up, purchased) to answer questions about behaviour: funnels, retention, feature use.",
        "Its quality depends on the tracking plan more than on the tools."]],
      ["Core ideas", "Plan, collect, model", [
        "A tracking plan lists each event, when it fires, and its properties, agreed before it's built.",
        "Events carry a user id (or an anonymous id joined to it after sign-in), a timestamp and a session.",
        "Funnels count how many people reach each step in order; retention counts who returns after 1, 7, 30 days.",
        "Model raw events into clean tables (sessions, daily user activity) before analysis."]],
      ["The trade-offs", "Track everything or the right things", [
        "Tracking everything is noisy and costly; tracking too little leaves questions unanswerable.",
        "Client-side events get blocked or lost; important ones (purchases) are better sent from the server.",
        "Personal data in events brings privacy duties; collect only what's needed and honour consent."]],
      ["In practice", "What it looks like", [
        "Event names in a consistent form (object_action: order_completed).",
        "Tests that check new releases still send the agreed events.",
        "A dashboard of the core funnel and retention, owned by the product team."]],
    ], Q("da-c-02", "Data Analyst", "mid", ["event tracking"], ["l2"],
      "The purchase count in product analytics is 15 % lower than in the orders database. What's a likely reason and fix?",
      ["The purchase event fires in the browser and is lost or blocked; send it from the server when the order is confirmed", "The database double-counts orders", "Analytics tools round numbers", "Users buy twice"],
      0, ["Ad blockers and closed tabs drop client events; the server knows every confirmed order.", "Possible, but the usual gap is lost client events.", "They don't round counts.", "That would raise the analytics count too."])),

    C(3, "A churn model", ["churn", "classification", "machine learning"], ["s9"], [
      ["What it is", "Who's about to leave?", [
        "A churn model predicts which customers are likely to cancel, so the team can act before they do.",
        "Its value is in the action it enables, not the accuracy alone."]],
      ["Core ideas", "Define, build, act", [
        "Define churn exactly (no activity for 30 days? cancelled a subscription?) and the prediction window.",
        "Features from before the prediction date only: usage trends, support tickets, payment failures, plan.",
        "A time-based split: train on earlier months, test on a later one.",
        "Rank customers by risk and pair the top group with an action (an offer, an outreach)."]],
      ["The trade-offs", "Predicting isn't preventing", [
        "Customers most likely to churn may not be the ones an intervention can save.",
        "An uplift test (contact half the high-risk group) measures whether the action works.",
        "Features that leak the outcome make a model look great and fail in use."]],
      ["In practice", "What it looks like", [
        "A weekly scored list delivered to the team that acts on it.",
        "Precision at the top of the list tracked, since only that group gets contacted.",
        "The model retrained and monitored as the product changes."]],
    ], Q("da-c-03", "Data Scientist", "mid", ["churn"], ["s9"],
      "Your churn model is accurate, and the retention team calls the top 1,000 risky customers each week. Churn hasn't fallen. What should you test?",
      ["Whether calling helps at all: call a random half of the high-risk group and compare churn with the other half", "A more accurate model", "Calling more customers", "Removing the model"],
      0, ["Prediction doesn't prove the action works; a controlled test does.", "Better ranking won't help if the action doesn't work.", "More of an action that may not work.", "You'd lose the targeting without learning anything."])),

    C(4, "Recommendations basics", ["recommendations", "collaborative filtering"], ["s9"], [
      ["What it is", "'People like you also liked'", [
        "A recommender suggests items a person is likely to want, from what they and others have done.",
        "It's usually two steps: find candidates, then rank them."]],
      ["Core ideas", "Content, collaboration, ranking", [
        "Content-based: suggest items similar to ones the person liked (same category, similar text).",
        "Collaborative filtering: people with similar histories like similar things; matrix factorisation or embeddings capture this.",
        "Candidate generation narrows millions of items to hundreds; a ranking model orders them using many features.",
        "Popularity is a strong baseline and the fallback for new users (the cold-start problem)."]],
      ["The trade-offs", "Relevance, variety, fairness", [
        "Optimising only clicks can narrow what people see and promote clickbait.",
        "New items have no history; mix in exploration so they get a chance.",
        "Offline metrics (precision at k) don't always predict online results; test online."]],
      ["In practice", "What it looks like", [
        "Logged impressions and clicks, so the model learns from what was shown, not just what was clicked.",
        "Business rules on top: no out-of-stock items, no repeats of what was just bought.",
        "A/B tests of each ranking change."]],
    ], Q("da-c-04", "Data Scientist", "mid", ["recommendations"], ["s9"],
      "A new user has no history. What should the recommender show?",
      ["Popular or trending items (optionally by their location or sign-up answers), then learn from their first actions", "Nothing until they've used the app for a week", "Random items", "Only the most expensive items"],
      0, ["Popularity is a solid cold-start fallback, refined as data arrives.", "An empty screen loses them.", "Random items are mostly irrelevant.", "That isn't relevance."])),

    I(1, "SQL rounds", ["sql interview"], ["b2"], [
      ["What it is", "Live SQL against a small schema", [
        "Data interviews often give a few tables and ask questions to answer in SQL, in 30–45 minutes.",
        "They test correctness with joins, grouping, window functions and edge cases."]],
      ["Core ideas", "Common shapes", [
        "Top N per group: ROW_NUMBER() OVER (PARTITION BY … ORDER BY …) and filter.",
        "Running totals and period-over-period changes: SUM() OVER and LAG().",
        "Funnels and retention: self-joins or conditional aggregation over events.",
        "Deduplication and 'latest record': windows again."]],
      ["The trade-offs", "Talk, then type", [
        "Clarify the grain of each table and how NULLs and ties should be handled before writing.",
        "Build the query in steps (CTEs), checking each step's output.",
        "A correct, readable query beats a clever one-liner with a bug."]],
      ["In practice", "How to prepare", [
        "Practise the common shapes until they're automatic.",
        "Say your checks aloud: 'this join is one to many, so I'll aggregate first'.",
        "Know the difference between WHERE, HAVING and QUALIFY."]],
    ], Q("da-iv-01", "Data Analyst", "entry", ["sql interview"], ["b2"],
      "Asked for each customer's most recent order, which approach is most reliable?",
      ["ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at DESC, order_id DESC) and keep row 1", "GROUP BY customer_id with MAX(ordered_at), then select every column", "ORDER BY ordered_at DESC LIMIT 1", "SELECT DISTINCT customer_id"],
      0, ["One row per customer, with a tie-breaker, and every column from that row.", "Other columns can't be selected safely next to MAX.", "That's one order overall, not per customer.", "That loses the order."])),

    I(2, "Data-modelling rounds", ["data modelling interview"], ["b2"], [
      ["What it is", "Design the tables for a business", [
        "You're asked to model data for a scenario (a ride-sharing app, an online shop) so that given questions are easy to answer.",
        "They're scoring your grain decisions and how you handle change."]],
      ["Core ideas", "Questions first", [
        "Ask what questions the model must answer, and how fresh it needs to be.",
        "Name the facts and their grain (one row per trip), then the dimensions (rider, driver, city, date).",
        "Decide which attributes need history (slowly changing dimensions).",
        "Walk through answering one of their questions with your tables."]],
      ["The trade-offs", "Normalised or analytical", [
        "Normalised models suit the app's writes; star schemas suit analysis. Say which you're designing.",
        "Pre-aggregated tables are fast and rigid; keep the detailed fact table too.",
        "Every extra table is something to maintain."]],
      ["In practice", "How to prepare", [
        "Practise three classic scenarios on paper.",
        "State the grain out loud for every table you draw.",
        "Mention data quality checks and ownership, briefly."]],
    ], Q("da-iv-02", "Analytics Engineer", "entry", ["data modelling interview"], ["b2"],
      "In a modelling round for a ride-sharing app, what should you settle first?",
      ["The questions to answer and the grain of the main fact table (for example, one row per trip)", "Which database vendor to use", "The colour scheme of the dashboard", "How many indexes to add"],
      0, ["Grain and questions drive every other choice.", "Secondary for a modelling round.", "Not modelling.", "That comes much later."])),

    I(3, "Experiment-design rounds", ["experiment design interview", "ab testing"], ["s9"], [
      ["What it is", "Design a test for a product change", [
        "You're given a change ('a new checkout button') and asked how you'd test it.",
        "They're checking your metrics, randomisation and statistical judgement."]],
      ["Core ideas", "A full plan", [
        "Hypothesis and primary metric, plus guardrails (refunds, latency).",
        "The unit of randomisation (user, session, region) and why.",
        "Sample size and duration from the smallest effect worth detecting.",
        "How you'll decide, and what you'll do if results are mixed."]],
      ["The trade-offs", "Real-world snags", [
        "Network effects (one user's treatment affects another) can need cluster randomisation.",
        "Peeking and many metrics raise false positives.",
        "Novelty and seasonality can mislead a short test."]],
      ["In practice", "How to prepare", [
        "Practise with three or four classic product changes.",
        "Always name a guardrail metric.",
        "Be ready to say when you wouldn't run a test at all."]],
    ], Q("da-iv-03", "Data Scientist", "entry", ["experiment design interview"], ["s9"],
      "You're testing a feature that lets riders share a car. Why might randomising by individual user be a problem?",
      ["Treated and untreated users share the same drivers and cars, so they affect each other; randomise by city or time instead", "Users dislike being randomised", "There are too few users", "Sharing can't be measured"],
      0, ["Interference between groups biases the comparison; cluster randomisation avoids it.", "They don't see it.", "Ride apps have plenty.", "It can."])),

    I(4, "Case presentations", ["case presentation", "communication"], ["l2"], [
      ["What it is", "Present an analysis you've done", [
        "Some data interviews give a dataset and a question days ahead; you present your findings to a panel.",
        "They're judging your reasoning, your honesty about limits, and your communication."]],
      ["Core ideas", "A clear arc", [
        "Open with the question and your answer.",
        "Show how you checked the data (and what was wrong with it).",
        "Two or three findings, each with one chart titled by its takeaway.",
        "Recommendations, limits, and what you'd do with more time."]],
      ["The trade-offs", "Depth against time", [
        "Fifteen slides in twenty minutes leaves no time for questions; aim for fewer.",
        "Showing every analysis you tried buries the result.",
        "Defending a weak finding hard costs more than admitting its limits."]],
      ["In practice", "How to prepare", [
        "Rehearse with a timer and someone who'll interrupt.",
        "Prepare an appendix for likely deep questions.",
        "Have the notebook ready to show your work."]],
    ], Q("da-iv-04", "Data Analyst", "entry", ["case presentation"], ["l2"],
      "During your case presentation a panelist points out a flaw in one finding. What's the best response?",
      ["Acknowledge it, explain how it changes the conclusion, and say how you'd check it", "Insist the finding is right", "Skip to the next slide", "Blame the data"],
      0, ["Honest reasoning about limits is exactly what they're testing.", "Defending a flaw costs trust.", "Avoiding it is noticed.", "The analysis is yours to own."])),
  ],
});
