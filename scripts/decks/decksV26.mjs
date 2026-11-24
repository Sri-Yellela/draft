#!/usr/bin/env node
// ⭐ D193-3 (47c, owner 11-23: "the AI engineering course outline APPROVED … The agent drafts the 13 new decks into decks-v26
// for review, under D195's three layers, in the existing format. Nothing shows until approved.") · decks-v26 — the NEW decks of
// docs/D193_AI_ENGINEERING_OUTLINE.md (pathway ml-ai, stage ai-engineering, after ml-ai-01…07). The outline's table marks 14
// lessons new — 1.3, 2.2, 2.3, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3 ("new (Try)"), 5.2, 5.3, 6.2, 6.3, 6.4 — against its count of 13; all
// 14 are drafted so the owner can drop 4.3 into 4.2's Try if it was meant as one. Each deck: concept → the math (the outline's
// own worked number) → a NAMED real case with its link (papers by their arXiv abstract, a tribunal decision, official docs —
// nothing invented) → a Try from an open register source. The owner's (2)(b): lesson 3.3 uses gbrain (MIT). (2)(d): the
// Anthropic guide is link-only (D176-1, 47c) and no deck adapts it; LangChain / LlamaIndex (MIT) are not needed by these 14.
// Written to docs/review/ (outside the served content/decks/). ON APPROVAL: add the 14 topics to PLAYBOOK.md Part C (ML / AI →
// AI engineering, after the seven), drop `dir`, record "26" in content/decks/approvals.json, run node scripts/pathwaysFromPlaybook.mjs.
// node scripts/decks/decksV26.mjs
import { layeredDeck, question, writeBatch } from "./deckKit.mjs";

const AI = (n) => `ml-ai-${String(n).padStart(2, "0")}`;
const HF = (path, label) => ({ source: "huggingface-courses", url: `https://huggingface.co/learn/${path}`, label });
const SMOL = { source: "huggingface-smol-course", url: "https://github.com/huggingface/smol-course", label: "The smol course" };
const q = (id, level, skills, stem, choices, why) => question(`${id}-q1`, "AI Engineer", level, skills, ["s9"], stem, choices, 0, why);
const deck = (n, title, skills, slides, realWorld, tryStep, check) =>
  layeredDeck(AI(n), "ml-ai", "ai-engineering", title, skills, ["s9"], slides, realWorld, tryStep, q(AI(n), ...check));

writeBatch({
  version: 26,
  dir: "docs/review",
  title: "AI engineering, the new lessons (D193-3)",
  note: "Drafted by the agent 2026-11-23 for the owner's review (D193-3, the AI engineering outline approved 11-23). 14 decks, ml-ai-08 … ml-ai-21 (pathway ml-ai, stage ai-engineering), in D195's three layers. Real cases are papers (linked to their arXiv abstracts), a tribunal decision and official docs; every Try is an open register source. General knowledge in our own words. Nothing is live until approved (status: draft).",
  decks: [
    // 1.3 Context engineering
    deck(8, "Context engineering", ["context engineering", "prompting", "llms"], [
      ["concept", "What it is", "Choose what the model sees", [
        "A model answers from what is in its window: the instructions, the retrieved text, the conversation so far.",
        "Context engineering is deciding what goes in, in what order, and what stays out."]],
      ["proof", "Why it works", "The window is a budget", [
        "System prompt 1,000 tokens + 8 retrieved chunks × 500 = 5,000 tokens before a word of history.",
        "In an 8,000-token window that leaves 3,000 for the conversation and the answer.",
        "Every chunk you add is history you drop: the budget forces the choice."]],
      ["realWorld", "Where it runs", "Lost in the middle", [
        "Liu and colleagues (2023): models use facts at the start or end of a long context better than in the middle.",
        "So order matters: put what decides the answer first or last."]],
      ["realWorld", "Try it", "Trim a prompt to budget", [
        "Take a long prompt from the Hugging Face course, count its tokens, and cut it to half without losing the answer."]],
    ], { name: "Lost in the Middle (Liu et al., 2023)", url: "https://arxiv.org/abs/2307.03172" },
    HF("llm-course", "The LLM course"),
    ["entry", ["context engineering"],
      "A support assistant retrieves 20 help-centre passages per question, and answers have got worse since the team raised it from 5. What should they try first?",
      ["Retrieve fewer, better-ranked passages and put the most relevant first, within a fixed token budget",
        "Raise it to 40 passages so the answer is always somewhere in the window",
        "Move the instructions to the middle of the prompt",
        "Remove the instructions to make room for more passages"],
      ["More text dilutes the window and buries the deciding passage; a ranked, budgeted set keeps it where the model uses it.",
        "More passages make the middle longer, where models use facts least.",
        "The middle is where facts are used least; instructions belong at the start.",
        "Without instructions the model no longer knows the task or the format."]]),

    // 2.2 Embeddings and vector search
    deck(9, "Embeddings and vector search", ["embeddings", "vector search", "rag"], [
      ["concept", "What it is", "Meaning as a point in space", [
        "An embedding turns a text into a list of numbers; texts that mean similar things land close together.",
        "Vector search finds the stored texts closest to the question's point."]],
      ["proof", "Why it works", "Cosine similarity and its cost", [
        "Closeness is cosine similarity: a·b / (‖a‖ ‖b‖), 1 for the same direction, 0 for unrelated.",
        "Comparing with every stored vector costs n × d: 1 million vectors × 768 dimensions = 768 million multiply-adds per question.",
        "That's why large stores use approximate indexes that check only a small share of the vectors."]],
      ["realWorld", "Where it runs", "FAISS at billion scale", [
        "FAISS, from Johnson, Douze and Jégou (2017), searches a billion vectors on GPUs with approximate indexes.",
        "It trades a little recall for speed: most of the true nearest neighbours, a small share of the work."]],
      ["realWorld", "Try it", "Nearest neighbours in scikit-learn", [
        "Embed twenty short texts, fit NearestNeighbors with the cosine metric, and query it with a question."]],
    ], { name: "FAISS: billion-scale similarity search (Johnson et al., 2017)", url: "https://arxiv.org/abs/1702.08734" },
    { source: "sklearn-docs", url: "https://scikit-learn.org/stable/modules/neighbors.html", label: "Nearest neighbors" },
    ["entry", ["vector search", "embeddings"],
      "A team's vector search over 50 million passages takes two seconds per query with exact search. Users need answers in under 200 ms. What's the usual fix?",
      ["An approximate nearest-neighbour index, checking recall on a labelled sample against exact search",
        "Shorten every passage to one sentence",
        "Switch from cosine similarity to keyword matching",
        "Search only the first million passages"],
      ["Approximate indexes cut the work per query by orders of magnitude; measuring recall shows what the speed costs.",
        "The number of vectors, not passage length, drives the n × d cost.",
        "That drops the meaning-based matching the team chose vectors for.",
        "Fast, but the other 49 million passages can never be found."]]),

    // 2.3 Hybrid search and reranking
    deck(10, "Hybrid search and reranking", ["hybrid search", "reranking", "rag"], [
      ["concept", "What it is", "Two searches, one list", [
        "Keyword search finds exact terms such as error codes; vector search finds meaning.",
        "Hybrid search runs both and fuses the two ranked lists into one."]],
      ["proof", "Why it works", "Reciprocal rank fusion", [
        "Each passage scores Σ 1 / (60 + rank) over the lists it appears in.",
        "Ranked 1st by keywords and 3rd by vectors: 1/61 + 1/63 = 0.0323. Ranked 2nd in one list only: 1/62 = 0.0161.",
        "A passage both searches agree on rises, with no score tuning between them."]],
      ["realWorld", "Where it runs", "Cormack's fusion, in production search", [
        "Cormack, Clarke and Büttcher (2009) showed this simple rank fusion beat the individual rankings it combined.",
        "Search services now use it for hybrid queries; Azure AI Search documents RRF for exactly this."]],
      ["realWorld", "Try it", "Fuse two lists", [
        "Read Azure AI Search's hybrid ranking page, then fuse two ranked lists of five by hand."]],
    ], { name: "Cormack et al., Reciprocal Rank Fusion (SIGIR 2009)", url: "https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf" },
    { source: "microsoft-learn-docs", url: "https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking", label: "Relevance scoring in hybrid search (RRF)" },
    ["mid", ["hybrid search", "rag"],
      "An internal assistant's vector search misses questions that quote exact error codes like E4021, though the right page contains the code. What should the team add?",
      ["A keyword search alongside the vector search, fused by rank",
        "A larger embedding model",
        "More passages per question from the vector search alone",
        "A rule that strips numbers from questions"],
      ["Exact tokens such as codes are what keyword search is good at; fusion keeps the vector results for the rest.",
        "Codes carry little meaning for an embedding; a bigger model doesn't fix that reliably.",
        "More of the same ranking still ranks the code page low.",
        "It removes the one term that identifies the page."]]),

    // 3.2 Orchestration
    deck(11, "Agent loops: plans and stopping", ["agents", "orchestration", "tool use"], [
      ["concept", "What it is", "Think, act, look, repeat", [
        "An agent loop asks the model for the next step, runs it, shows the result, and asks again.",
        "Orchestration decides the plan, the order and, above all, when to stop."]],
      ["proof", "Why it works", "Why loops need a stopping rule", [
        "If each step is right 95 % of the time, ten steps in a row are right 0.95¹⁰ ≈ 60 % of the time.",
        "A cap of 10 steps × 2,000 tokens a step is a ceiling of 20,000 tokens per task.",
        "Without a cap, a confused loop spends without limit and gets less likely to be right."]],
      ["realWorld", "Where it runs", "ReAct", [
        "ReAct (Yao and colleagues, 2022) interleaves reasoning with actions, reading each result before the next step.",
        "Agent frameworks still use this loop, with a step limit."]],
      ["realWorld", "Try it", "Add a cap and a stop", [
        "In the Hugging Face Agents Course, give an agent a step cap and a rule that stops it when the answer is found."]],
    ], { name: "ReAct (Yao et al., 2022)", url: "https://arxiv.org/abs/2210.03629" },
    HF("agents-course", "The Agents Course"),
    ["mid", ["agents", "orchestration"],
      "An agent that books meeting rooms sometimes loops for minutes, retrying the same failing calendar call. What should the team add first?",
      ["A step cap and a stop rule that returns the error to the person after repeated failures",
        "A bigger model so it reasons better",
        "Longer timeouts on the calendar call",
        "A second agent to watch the first"],
      ["It bounds cost and time, and hands the person what the agent couldn't do.",
        "May reduce loops, but nothing stops the next one.",
        "Each retry just waits longer.",
        "Two loops can run without limit as easily as one."]]),

    // 3.3 Memory
    deck(12, "Agent memory", ["agents", "memory", "summarisation"], [
      ["concept", "What it is", "What an agent keeps between turns", [
        "A model remembers nothing between calls; memory is what you choose to send back in.",
        "Keep everything and the window fills; keep nothing and the agent forgets the person."]],
      ["proof", "Why it works", "History grows, summaries don't", [
        "20 turns × 400 tokens = 8,000 tokens of history, and it grows with every turn.",
        "A 300-token summary plus the last two turns (800 tokens) stays at about 1,100, however long the conversation.",
        "Retrieval (lesson 2.2) brings back an old detail only when the question needs it."]],
      ["realWorld", "Where it runs", "MemGPT's paging", [
        "MemGPT (Packer and colleagues, 2023) treats the window like a computer's main memory and moves older text to storage and back.",
        "The agent itself decides what to page in, as an operating system pages memory."]],
      ["realWorld", "Try it", "A second brain, from a repo", [
        "Read how the gbrain repository stores and recalls notes, then summarise a 20-turn chat to 300 tokens."]],
    ], { name: "MemGPT (Packer et al., 2023)", url: "https://arxiv.org/abs/2310.08560" },
    { source: "gbrain", url: "https://github.com/garrytan/gbrain", label: "gbrain" },
    ["mid", ["memory", "agents"],
      "A coaching assistant forgets a person's goals after a long chat, and its cost per message keeps climbing. What design fixes both?",
      ["A short running summary of the person's goals plus the last few turns, with older details retrieved when needed",
        "Send the full history on every message",
        "Start a fresh conversation every ten messages",
        "Raise the model's maximum output length"],
      ["The summary stays flat in cost and keeps what matters; retrieval brings back specifics on demand.",
        "Cost grows with every turn and early goals end up mid-window.",
        "Cheap, but the agent forgets everything at each restart.",
        "Output length has nothing to do with what the model remembers."]]),

    // 3.4 Human in the loop
    deck(13, "Human in the loop", ["agents", "human in the loop", "ai safety"], [
      ["concept", "What it is", "When the agent must ask", [
        "Some actions are cheap to undo, some are not: a draft can be rewritten, a payment can't be unsent.",
        "Human in the loop means the agent stops and asks before the actions that matter."]],
      ["proof", "Why it works", "Ask when the expected cost is higher", [
        "Ask when P(wrong) × cost of a wrong action > cost of asking.",
        "A wrong refund costs $500; wrong 2 % of the time, that's $10 per action. A check costs $2, so ask.",
        "A wrong email label costs $0.10: 2 % of that is $0.002, far below $2, so don't."]],
      ["realWorld", "Where it broke", "Air Canada's chatbot, 2024", [
        "Air Canada's chatbot told a customer he could claim a bereavement fare after travelling; the policy said otherwise.",
        "In Moffatt v. Air Canada (2024), the tribunal held the airline responsible for what its chatbot said."]],
      ["realWorld", "Try it", "Set three thresholds", [
        "Using the Agents Course's tool examples, decide for three actions whether the agent acts alone or asks first."]],
    ], { name: "Moffatt v. Air Canada, 2024 BCCRT 149", url: "https://www.canlii.org/en/bc/bccrt/doc/2024/2024bccrt149/2024bccrt149.html" },
    HF("agents-course", "The Agents Course"),
    ["entry", ["human in the loop", "agents"],
      "A job-application agent can fill forms, save drafts and press Submit. Which should wait for the person's approval?",
      ["Pressing Submit, because a sent application can't be taken back",
        "Saving a draft",
        "Filling the form fields",
        "None: the agent is right most of the time"],
      ["The irreversible, costly action is the one where a check pays for itself.",
        "A draft is private and easy to change.",
        "Filled fields can be reviewed and corrected before sending.",
        "Being right most of the time still means some wrong, irreversible sends."]]),

    // 4.1 Fine-tune or prompt
    deck(14, "Fine-tune or prompt?", ["fine-tuning", "prompting", "llm cost"], [
      ["concept", "What it is", "Two ways to adapt a model", [
        "Prompting teaches the task in every request; fine-tuning teaches it once, in the weights.",
        "Start with prompting: it's cheap to change. Fine-tune when the prompt is long, repeated and stable."]],
      ["proof", "Why it works", "The break-even", [
        "A fine-tune costs $300 once and saves 1,500 prompt tokens a call.",
        "At $3 per million input tokens, that saves $0.0045 a call: $300 ÷ $0.0045 ≈ 67,000 calls to break even.",
        "At 10,000 calls a day, about a week. At 100 a day, nearly two years."]],
      ["realWorld", "Where it runs", "LIMA: a thousand examples", [
        "LIMA (Zhou and colleagues, 2023) fine-tuned a 65-billion-parameter model on only 1,000 carefully chosen examples.",
        "Quality of the examples mattered more than their number."]],
      ["realWorld", "Try it", "Find one feature's break-even", [
        "Read the smol course's notes on when to fine-tune, then work out the break-even for one feature you know."]],
    ], { name: "LIMA: Less Is More for Alignment (Zhou et al., 2023)", url: "https://arxiv.org/abs/2305.11206" },
    SMOL,
    ["mid", ["fine-tuning", "llm cost"],
      "A feature sends the same 2,000-token instructions with every one of 50,000 calls a day, and the instructions haven't changed in months. What should the team evaluate?",
      ["Fine-tuning a model on the task, comparing its break-even and quality with the prompted version",
        "Adding more examples to the prompt",
        "Switching to a larger model with a bigger window",
        "Nothing: prompts are always cheaper"],
      ["Long, stable, high-volume instructions are where a fine-tune pays back quickly; measure quality before switching.",
        "Makes every call longer and dearer.",
        "Costs more per call and leaves the repeated instructions in place.",
        "At this volume, the repeated tokens are the main cost."]]),

    // 4.2 LoRA
    deck(15, "LoRA and small models", ["lora", "fine-tuning", "small models"], [
      ["concept", "What it is", "Train a small update, not the whole model", [
        "LoRA freezes the model's weights and trains a small add-on for some of its layers.",
        "The add-on is tiny, so training needs less memory and the result is easy to swap."]],
      ["proof", "Why it works", "A low-rank update", [
        "A d × d weight update is written as B · A, two thin matrices of rank r: 2dr numbers instead of d².",
        "With d = 4,096 and r = 8: 65,536 numbers instead of 16.8 million, about 0.39 %.",
        "Small r works because the useful change to a big model tends to lie in few directions."]],
      ["realWorld", "Where it runs", "The LoRA paper", [
        "Hu and colleagues (2021) applied LoRA to GPT-3 175B: 10,000 times fewer trainable parameters and a third of the GPU memory.",
        "Quality matched or beat full fine-tuning on their benchmarks."]],
      ["realWorld", "Try it", "The smol course's LoRA notebook", [
        "Run the smol course's LoRA exercise and count the trainable parameters before and after."]],
    ], { name: "LoRA: Low-Rank Adaptation (Hu et al., 2021)", url: "https://arxiv.org/abs/2106.09685" },
    SMOL,
    ["mid", ["lora", "fine-tuning"],
      "A team needs one base model adapted for five customers, each with its own style, on a single GPU. What fits best?",
      ["One frozen base model with a small LoRA adapter per customer, loaded as needed",
        "Five full fine-tuned copies of the model",
        "One prompt that describes all five styles",
        "Train a new model from scratch per customer"],
      ["Adapters are small, so five fit beside one base model on one GPU.",
        "Five full copies need five times the memory and storage.",
        "One prompt can't hold five styles reliably, and grows with each customer.",
        "Far beyond the data and compute a single GPU offers."]]),

    // 4.3 A fine-tuning run from a config file
    deck(16, "A fine-tuning run from a config", ["fine-tuning", "training", "qlora"], [
      ["concept", "What it is", "A run you can repeat", [
        "A fine-tuning run is a config: the base model, the data, the epochs, the batch size, the learning rate.",
        "Kept in a file, the run can be reviewed, repeated and compared."]],
      ["proof", "Why it works", "Counting the steps", [
        "Steps = examples × epochs ÷ batch size: 2,000 × 3 ÷ 16 = 375 steps.",
        "Double the batch and you halve the steps; each step needs more memory.",
        "Checkpoint every 125 steps and you can compare three versions on the same eval set."]],
      ["realWorld", "Where it runs", "QLoRA on one GPU", [
        "QLoRA (Dettmers and colleagues, 2023) fine-tuned a 65-billion-parameter model on a single 48 GB GPU.",
        "It stores the frozen model in 4 bits and trains LoRA adapters on top."]],
      ["realWorld", "Try it", "Run the smol course's config", [
        "Run the smol course's fine-tuning config, change one value, and compare the two runs' eval scores."]],
    ], { name: "QLoRA (Dettmers et al., 2023)", url: "https://arxiv.org/abs/2305.14314" },
    SMOL,
    ["entry", ["fine-tuning", "training"],
      "Two engineers fine-tuned the same model and got different results, and neither can say exactly what they ran. What should the team change?",
      ["Keep every run's settings in a versioned config file and evaluate each run on the same held-out set",
        "Let only one engineer run fine-tunes",
        "Always train for more epochs",
        "Pick whichever result looks better on a few examples"],
      ["A config makes the run repeatable and comparable; a fixed eval set makes the comparison fair.",
        "Hides the problem; that one engineer's runs still can't be reproduced.",
        "More epochs can overfit, and the difference stays unexplained.",
        "A few hand-picked examples are not a measurement."]]),

    // 5.2 Evals from production logs
    deck(17, "Evals from real use", ["llm evaluation", "evals", "sampling"], [
      ["concept", "What it is", "Test on what people actually ask", [
        "Benchmarks measure a model on someone else's questions; your users ask their own.",
        "An eval set sampled from real logs, with private data removed, measures your feature."]],
      ["proof", "Why it works", "How many samples you need", [
        "A pass rate's margin is about 1.96 × √(p(1 − p) / n).",
        "With 400 samples and p = 0.5: 1.96 × 0.025 ≈ ± 4.9 points.",
        "For ± 3 points you need (1.96 ÷ 0.03)² × 0.25 ≈ 1,067 samples."]],
      ["realWorld", "Where it runs", "Chatbot Arena", [
        "Chatbot Arena (Chiang and colleagues, 2024) ranks models from people's own questions, voted on two answers at a time.",
        "Its rankings come from real prompts, not a fixed test set."]],
      ["realWorld", "Try it", "Size a sample", [
        "Using the ML Crash Course's notes on data, size an eval sample for ± 3 points and draw it from a log."]],
    ], { name: "Chatbot Arena (Chiang et al., 2024)", url: "https://arxiv.org/abs/2403.04132" },
    { source: "google-developers", url: "https://developers.google.com/machine-learning/crash-course", label: "Machine Learning Crash Course" },
    ["mid", ["evals", "sampling"],
      "A team reports their assistant improved from 70 % to 74 % on 100 hand-written test questions. What's the main problem?",
      ["100 questions give a margin of about ± 9 points, and hand-written questions may not match what users ask",
        "74 % is too low to report",
        "They should have used 50 questions to move faster",
        "Nothing: four points is a clear improvement"],
      ["At n = 100 the change is inside the noise, and the set may not represent real use.",
        "The level isn't the issue; whether the change is real is.",
        "Fewer questions make the margin wider still.",
        "Four points is well inside a ± 9-point margin."]]),

    // 5.3 Regression suites
    deck(18, "Regression suites for prompts and models", ["llm evaluation", "regression testing", "evals"], [
      ["concept", "What it is", "Re-run the same test on every change", [
        "A prompt edit or a model update can fix one thing and break another.",
        "A regression suite runs a fixed eval set on every change and compares it with the last version."]],
      ["proof", "Why it works", "A drop inside the margin", [
        "Version 1 passes 82 % of 400 items; version 2 passes 79 %.",
        "The margin at p ≈ 0.8 and n = 400 is 1.96 × √(0.16 / 400) ≈ ± 3.9 points: a 3-point drop is noise.",
        "A 10-point drop is not: block the change and read the items that flipped."]],
      ["realWorld", "Where it broke", "The same model, three months apart", [
        "Chen, Zaharia and Zou (2023) asked GPT-4 the same questions in March and June 2023.",
        "On one task, identifying prime numbers, accuracy fell from 84 % to 51 %: behaviour changed under the same name."]],
      ["realWorld", "Try it", "Compare two prompt versions", [
        "Following the course's evaluation chapter, run two prompt versions on one set and list the items that changed."]],
    ], { name: "Chen et al., 2023: How is ChatGPT's behavior changing over time?", url: "https://arxiv.org/abs/2307.09009" },
    HF("llm-course", "The LLM course"),
    ["mid", ["regression testing", "evals"],
      "A model provider updates the model behind the same name, and your summaries start missing dates. What would have caught it?",
      ["A regression suite that re-runs a fixed eval set on a schedule and when the model version changes",
        "Reading a few summaries by hand each month",
        "Asking the provider to never change the model",
        "A longer prompt"],
      ["A fixed set run on every change shows the drop and the exact items that flipped.",
        "Too few, too late, and easy to miss a pattern.",
        "You can pin versions where offered, but you still need to test before moving.",
        "Doesn't detect anything."]]),

    // 6.2 Text-to-SQL
    deck(19, "Text-to-SQL that can't drop a table", ["text-to-sql", "sql", "least privilege"], [
      ["concept", "What it is", "Let the database say no", [
        "A model that writes SQL can write any SQL, including DELETE and DROP.",
        "Don't rely on the prompt to prevent it; run the query as a role that can only read."]],
      ["proof", "Why it works", "Zero, whatever the model writes", [
        "A role granted SELECT only can't run INSERT, UPDATE, DELETE or DROP: the database refuses them.",
        "So the number of damaging statements that can succeed is zero, whatever the model generates.",
        "Add a statement timeout, say 5 seconds, and one bad query can't hold the database either."]],
      ["realWorld", "Where it runs", "PostgreSQL's privileges", [
        "PostgreSQL's GRANT gives a role exactly the commands it may run, table by table.",
        "The same idea is in every major database: least privilege, enforced below the application."]],
      ["realWorld", "Try it", "Run generated SQL read-only", [
        "From the PostgreSQL privileges chapter, create a read-only role and confirm it can't delete a row."]],
    ], { name: "PostgreSQL GRANT", url: "https://www.postgresql.org/docs/current/sql-grant.html" },
    { source: "postgres-docs", url: "https://www.postgresql.org/docs/current/ddl-priv.html", label: "Privileges" },
    ["entry", ["text-to-sql", "least privilege"],
      "A reporting assistant turns questions into SQL and runs them on the analytics database. How do you make sure it can't change data?",
      ["Run its queries as a database role granted SELECT only, with a statement timeout",
        "Tell the model in the prompt never to write DELETE",
        "Block queries that contain the word DROP",
        "Review each query by hand afterwards"],
      ["The database itself refuses writes, whatever the model produces.",
        "Prompts can be ignored or overridden by an injected instruction.",
        "Easy to get around, and misses UPDATE and DELETE.",
        "Afterwards is too late for a write."]]),

    // 6.3 Model migration and canary rollout
    deck(20, "Model migration and canary rollout", ["model migration", "canary", "deployment"], [
      ["concept", "What it is", "Moving a feature to a new model", [
        "A new model can be better on average and worse on your cases.",
        "Migrate like any risky deploy: a small share of traffic first, watched, with a way back."]],
      ["proof", "Why it works", "The blast radius", [
        "A 5 % canary on a model that fails 10 % of requests fails 0.5 % of all requests.",
        "At 2,000 requests an hour, the canary still sees 100 an hour to judge from.",
        "Compare the canary's pass rate on the regression set with the old model's before going wider."]],
      ["realWorld", "Where it broke", "Cloudflare, 2 July 2019", [
        "Cloudflare pushed one firewall rule to every server at once, and its regular expression drove CPUs to 100 %.",
        "About 27 minutes of errors; such changes now roll out in stages."]],
      ["realWorld", "Try it", "A rolling update, then roll back", [
        "Follow the Kubernetes rolling-update tutorial: move to a new version, watch it, and roll back."]],
    ], { name: "Cloudflare's outage of 2 July 2019", url: "https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/" },
    { source: "kubernetes-docs", url: "https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/", label: "Performing a rolling update" },
    ["mid", ["model migration", "canary"],
      "A cheaper model scores the same as the current one on a public benchmark. How should the team switch their feature to it?",
      ["Run their own regression set on it, then send a small share of traffic to it, watched, with automatic rollback",
        "Switch all traffic at once, since the benchmark scores match",
        "Switch on a Friday evening when traffic is low",
        "Ask users to report problems after the switch"],
      ["Their own cases and a small, watched share limit the damage if the new model is worse where it matters.",
        "A public benchmark isn't their feature; every user meets any regression at once.",
        "Low traffic means less signal and fewer people to fix it.",
        "Users find problems late and only some report them."]]),

    // 6.4 Monitoring an LLM feature
    deck(21, "Monitoring an LLM feature", ["monitoring", "slo", "latency"], [
      ["concept", "What it is", "Know before users tell you", [
        "An LLM feature fails like any service (errors, slowness) and in its own ways: empty or wrong answers.",
        "Monitoring watches both, against targets you set in advance."]],
      ["proof", "Why it works", "Error budgets and the p95", [
        "A 99.9 % availability target over 30 days allows 43.2 minutes of failure: the error budget.",
        "If 90 requests take 1 s and 10 take 11 s, the mean is 2 s; the p95 is 11 s.",
        "Alert on the p95, not the mean: the slow tail is what users feel."]],
      ["realWorld", "Where it runs", "Google's SRE practice", [
        "Google's SRE book describes error budgets: when the budget is spent, releases pause until reliability recovers.",
        "Teams running LLM features add answer quality, sampled and scored, to the same dashboards."]],
      ["realWorld", "Try it", "Set an alert on the p95", [
        "Using the ML Crash Course's production section, pick a p95 latency target and an alert for one feature."]],
    ], { name: "Google's SRE book, error budgets", url: "https://sre.google/sre-book/embracing-risk/" },
    { source: "google-developers", url: "https://developers.google.com/machine-learning/crash-course/production-ml-systems", label: "Production ML systems" },
    ["entry", ["monitoring", "latency"],
      "An assistant's average response time is a healthy 2 seconds, yet users complain it's slow. What should the team look at?",
      ["The p95 and p99 latency, where a slow tail hides behind the average",
        "The average over a longer period",
        "The number of requests per day",
        "The model's benchmark scores"],
      ["A few very slow answers barely move the mean but are what those users feel.",
        "A longer average hides the tail even more.",
        "Volume doesn't show how long each person waits.",
        "Benchmarks say nothing about this feature's latency."]]),
  ],
});
console.log("decks-v26 written");
