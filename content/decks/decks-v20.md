# Decks v20 — QA and SDET, Foundations, Building blocks and Patterns (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 10 five-slide decks; each ends with one new question (drafts for the bank). **Nothing is live until you approve** — say "approve decks-v20" (or name the decks to change).

## qa-f-01 · The testing pyramid
*Skills:* testing strategy, unit tests, integration tests · *Check yourself:* qa-f-01-q1

**1. What it is — How many of each kind of test**
- The testing pyramid says: many fast unit tests at the base, fewer integration tests in the middle, a few end-to-end tests at the top.
- It balances confidence, speed and maintenance.

**2. Core ideas — Three layers**
- Unit tests check small pieces of logic in isolation, in milliseconds.
- Integration tests check that pieces work together: code with a real database, two services over an API.
- End-to-end tests drive the whole system like a user; they catch the most and break the most.
- Each bug found is best pinned at the lowest layer that can catch it.

**3. The trade-offs — Shapes that go wrong**
- An 'ice-cream cone' (mostly end-to-end, few unit tests) is slow and flaky.
- Only unit tests can pass while the parts don't fit together.
- Some teams prefer a 'trophy' with more integration tests; the point is a deliberate mix.

**4. In practice — What you'll see at work**
- Unit and integration tests on every commit; end-to-end on merge or nightly.
- Test run times watched like product performance.
- Each production bug gets a test at the right layer.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-f-01-q1).** A team's suite is 400 end-to-end browser tests that take 90 minutes and often fail randomly. What change helps most?
- ✅ Move most checks down to unit and integration tests, keeping a few end-to-end tests for critical journeys — *Lower layers are faster and steadier; keep the top thin.*
- Add more end-to-end tests — *Makes it slower and flakier.*
- Run the suite less often — *Bugs get found later.*
- Delete all tests — *Loses all safety.*

## qa-f-02 · Test design
*Skills:* test design, boundary values, equivalence partitioning · *Check yourself:* qa-f-02-q1

**1. What it is — Choosing which cases to test**
- You can't test every input. Test design picks the few cases most likely to find bugs.
- A handful of well-chosen cases beats hundreds of random ones.

**2. Core ideas — Partitions, boundaries, combinations**
- Equivalence partitioning: group inputs that should behave the same, and test one from each group.
- Boundary values: bugs cluster at edges, so test just below, at and just above each limit.
- Decision tables and state transitions cover rules and workflows systematically.
- Pairwise testing covers combinations of options without testing every one.

**3. The trade-offs — Coverage against effort**
- Too few cases miss bugs; too many slow the suite and hide intent.
- Code coverage shows what ran, not whether the checks were meaningful.
- Negative cases (invalid input, failures) are often forgotten.

**4. In practice — What you'll see at work**
- Test cases written from requirements before the code is done.
- Edge cases listed explicitly in tickets.
- Reviews of tests, not just code.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-f-02-q1).** A field accepts ages 18 to 65 inclusive. Which set of test values is strongest?
- ✅ 17, 18, 65, 66 (plus one typical value like 40) — *Boundaries and just beyond are where off-by-one bugs live.*
- 20, 30, 40 — *Misses the edges.*
- 1 to 100, every value — *Wasteful and slow.*
- Only 18 — *Misses the upper limit and invalid values.*

## qa-f-03 · Bug reports that get fixed
*Skills:* bug reporting, communication · *Check yourself:* qa-f-03-q1

**1. What it is — Making a bug easy to fix**
- A good bug report lets someone else reproduce the problem quickly and understand why it matters.
- Vague reports get bounced back or ignored.

**2. Core ideas — Steps, expected, actual, impact**
- A clear title naming the symptom and where it happens.
- Exact steps to reproduce, from a known starting state.
- Expected result versus actual result, with screenshots, logs or a recording.
- Environment (version, browser, device, account type) and impact (who's affected, how badly).

**3. The trade-offs — Detail against time**
- Minimising the steps takes effort and saves developers far more.
- Severity (how bad) and priority (how soon) are different; say both.
- One bug per report, so each can be tracked and closed.

**4. In practice — What you'll see at work**
- A bug template in the tracker.
- Intermittent bugs reported with how often they happen and what was tried.
- Retesting after the fix, then closing.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-f-03-q1).** Which bug report is most likely to get fixed quickly?
- ✅ 'Checkout: Pay button does nothing on Safari 17 (macOS). Steps: … Expected: payment page. Actual: no response; console error attached. Affects all Safari users.' — *It's reproducible, specific and shows impact.*
- 'Checkout is broken' — *No steps or details.*
- 'Payments don't work sometimes, please fix ASAP' — *No steps, environment or evidence.*
- 'Same as the other bug' — *Not traceable.*

## qa-b-01 · Automation frameworks
*Skills:* test automation, playwright, selenium · *Check yourself:* qa-b-01-q1

**1. What it is — Tests that run themselves**
- Automation frameworks drive applications through code: browsers (Playwright, Cypress, Selenium), APIs, mobile apps.
- They turn repeated manual checks into fast, repeatable ones.

**2. Core ideas — Stable, readable, maintainable**
- Locate elements by role, label or test id, not by fragile CSS paths.
- Wait for conditions (an element visible, a request done), never fixed sleeps.
- Page objects or helpers keep tests readable and changes in one place.
- API tests check logic faster and more reliably than UI tests where possible.

**3. The trade-offs — Automation isn't free**
- Every automated test needs maintenance as the product changes.
- Automating unstable features wastes effort.
- Some checks (look and feel, exploratory) still need people.

**4. In practice — What you'll see at work**
- Tests in the same repository as the code, reviewed with it.
- Runs in CI with screenshots and traces on failure.
- A rule for what gets automated and what stays manual.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-b-01-q1).** UI tests break every time designers change CSS classes. What's the more robust way to find elements?
- ✅ Use roles, accessible labels or dedicated test ids instead of styling selectors — *These reflect meaning and stay stable when styles change.*
- Use longer CSS paths — *Even more fragile.*
- Use pixel coordinates — *Breaks on any layout change.*
- Stop changing the design — *Not realistic.*

## qa-b-02 · Test data and isolation
*Skills:* test data, test isolation · *Check yourself:* qa-b-02-q1

**1. What it is — Each test starts from a known state**
- Tests that share data or depend on order fail unpredictably.
- Isolation means each test sets up what it needs and leaves nothing behind.

**2. Core ideas — Create, use, clean up**
- Create test data in the test (factories, fixtures) rather than relying on whatever's in a shared database.
- Use unique names or ids so parallel tests don't collide.
- Reset state between tests: transactions rolled back, containers recreated, or data deleted.
- Never use real customer data; generate synthetic data.

**3. The trade-offs — Speed against independence**
- Fresh data for every test is slower; sharing read-only reference data is often fine.
- Mocks make tests fast and can drift from the real dependency.
- Production-like data finds more bugs but brings privacy risk.

**4. In practice — What you'll see at work**
- Database containers per test run (Testcontainers).
- Seeded, synthetic datasets for staging.
- Tests that pass in any order and in parallel.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-b-02-q1).** Tests pass when run one by one but fail when run in parallel. What's the most likely cause?
- ✅ Tests share data or state (same user, same record); give each test its own data — *Shared state makes results depend on timing and order.*
- The CI machine is too slow — *Speed doesn't create collisions.*
- Parallel runs are always unreliable — *They're reliable when isolated.*
- The tests are too short — *Length isn't the cause.*

## qa-b-03 · CI quality gates
*Skills:* ci, quality gates · *Check yourself:* qa-b-03-q1

**1. What it is — Checks a change must pass to merge**
- Quality gates in CI stop changes that break tests, lower coverage on new code, add vulnerabilities or fail linting.
- They make quality automatic instead of a final phase.

**2. Core ideas — Fast, meaningful, enforced**
- Required checks on every pull request: build, unit and integration tests, linters, security scans.
- Gate on new code (coverage of changed lines), not on legacy totals.
- Keep the required set fast; run slow suites on merge or nightly.
- A failed gate blocks the merge; bypassing needs a recorded reason.

**3. The trade-offs — Strict against productive**
- Too many slow gates push people to batch changes or bypass.
- Flaky gates teach people to rerun until green; fix flakiness quickly.
- Metrics like coverage can be gamed; review the tests too.

**4. In practice — What you'll see at work**
- Branch protection rules with required checks.
- Dashboards of pipeline time and failure causes.
- Ownership for each gate.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-b-03-q1).** Developers routinely click 're-run' until a flaky CI check turns green. What's the right response?
- ✅ Quarantine and fix the flaky tests, and track flakiness so the gate stays trustworthy — *A gate is only useful if failures mean something.*
- Remove CI — *Loses all protection.*
- Make the check optional forever — *Silently drops the check.*
- Add more retries automatically — *Hides real failures too.*

## qa-p-01 · Flaky tests
*Skills:* flaky tests, test reliability · *Check yourself:* qa-p-01-q1

**1. What it is — Tests that fail without a real bug**
- A flaky test passes and fails on the same code.
- Flakiness erodes trust: people stop believing red builds, and real bugs slip through.

**2. Core ideas — Common causes**
- Timing: fixed sleeps, race conditions, animations, slow responses.
- Shared state and order dependence between tests.
- External dependencies: real networks, third-party services, time and dates.
- Randomness without a fixed seed.

**3. The trade-offs — Retry or fix**
- Automatic retries hide flakiness and real intermittent bugs alike.
- Quarantining keeps the build green while the test is fixed, but must be temporary.
- Sometimes the flakiness is a real product race condition worth fixing.

**4. In practice — What you'll see at work**
- Flaky-test reports from CI history.
- Clock and network faked in tests.
- An owner and a deadline for each quarantined test.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-p-01-q1).** A test checks a 'created today' label and fails every night just after midnight UTC. What's the cause and fix?
- ✅ It depends on the real clock and time zone; control the clock in the test (inject or fake the date) — *Tests that read the real clock change behaviour by time of day.*
- The server is slow at night — *Not about speed.*
- Tests shouldn't run at night — *Avoids rather than fixes.*
- The label is wrong — *The product may be fine.*

## qa-p-02 · Contract testing
*Skills:* contract testing, pact, microservices · *Check yourself:* qa-p-02-q1

**1. What it is — Checking services agree, without running them all**
- Contract tests check that a provider (an API) still gives what each consumer expects.
- They catch breaking changes between services earlier and faster than full end-to-end tests.

**2. Core ideas — Consumer-driven contracts**
- Each consumer records the requests it makes and the responses it relies on (a contract).
- The provider's CI replays those contracts against its own code.
- A change that breaks a consumer's contract fails the provider's build.
- Tools like Pact manage contracts and versions.

**3. The trade-offs — Narrow but fast**
- Contracts check shape and key behaviour, not whole business flows.
- Keeping contracts up to date takes discipline from both teams.
- They don't replace a few end-to-end tests of critical journeys.

**4. In practice — What you'll see at work**
- A contract broker showing which versions are compatible.
- Deploys blocked when a contract isn't verified.
- Schema checks (OpenAPI) as a lighter alternative.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-p-02-q1).** A backend team renames a response field and two frontend apps break in production. How would contract testing have helped?
- ✅ The consumers' contracts would fail in the backend's CI before the change merged — *The provider learns it breaks a consumer before shipping.*
- It would rename the field automatically — *It doesn't change code.*
- It would make the apps faster — *Unrelated.*
- It wouldn't help — *This is exactly what it catches.*

## qa-p-03 · Performance testing
*Skills:* performance testing, load testing · *Check yourself:* qa-p-03-q1

**1. What it is — Will it hold up under load?**
- Performance tests measure response times and capacity under realistic and extreme load.
- They find bottlenecks before users do.

**2. Core ideas — Load, stress, soak**
- Load test: expected traffic, checking latency percentiles against targets.
- Stress test: beyond expected, to find the breaking point and how it fails.
- Soak test: steady load for hours, finding memory leaks and slow degradation.
- Use production-like data volumes; small data hides slow queries.

**3. The trade-offs — Realism costs effort**
- Unrealistic scripts (one endpoint hammered) give misleading results.
- Testing shared environments disturbs other teams.
- Averages hide the slow tail; report p95 and p99.

**4. In practice — What you'll see at work**
- k6, Gatling, Locust or JMeter scripts in version control.
- Performance budgets checked before big releases.
- Results compared with the previous run to catch regressions.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-p-03-q1).** A load test against a database with 1,000 rows shows great response times. Production has 10 million rows. What's the concern?
- ✅ Queries that are fast on tiny data can be slow at production size; test with production-like volumes — *Data size changes query plans and timings.*
- None; the code is the same — *Data volume matters a lot.*
- The test ran too long — *Not the issue.*
- Load tests should use no data — *Unrealistic.*

## qa-p-04 · Accessibility testing
*Skills:* accessibility testing, wcag · *Check yourself:* qa-p-04-q1

**1. What it is — Checking the product works for everyone**
- Accessibility testing checks that people using keyboards, screen readers, magnification or voice can use the product.
- It combines automated checks with manual testing.

**2. Core ideas — Automated plus manual**
- Automated tools (axe, Lighthouse) catch missing labels, low contrast and invalid ARIA, about a third of issues.
- Keyboard testing: every action reachable with Tab, Enter and Space, with visible focus.
- Screen-reader testing (VoiceOver, NVDA): content announced sensibly, in order.
- Zoom to 200 % and large text sizes without breaking layouts.

**3. The trade-offs — Early is cheap**
- Fixing accessibility late means rework; test components as they're built.
- Passing automated checks doesn't mean usable.
- Testing with disabled users finds what experts miss.

**4. In practice — What you'll see at work**
- axe checks in component and end-to-end tests.
- An accessibility checklist in the definition of done.
- Issues ranked by WCAG level and impact.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-p-04-q1).** Automated accessibility checks report zero issues. Is the page accessible?
- ✅ Not necessarily: automated tools catch only some issues; test with a keyboard and a screen reader too — *Much of accessibility needs human judgement.*
- Yes, zero issues means accessible — *Tools miss many problems.*
- Only if it's also fast — *Unrelated.*
- Only on mobile — *Unrelated.*
