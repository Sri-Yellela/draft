# Decks v27 — Spark (the data-engineering roadmap's station 7) (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 1 five-slide decks, each with one new question. **APPROVED by the owner 2026-11-24** — served in the Library; the questions are live in the bank.

## da-b-07 · Spark
*Skills:* spark, batch processing, partitioning, databricks · *Check yourself:* da-b-07-q1

*D195 layers:* concept → proof → real world · *plays in* 51.7 s (concept 13.4 · proof 19 · real world 19.3) · *real world:* [Zaharia et al., Resilient Distributed Datasets (NSDI 2012)](https://www.usenix.org/conference/nsdi12/technical-sessions/presentation/zaharia) · *Try:* [Quick start](https://spark.apache.org/docs/latest/quick-start.html) (`spark-docs`)

**1. What it is — One job, many machines** *(concept)*
- Spark splits a dataset too big for one machine into partitions and runs the same steps on each, in parallel.
- You write it once; managed platforms such as Databricks, Amazon EMR or Google Dataproc run the cluster for you.

**2. Why it works — Partitions, waves and the shuffle** *(proof)*
- 1 TB in 128 MB partitions is 8,192 tasks; on 200 cores that's about 41 waves of work.
- A filter or a map stays on its machine. A groupBy or a join must move rows with the same key together: the shuffle.
- The shuffle crosses the network, so filter and aggregate first and shuffle as little as you can.

**3. Where it runs — Zaharia's RDD paper** *(realWorld)*
- Zaharia and colleagues (NSDI 2012) kept data in memory between steps instead of rereading it from disk.
- For iterative algorithms and interactive queries, they report it can improve performance by an order of magnitude.

**4. Try it — Spark's quick start** *(realWorld)*
- Follow Spark's quick start: count words in a file, then cache it and run the count twice.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (da-b-07-q1).** A nightly Spark job joins 2 TB of click events to a small table of 300 campaigns, and most of its time goes to the shuffle. What should the team try first?
- ✅ Broadcast the small campaigns table to every machine, so the large side is joined where it already sits — *A broadcast join sends the small table once to each machine, so the 2 TB never moves across the network.*
- Add more machines and keep the join as it is — *More machines can help, but the same 2 TB still crosses the network in the shuffle.*
- Write the events to one big file first — *One file removes the parallelism Spark depends on.*
- Run the job twice and keep the faster result — *Runs vary a little; the shuffle stays the cost.*
