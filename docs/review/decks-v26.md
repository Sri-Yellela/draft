# Decks v26 — AI engineering, the new lessons (D193-3) (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 14 five-slide decks; each ends with one new question (drafts for the bank). **Nothing is live until you approve** — say "approve decks-v26" (or name the decks to change).

## ml-ai-08 · Context engineering
*Skills:* context engineering, prompting, llms · *Check yourself:* ml-ai-08-q1

*D195 layers:* concept → proof → real world · *plays in* 46.1 s (concept 11.5 · proof 14.8 · real world 19.8) · *real world:* [Lost in the Middle (Liu et al., 2023)](https://arxiv.org/abs/2307.03172) · *Try:* [The LLM course](https://huggingface.co/learn/llm-course) (`huggingface-courses`)

**1. What it is — Choose what the model sees** *(concept)*
- A model answers from what is in its window: the instructions, the retrieved text, the conversation so far.
- Context engineering is deciding what goes in, in what order, and what stays out.

**2. Why it works — The window is a budget** *(proof)*
- System prompt 1,000 tokens + 8 retrieved chunks × 500 = 5,000 tokens before a word of history.
- In an 8,000-token window that leaves 3,000 for the conversation and the answer.
- Every chunk you add is history you drop: the budget forces the choice.

**3. Where it runs — Lost in the middle** *(realWorld)*
- Liu and colleagues (2023): models use facts at the start or end of a long context better than in the middle.
- So order matters: put what decides the answer first or last.

**4. Try it — Trim a prompt to budget** *(realWorld)*
- Take a long prompt from the Hugging Face course, count its tokens, and cut it to half without losing the answer.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-08-q1).** A support assistant retrieves 20 help-centre passages per question, and answers have got worse since the team raised it from 5. What should they try first?
- ✅ Retrieve fewer, better-ranked passages and put the most relevant first, within a fixed token budget — *More text dilutes the window and buries the deciding passage; a ranked, budgeted set keeps it where the model uses it.*
- Raise it to 40 passages so the answer is always somewhere in the window — *More passages make the middle longer, where models use facts least.*
- Move the instructions to the middle of the prompt — *The middle is where facts are used least; instructions belong at the start.*
- Remove the instructions to make room for more passages — *Without instructions the model no longer knows the task or the format.*

## ml-ai-09 · Embeddings and vector search
*Skills:* embeddings, vector search, rag · *Check yourself:* ml-ai-09-q1

*D195 layers:* concept → proof → real world · *plays in* 47.2 s (concept 10.6 · proof 17.3 · real world 19.3) · *real world:* [FAISS: billion-scale similarity search (Johnson et al., 2017)](https://arxiv.org/abs/1702.08734) · *Try:* [Nearest neighbors](https://scikit-learn.org/stable/modules/neighbors.html) (`sklearn-docs`)

**1. What it is — Meaning as a point in space** *(concept)*
- An embedding turns a text into a list of numbers; texts that mean similar things land close together.
- Vector search finds the stored texts closest to the question's point.

**2. Why it works — Cosine similarity and its cost** *(proof)*
- Closeness is cosine similarity: a·b / (‖a‖ ‖b‖), 1 for the same direction, 0 for unrelated.
- Comparing with every stored vector costs n × d: 1 million vectors × 768 dimensions = 768 million multiply-adds per question.
- That's why large stores use approximate indexes that check only a small share of the vectors.

**3. Where it runs — FAISS at billion scale** *(realWorld)*
- FAISS, from Johnson, Douze and Jégou (2017), searches a billion vectors on GPUs with approximate indexes.
- It trades a little recall for speed: most of the true nearest neighbours, a small share of the work.

**4. Try it — Nearest neighbours in scikit-learn** *(realWorld)*
- Embed twenty short texts, fit NearestNeighbors with the cosine metric, and query it with a question.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-09-q1).** A team's vector search over 50 million passages takes two seconds per query with exact search. Users need answers in under 200 ms. What's the usual fix?
- ✅ An approximate nearest-neighbour index, checking recall on a labelled sample against exact search — *Approximate indexes cut the work per query by orders of magnitude; measuring recall shows what the speed costs.*
- Shorten every passage to one sentence — *The number of vectors, not passage length, drives the n × d cost.*
- Switch from cosine similarity to keyword matching — *That drops the meaning-based matching the team chose vectors for.*
- Search only the first million passages — *Fast, but the other 49 million passages can never be found.*

## ml-ai-10 · Hybrid search and reranking
*Skills:* hybrid search, reranking, rag · *Check yourself:* ml-ai-10-q1

*D195 layers:* concept → proof → real world · *plays in* 44.4 s (concept 9.5 · proof 16.5 · real world 18.4) · *real world:* [Cormack et al., Reciprocal Rank Fusion (SIGIR 2009)](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) · *Try:* [Relevance scoring in hybrid search (RRF)](https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking) (`microsoft-learn-docs`)

**1. What it is — Two searches, one list** *(concept)*
- Keyword search finds exact terms such as error codes; vector search finds meaning.
- Hybrid search runs both and fuses the two ranked lists into one.

**2. Why it works — Reciprocal rank fusion** *(proof)*
- Each passage scores Σ 1 / (60 + rank) over the lists it appears in.
- Ranked 1st by keywords and 3rd by vectors: 1/61 + 1/63 = 0.0323. Ranked 2nd in one list only: 1/62 = 0.0161.
- A passage both searches agree on rises, with no score tuning between them.

**3. Where it runs — Cormack's fusion, in production search** *(realWorld)*
- Cormack, Clarke and Büttcher (2009) showed this simple rank fusion beat the individual rankings it combined.
- Search services now use it for hybrid queries; Azure AI Search documents RRF for exactly this.

**4. Try it — Fuse two lists** *(realWorld)*
- Read Azure AI Search's hybrid ranking page, then fuse two ranked lists of five by hand.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-10-q1).** An internal assistant's vector search misses questions that quote exact error codes like E4021, though the right page contains the code. What should the team add?
- ✅ A keyword search alongside the vector search, fused by rank — *Exact tokens such as codes are what keyword search is good at; fusion keeps the vector results for the rest.*
- A larger embedding model — *Codes carry little meaning for an embedding; a bigger model doesn't fix that reliably.*
- More passages per question from the vector search alone — *More of the same ranking still ranks the code page low.*
- A rule that strips numbers from questions — *It removes the one term that identifies the page.*

## ml-ai-11 · Agent loops: plans and stopping
*Skills:* agents, orchestration, tool use · *Check yourself:* ml-ai-11-q1

*D195 layers:* concept → proof → real world · *plays in* 48.4 s (concept 10.9 · proof 18.7 · real world 18.7) · *real world:* [ReAct (Yao et al., 2022)](https://arxiv.org/abs/2210.03629) · *Try:* [The Agents Course](https://huggingface.co/learn/agents-course) (`huggingface-courses`)

**1. What it is — Think, act, look, repeat** *(concept)*
- An agent loop asks the model for the next step, runs it, shows the result, and asks again.
- Orchestration decides the plan, the order and, above all, when to stop.

**2. Why it works — Why loops need a stopping rule** *(proof)*
- If each step is right 95 % of the time, ten steps in a row are right 0.95¹⁰ ≈ 60 % of the time.
- A cap of 10 steps × 2,000 tokens a step is a ceiling of 20,000 tokens per task.
- Without a cap, a confused loop spends without limit and gets less likely to be right.

**3. Where it runs — ReAct** *(realWorld)*
- ReAct (Yao and colleagues, 2022) interleaves reasoning with actions, reading each result before the next step.
- Agent frameworks still use this loop, with a step limit.

**4. Try it — Add a cap and a stop** *(realWorld)*
- In the Hugging Face Agents Course, give an agent a step cap and a rule that stops it when the answer is found.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-11-q1).** An agent that books meeting rooms sometimes loops for minutes, retrying the same failing calendar call. What should the team add first?
- ✅ A step cap and a stop rule that returns the error to the person after repeated failures — *It bounds cost and time, and hands the person what the agent couldn't do.*
- A bigger model so it reasons better — *May reduce loops, but nothing stops the next one.*
- Longer timeouts on the calendar call — *Each retry just waits longer.*
- A second agent to watch the first — *Two loops can run without limit as easily as one.*

## ml-ai-12 · Agent memory
*Skills:* agents, memory, summarisation · *Check yourself:* ml-ai-12-q1

*D195 layers:* concept → proof → real world · *plays in* 46.1 s (concept 10.6 · proof 15.9 · real world 19.6) · *real world:* [MemGPT (Packer et al., 2023)](https://arxiv.org/abs/2310.08560) · *Try:* [gbrain](https://github.com/garrytan/gbrain) (`gbrain`)

**1. What it is — What an agent keeps between turns** *(concept)*
- A model remembers nothing between calls; memory is what you choose to send back in.
- Keep everything and the window fills; keep nothing and the agent forgets the person.

**2. Why it works — History grows, summaries don't** *(proof)*
- 20 turns × 400 tokens = 8,000 tokens of history, and it grows with every turn.
- A 300-token summary plus the last two turns (800 tokens) stays at about 1,100, however long the conversation.
- Retrieval (lesson 2.2) brings back an old detail only when the question needs it.

**3. Where it runs — MemGPT's paging** *(realWorld)*
- MemGPT (Packer and colleagues, 2023) treats the window like a computer's main memory and moves older text to storage and back.
- The agent itself decides what to page in, as an operating system pages memory.

**4. Try it — A second brain, from a repo** *(realWorld)*
- Read how the gbrain repository stores and recalls notes, then summarise a 20-turn chat to 300 tokens.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-12-q1).** A coaching assistant forgets a person's goals after a long chat, and its cost per message keeps climbing. What design fixes both?
- ✅ A short running summary of the person's goals plus the last few turns, with older details retrieved when needed — *The summary stays flat in cost and keeps what matters; retrieval brings back specifics on demand.*
- Send the full history on every message — *Cost grows with every turn and early goals end up mid-window.*
- Start a fresh conversation every ten messages — *Cheap, but the agent forgets everything at each restart.*
- Raise the model's maximum output length — *Output length has nothing to do with what the model remembers.*

## ml-ai-13 · Human in the loop
*Skills:* agents, human in the loop, ai safety · *Check yourself:* ml-ai-13-q1

*D195 layers:* concept → proof → real world · *plays in* 48.6 s (concept 12 · proof 16.8 · real world 19.8) · *real world:* [Moffatt v. Air Canada, 2024 BCCRT 149](https://www.canlii.org/en/bc/bccrt/doc/2024/2024bccrt149/2024bccrt149.html) · *Try:* [The Agents Course](https://huggingface.co/learn/agents-course) (`huggingface-courses`)

**1. What it is — When the agent must ask** *(concept)*
- Some actions are cheap to undo, some are not: a draft can be rewritten, a payment can't be unsent.
- Human in the loop means the agent stops and asks before the actions that matter.

**2. Why it works — Ask when the expected cost is higher** *(proof)*
- Ask when P(wrong) × cost of a wrong action > cost of asking.
- A wrong refund costs $500; wrong 2 % of the time, that's $10 per action. A check costs $2, so ask.
- A wrong email label costs $0.10: 2 % of that is $0.002, far below $2, so don't.

**3. Where it broke — Air Canada's chatbot, 2024** *(realWorld)*
- Air Canada's chatbot told a customer he could claim a bereavement fare after travelling; the policy said otherwise.
- In Moffatt v. Air Canada (2024), the tribunal held the airline responsible for what its chatbot said.

**4. Try it — Set three thresholds** *(realWorld)*
- Using the Agents Course's tool examples, decide for three actions whether the agent acts alone or asks first.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-13-q1).** A job-application agent can fill forms, save drafts and press Submit. Which should wait for the person's approval?
- ✅ Pressing Submit, because a sent application can't be taken back — *The irreversible, costly action is the one where a check pays for itself.*
- Saving a draft — *A draft is private and easy to change.*
- Filling the form fields — *Filled fields can be reviewed and corrected before sending.*
- None: the agent is right most of the time — *Being right most of the time still means some wrong, irreversible sends.*

## ml-ai-14 · Fine-tune or prompt?
*Skills:* fine-tuning, prompting, llm cost · *Check yourself:* ml-ai-14-q1

*D195 layers:* concept → proof → real world · *plays in* 43.6 s (concept 10.9 · proof 15.7 · real world 17) · *real world:* [LIMA: Less Is More for Alignment (Zhou et al., 2023)](https://arxiv.org/abs/2305.11206) · *Try:* [The smol course](https://github.com/huggingface/smol-course) (`huggingface-smol-course`)

**1. What it is — Two ways to adapt a model** *(concept)*
- Prompting teaches the task in every request; fine-tuning teaches it once, in the weights.
- Start with prompting: it's cheap to change. Fine-tune when the prompt is long, repeated and stable.

**2. Why it works — The break-even** *(proof)*
- A fine-tune costs $300 once and saves 1,500 prompt tokens a call.
- At $3 per million input tokens, that saves $0.0045 a call: $300 ÷ $0.0045 ≈ 67,000 calls to break even.
- At 10,000 calls a day, about a week. At 100 a day, nearly two years.

**3. Where it runs — LIMA: a thousand examples** *(realWorld)*
- LIMA (Zhou and colleagues, 2023) fine-tuned a 65-billion-parameter model on only 1,000 carefully chosen examples.
- Quality of the examples mattered more than their number.

**4. Try it — Find one feature's break-even** *(realWorld)*
- Read the smol course's notes on when to fine-tune, then work out the break-even for one feature you know.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-14-q1).** A feature sends the same 2,000-token instructions with every one of 50,000 calls a day, and the instructions haven't changed in months. What should the team evaluate?
- ✅ Fine-tuning a model on the task, comparing its break-even and quality with the prompted version — *Long, stable, high-volume instructions are where a fine-tune pays back quickly; measure quality before switching.*
- Adding more examples to the prompt — *Makes every call longer and dearer.*
- Switching to a larger model with a bigger window — *Costs more per call and leaves the repeated instructions in place.*
- Nothing: prompts are always cheaper — *At this volume, the repeated tokens are the main cost.*

## ml-ai-15 · LoRA and small models
*Skills:* lora, fine-tuning, small models · *Check yourself:* ml-ai-15-q1

*D195 layers:* concept → proof → real world · *plays in* 47 s (concept 11.2 · proof 18.5 · real world 17.3) · *real world:* [LoRA: Low-Rank Adaptation (Hu et al., 2021)](https://arxiv.org/abs/2106.09685) · *Try:* [The smol course](https://github.com/huggingface/smol-course) (`huggingface-smol-course`)

**1. What it is — Train a small update, not the whole model** *(concept)*
- LoRA freezes the model's weights and trains a small add-on for some of its layers.
- The add-on is tiny, so training needs less memory and the result is easy to swap.

**2. Why it works — A low-rank update** *(proof)*
- A d × d weight update is written as B · A, two thin matrices of rank r: 2dr numbers instead of d².
- With d = 4,096 and r = 8: 65,536 numbers instead of 16.8 million, about 0.39 %.
- Small r works because the useful change to a big model tends to lie in few directions.

**3. Where it runs — The LoRA paper** *(realWorld)*
- Hu and colleagues (2021) applied LoRA to GPT-3 175B: 10,000 times fewer trainable parameters and a third of the GPU memory.
- Quality matched or beat full fine-tuning on their benchmarks.

**4. Try it — The smol course's LoRA notebook** *(realWorld)*
- Run the smol course's LoRA exercise and count the trainable parameters before and after.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-15-q1).** A team needs one base model adapted for five customers, each with its own style, on a single GPU. What fits best?
- ✅ One frozen base model with a small LoRA adapter per customer, loaded as needed — *Adapters are small, so five fit beside one base model on one GPU.*
- Five full fine-tuned copies of the model — *Five full copies need five times the memory and storage.*
- One prompt that describes all five styles — *One prompt can't hold five styles reliably, and grows with each customer.*
- Train a new model from scratch per customer — *Far beyond the data and compute a single GPU offers.*

## ml-ai-16 · A fine-tuning run from a config
*Skills:* fine-tuning, training, qlora · *Check yourself:* ml-ai-16-q1

*D195 layers:* concept → proof → real world · *plays in* 43.6 s (concept 11.2 · proof 14.8 · real world 17.6) · *real world:* [QLoRA (Dettmers et al., 2023)](https://arxiv.org/abs/2305.14314) · *Try:* [The smol course](https://github.com/huggingface/smol-course) (`huggingface-smol-course`)

**1. What it is — A run you can repeat** *(concept)*
- A fine-tuning run is a config: the base model, the data, the epochs, the batch size, the learning rate.
- Kept in a file, the run can be reviewed, repeated and compared.

**2. Why it works — Counting the steps** *(proof)*
- Steps = examples × epochs ÷ batch size: 2,000 × 3 ÷ 16 = 375 steps.
- Double the batch and you halve the steps; each step needs more memory.
- Checkpoint every 125 steps and you can compare three versions on the same eval set.

**3. Where it runs — QLoRA on one GPU** *(realWorld)*
- QLoRA (Dettmers and colleagues, 2023) fine-tuned a 65-billion-parameter model on a single 48 GB GPU.
- It stores the frozen model in 4 bits and trains LoRA adapters on top.

**4. Try it — Run the smol course's config** *(realWorld)*
- Run the smol course's fine-tuning config, change one value, and compare the two runs' eval scores.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-16-q1).** Two engineers fine-tuned the same model and got different results, and neither can say exactly what they ran. What should the team change?
- ✅ Keep every run's settings in a versioned config file and evaluate each run on the same held-out set — *A config makes the run repeatable and comparable; a fixed eval set makes the comparison fair.*
- Let only one engineer run fine-tunes — *Hides the problem; that one engineer's runs still can't be reproduced.*
- Always train for more epochs — *More epochs can overfit, and the difference stays unexplained.*
- Pick whichever result looks better on a few examples — *A few hand-picked examples are not a measurement.*

## ml-ai-17 · Evals from real use
*Skills:* llm evaluation, evals, sampling · *Check yourself:* ml-ai-17-q1

*D195 layers:* concept → proof → real world · *plays in* 43.6 s (concept 10.1 · proof 14 · real world 19.6) · *real world:* [Chatbot Arena (Chiang et al., 2024)](https://arxiv.org/abs/2403.04132) · *Try:* [Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course) (`google-developers`)

**1. What it is — Test on what people actually ask** *(concept)*
- Benchmarks measure a model on someone else's questions; your users ask their own.
- An eval set sampled from real logs, with private data removed, measures your feature.

**2. Why it works — How many samples you need** *(proof)*
- A pass rate's margin is about 1.96 × √(p(1 − p) / n).
- With 400 samples and p = 0.5: 1.96 × 0.025 ≈ ± 4.9 points.
- For ± 3 points you need (1.96 ÷ 0.03)² × 0.25 ≈ 1,067 samples.

**3. Where it runs — Chatbot Arena** *(realWorld)*
- Chatbot Arena (Chiang and colleagues, 2024) ranks models from people's own questions, voted on two answers at a time.
- Its rankings come from real prompts, not a fixed test set.

**4. Try it — Size a sample** *(realWorld)*
- Using the ML Crash Course's notes on data, size an eval sample for ± 3 points and draw it from a log.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-17-q1).** A team reports their assistant improved from 70 % to 74 % on 100 hand-written test questions. What's the main problem?
- ✅ 100 questions give a margin of about ± 9 points, and hand-written questions may not match what users ask — *At n = 100 the change is inside the noise, and the set may not represent real use.*
- 74 % is too low to report — *The level isn't the issue; whether the change is real is.*
- They should have used 50 questions to move faster — *Fewer questions make the margin wider still.*
- Nothing: four points is a clear improvement — *Four points is well inside a ± 9-point margin.*

## ml-ai-18 · Regression suites for prompts and models
*Skills:* llm evaluation, regression testing, evals · *Check yourself:* ml-ai-18-q1

*D195 layers:* concept → proof → real world · *plays in* 48.4 s (concept 11.5 · proof 17.1 · real world 19.8) · *real world:* [Chen et al., 2023: How is ChatGPT's behavior changing over time?](https://arxiv.org/abs/2307.09009) · *Try:* [The LLM course](https://huggingface.co/learn/llm-course) (`huggingface-courses`)

**1. What it is — Re-run the same test on every change** *(concept)*
- A prompt edit or a model update can fix one thing and break another.
- A regression suite runs a fixed eval set on every change and compares it with the last version.

**2. Why it works — A drop inside the margin** *(proof)*
- Version 1 passes 82 % of 400 items; version 2 passes 79 %.
- The margin at p ≈ 0.8 and n = 400 is 1.96 × √(0.16 / 400) ≈ ± 3.9 points: a 3-point drop is noise.
- A 10-point drop is not: block the change and read the items that flipped.

**3. Where it broke — The same model, three months apart** *(realWorld)*
- Chen, Zaharia and Zou (2023) asked GPT-4 the same questions in March and June 2023.
- On one task, identifying prime numbers, accuracy fell from 84 % to 51 %: behaviour changed under the same name.

**4. Try it — Compare two prompt versions** *(realWorld)*
- Following the course's evaluation chapter, run two prompt versions on one set and list the items that changed.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-18-q1).** A model provider updates the model behind the same name, and your summaries start missing dates. What would have caught it?
- ✅ A regression suite that re-runs a fixed eval set on a schedule and when the model version changes — *A fixed set run on every change shows the drop and the exact items that flipped.*
- Reading a few summaries by hand each month — *Too few, too late, and easy to miss a pattern.*
- Asking the provider to never change the model — *You can pin versions where offered, but you still need to test before moving.*
- A longer prompt — *Doesn't detect anything.*

## ml-ai-19 · Text-to-SQL that can't drop a table
*Skills:* text-to-sql, sql, least privilege · *Check yourself:* ml-ai-19-q1

*D195 layers:* concept → proof → real world · *plays in* 44.2 s (concept 11.2 · proof 15.7 · real world 17.3) · *real world:* [PostgreSQL GRANT](https://www.postgresql.org/docs/current/sql-grant.html) · *Try:* [Privileges](https://www.postgresql.org/docs/current/ddl-priv.html) (`postgres-docs`)

**1. What it is — Let the database say no** *(concept)*
- A model that writes SQL can write any SQL, including DELETE and DROP.
- Don't rely on the prompt to prevent it; run the query as a role that can only read.

**2. Why it works — Zero, whatever the model writes** *(proof)*
- A role granted SELECT only can't run INSERT, UPDATE, DELETE or DROP: the database refuses them.
- So the number of damaging statements that can succeed is zero, whatever the model generates.
- Add a statement timeout, say 5 seconds, and one bad query can't hold the database either.

**3. Where it runs — PostgreSQL's privileges** *(realWorld)*
- PostgreSQL's GRANT gives a role exactly the commands it may run, table by table.
- The same idea is in every major database: least privilege, enforced below the application.

**4. Try it — Run generated SQL read-only** *(realWorld)*
- From the PostgreSQL privileges chapter, create a read-only role and confirm it can't delete a row.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-19-q1).** A reporting assistant turns questions into SQL and runs them on the analytics database. How do you make sure it can't change data?
- ✅ Run its queries as a database role granted SELECT only, with a statement timeout — *The database itself refuses writes, whatever the model produces.*
- Tell the model in the prompt never to write DELETE — *Prompts can be ignored or overridden by an injected instruction.*
- Block queries that contain the word DROP — *Easy to get around, and misses UPDATE and DELETE.*
- Review each query by hand afterwards — *Afterwards is too late for a write.*

## ml-ai-20 · Model migration and canary rollout
*Skills:* model migration, canary, deployment · *Check yourself:* ml-ai-20-q1

*D195 layers:* concept → proof → real world · *plays in* 45 s (concept 10.6 · proof 16.5 · real world 17.9) · *real world:* [Cloudflare's outage of 2 July 2019](https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/) · *Try:* [Performing a rolling update](https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/) (`kubernetes-docs`)

**1. What it is — Moving a feature to a new model** *(concept)*
- A new model can be better on average and worse on your cases.
- Migrate like any risky deploy: a small share of traffic first, watched, with a way back.

**2. Why it works — The blast radius** *(proof)*
- A 5 % canary on a model that fails 10 % of requests fails 0.5 % of all requests.
- At 2,000 requests an hour, the canary still sees 100 an hour to judge from.
- Compare the canary's pass rate on the regression set with the old model's before going wider.

**3. Where it broke — Cloudflare, 2 July 2019** *(realWorld)*
- Cloudflare pushed one firewall rule to every server at once, and its regular expression drove CPUs to 100 %.
- About 27 minutes of errors; such changes now roll out in stages.

**4. Try it — A rolling update, then roll back** *(realWorld)*
- Follow the Kubernetes rolling-update tutorial: move to a new version, watch it, and roll back.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-20-q1).** A cheaper model scores the same as the current one on a public benchmark. How should the team switch their feature to it?
- ✅ Run their own regression set on it, then send a small share of traffic to it, watched, with automatic rollback — *Their own cases and a small, watched share limit the damage if the new model is worse where it matters.*
- Switch all traffic at once, since the benchmark scores match — *A public benchmark isn't their feature; every user meets any regression at once.*
- Switch on a Friday evening when traffic is low — *Low traffic means less signal and fewer people to fix it.*
- Ask users to report problems after the switch — *Users find problems late and only some report them.*

## ml-ai-21 · Monitoring an LLM feature
*Skills:* monitoring, slo, latency · *Check yourself:* ml-ai-21-q1

*D195 layers:* concept → proof → real world · *plays in* 45.3 s (concept 10.1 · proof 16.8 · real world 18.4) · *real world:* [Google's SRE book, error budgets](https://sre.google/sre-book/embracing-risk/) · *Try:* [Production ML systems](https://developers.google.com/machine-learning/crash-course/production-ml-systems) (`google-developers`)

**1. What it is — Know before users tell you** *(concept)*
- An LLM feature fails like any service (errors, slowness) and in its own ways: empty or wrong answers.
- Monitoring watches both, against targets you set in advance.

**2. Why it works — Error budgets and the p95** *(proof)*
- A 99.9 % availability target over 30 days allows 43.2 minutes of failure: the error budget.
- If 90 requests take 1 s and 10 take 11 s, the mean is 2 s; the p95 is 11 s.
- Alert on the p95, not the mean: the slow tail is what users feel.

**3. Where it runs — Google's SRE practice** *(realWorld)*
- Google's SRE book describes error budgets: when the budget is spent, releases pause until reliability recovers.
- Teams running LLM features add answer quality, sampled and scored, to the same dashboards.

**4. Try it — Set an alert on the p95** *(realWorld)*
- Using the ML Crash Course's production section, pick a p95 latency target and an alert for one feature.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-ai-21-q1).** An assistant's average response time is a healthy 2 seconds, yet users complain it's slow. What should the team look at?
- ✅ The p95 and p99 latency, where a slow tail hides behind the average — *A few very slow answers barely move the mean but are what those users feel.*
- The average over a longer period — *A longer average hides the tail even more.*
- The number of requests per day — *Volume doesn't show how long each person waits.*
- The model's benchmark scores — *Benchmarks say nothing about this feature's latency.*
