#!/usr/bin/env node
// ⭐ D155 Part C · decks-v8 — data: Patterns (5) and the Data science track (5), drafted by the agent 2026-11-08 for the
// owner's review. node scripts/decks/decksV8.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const P = (n, title, skills, pieces, slides, q) => deck(`da-p-0${n}`, "data", "patterns", title, skills, pieces, slides, q);
const S = (n, title, skills, pieces, slides, q) => deck(`da-ds-0${n}`, "data", "data-science-track", title, skills, pieces, slides, q);
const Q = (id, role, skills, pieces, stem, choices, correct, why) => question(`${id}-q1`, role, "mid", skills, pieces, stem, choices, correct, why);

writeBatch({
  version: 8,
  title: "data, Patterns and the Data science track",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C, approved; D154 P4 format). Pathway 'data', stages 'patterns' (5) and 'data-science-track' (5), in Part C's order. Nothing is live until approved (status: draft).",
  decks: [
    P(1, "Idempotent pipelines and backfills", ["idempotency", "backfills", "pipelines"], ["x1"], [
      ["What it is", "Rerun anything, safely", [
        "An idempotent pipeline produces the same output however many times a run is repeated.",
        "A backfill reruns a pipeline over past dates, after a bug fix or a new column."]],
      ["Core ideas", "Partitions in, partitions out", [
        "Each run processes a defined slice (a date) and replaces exactly that slice of the output.",
        "Write to a temporary location, then swap it in, so readers never see half a day.",
        "Inputs are read as they were (raw data kept unchanged), so a rerun sees the same input.",
        "Avoid 'now()' inside the logic; use the run's logical date."]],
      ["The trade-offs", "Correctness costs a little more", [
        "Replacing partitions rewrites data that may not have changed.",
        "Backfilling years at once can overload the warehouse; run slices with limited parallelism.",
        "Downstream tables must be rebuilt too, in dependency order."]],
      ["In practice", "What you'll see at work", [
        "MERGE or delete-then-insert by partition key, never blind INSERT.",
        "Backfills planned like a release: scope, order, cost, who's told.",
        "A row count and a sum compared before and after."]],
    ], Q("da-p-01", "Data Engineer", ["backfills", "idempotency"], ["x1"],
      "A pipeline uses CURRENT_DATE inside its SQL to pick 'yesterday'. A backfill of last March produces wrong data. Why?",
      ["Every rerun computes 'yesterday' from today, not from the date being backfilled; use the run's logical date", "March had 31 days", "The warehouse caches CURRENT_DATE", "Backfills always produce wrong data"],
      0, ["Wall-clock time makes the output depend on when it ran.", "Not the issue.", "It isn't cached; it's simply today.", "They don't, when the logic uses the run's date."])),

    P(2, "Late data and watermarks", ["late data", "watermarks", "streaming"], ["x1"], [
      ["What it is", "Events that arrive after you counted", [
        "Phones go offline and send events hours later; partners resend files. Data arrives after the window it belongs to.",
        "A watermark is the point up to which a system assumes it has seen everything."]],
      ["Core ideas", "Event time and allowed lateness", [
        "Count by event time (when it happened), not arrival time, or late events land in the wrong window.",
        "A watermark trails the newest event time by a margin; windows close once the watermark passes them.",
        "Allowed lateness keeps a window open a little longer, updating its result when stragglers arrive.",
        "Events later than that go to a side output to be handled separately."]],
      ["The trade-offs", "Fast or complete", [
        "A short wait gives fast, sometimes incomplete numbers; a long wait gives complete, slow ones.",
        "Updating results after they were published means consumers must accept corrections.",
        "In batch, the same problem shows up as reprocessing the last few days each run."]],
      ["In practice", "What you'll see at work", [
        "Daily batch jobs that recompute the last 3 days to catch late rows.",
        "Dashboards marked 'preliminary' for the most recent day.",
        "Metrics on how late events typically arrive, to set the margin."]],
    ], Q("da-p-02", "Data Engineer", ["late data"], ["x1"],
      "Yesterday's mobile event count rises by 5 % over the next two days as offline phones sync. How should the daily job handle it?",
      ["Count by event time and recompute the last few days on each run (or mark recent days as preliminary)", "Count by arrival time so yesterday never changes", "Drop events more than an hour late", "Ignore it"],
      0, ["Late events belong to the day they happened; reprocessing a short window catches them.", "That puts events on the wrong day.", "That loses real data.", "Reports would undercount consistently."])),

    P(3, "Slowly changing dimensions", ["slowly changing dimensions", "scd", "data modelling"], ["b2"], [
      ["What it is", "Keeping history of descriptive data", [
        "Dimension attributes change: a customer moves country, a product changes category.",
        "Slowly changing dimension (SCD) types decide whether old reports show the old value or the new one."]],
      ["Core ideas", "Type 1 and Type 2", [
        "Type 1 overwrites: the dimension only knows the current value, and history is restated.",
        "Type 2 adds a new row per change, with valid_from, valid_to and a current flag.",
        "Facts join to the dimension row that was valid when the fact happened, through a surrogate key.",
        "Snapshot tables (one row per entity per day) are a simpler alternative when storage is cheap."]],
      ["The trade-offs", "Truth then or truth now", [
        "Type 2 keeps history exactly but makes tables bigger and joins more careful.",
        "Type 1 is simple and rewrites the past; past reports change.",
        "Choose per attribute: a typo fix is Type 1, a region move is often Type 2."]],
      ["In practice", "What you'll see at work", [
        "dbt snapshots producing Type 2 tables.",
        "Point-in-time joins: fact.date BETWEEN dim.valid_from AND dim.valid_to.",
        "A clear note on which attributes keep history."]],
    ], Q("da-p-03", "Analytics Engineer", ["slowly changing dimensions"], ["b2"],
      "A customer moved from the US to Canada in March. Finance wants January's revenue still reported under the US. Which model does that?",
      ["A Type 2 customer dimension, with orders joined to the row valid on the order date", "Overwrite the country (Type 1)", "Delete the customer and re-add them", "Store the country only in the orders table"],
      0, ["Each order points at the customer as they were then.", "January would move to Canada.", "That breaks every past reference.", "It works for country only and duplicates data everywhere."])),

    P(4, "Data contracts", ["data contracts", "schemas"], ["l2"], [
      ["What it is", "An agreement about the data", [
        "A data contract is an explicit agreement between a team producing data and the teams using it: the schema, meanings, freshness and who owns it.",
        "It turns 'someone renamed a column and broke the dashboard' into a reviewed change."]],
      ["Core ideas", "Schema, meaning, guarantees", [
        "The schema: field names and types, required or optional.",
        "Semantics: what each field means and its units.",
        "Service levels: how fresh, how complete, how quickly problems are fixed.",
        "Changes follow rules: additive changes are fine; breaking ones need a new version and notice."]],
      ["The trade-offs", "Stability against speed", [
        "Producers lose the freedom to change data on a whim.",
        "Consumers get stability, and must state what they actually rely on.",
        "Contracts on everything is bureaucracy; start with the data that feeds important decisions."]],
      ["In practice", "What you'll see at work", [
        "Schemas checked in CI on the producer's side; a breaking change fails the build.",
        "A schema registry for event streams.",
        "An owner and a channel named for each contracted dataset."]],
    ], Q("da-p-04", "Data Engineer", ["data contracts"], ["l2"],
      "An app team renames `user_id` to `account_id` in their events, and three pipelines break overnight. What would a data contract have changed?",
      ["The rename would be a breaking change, caught in the app team's CI and shipped as a new version with notice", "Nothing; renames are always safe", "The pipelines would rename automatically", "Only the dashboard would break"],
      0, ["A contract makes the break visible before it ships.", "Renames break every consumer.", "No pipeline can guess a rename.", "Everything downstream breaks."])),

    P(5, "Metrics and the semantic layer", ["metrics", "semantic layer"], ["l2"], [
      ["What it is", "One definition per number", [
        "A metric is a number the business steers by: revenue, active users, conversion.",
        "A semantic layer defines each metric once, so every dashboard and tool computes it the same way."]],
      ["Core ideas", "Define once, query anywhere", [
        "A metric definition names the measure (SUM of amount), filters (completed orders only), time grain and allowed dimensions.",
        "Tools query the metric by name; the layer writes the SQL.",
        "Ratios are computed after aggregation (sum of numerator / sum of denominator), not as an average of ratios.",
        "Every metric has an owner and a written definition."]],
      ["The trade-offs", "Consistency against flexibility", [
        "Analysts lose some freedom to write their own SQL for official numbers.",
        "Without it, two dashboards show two 'revenue' numbers and trust erodes.",
        "Definitions change over time; record when and why."]],
      ["In practice", "What you'll see at work", [
        "dbt's semantic layer, LookML or Cube for definitions.",
        "A metrics catalogue people can search.",
        "'Active user' defined precisely: who, what action, which window."]],
    ], Q("da-p-05", "Analytics Engineer", ["metrics"], ["l2"],
      "Conversion is computed as the average of each day's conversion rate, and it disagrees with total orders ÷ total visits. Which is right for the month?",
      ["Total orders ÷ total visits: aggregate first, then divide; averaging daily rates gives quiet days too much weight", "The average of daily rates", "Either; they're the same", "Neither; use the median"],
      0, ["A ratio of sums weights each visit equally.", "A day with 10 visits counts as much as a day with 10,000.", "They differ whenever daily volumes differ.", "The median isn't the conversion rate."])),

    S(1, "Experiments: A/B tests", ["ab testing", "experiments", "statistics"], ["s9"], [
      ["What it is", "Measuring what a change causes", [
        "An A/B test randomly splits people between the current version (A) and a change (B), then compares an outcome.",
        "Randomisation is what lets you say the change caused the difference."]],
      ["Core ideas", "Power, significance, one decision", [
        "Choose the primary metric and the smallest effect worth detecting before starting.",
        "Compute the sample size needed (power analysis), and run until you reach it.",
        "A p-value is how surprising the result would be if there were no real effect; it isn't the chance B is better.",
        "Check guardrail metrics (errors, latency, refunds) so a 'win' doesn't hide damage."]],
      ["The trade-offs", "Peeking and many metrics", [
        "Checking results daily and stopping at the first significant day inflates false positives (peeking); use a fixed horizon or sequential methods.",
        "Testing many metrics or segments finds some 'wins' by chance.",
        "Novelty effects fade; short tests can overstate a change."]],
      ["In practice", "What you'll see at work", [
        "An experiment plan written before launch: hypothesis, metric, sample size, duration.",
        "Sample ratio mismatch checks (did the split come out 50/50?).",
        "Results reported with confidence intervals, not just 'significant'."]],
    ], Q("da-ds-01", "Data Scientist", ["ab testing"], ["s9"],
      "An experiment planned for 2 weeks shows p < 0.05 on day 3, and the team wants to stop and ship. What's the risk?",
      ["Peeking: stopping at the first significant look inflates the false-positive rate; run to the planned size (or use a sequential test)", "None; significance is significance", "The test ran too long", "p-values only work on Mondays"],
      0, ["Many looks give many chances to see a fluke.", "Repeated looks change what the threshold means.", "It's the opposite.", "Not a thing."])),

    S(2, "Causal thinking", ["causal inference", "confounding"], ["s9"], [
      ["What it is", "Correlation is not causation, so what is?", [
        "Causal thinking asks what would have happened without the change, not just what moved together.",
        "When you can't run an experiment, you have to argue for causes carefully."]],
      ["Core ideas", "Confounders and counterfactuals", [
        "A confounder affects both the cause and the outcome: users who enable a feature may already be the most engaged.",
        "Selection bias: who ended up in a group isn't random.",
        "Methods for observational data: difference-in-differences, matching, regression discontinuity, instrumental variables.",
        "Draw the causal diagram (what affects what) before choosing a method."]],
      ["The trade-offs", "Assumptions everywhere", [
        "Every observational method rests on assumptions you can't fully test; state them.",
        "Controlling for the wrong variable (one caused by the treatment) can create bias.",
        "An experiment, when possible, beats clever analysis."]],
      ["In practice", "What you'll see at work", [
        "'Users of feature X retain better' — check whether X users were different beforehand.",
        "A rollout by region used as a natural experiment, with difference-in-differences.",
        "Findings worded as 'associated with' unless the design supports 'caused'."]],
    ], Q("da-ds-02", "Data Scientist", ["causal inference"], ["s9"],
      "Users who turned on notifications retain 30 % better. A manager says notifications cause retention. What's the main concern?",
      ["Confounding: more engaged users may be the ones who turn notifications on; test it with an experiment", "The sample is too big", "30 % is too round a number", "Retention can't be measured"],
      0, ["The groups differ before the feature does anything.", "Size isn't the problem.", "Not a reason to doubt it.", "It can."])),

    S(3, "Regression and classification", ["regression", "classification", "machine learning"], ["s9"], [
      ["What it is", "Predicting numbers and categories", [
        "Regression predicts a number (a price, a delivery time); classification predicts a category (churn or not, spam or not).",
        "Linear and logistic regression are the starting points, and often good enough."]],
      ["Core ideas", "Fit, features, holdout", [
        "A model learns weights for features from training data and is judged on data it hasn't seen (a test set).",
        "Logistic regression outputs a probability; a threshold turns it into a decision.",
        "Tree-based models (random forests, gradient boosting) capture non-linear patterns and interactions with little tuning.",
        "Feature engineering — turning raw data into useful inputs — often matters more than the algorithm."]],
      ["The trade-offs", "Accuracy against understanding", [
        "Simple models are easy to explain and debug; complex ones may predict better and explain less.",
        "Overfitting: great on training data, poor on new data.",
        "Leakage: a feature that wouldn't be known at prediction time makes results look impossibly good."]],
      ["In practice", "What you'll see at work", [
        "A simple baseline first; anything fancier must beat it.",
        "Time-based splits for anything that changes over time.",
        "scikit-learn pipelines that apply the same preprocessing in training and prediction."]],
    ], Q("da-ds-03", "Data Scientist", ["machine learning", "leakage"], ["s9"],
      "A churn model scores 99 % accuracy. One feature is 'cancellation_reason'. What's wrong?",
      ["Leakage: the reason exists only after someone churns, so it won't be known when predicting", "Nothing; 99 % is excellent", "The model is too simple", "Accuracy is always 99 %"],
      0, ["The model is reading the answer.", "Results that good usually mean a mistake.", "Complexity isn't the issue.", "It isn't."])),

    S(4, "Evaluation metrics", ["evaluation", "precision", "recall"], ["s9"], [
      ["What it is", "Measuring a model the right way", [
        "The metric decides what 'better' means; the wrong one rewards the wrong model.",
        "Pick it from the decision the model supports, not from habit."]],
      ["Core ideas", "Beyond accuracy", [
        "Precision: of the cases flagged, how many were right. Recall: of the real cases, how many were flagged.",
        "With rare events, accuracy misleads: flagging nothing is 99 % accurate if 1 % are positive.",
        "ROC AUC and PR AUC summarise across thresholds; PR AUC is more telling for rare positives.",
        "Regression: MAE (typical error), RMSE (punishes big errors), and checking errors by segment."]],
      ["The trade-offs", "Which mistake costs more", [
        "Raising the threshold improves precision and lowers recall; the business decides the balance.",
        "Calibration matters when probabilities are used directly (a 70 % score should be right about 70 % of the time).",
        "A model can score well overall and badly for one group; check segments."]],
      ["In practice", "What you'll see at work", [
        "A confusion matrix at the chosen threshold, with the cost of each cell.",
        "Offline metrics confirmed by an online test.",
        "Monitoring the same metric after launch, as data drifts."]],
    ], Q("da-ds-04", "Data Scientist", ["evaluation"], ["s9"],
      "A fraud model is 99.5 % accurate on data where 0.5 % of transactions are fraud. What should you check?",
      ["Precision and recall on the fraud class; a model that flags nothing also scores 99.5 % accuracy", "Nothing; it's excellent", "Training time", "The number of features"],
      0, ["Accuracy is meaningless when one class is tiny.", "It may catch no fraud at all.", "Not about quality.", "Not about quality."])),

    S(5, "Explaining results", ["communication", "data storytelling"], ["l2"], [
      ["What it is", "Analysis only matters if it changes a decision", [
        "Explaining results means turning analysis into a clear recommendation people can act on.",
        "Most of the audience reads the first sentence and the chart."]],
      ["Core ideas", "Answer first", [
        "Lead with the answer and the recommendation, then the evidence.",
        "One chart per point, titled with the takeaway ('Mobile checkout drops after step 2'), not the axis names.",
        "State uncertainty plainly: a range, and what would change the conclusion.",
        "Say what you didn't check."]],
      ["The trade-offs", "Simple without being wrong", [
        "Simplifying too far misleads; too much detail buries the point.",
        "A confident tone without caveats spends trust you'll need later.",
        "Different audiences need different depth: a summary for leaders, an appendix for analysts."]],
      ["In practice", "What you'll see at work", [
        "A one-page memo: question, answer, evidence, risks, next step.",
        "Charts with honest axes (starting at zero for bars).",
        "Numbers reproducible from saved queries or notebooks."]],
    ], Q("da-ds-05", "Data Analyst", ["communication"], ["l2"],
      "You've found that a pricing change probably raised revenue 3–6 %. How should the summary open?",
      ["With the answer and the recommendation: 'The new pricing likely raised revenue 3–6 %; keep it, and watch refunds.'", "With the data sources and methods", "With a table of every metric", "With the question restated three ways"],
      0, ["Readers get the decision first, with its uncertainty.", "Methods belong after the answer.", "That buries the point.", "That delays it."])),
  ],
});
