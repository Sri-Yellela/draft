# D193-3 · "AI engineering" — a course outline for the owner's review

*46z, 2026-11-20. A DRAFT. Nothing here is published, and no lesson text is written. It is the brief D193-3 asks for: modules,
lessons, and the register's sources for each, marked **adapt** (open licence, with attribution) or **link** (our own summary +
a link, never copied — D176). No model wrote it (D190).*

## Why
The owner's saved reels (D193 gap 1) show applied AI engineering as the topic people are most actively learning, and the one
AI-engineer postings ask for. Atlas has the ML fundamentals (`ml-f-*`, D2L, the Hugging Face courses) and seven
**ai-engineering** decks already approved (`decks-v11.json`: `ml-ai-01` … `ml-ai-07`) plus two case studies
(`ml-c-03` a support assistant with retrieval, `ml-c-04` an agent with tools). What's missing is the course around them:
the order, the hands-on steps, the checks, and the production topics the decks don't cover.

## Corrections to the D193 row (read while building this)
- **TruffleHog is AGPL-3.0, not MIT** (GitHub API, 2026-11-20). Registered `trufflehog` as **share-alike**.
- **The Google SRE books are CC BY-NC-ND 4.0, not CC BY 4.0** (read on sre.google). The register already had them as
  **link-only** (`google-sre-books`). They can be linked and summarised, never adapted.
- **Anthropic's prompt-engineering guide is not CC BY 4.0 in the register.** `anthropic` is **link-only** ("copyright line
  only"). Re-read it before any lesson uses it. Until then it is link-only.
- LangChain / LlamaIndex docs are **not in the register**. They're left out until D176-1 reads their licences.

## The course (6 modules, 24 lessons) — in D195's shape (re-drafted 47a, before the owner's review)
**D195 (owner 11-14), the content rule, sets the shape:** a module is a cluster of related concepts → a lesson is ONE concept →
its deck carries layers 1–2 (the concept simply, then the one formula, diagram or worked example that proves it isn't
magic) → its **Try** is layer 3 (a real system, a real failure or a hands-on step from an open register source) → its
**Check** asks the learner to APPLY it, not recall it. Every new deck is linted (`services/learn/deckLayers.js`: three
layers in order, a number in the proof, a named real case, an open Try source, ≤ 90 s as D194 plays it) before review.
**Existing** = an approved deck that predates the rule — on revision it gains the proof and real-world slides listed here.
**New** = a deck to write. "The board" = draft's own postings asking for the skill, counted when the deck is written.

### Module 1 · How LLMs work, from the outside in
| Lesson (one concept) | Deck | Layer 2 — the math | Layer 3 — real world · Try | Sources |
|---|---|---|---|---|
| 1.1 Tokens, context windows, sampling | existing `ml-ai-01` | temperature: pᵢ = e^(zᵢ/T) / Σ e^(zⱼ/T); T → 0 always picks the top token | a résumé's token count against a model's stated window · Try: the Hugging Face course's tokenizer chapter | adapt: `huggingface-courses` (Apache-2.0) |
| 1.2 Prompts as programs: structure, examples, structured output | existing `ml-ai-02` | few-shot cost: 5 examples × 200 tokens × 10,000 calls a day = 10 M extra input tokens a day | two vendors' structured-output docs side by side (link) · Try: the course's prompting exercise | adapt: `huggingface-courses` · link: `anthropic`, `google-developers` (CC BY 4.0 → adapt) |
| 1.3 Context engineering: what goes in the window and why | **new** | the window budget: system + k chunks × chunk size + history ≤ window (8 × 500 = 4,000 tokens before a word of history) | the board's AI-engineer postings asking for it · Try: trim a prompt to budget | adapt: `huggingface-courses` · link: `anthropic` |
| 1.4 Cost and latency: tokens in, tokens out | existing `ml-ai-06` (part) | cost = tokens in × price in + tokens out × price out; latency ≈ time to first token + tokens out ÷ tokens a second | published per-token price pages, read on the day (link) · Try: price one feature at 10k calls a day | adapt: `google-developers` |

### Module 2 · Retrieval (RAG)
| Lesson | Deck | Layer 2 — the math | Layer 3 — real world · Try | Sources |
|---|---|---|---|---|
| 2.1 Why retrieve: grounding and citations | existing `ml-ai-03` | recall@k: the share of the right passages in the top k; an answer can't cite what wasn't retrieved | `ml-c-03`'s support assistant · Try: measure recall@5 on ten questions | adapt: `huggingface-courses` |
| 2.2 Embeddings and vector search | **new** | cosine similarity a·b / (‖a‖‖b‖); brute force costs n × d per query (the same sum as `ml-f-05`) | scikit-learn's nearest-neighbour search · Try: `sklearn-docs` NearestNeighbors on a small corpus | adapt: `huggingface-courses`, `sklearn-docs` (BSD-3, nearest neighbours) |
| 2.3 Hybrid search and reranking | **new** | reciprocal rank fusion: score = Σ 1 / (60 + rank) over the keyword and vector lists | a cloud search service that documents RRF for hybrid queries (`microsoft-learn-docs`) · Try: fuse two ranked lists by hand | adapt: `microsoft-learn-docs` (CC BY 4.0) · link: vendor docs side by side |
| 2.4 Case: a support assistant with retrieval | existing `ml-c-03` | — (the case applies 2.1–2.3) | — | — |

### Module 3 · Tools and agents
| Lesson | Deck | Layer 2 — the math | Layer 3 — real world · Try | Sources |
|---|---|---|---|---|
| 3.1 Tool use: a model that calls functions | existing `ml-ai-04` | a tool is a JSON schema; a chain of n calls each right 95 % of the time succeeds 0.95ⁿ (10 calls ≈ 60 %) | the Agents Course's first tool · Try: write one tool's schema | adapt: `huggingface-courses` (the Agents Course) |
| 3.2 Orchestration: loops, plans, stopping | **new** | a step cap × tokens a step = the cost ceiling; 0.95ⁿ is why loops need a stopping rule | the Agents Course's planner · Try: add a step cap and a stop condition | adapt: `huggingface-courses` (Agents Course) |
| 3.3 Memory: what an agent keeps between turns | **new** | N turns × t tokens grows without bound; a summary of s tokens or retrieval (2.2) keeps it flat | the second-brain repos (pending the owner's confirmation) · Try: summarise a 20-turn history to 300 tokens | adapt: `gbrain`, `cog-second-brain` (MIT; ⚠ confirm these are the repos the reels meant) |
| 3.4 Human in the loop: when the agent must ask | **new** | ask when P(wrong) × cost of a wrong action > cost of asking | draft's *Ask me first* (a held application waits for Submit) · Try: set the threshold for three actions | our own words |
| 3.5 Case: an agent with tools | existing `ml-c-04` | — (applies 3.1–3.4) | — | — |

### Module 4 · Adapting a model
| Lesson | Deck | Layer 2 — the math | Layer 3 — real world · Try | Sources |
|---|---|---|---|---|
| 4.1 Fine-tune or prompt? The decision | **new** | break-even: a fine-tune's fixed cost F against tokens saved per call × price × calls | the smol course's decision guide · Try: find the break-even for one feature | adapt: `huggingface-smol-course` (Apache-2.0), `huggingface-courses` |
| 4.2 LoRA and small models | **new** | a d × d update as B·A of rank r: 2dr weights instead of d² (d = 4,096, r = 8: 65,536 instead of 16.8 M — 0.39 %) | the LoRA paper (Hu et al., 2021, link) · Try: the smol course's LoRA notebook | adapt: `huggingface-smol-course`, `d2l` (CC BY-SA — share-alike items only) |
| 4.3 A fine-tuning run from a config file | **new** (Try) | steps = examples × epochs ÷ batch: 2,000 × 3 ÷ 16 = 375 | Try: the smol course's run from its config | adapt: `huggingface-smol-course` |

### Module 5 · Evaluation
| Lesson | Deck | Layer 2 — the math | Layer 3 — real world · Try | Sources |
|---|---|---|---|---|
| 5.1 What to measure | existing `ml-ai-05` | precision, recall, F1 = 2PR / (P + R) | the course's evaluation chapter · Try: score ten answers by hand | adapt: `huggingface-courses` |
| 5.2 Evals from production logs, not toy benchmarks | **new** | a pass rate's margin ≈ 1.96 √(p(1 − p) / n): 400 samples → ± 4.9 % at p = 0.5 | the ML Crash Course on data drawn from real use · Try: size a sample for ± 3 % | adapt: `google-developers` (ML Crash Course) · our own words |
| 5.3 Regression suites for prompts and models | **new** | a change passes when the drop is inside the margin of 5.2, on the same items | draft's D162 per-task evaluation sets · Try: compare two prompt versions on one set | our own words |

### Module 6 · Running it in production
| Lesson | Deck | Layer 2 — the math | Layer 3 — real world · Try | Sources |
|---|---|---|---|---|
| 6.1 Guardrails: prompt injection, unsafe actions | existing `ml-ai-07` | defence in depth: three independent checks that each miss 10 % miss together 0.1 % | OWASP's Top 10 for LLM applications, prompt injection first · Try: the cheat sheet's input-handling steps | adapt: `owasp-cheatsheets` (CC BY-SA — share-alike items only) · link: `owasp` |
| 6.2 Text-to-SQL that can't drop a table | **new** | a read-only role allows SELECT only: the damaging statements possible are zero, whatever the model writes | OWASP's SQL injection cheat sheet · Try: run generated SQL under a read-only role | our own words · adapt: `owasp-cheatsheets` (SQL injection) |
| 6.3 Model migration and canary rollout | **new** | a 5 % canary with a 10 % failure fails 0.5 % of requests (`cl-b-06`'s proof) | Cloudflare's global push of 2 July 2019 (as `cl-b-06`) · Try: the Kubernetes rolling-update tutorial | adapt: `kubernetes-docs` (CC BY 4.0, rollouts) · link: `google-sre-books` |
| 6.4 Monitoring an LLM feature | **new** | an error budget: a 99.9 % SLO allows 43.2 minutes a month; p95 latency, not the mean | the SRE book's error-budget chapter (link only) · Try: set an alert on p95 | adapt: `ml-b-04`'s sources · link: `google-sre-books` |
| 6.5 Prove it: build a small grounded assistant | **Build** (own) | — | the Build is layer 3 for the whole course | — |

**Counts:** 24 lessons. 10 use existing approved decks (each gains its proof and real-world slides on revision), 13 need new
decks, plus 1 Build. Each new deck needs its check question approved before it shows (the decks' rule), and passes the
D195 lint before review.

## What the owner decides
1. Approve the module list, or change it.
2. Whether `gbrain` / `cog-second-brain` are the repos the reels meant. If not, lesson 3.3 uses our own words only.
3. Whether the 10 existing decks are revised to D195's three layers now, or as each is next touched.
4. Whether to ask D176-1 to read Anthropic's guide and the LangChain / LlamaIndex docs licences before the decks are written.

After approval, the 13 new decks are drafted into the next free deck batch (`decks-v26`) for review, under D195's three layers, in the existing deck format. Nothing shows
until approved.
