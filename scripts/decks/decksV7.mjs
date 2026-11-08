#!/usr/bin/env node
// ⭐ D155 Part C · decks-v7 — data (data engineer, analytics engineer, data scientist): Foundations (5) and Building
// blocks (6), drafted by the agent 2026-11-08 for the owner's review. node scripts/decks/decksV7.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const F = (n, title, skills, pieces, slides, q) => deck(`da-f-0${n}`, "data", "foundations", title, skills, pieces, slides, q);
const B = (n, title, skills, pieces, slides, q) => deck(`da-b-0${n}`, "data", "building-blocks", title, skills, pieces, slides, q);
const Q = (id, role, skills, pieces, stem, choices, correct, why) => question(`${id}-q1`, role, "entry", skills, pieces, stem, choices, correct, why);

writeBatch({
  version: 7,
  title: "data, Foundations and Building blocks",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C, approved; D154 P4 format). Pathway 'data', stages 'foundations' (5) and 'building-blocks' (6), in Part C's order. Nothing is live until approved (status: draft).",
  decks: [
    F(1, "SQL in depth", ["sql", "window functions", "joins"], ["b2"], [
      ["What it is", "The language of data work", [
        "SQL is how you ask a database questions: filter, join, group, sort.",
        "Past the basics, data work leans on joins done right, aggregation and window functions."]],
      ["Core ideas", "Joins, groups, windows", [
        "An inner join keeps matching rows; a left join keeps every row on the left, with NULLs where nothing matches.",
        "GROUP BY collapses rows into one per group; HAVING filters groups, WHERE filters rows before grouping.",
        "Window functions compute across related rows without collapsing them: ROW_NUMBER, running totals, LAG to compare with the previous row.",
        "Common table expressions (WITH …) name steps, so a long query reads top to bottom."]],
      ["The trade-offs", "Correct before fast", [
        "Joining on a key that isn't unique multiplies rows silently, inflating sums.",
        "NULL never equals anything, NULL included; use IS NULL, and remember COUNT(column) skips NULLs.",
        "A clever single query can be harder to check than three clear steps."]],
      ["In practice", "What you'll see at work", [
        "'Latest row per customer' is ROW_NUMBER() OVER (PARTITION BY customer ORDER BY updated_at DESC) = 1.",
        "Check row counts before and after every join.",
        "Read the query plan when a query is slow (see Indexes and query plans)."]],
    ], Q("da-f-01", "Data Analyst", ["sql", "joins"], ["b2"],
      "After joining orders to a payments table, total revenue doubles. What's the most likely cause?",
      ["Some orders have more than one payment row, so the join repeats each order", "SUM is broken for large numbers", "The left join dropped rows", "The database cached an old result"],
      0, ["A one-to-many join repeats the order's amount once per matching payment.", "SUM is fine; the rows are duplicated.", "Dropping rows would lower the total.", "A cache wouldn't double it."])),

    F(2, "Data modelling: grain and star schemas", ["data modelling", "star schema", "dimensional modelling"], ["b2"], [
      ["What it is", "Shaping data so questions are easy", [
        "A data model decides which tables exist, what one row means, and how tables relate.",
        "Analytics usually uses dimensional models: facts (events, measurements) and dimensions (who, what, where)."]],
      ["Core ideas", "Grain first", [
        "The grain is what one row of a fact table represents: one order line, one page view, one day per store. Decide it before anything else.",
        "Fact tables hold numbers to add up (amount, quantity) and keys to dimensions.",
        "Dimension tables hold descriptive attributes (customer name, product category) to filter and group by.",
        "A star schema is one fact table with dimensions around it, joined by keys."]],
      ["The trade-offs", "Easy to query, more to build", [
        "Star schemas duplicate some data (denormalisation) to make queries simple and fast.",
        "Mixing grains in one table (orders and order lines) leads to double counting.",
        "Wide, flat tables are easy for one report and hard to reuse for the next."]],
      ["In practice", "What you'll see at work", [
        "A fact_orders table at one row per order line, with dim_customer, dim_product and dim_date.",
        "Surrogate keys in dimensions, so history can be tracked (see slowly changing dimensions).",
        "Every table documented with its grain in one sentence."]],
    ], Q("da-f-02", "Analytics Engineer", ["data modelling"], ["b2"],
      "A table has one row per order, and the order's total, but someone adds a column per product in the order. Why is this a problem?",
      ["The grain is no longer clear; product facts belong in a separate table at one row per order line", "Too many columns slow SQL down", "Products should be stored as text", "It isn't a problem"],
      0, ["Mixing the order grain with the line grain invites double counting and missing data.", "Width is the smaller issue.", "That loses structure.", "It breaks every product-level question."])),

    F(3, "Python for data", ["python", "pandas"], ["l2"], [
      ["What it is", "The glue of data work", [
        "Python with pandas (or Polars) loads, cleans, joins and reshapes tabular data, and connects to almost everything.",
        "Notebooks (Jupyter) mix code, results and notes for exploring."]],
      ["Core ideas", "DataFrames, vectorising, types", [
        "A DataFrame is a table in memory; operations apply to whole columns at once (vectorised), which is far faster than looping over rows.",
        "Watch types: dates as datetime, money as decimals or integers of cents, categories as category.",
        "merge is a SQL join; groupby + agg is GROUP BY; check row counts after each.",
        "Missing values are NaN or None; decide per column whether to drop, fill or flag them."]],
      ["The trade-offs", "Notebook to production", [
        "Everything in memory is fast until the data doesn't fit; then push work into the database or a distributed engine.",
        "Notebooks run cells in any order, so results may not be reproducible; turn finished work into scripts or modules with tests.",
        "Row-by-row loops are easy to write and slow."]],
      ["In practice", "What you'll see at work", [
        "Pinned dependencies (a lock file) so a pipeline runs the same next month.",
        "Reading Parquet rather than CSV: typed, compressed, columnar.",
        "Small reusable functions for cleaning steps, each with a test."]],
    ], Q("da-f-03", "Data Analyst", ["python", "pandas"], ["l2"],
      "A pandas script loops over 5 million rows with iterrows() to compute price × quantity, and takes 20 minutes. What's the fix?",
      ["Compute it as a vectorised column operation: df['total'] = df['price'] * df['quantity']", "Use a faster laptop", "Split the file into 100 CSVs", "Convert the columns to strings first"],
      0, ["Vectorised operations run in optimised native code over whole columns.", "It shaves time but keeps the slow pattern.", "That adds work without fixing the loop.", "Strings make arithmetic impossible."])),

    F(4, "Statistics basics", ["statistics", "distributions"], ["s9"], [
      ["What it is", "Reasoning with uncertainty", [
        "Statistics tells you what data can and can't support: what's typical, how spread out it is, and whether a difference is real or noise.",
        "Most data mistakes are statistical, not technical."]],
      ["Core ideas", "Centre, spread, samples", [
        "Mean, median and mode describe the centre; with skewed data (incomes, latencies) the median is more representative.",
        "Standard deviation and percentiles describe spread.",
        "A sample estimates the whole population; bigger samples give narrower confidence intervals.",
        "Correlation measures how two things move together; it doesn't show that one causes the other."]],
      ["The trade-offs", "Simple numbers hide shapes", [
        "An average can describe nobody: half the users at 1 and half at 9 average 5.",
        "Outliers can dominate a mean; decide whether they're errors or the most important rows.",
        "Testing many things at once makes some 'significant' by chance."]],
      ["In practice", "What you'll see at work", [
        "Plot the distribution before quoting any single number.",
        "Report a range or interval, not just a point estimate.",
        "Ask how the sample was collected; a biased sample can't be fixed with more rows."]],
    ], Q("da-f-04", "Data Analyst", ["statistics"], ["s9"],
      "Average time on site rose from 3 to 6 minutes after a change, but most users' time barely moved. What should you check first?",
      ["The distribution: a few extreme sessions (or bots) can pull the mean up; compare medians and percentiles", "Nothing, the average doubled", "The colour of the new design", "Whether the change was popular on social media"],
      0, ["Means are pulled by outliers; the median shows the typical user.", "The mean alone can mislead.", "Not related to the measurement.", "Not evidence about time on site."])),

    F(5, "Data quality", ["data quality", "testing"], ["l2"], [
      ["What it is", "Can you trust the numbers?", [
        "Data quality is whether data is complete, correct, consistent, unique and on time.",
        "A dashboard is only as good as the rows behind it."]],
      ["Core ideas", "Test data like code", [
        "Checks for: nulls where values are required, duplicate keys, values out of range, broken references between tables.",
        "Freshness: did today's data arrive? Volume: is the row count far from normal?",
        "Run checks in the pipeline and stop or flag bad data before it reaches reports.",
        "Each dataset has an owner who is told when its checks fail."]],
      ["The trade-offs", "Strict or available", [
        "Stopping a pipeline on a failed check protects reports but leaves them stale.",
        "Too many noisy checks get ignored; start with the ones that would really hurt.",
        "Fixing data downstream hides the problem; fix it at the source when you can."]],
      ["In practice", "What you'll see at work", [
        "dbt tests or Great Expectations alongside each model.",
        "Alerts on freshness and on sudden drops in volume.",
        "A short note on each dashboard: where the data comes from and when it was last updated."]],
    ], Q("da-f-05", "Data Engineer", ["data quality"], ["l2"],
      "Yesterday's sales dashboard showed a 40 % drop. It turned out half the stores' data hadn't arrived. Which check would have caught it?",
      ["A volume or completeness check: row counts per store per day compared with normal, failing loudly when far off", "A check that sales are positive", "A spell-check on store names", "A faster dashboard"],
      0, ["Missing stores show up as a sudden drop in rows and in stores reporting.", "The rows that arrived were valid.", "Not related.", "Speed doesn't detect missing data."])),

    B(1, "Batch and streaming", ["batch processing", "streaming"], ["x1"], [
      ["What it is", "Process later, or process now", [
        "Batch processing handles data in chunks on a schedule (every night, every hour).",
        "Streaming processes each event as it arrives, within seconds."]],
      ["Core ideas", "Windows and time", [
        "Batch jobs read a bounded set (yesterday's files) and can simply be rerun.",
        "Streams are unbounded; aggregates are computed over windows (per minute, per session).",
        "Event time (when it happened) and processing time (when it arrived) differ; late events need handling.",
        "Engines: Spark for batch; Flink, Kafka Streams or Spark Structured Streaming for streams."]],
      ["The trade-offs", "Freshness against simplicity", [
        "Streaming gives fresher results and is harder to build, test, debug and backfill.",
        "Many 'real-time' needs are met by hourly batches.",
        "Running both (a fast stream and a corrective batch) doubles the logic to maintain."]],
      ["In practice", "What you'll see at work", [
        "Start with batch; stream only where minutes matter (fraud, alerts, live dashboards).",
        "Store raw events so any job can be rerun from the start.",
        "Watch lag: how far behind real time the stream is."]],
    ], Q("da-b-01", "Data Engineer", ["streaming", "batch processing"], ["x1"],
      "A team wants a streaming pipeline for a revenue report that finance reads once each morning. What's the better choice?",
      ["A daily batch job: simpler, cheaper and easier to rerun, and fresh enough for a morning report", "Streaming, because it's more modern", "A pipeline that runs every second", "Manual exports"],
      0, ["Match freshness to the need; the morning report doesn't need seconds.", "Newer isn't a requirement.", "That's streaming's cost without its need.", "Manual work is error-prone."])),

    B(2, "Orchestration", ["orchestration", "airflow", "pipelines"], ["x1"], [
      ["What it is", "Running steps in the right order", [
        "An orchestrator schedules pipeline steps, runs them in dependency order, retries failures and shows what ran.",
        "Airflow, Dagster and Prefect are common choices."]],
      ["Core ideas", "Graphs of tasks", [
        "A pipeline is a directed acyclic graph (DAG): each task runs after the tasks it depends on.",
        "Each run is for a logical date or partition, so reruns and backfills target a specific day.",
        "Tasks should be idempotent: rerunning a day replaces that day's output instead of adding to it.",
        "Sensors or events start work when data arrives, not just at a clock time."]],
      ["The trade-offs", "Control against complexity", [
        "An orchestrator adds a system to run and learn, which pays off once there are many dependent jobs.",
        "Heavy work belongs in the engines (warehouse, Spark); the orchestrator should coordinate, not compute.",
        "Too many tiny tasks make the graph hard to read and slow to schedule."]],
      ["In practice", "What you'll see at work", [
        "Alerts on failure and on runs that take far longer than usual.",
        "Backfills run one partition at a time, with limits on parallel runs.",
        "Pipelines kept in version control and reviewed like code."]],
    ], Q("da-b-02", "Data Engineer", ["orchestration", "idempotency"], ["x1"],
      "Rerunning yesterday's pipeline after a fix doubled yesterday's rows in the output table. What design prevents this?",
      ["Make each run replace its own date partition (overwrite or delete-then-insert for that day) instead of appending", "Never rerun pipelines", "Add a DISTINCT to every report", "Run the pipeline twice to check"],
      0, ["Idempotent writes per partition make reruns safe.", "Reruns are how you fix bad data.", "That hides the duplication everywhere.", "It makes the duplication worse."])),

    B(3, "Warehouses and lakes", ["data warehouse", "data lake", "columnar storage"], ["b2"], [
      ["What it is", "Where analytical data lives", [
        "A data warehouse (Snowflake, BigQuery, Redshift) stores structured tables tuned for large analytical queries.",
        "A data lake stores files (often Parquet) in cheap object storage; a lakehouse adds table features on top (Delta, Iceberg)."]],
      ["Core ideas", "Columns and partitions", [
        "Columnar storage keeps each column together, so a query reading 3 of 100 columns reads little, and similar values compress well.",
        "Partitioning splits a table by a column (usually date); filtering on it skips whole partitions.",
        "Clustering or sorting within partitions narrows reads further.",
        "Compute and storage are separate in most cloud warehouses: you pay for what queries scan."]],
      ["The trade-offs", "Cost follows what you scan", [
        "SELECT * on a wide, unpartitioned table can cost real money every run.",
        "Too many small partitions or files slow everything down; too few skip too little.",
        "Lakes are flexible and cheap but need discipline to stay queryable."]],
      ["In practice", "What you'll see at work", [
        "Tables partitioned by event date; queries always filter on it.",
        "Raw, cleaned and modelled layers (sometimes called bronze, silver, gold).",
        "Cost dashboards showing which queries scan the most."]],
    ], Q("da-b-03", "Data Engineer", ["columnar storage", "partitioning"], ["b2"],
      "A daily query scans a 4-year events table to get yesterday's numbers, and it's slow and expensive. What helps most?",
      ["Partition the table by event date and filter on that date, so only yesterday's partition is read", "Add more columns", "Export it to CSV first", "Run it at night"],
      0, ["Partition pruning skips almost all of the data.", "That increases what's stored.", "CSV is slower and larger.", "It's still a full scan."])),

    B(4, "dbt and testing", ["dbt", "analytics engineering", "testing"], ["l2"], [
      ["What it is", "SQL models with software habits", [
        "dbt turns SELECT statements into tables and views in the warehouse, in dependency order.",
        "It brings version control, tests, documentation and code review to SQL transformations."]],
      ["Core ideas", "Models, refs, tests", [
        "Each model is a SELECT in a file; ref('other_model') declares a dependency, so dbt builds a graph.",
        "Tests check models: unique, not_null, accepted values, relationships, plus custom SQL tests.",
        "Incremental models add only new rows instead of rebuilding the whole table.",
        "Documentation and lineage are generated from the project."]],
      ["The trade-offs", "Structure helps until it sprawls", [
        "Hundreds of models with unclear layers become as hard to follow as the scripts they replaced.",
        "Incremental models are faster and need care with late or updated rows.",
        "Tests that always fail get ignored; fix them or remove them."]],
      ["In practice", "What you'll see at work", [
        "Layers: staging (clean the source), intermediate, marts (what reports read).",
        "Every pull request builds and tests the changed models (CI).",
        "Primary keys tested unique and not null on every model."]],
    ], Q("da-b-04", "Analytics Engineer", ["dbt", "testing"], ["l2"],
      "A dbt model's primary key suddenly has duplicates after an upstream change, and dashboards double-count. Which practice catches this before it ships?",
      ["unique and not_null tests on the model's key, run in CI on every change", "Reviewing dashboards weekly", "Making the model a view", "Adding DISTINCT in the dashboard"],
      0, ["The test fails as soon as the key duplicates, before reports use it.", "Too late, and by eye.", "Materialisation doesn't change uniqueness.", "That hides the bug in one place only."])),

    B(5, "Change data capture", ["change data capture", "cdc", "replication"], ["b2", "x1"], [
      ["What it is", "Following every change in a database", [
        "Change data capture (CDC) reads a database's own change log and emits each insert, update and delete as an event.",
        "It keeps a warehouse or another service in step with the source, in near real time."]],
      ["Core ideas", "Logs, not queries", [
        "Log-based CDC (Debezium, for example) reads the write-ahead log or binlog, so it sees every change, deletes included, without loading the source.",
        "Query-based extraction ('WHERE updated_at > last run') misses deletes and rows whose timestamp wasn't updated.",
        "Each event has the before and after values and a position in the log, so consumers can resume where they stopped.",
        "Events usually flow through Kafka to the warehouse or other services."]],
      ["The trade-offs", "Fresh and complete, more to run", [
        "CDC needs access to database logs and careful handling of schema changes.",
        "Consumers must apply events in order per row and cope with duplicates.",
        "A full initial snapshot is needed before the stream of changes makes sense."]],
      ["In practice", "What you'll see at work", [
        "A replica of a production table in the warehouse, minutes behind.",
        "Soft deletes or a deleted flag in the warehouse, so history isn't lost.",
        "Alerts when the CDC connector falls behind the log."]],
    ], Q("da-b-05", "Data Engineer", ["change data capture"], ["b2"],
      "Your nightly extract uses WHERE updated_at > :last_run, and the warehouse still shows customers who were deleted weeks ago. Why?",
      ["Deleted rows no longer exist to be selected, so the query never sees the deletion; log-based CDC captures deletes", "The warehouse is caching", "updated_at is in the wrong time zone", "Deleted customers come back automatically"],
      0, ["A query can only return rows that exist; the delete only appears in the database's log.", "Caching isn't the cause.", "Time zones can skew windows but don't explain missing deletes.", "They don't."])),

    B(6, "Kafka", ["kafka", "event streaming"], ["x1"], [
      ["What it is", "A durable log of events", [
        "Kafka stores streams of events in topics, keeps them for a set time, and lets many consumers read them independently.",
        "It's the backbone between services and pipelines in many companies."]],
      ["Core ideas", "Topics, partitions, offsets, groups", [
        "A topic is split into partitions; events with the same key go to the same partition, which keeps their order.",
        "Each consumer tracks its offset (position) per partition, so it can stop and resume.",
        "A consumer group shares the partitions among its members; adding consumers (up to the partition count) adds throughput.",
        "Events are kept for a retention period whether or not anyone read them, so new consumers can replay history."]],
      ["The trade-offs", "Scale and order, at a price", [
        "Order is guaranteed only within a partition, not across a topic.",
        "The partition count limits parallelism and is awkward to change later.",
        "Delivery is at least once by default; consumers must handle duplicates (exactly-once needs extra setup)."]],
      ["In practice", "What you'll see at work", [
        "Keys chosen by what must stay in order (an account id, an order id).",
        "Schemas for messages kept in a schema registry, changed compatibly.",
        "Consumer lag watched as the main health signal."]],
    ], Q("da-b-06", "Data Engineer", ["kafka"], ["x1"],
      "Events for the same order are sometimes processed out of order. The producer sends them with a random key. What fixes it?",
      ["Use the order id as the message key, so all of an order's events go to one partition and keep their order", "Add more partitions", "Add more consumers", "Increase retention"],
      0, ["Kafka keeps order within a partition; the key decides the partition.", "More partitions spread them further.", "More consumers don't change the ordering rule.", "Retention is about how long events are kept."])),
  ],
});
