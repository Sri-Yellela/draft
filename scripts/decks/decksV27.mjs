#!/usr/bin/env node
// ⭐ D193-5 (47c, owner 11-24: "do the spark lesson") · decks-v27 — ONE deck: Spark, the data-engineering roadmap's station 7
// (the roadmap doc's "Spark, with Databricks folded in": a managed platform is named beside the others, never alone — the
// register's vendor rule). Pathway data, stage building-blocks, after Kafka (da-b-06). In D195's three layers; the real case
// is the RDD paper's own abstract (Zaharia et al., NSDI 2012: "keeping data in memory can improve performance by an order of
// magnitude", read 11-24); the Try is Spark's own quick start (spark-docs, Apache-2.0, registered 11-24). Drafted for the
// owner's review — written to docs/review/. ON APPROVAL: add "Spark" to PLAYBOOK.md Part C (C.2 Building blocks, after
// Kafka), drop `dir`, record "27" in content/decks/approvals.json, run node scripts/pathwaysFromPlaybook.mjs — the roadmap
// page's station 7 already names da-b-07 and links it the moment it is approved.
// node scripts/decks/decksV27.mjs
import { layeredDeck, question, writeBatch } from "./deckKit.mjs";

writeBatch({
  version: 27,
  title: "Spark (the data-engineering roadmap's station 7)",
  note: "Drafted by the agent 2026-11-24 for the owner's review (D193-5: the roadmap's station 7, the owner's 11-24 \"do the spark lesson\"). da-b-07, pathway data, stage building-blocks, in D195's three layers. General knowledge in our own words. Nothing is live until approved (status: draft).",
  decks: [
    layeredDeck("da-b-07", "data", "building-blocks", "Spark", ["spark", "batch processing", "partitioning", "databricks"], ["b1"], [
      ["concept", "What it is", "One job, many machines", [
        "Spark splits a dataset too big for one machine into partitions and runs the same steps on each, in parallel.",
        "You write it once; managed platforms such as Databricks, Amazon EMR or Google Dataproc run the cluster for you."]],
      ["proof", "Why it works", "Partitions, waves and the shuffle", [
        "1 TB in 128 MB partitions is 8,192 tasks; on 200 cores that's about 41 waves of work.",
        "A filter or a map stays on its machine. A groupBy or a join must move rows with the same key together: the shuffle.",
        "The shuffle crosses the network, so filter and aggregate first and shuffle as little as you can."]],
      ["realWorld", "Where it runs", "Zaharia's RDD paper", [
        "Zaharia and colleagues (NSDI 2012) kept data in memory between steps instead of rereading it from disk.",
        "For iterative algorithms and interactive queries, they report it can improve performance by an order of magnitude."]],
      ["realWorld", "Try it", "Spark's quick start", [
        "Follow Spark's quick start: count words in a file, then cache it and run the count twice."]],
    ], { name: "Zaharia et al., Resilient Distributed Datasets (NSDI 2012)", url: "https://www.usenix.org/conference/nsdi12/technical-sessions/presentation/zaharia" },
    { source: "spark-docs", url: "https://spark.apache.org/docs/latest/quick-start.html", label: "Quick start" },
    question("da-b-07-q1", "Data Engineer", "entry", ["spark", "partitioning"], ["b1"],
      "A nightly Spark job joins 2 TB of click events to a small table of 300 campaigns, and most of its time goes to the shuffle. What should the team try first?",
      ["Broadcast the small campaigns table to every machine, so the large side is joined where it already sits",
        "Add more machines and keep the join as it is",
        "Write the events to one big file first",
        "Run the job twice and keep the faster result"], 0,
      ["A broadcast join sends the small table once to each machine, so the 2 TB never moves across the network.",
        "More machines can help, but the same 2 TB still crosses the network in the shuffle.",
        "One file removes the parallelism Spark depends on.",
        "Runs vary a little; the shuffle stays the cost."])),
  ],
});
console.log("decks-v27 written");
