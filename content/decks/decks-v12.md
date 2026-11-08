# Decks v12 — ML and AI engineering, Case studies and Interview (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 6 five-slide decks; each ends with one new question (drafts for the bank). **Nothing is live until you approve** — say "approve decks-v12" (or name the decks to change).

## ml-c-01 · A fraud model
*Skills:* fraud detection, imbalanced data · *Check yourself:* ml-c-01-q1

**1. What it is — Catching the few bad transactions**
- A fraud model scores each transaction's risk so the riskiest can be blocked or reviewed.
- Fraud is rare, fast-changing and adversarial: people actively try to get past the model.

**2. Core ideas — Features, labels, decisions**
- Features: amount, merchant, device, location, how this compares with the customer's usual behaviour, velocity (how many in the last hour).
- Labels arrive late (chargebacks take weeks), so training data lags reality.
- Rare positives: use PR AUC, class weights or resampling, and judge precision and recall at the operating threshold.
- Scores become actions: approve, step-up check, manual review, block.

**3. The trade-offs — Losses against friction**
- Blocking more stops more fraud and annoys more honest customers.
- Fraudsters adapt, so performance decays; retrain often and monitor.
- Rules and models together: rules for known patterns, the model for the rest.

**4. In practice — What it looks like**
- Real-time scoring under tight latency (tens of milliseconds).
- A review queue sized to the team's capacity.
- Feedback from reviewers fed back as labels.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-c-01-q1).** Your fraud model is trained on last year's chargebacks. Labels for the last six weeks aren't in yet. What's the risk?
- ✅ The newest fraud patterns aren't in training; monitor recent performance and use faster signals (reviewer decisions, customer reports) as interim labels — *Fraud changes quickly; delayed labels mean the model learns old tactics.*
- None; a year is plenty — *Recency matters more than volume here.*
- The model will overfit to six weeks — *It's missing them, not overfitting to them.*
- Chargebacks are always wrong — *They're the most reliable label, just slow.*

## ml-c-02 · Search ranking
*Skills:* learning to rank, search · *Check yourself:* ml-c-02-q1

**1. What it is — Putting the best result first**
- Search ranking orders the results a search engine retrieves, so the most useful appear at the top.
- It's usually a model trained on what people clicked, bought or applied to.

**2. Core ideas — Retrieve, then rank**
- Retrieval finds candidates fast (keyword and vector search); ranking scores a few hundred carefully.
- Features: text match, freshness, popularity, personal signals, quality.
- Learning-to-rank models (gradient-boosted trees, neural rankers) optimise the order, measured by NDCG or precision at k.
- Clicks are biased by position: people click the top more because it's at the top.

**3. The trade-offs — Relevance, freshness, fairness**
- Optimising clicks can reward clickbait; use stronger signals (purchases, long dwell).
- Personalisation helps relevance and narrows what people see.
- Offline gains need online A/B tests to confirm.

**4. In practice — What it looks like**
- Logged impressions with positions, so position bias can be corrected.
- Human-rated query sets for offline evaluation.
- Business rules after ranking (no unavailable items).

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-c-02-q1).** A ranking model trained on clicks keeps promoting whatever is already at the top. Why?
- ✅ Position bias: top results get more clicks because of their position; correct for it (randomised slots, inverse propensity weighting) — *Without correcting for position, the model learns 'being on top earns clicks'.*
- The model is too small — *Size doesn't remove the bias.*
- Clicks are always random — *They aren't random; they're biased.*
- There are too many results — *Not the cause.*

## ml-c-03 · A support assistant with retrieval
*Skills:* rag, customer support, llm · *Check yourself:* ml-c-03-q1

**1. What it is — Answering customers from your own help content**
- A support assistant answers questions using the help centre, policies and the customer's own account, and hands off to people when it should.
- It's a RAG system with permissions, tone and escalation.

**2. Core ideas — Ground, cite, escalate**
- Retrieve from approved help articles, filtered by product and region.
- Account data (orders, plan) comes through tools that only see that customer's records.
- Answers cite their sources; with no good source, say so and offer a person.
- Escalate on frustration, money, legal or safety topics, or low confidence.

**3. The trade-offs — Deflection against trust**
- Answering more questions automatically saves cost and risks confident wrong answers.
- Stale help articles produce stale answers; content needs owners.
- Customers need to know they're talking to AI and how to reach a person.

**4. In practice — What it looks like**
- An eval set built from real tickets, with correct answers.
- Resolution rate and escalation rate tracked together, not deflection alone.
- Human review of a sample of conversations each week.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-c-03-q1).** A customer asks the support assistant to reverse a large charge. Policy for refunds over a threshold isn't in the help centre. What should the assistant do?
- ✅ Say it can't decide that, and hand the customer to a person with the context so far — *Money decisions without a source belong with a person, and the hand-off saves the customer repeating themselves.*
- Approve the refund to keep the customer happy — *It has no authority or policy for that.*
- Invent a policy that sounds reasonable — *That's a hallucinated commitment.*
- Ignore the question — *Unhelpful and frustrating.*

## ml-c-04 · An agent with tools
*Skills:* agents, tool use · *Check yourself:* ml-c-04-q1

**1. What it is — A model that completes a task in steps**
- An agent uses tools (search, a calendar, a database) in a loop to finish a multi-step task, such as 'find three suitable flights and draft an email'.
- Its value and its risk both come from acting, not just answering.

**2. Core ideas — Plan, act, check**
- Give a clear goal, a few well-described tools, and limits (steps, budget, time).
- The loop: choose a tool, run it, read the result, decide the next step.
- Check progress against the goal; stop when done or stuck.
- Irreversible actions wait for a person's confirmation.

**3. The trade-offs — Autonomy against reliability**
- Each step can fail; a ten-step task with 95 % per-step success fails often.
- Long runs cost more and are harder to debug.
- Narrower agents (one job, few tools) are far more reliable than general ones.

**4. In practice — What it looks like**
- Every step traced, so failures can be replayed.
- Evals on whole tasks, measuring success rate, cost and steps.
- Fallback to a person when the agent stops making progress.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-c-04-q1).** An agent succeeds at each step 95 % of the time and needs 12 steps per task. Roughly how often does a whole task succeed, and what helps?
- ✅ About 54 % (0.95¹²); fewer, more reliable steps and checks between them help — *Errors compound; shortening the chain and verifying steps raises task success.*
- 95 %, the same as one step — *Each step is another chance to fail.*
- Almost 100 %, because steps average out — *Failures multiply, they don't average out.*
- 0 %, agents never finish — *They often do, at that rate about half the time.*

## ml-iv-01 · ML system design rounds
*Skills:* ml system design interview · *Check yourself:* ml-iv-01-q1

**1. What it is — Design an ML-powered product feature**
- You're asked to design something like a feed ranker, a spam filter or a recommendation system end to end.
- They score how you frame the problem, the data, the model, evaluation and serving — not just the algorithm.

**2. Core ideas — A structure to follow**
- Clarify the goal and how success is measured, online and offline.
- Data: sources, labels, how fresh, how biased.
- Model: a simple baseline first, then what you'd add; features and how they're computed.
- Serving and monitoring: latency, scale, drift, feedback loops.

**3. The trade-offs — Practical over fancy**
- Jumping to a deep model before discussing data and metrics loses points.
- Say what you'd ship first and how you'd learn from it.
- Name risks: leakage, cold start, bias, feedback loops.

**4. In practice — How to prepare**
- Practise four or five classic ML designs out loud.
- Always define the metric before the model.
- Draw the data flow from raw events to predictions and back.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-iv-01-q1).** In an ML system design round for a spam filter, what should come before choosing a model?
- ✅ The goal and metrics (which mistakes cost more), the data and labels, and how predictions will be used — *Framing decides everything else and is a big part of the score.*
- Picking the deepest neural network — *Model choice without framing looks naive.*
- Choosing a GPU type — *Hardware comes far later.*
- Writing the training loop — *Implementation detail too early.*

## ml-iv-02 · Model debugging rounds
*Skills:* model debugging · *Check yourself:* ml-iv-02-q1

**1. What it is — Something is wrong with a model; find it**
- You're told a model behaves badly (great offline, poor online; suddenly worse; unfair to a group) and asked how you'd investigate.
- They're checking for a methodical approach.

**2. Core ideas — Data first**
- Check the data pipeline: did inputs change, break or go missing?
- Compare training and production feature distributions (skew, drift).
- Look for leakage that inflated offline results.
- Slice errors by segment to find where it fails.

**3. The trade-offs — Hypotheses, not guesses**
- Retraining immediately can hide the cause and repeat it.
- Most model problems are data problems.
- Say what evidence would confirm or rule out each hypothesis.

**4. In practice — How to prepare**
- Practise a checklist: data, features, labels, split, metric, serving.
- Prepare a story of a real model you debugged.
- Talk through the cheapest checks first.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-iv-02-q1).** A model's online accuracy dropped sharply yesterday. What do you check first?
- ✅ The input data: a broken upstream pipeline, missing or changed features, a new data source — *A sudden drop with no model change usually means the inputs changed.*
- The model's architecture — *It didn't change yesterday.*
- The choice of optimiser — *Training detail, not a sudden online change.*
- Whether to add more layers — *Doesn't address a sudden drop.*
