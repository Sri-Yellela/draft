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

## The course (6 modules, 24 lessons)
Each lesson is one deck (the reel shape: one idea, visual, five slides, ending with a question) plus a Try or Build step.
**Existing** = an approved deck that already exists. **New** = a deck to write.

### Module 1 · How LLMs work, from the outside in
| Lesson | Deck | Sources |
|---|---|---|
| 1.1 Tokens, context windows, sampling | existing `ml-ai-01` | adapt: `huggingface-courses` (Apache-2.0) |
| 1.2 Prompts as programs: structure, examples, structured output | existing `ml-ai-02` | adapt: `huggingface-courses` · link: `anthropic`, `google-developers` (CC BY 4.0 → adapt) |
| 1.3 Context engineering: what goes in the window and why | **new** | adapt: `huggingface-courses` · link: `anthropic` |
| 1.4 Cost and latency: tokens in, tokens out | existing `ml-ai-06` (part) | adapt: `google-developers` |

### Module 2 · Retrieval (RAG)
| Lesson | Deck | Sources |
|---|---|---|
| 2.1 Why retrieve: grounding and citations | existing `ml-ai-03` | adapt: `huggingface-courses` |
| 2.2 Embeddings and vector search | **new** | adapt: `huggingface-courses`, `sklearn-docs` (BSD-3, nearest neighbours) |
| 2.3 Hybrid search and reranking | **new** | adapt: `microsoft-learn-docs` (CC BY 4.0) · link: vendor docs side by side |
| 2.4 Case: a support assistant with retrieval | existing `ml-c-03` | — |

### Module 3 · Tools and agents
| Lesson | Deck | Sources |
|---|---|---|
| 3.1 Tool use: a model that calls functions | existing `ml-ai-04` | adapt: `huggingface-courses` (the Agents Course) |
| 3.2 Orchestration: loops, plans, stopping | **new** | adapt: `huggingface-courses` (Agents Course) |
| 3.3 Memory: what an agent keeps between turns | **new** | adapt: `gbrain`, `cog-second-brain` (MIT; ⚠ confirm these are the repos the reels meant) |
| 3.4 Human in the loop: when the agent must ask | **new** | our own words (draft's *Ask me first* is a worked example) |
| 3.5 Case: an agent with tools | existing `ml-c-04` | — |

### Module 4 · Adapting a model
| Lesson | Deck | Sources |
|---|---|---|
| 4.1 Fine-tune or prompt? The decision | **new** | adapt: `huggingface-smol-course` (Apache-2.0), `huggingface-courses` |
| 4.2 LoRA and small models | **new** | adapt: `huggingface-smol-course`, `d2l` (CC BY-SA — share-alike items only) |
| 4.3 A fine-tuning run from a config file | **new** (Try) | adapt: `huggingface-smol-course` |

### Module 5 · Evaluation
| Lesson | Deck | Sources |
|---|---|---|
| 5.1 What to measure | existing `ml-ai-05` | adapt: `huggingface-courses` |
| 5.2 Evals from production logs, not toy benchmarks | **new** | adapt: `google-developers` (ML Crash Course) · our own words |
| 5.3 Regression suites for prompts and models | **new** | our own words (draft's D162 per-task evaluation sets are a worked example) |

### Module 6 · Running it in production
| Lesson | Deck | Sources |
|---|---|---|
| 6.1 Guardrails: prompt injection, unsafe actions | existing `ml-ai-07` | adapt: `owasp-cheatsheets` (CC BY-SA — share-alike items only) · link: `owasp` |
| 6.2 Text-to-SQL that can't drop a table | **new** | our own words · adapt: `owasp-cheatsheets` (SQL injection) |
| 6.3 Model migration and canary rollout | **new** | adapt: `kubernetes-docs` (CC BY 4.0, rollouts) · link: `google-sre-books` |
| 6.4 Monitoring an LLM feature | **new** | adapt: `ml-b-04`'s sources · link: `google-sre-books` |
| 6.5 Prove it: build a small grounded assistant | **Build** (own) | — |

**Counts:** 24 lessons. 10 use existing approved decks, 13 need new decks, plus 1 Build. Each new deck needs its check
question approved before it shows (the decks' rule).

## What the owner decides
1. Approve the module list, or change it.
2. Whether `gbrain` / `cog-second-brain` are the repos the reels meant. If not, lesson 3.3 uses our own words only.
3. Whether to ask D176-1 to read Anthropic's guide and the LangChain / LlamaIndex docs licences before the decks are written.

After approval, the 13 new decks are drafted into a `decks-v15.json` for review, in the existing deck format. Nothing shows
until approved.
