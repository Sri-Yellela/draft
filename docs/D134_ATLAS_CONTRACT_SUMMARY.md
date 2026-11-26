# D134 · the Atlas contract (`contract/atlas/v1/`), on one page

Written 2026-11-26 (47i), from `contract/atlas/v1/README.md` and `openapi.yaml`, for the owner's review (the owner's
11-26 "go with your recs": *"the agent drafts a one-page summary for the owner"*). **Nothing implements the contract
yet. P2–P5 wait on this review.**

## What it is

Atlas as its own service, with draft as its first customer. Today Atlas lives inside draft and reads draft's tables. The
contract is a versioned API (OpenAPI 3.1, `1.0.0-draft`) that lets them be separated:

- **Read:** nodes, search, peek, graph, families, role boards, trees, thumbnails.
- **Compute:** resolve a skill list, annotate a text, a person's map, a learning route.
- **Events:** postings in, nightly reconcile.
- **Learn:** content, the circle, pieces, a person's progress / state / route.
- **Admin:** the editor's 44 routes.

**Additive changes only within v1.** Removing, renaming or changing a meaning is v2.

## The five rules it holds to

1. **Neither side reads the other's database.** Every crossing in `docs/ATLAS_BOUNDARY.md` becomes an API call.
2. **Atlas holds no personal data.** A person is an opaque `subject`, which draft sends as an HMAC of the user id, never
   the id, email or name. Skill lists sent to compute calls are used and not stored. Per subject, Atlas keeps only the
   Learn facts that were earned (opened, explained, built).
3. **One thesaurus, owned by Atlas.** Draft's scorer reads a versioned snapshot plus a change feed. It scores from a local
   file, with no network on the scoring path.
4. **Posting counts come from events, never from reading postings.** Draft runs the matcher (a pure package) and writes
   an outbox row in the same transaction as the board write. A drain sends batches; a nightly reconcile closes what's
   gone and reports drift, which a test holds at 0. Atlas never sees posting text, titles or URLs.
5. **Keys, scopes, budgets.** One key per customer, with scopes read · compute · events · learn · admin. Peek and resolve
   answer at p95 ≤ 100 ms. Every response is validated against the spec in tests.

## What it costs to build (P2–P5, when approved)

A data move: Atlas's tables get their own store (P2 has the column map). Then:

- an outbox and a drain in draft, replacing the 15 `atlasPostingsChanged` sites and migration 199's triggers;
- the matcher as a versioned package;
- a real append-only change log (today it's one counter);
- draft's client reading a person's Learn state from Atlas instead of computing it.

Each step carries its own test from the README's table (`d134NoCrossDbAccess` … `d134ContractValidates`).

## Six questions, each with the recommendation

| # | Question | Recommendation |
| --- | --- | --- |
| Q1 | The person's own explanations and build links in Learn: where do they live? | **In draft.** Atlas gets only the earned fact. This keeps rule 2. A future outside customer with no store of its own would have nowhere for the text, and that's acceptable for v1 |
| Q2 | "You have / you're missing" on public pages | **Draft's proxy adds it** (one resolve call per page, cached per person). Atlas's public reads stay public and cacheable |
| Q3 | The scorer's own vocabulary | **Later, separately.** Making it injectable from the snapshot moves ATS scores, so it needs its own before / after on D125's gold set. Not part of P2 |
| Q4 | Sponsorship on role pages | **Stays draft's.** Employer immigration data isn't Atlas's domain |
| Q5 | Counts when a second customer sends postings | **Per customer in v1.** Pooling can be added later |
| Q6 | Where the editor lives | **Draft's admin panel**, calling `/v1/admin/*` with draft's key |

## What the owner says

**"Approve with the recommendations"**, or change any row. P2 (the data move) then becomes a lane in the TRACK ORDER
after D197 Wave 1. Nothing about the live site changes until P2 ships.
