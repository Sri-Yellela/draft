# Atlas as a wiki: audit and plan (47o, 2026-11-27). Nothing is built until the owner approves.

The owner's correction (11-27, quoted in WORKLOG's 47n END block): *"shared like how wiki has links of a keyword and the
keyword can be found across domains but the keyword itself means the same and would lead to the same specific thing,
although same words with diff meanings might have to be programmed specially … visualise an example of this."*

**The example (the target, for the owner's look):** https://claude.ai/artifact/KNmdzWi783ZLz3UWenM2q5. Four lessons
(finance, ML, chip design, cloud) link GPU, Python, Monte Carlo and CPU inline. Every link to a word opens the same single
entry, and that entry lists every page that links to it, grouped by domain. A second section shows "kernel" with three
meanings: each context's link goes to its own entry, and a plain "kernel" with no context opens a disambiguation page.

**Sources:** production's public Atlas, read-only on 27 Nov: `/api/atlas/glossary` (1,773 published entries, saved
to `tmp/glossary47o.json`) and `/api/atlas/node/gpu`. The code was read at `0460d330`. The 47n audit
(`docs/ATLAS_AUDIT_47n.md`) still supplies the family numbers.

## 1. The model we're aiming for

| | Wiki | The Atlas, target |
|---|---|---|
| One meaning | one article | one entry (`atlas_nodes` row, unique slug) |
| A word in any text | a link to that article | an inline link in a lesson, route, posting, interview question, Ask draft answer or Library guide |
| Other names | redirects | aliases (Postgres → PostgreSQL), phrase forms ("CUDA kernel" → Compute kernel) |
| Same word, other meaning | separate articles plus a disambiguation page | separate entries named `Kernel (operating system)` and so on, plus `/atlas/kernel` listing them |
| What links here | backlinks | "Linked from": every page that links to the entry, grouped by domain |
| Categories | categories | families or gazetteers, used for browsing only. Linking does not depend on them. |

Domains don't keep their own copy of a shared concept. They link to the one entry.

## 2. Audit: how the Atlas compares to that model today

### 2.1 One entry per meaning: mostly there
- `atlas_nodes.slug` is UNIQUE. `term` has an index but is NOT unique (migrations 4977 / 5445), so the schema already
  allows two meanings to share a word.
- **Production has 1,773 published entries, and no two share a name** (case-folded). GPU is one entry
  (concept, 1,059 open postings, top roles Software Engineer 236 · Research Engineer 35 · ML Engineer 32).
- **Duplicates of one meaning:** a name fold (plurals, modelling/models) finds `financial modelling` | `financial models`,
  `press release` | `press releases` and `Trie` | `Tries`. There are also the forecasting variants (`forecasting`,
  `budget forecasting`, `budgeting and forecasting`, `rolling forecast` …), but whether those are one meaning or several
  is a curation call.
- Each node has one `family` (migration 201). That suits browsing. Wiki links don't need several families, because
  backlinks do the work of showing where a concept is used.
- `atlas_nodes.wikidata_id` exists. A Wikidata Q-id names exactly one meaning, so two nodes with the same Q-id are a
  duplicate, and one word with two Q-ids is two senses. ⚠ Coverage not measured: the public API doesn't expose it.
  Check it on the local copy or in Admin.

### 2.2 Inline links: two linkers, few surfaces
| Surface | Links terms inline? | How |
|---|---|---|
| Postings (board, opening sheet, public job page) | ✅ | the server picks which nodes (`services/atlas/atlasLinks.js` `atlasTermsFor`: the posting's skill list or the one matcher, ambiguous words left out). The client places them in the drawn text (`shared/atlasLinks.js` `linkSegments`: longest first, whole words, exactCase, common-phrase guard, first occurrence only). |
| Skill tags (FitCard, ATS report, JobCard, Profile) | ✅ tags only | `client/src/lib/atlasLinks.js` → `/api/atlas/resolve` |
| Gazetteer entry meanings and index lines | ✅ | a **second linker**: `client/src/pages/atlas/gazetteerModel.js` `crossRefs`. It's case-insensitive, knows no aliases, has no ambiguous-word guard and no common-phrase guard, needs names of 3+ characters, and links at most 6 per text. |
| Lessons / Learn, route stops, the Proving ground (interview), Ask draft answers, the Library, the Logbook, emails | ❌ | none. A grep of `client/src/pages`, `plate` and `components` for `linkSegments` / `atlasHref` / `useAtlasSlugs` / `crossRefs` finds only the rows above. |
| Extension, resume-master | ⚠ not checked here | |

So the same word can link on a posting and not on a lesson. A lowercase "spark" or "lean" in a Gazetteer meaning links
through `crossRefs` even though the posting linker refuses it.

### 2.3 Same word, different meanings: suppressed, never resolved
- `services/atlas/postingMatcher.js` `AMBIGUOUS_TERMS` (go, r, c, swift, rust, dart, ruby, spring, unity, shell, bash,
  spark, hive, flink, beam, arrow, can, safe …) are **never linked** unless they're on the posting's own skill list.
  The A122 regex (`KAFKA_THE_AUTHOR_RE`) catches one case.
- The cost is visible in the counts: Spark is asked for in **6** open postings, Go in **23** and Rust in **19** (production,
  27 Nov). ⚠ That they're undercounted is an inference, not measured against the scorer's tags.
- `resolveTerms` (`services/atlas/atlasStore.js:227`) runs `SELECT slug … WHERE term = ? LIMIT 1`, so a second sense
  would be picked arbitrarily. There's no disambiguation page and no sense label.
- Single-meaning entries that a reader would expect to have more than one: `Lean` (process improvement only; Lean 4 and
  Lean Startup are absent), `Sketch` (the Mac app), `Snowflake` (the warehouse). Kernel exists only as
  `Operating system and kernel` (1 posting), `Linux kernel` (87) and `Kernel module`. There is no compute kernel and no kernel
  method.
- Roles already use a bracketed qualifier, the naming convention to adopt: `Systems Engineer (aerospace)` /
  `(software)`, `Operations Manager (plant)`, `Research Scientist (ML)`.

### 2.4 Backlinks ("Linked from"): none
- An entry shows `onTheBoard` (postings, top skills, top roles) and `related` (co-occurrence edges). Nothing records
  which lessons, routes or questions mention it, so GPU can't say "used in finance, ML, chip design and cloud".
- Postings already store their matches (`atlas_posting_match`, D118), so the posting side of backlinks can be counted
  per posting family without new matching.

### 2.5 Missing hub entries
- Absent from production (404 or no glossary row): **CPU** (CPU core and CPU cache exist), **Monte Carlo**,
  **statistics** (only `statistical modelling`, 8 postings), **parallel computing**, **linear algebra**, data analysis,
  data visualization, computer architecture, microarchitecture, HPC, derivatives, risk modeling, semiconductor, SoC
  (47n's list).
- **Cloud computing exists but never matches anything:** `cloud-computing-aws-azure-google-cloud`, named
  "Cloud computing (AWS, Azure, Google Cloud)", has 0 postings. The brackets are in the name, and no posting contains that
  string. Rename it with the brackets moved to aliases.
- Families: 12 of 40 are empty, and about half of linked nodes have no family (47n). That matters for browsing, not for
  links.

## 3. Plan in phases (for the owner's word)

Each phase can ship on its own. No model anywhere (D190): plain text matching, curation in Admin, Wikidata as the source
of sense identity.

| Phase | What | Touches | Size |
|---|---|---|---|
| **W1 One linker** | `crossRefs` replaced by `shared/atlasLinks.js` `linkSegments`, fed by one "Atlas text" term list (all published nodes with their forms, the ambiguous guard, common phrases). The same word then links the same way on every page. | gazetteerModel.js, AtlasGazetteer.jsx, a `/api/atlas/terms` read (cached like `linkableNodes`) | S |
| **W2 Links everywhere** | the one linker on lessons / Learn, route stops, the Proving ground's questions, Ask draft answers, Library guides, the Logbook. Each surface says its **domain** (the family of its route or lesson), which W4 needs. First occurrence per page only, as in postings. | LearnView, RouteMap, Proving ground, Ask draft card, LibraryGuides, Logbook | M |
| **W3 "Linked from"** | an `atlas_mentions(node_id, surface, ref, domain)` index, written when content is imported or edited and rebuilt at boot only when its fingerprint changes (A158 / A253: never a sync whole-board pass on the request thread). Postings counted from `atlas_posting_match` by family. The entry shows "Linked from · N pages in M domains", like the example. | migration **284**, the content importers, entry page | M |
| **W4 Senses and disambiguation** | the sense convention `Word (qualifier)`; `atlas_nodes.sense_of` (the bare word) so several nodes share one word; a `/atlas/<word>` disambiguation page whenever a word has 2+ senses. The resolver follows the example's five rules: phrase entry, neighbouring words, page domain, single sense, otherwise the disambiguation page. `resolveTerms` returns senses rather than `LIMIT 1`. `AMBIGUOUS_TERMS` words become senses one at a time (Go, Rust, Spark, Swift, Unity, Spring, Shell, Lean, Kafka) and stop being suppressed. The ATS scorer's own ambiguity rules stay as they are (`packages/ats-scorer`). | migration 285, atlasStore, postingMatcher, atlasLinks, Admin → Atlas (a sense editor) | L |
| **W5 Hubs and tidying** | add CPU, Monte Carlo, statistics, parallel computing, linear algebra, data analysis, data visualization, computer architecture; rename Cloud computing; merge the duplicates (financial modelling/models, press release(s), Trie/Tries) with the old slugs redirecting; link CPU core / CPU cache / Linux kernel to their parents (`part_of`). Then 47n's family work (fill the 12 empty families, place family-less nodes) for browsing. | curation + Admin, `forwardOf` redirects | M, mostly curation |
| **W6 Search** | search and `/api/atlas/resolve` show "Kernel · 3 meanings" and send a bare word to its disambiguation page. | search, resolve | S |

**Suggested order:** W1 → W2 → W3, since together they give "one word, one entry, linked from everywhere" for every
single-meaning word. Then W5's hubs, so the links have somewhere to go. W4 is the biggest piece and starts after that,
with W6 last.

**Measurement before any push (memory: board reads freeze the site):** W2 and W3 add a mention pass over all content and
postings. Measure it at production size on the scaled copy, off the request thread, before pushing.

## 4. Questions for the owner
1. Is the example what you meant? One entry per meaning, inline links on every surface, "Linked from" by domain, and a
   disambiguation page when a word is unclear.
2. Disambiguation naming: `Kernel (operating system)` style, the wiki convention roles already use?
3. When the page domain picks a sense (rule 3) but could be wrong, should the link go straight to that sense, or to the
   disambiguation page with that sense first?
4. Which hub entries come first? The plan suggests CPU, Monte Carlo, statistics, parallel computing and linear algebra.
5. Order: W1 → W2 → W3 → W5 → W4 → W6, or senses (W4) earlier?
