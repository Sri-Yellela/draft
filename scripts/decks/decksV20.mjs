#!/usr/bin/env node
// ⭐ D155 Part C · decks-v20 — QA and SDET: Foundations (3), Building blocks (3), Patterns (4), drafted by the agent
// 2026-11-08 for the owner's review. node scripts/decks/decksV20.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const D = (id, stage, title, skills, slides, q) => deck(id, "qa", stage, title, skills, ["l2"], slides, q);
const Q = (id, level, skills, stem, choices, correct, why) => question(`${id}-q1`, "QA Engineer", level, skills, ["l2"], stem, choices, correct, why);

writeBatch({
  version: 20,
  title: "QA and SDET, Foundations, Building blocks and Patterns",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C, approved; D154 P4 format). Pathway 'qa', stages 'foundations' (3), 'building-blocks' (3) and 'patterns' (4), in Part C's order. Nothing is live until approved (status: draft).",
  decks: [
    D("qa-f-01", "foundations", "The testing pyramid", ["testing strategy", "unit tests", "integration tests"], [
      ["What it is", "How many of each kind of test", [
        "The testing pyramid says: many fast unit tests at the base, fewer integration tests in the middle, a few end-to-end tests at the top.",
        "It balances confidence, speed and maintenance."]],
      ["Core ideas", "Three layers", [
        "Unit tests check small pieces of logic in isolation, in milliseconds.",
        "Integration tests check that pieces work together: code with a real database, two services over an API.",
        "End-to-end tests drive the whole system like a user; they catch the most and break the most.",
        "Each bug found is best pinned at the lowest layer that can catch it."]],
      ["The trade-offs", "Shapes that go wrong", [
        "An 'ice-cream cone' (mostly end-to-end, few unit tests) is slow and flaky.",
        "Only unit tests can pass while the parts don't fit together.",
        "Some teams prefer a 'trophy' with more integration tests; the point is a deliberate mix."]],
      ["In practice", "What you'll see at work", [
        "Unit and integration tests on every commit; end-to-end on merge or nightly.",
        "Test run times watched like product performance.",
        "Each production bug gets a test at the right layer."]],
    ], Q("qa-f-01", "entry", ["testing strategy"],
      "A team's suite is 400 end-to-end browser tests that take 90 minutes and often fail randomly. What change helps most?",
      ["Move most checks down to unit and integration tests, keeping a few end-to-end tests for critical journeys", "Add more end-to-end tests", "Run the suite less often", "Delete all tests"],
      0, ["Lower layers are faster and steadier; keep the top thin.", "Makes it slower and flakier.", "Bugs get found later.", "Loses all safety."])),

    D("qa-f-02", "foundations", "Test design", ["test design", "boundary values", "equivalence partitioning"], [
      ["What it is", "Choosing which cases to test", [
        "You can't test every input. Test design picks the few cases most likely to find bugs.",
        "A handful of well-chosen cases beats hundreds of random ones."]],
      ["Core ideas", "Partitions, boundaries, combinations", [
        "Equivalence partitioning: group inputs that should behave the same, and test one from each group.",
        "Boundary values: bugs cluster at edges, so test just below, at and just above each limit.",
        "Decision tables and state transitions cover rules and workflows systematically.",
        "Pairwise testing covers combinations of options without testing every one."]],
      ["The trade-offs", "Coverage against effort", [
        "Too few cases miss bugs; too many slow the suite and hide intent.",
        "Code coverage shows what ran, not whether the checks were meaningful.",
        "Negative cases (invalid input, failures) are often forgotten."]],
      ["In practice", "What you'll see at work", [
        "Test cases written from requirements before the code is done.",
        "Edge cases listed explicitly in tickets.",
        "Reviews of tests, not just code."]],
    ], Q("qa-f-02", "entry", ["boundary values"],
      "A field accepts ages 18 to 65 inclusive. Which set of test values is strongest?",
      ["17, 18, 65, 66 (plus one typical value like 40)", "20, 30, 40", "1 to 100, every value", "Only 18"],
      0, ["Boundaries and just beyond are where off-by-one bugs live.", "Misses the edges.", "Wasteful and slow.", "Misses the upper limit and invalid values."])),

    D("qa-f-03", "foundations", "Bug reports that get fixed", ["bug reporting", "communication"], [
      ["What it is", "Making a bug easy to fix", [
        "A good bug report lets someone else reproduce the problem quickly and understand why it matters.",
        "Vague reports get bounced back or ignored."]],
      ["Core ideas", "Steps, expected, actual, impact", [
        "A clear title naming the symptom and where it happens.",
        "Exact steps to reproduce, from a known starting state.",
        "Expected result versus actual result, with screenshots, logs or a recording.",
        "Environment (version, browser, device, account type) and impact (who's affected, how badly)."]],
      ["The trade-offs", "Detail against time", [
        "Minimising the steps takes effort and saves developers far more.",
        "Severity (how bad) and priority (how soon) are different; say both.",
        "One bug per report, so each can be tracked and closed."]],
      ["In practice", "What you'll see at work", [
        "A bug template in the tracker.",
        "Intermittent bugs reported with how often they happen and what was tried.",
        "Retesting after the fix, then closing."]],
    ], Q("qa-f-03", "entry", ["bug reporting"],
      "Which bug report is most likely to get fixed quickly?",
      ["'Checkout: Pay button does nothing on Safari 17 (macOS). Steps: … Expected: payment page. Actual: no response; console error attached. Affects all Safari users.'", "'Checkout is broken'", "'Payments don't work sometimes, please fix ASAP'", "'Same as the other bug'"],
      0, ["It's reproducible, specific and shows impact.", "No steps or details.", "No steps, environment or evidence.", "Not traceable."])),

    D("qa-b-01", "building-blocks", "Automation frameworks", ["test automation", "playwright", "selenium"], [
      ["What it is", "Tests that run themselves", [
        "Automation frameworks drive applications through code: browsers (Playwright, Cypress, Selenium), APIs, mobile apps.",
        "They turn repeated manual checks into fast, repeatable ones."]],
      ["Core ideas", "Stable, readable, maintainable", [
        "Locate elements by role, label or test id, not by fragile CSS paths.",
        "Wait for conditions (an element visible, a request done), never fixed sleeps.",
        "Page objects or helpers keep tests readable and changes in one place.",
        "API tests check logic faster and more reliably than UI tests where possible."]],
      ["The trade-offs", "Automation isn't free", [
        "Every automated test needs maintenance as the product changes.",
        "Automating unstable features wastes effort.",
        "Some checks (look and feel, exploratory) still need people."]],
      ["In practice", "What you'll see at work", [
        "Tests in the same repository as the code, reviewed with it.",
        "Runs in CI with screenshots and traces on failure.",
        "A rule for what gets automated and what stays manual."]],
    ], Q("qa-b-01", "mid", ["test automation"],
      "UI tests break every time designers change CSS classes. What's the more robust way to find elements?",
      ["Use roles, accessible labels or dedicated test ids instead of styling selectors", "Use longer CSS paths", "Use pixel coordinates", "Stop changing the design"],
      0, ["These reflect meaning and stay stable when styles change.", "Even more fragile.", "Breaks on any layout change.", "Not realistic."])),

    D("qa-b-02", "building-blocks", "Test data and isolation", ["test data", "test isolation"], [
      ["What it is", "Each test starts from a known state", [
        "Tests that share data or depend on order fail unpredictably.",
        "Isolation means each test sets up what it needs and leaves nothing behind."]],
      ["Core ideas", "Create, use, clean up", [
        "Create test data in the test (factories, fixtures) rather than relying on whatever's in a shared database.",
        "Use unique names or ids so parallel tests don't collide.",
        "Reset state between tests: transactions rolled back, containers recreated, or data deleted.",
        "Never use real customer data; generate synthetic data."]],
      ["The trade-offs", "Speed against independence", [
        "Fresh data for every test is slower; sharing read-only reference data is often fine.",
        "Mocks make tests fast and can drift from the real dependency.",
        "Production-like data finds more bugs but brings privacy risk."]],
      ["In practice", "What you'll see at work", [
        "Database containers per test run (Testcontainers).",
        "Seeded, synthetic datasets for staging.",
        "Tests that pass in any order and in parallel."]],
    ], Q("qa-b-02", "mid", ["test isolation"],
      "Tests pass when run one by one but fail when run in parallel. What's the most likely cause?",
      ["Tests share data or state (same user, same record); give each test its own data", "The CI machine is too slow", "Parallel runs are always unreliable", "The tests are too short"],
      0, ["Shared state makes results depend on timing and order.", "Speed doesn't create collisions.", "They're reliable when isolated.", "Length isn't the cause."])),

    D("qa-b-03", "building-blocks", "CI quality gates", ["ci", "quality gates"], [
      ["What it is", "Checks a change must pass to merge", [
        "Quality gates in CI stop changes that break tests, lower coverage on new code, add vulnerabilities or fail linting.",
        "They make quality automatic instead of a final phase."]],
      ["Core ideas", "Fast, meaningful, enforced", [
        "Required checks on every pull request: build, unit and integration tests, linters, security scans.",
        "Gate on new code (coverage of changed lines), not on legacy totals.",
        "Keep the required set fast; run slow suites on merge or nightly.",
        "A failed gate blocks the merge; bypassing needs a recorded reason."]],
      ["The trade-offs", "Strict against productive", [
        "Too many slow gates push people to batch changes or bypass.",
        "Flaky gates teach people to rerun until green; fix flakiness quickly.",
        "Metrics like coverage can be gamed; review the tests too."]],
      ["In practice", "What you'll see at work", [
        "Branch protection rules with required checks.",
        "Dashboards of pipeline time and failure causes.",
        "Ownership for each gate."]],
    ], Q("qa-b-03", "mid", ["quality gates"],
      "Developers routinely click 're-run' until a flaky CI check turns green. What's the right response?",
      ["Quarantine and fix the flaky tests, and track flakiness so the gate stays trustworthy", "Remove CI", "Make the check optional forever", "Add more retries automatically"],
      0, ["A gate is only useful if failures mean something.", "Loses all protection.", "Silently drops the check.", "Hides real failures too."])),

    D("qa-p-01", "patterns", "Flaky tests", ["flaky tests", "test reliability"], [
      ["What it is", "Tests that fail without a real bug", [
        "A flaky test passes and fails on the same code.",
        "Flakiness erodes trust: people stop believing red builds, and real bugs slip through."]],
      ["Core ideas", "Common causes", [
        "Timing: fixed sleeps, race conditions, animations, slow responses.",
        "Shared state and order dependence between tests.",
        "External dependencies: real networks, third-party services, time and dates.",
        "Randomness without a fixed seed."]],
      ["The trade-offs", "Retry or fix", [
        "Automatic retries hide flakiness and real intermittent bugs alike.",
        "Quarantining keeps the build green while the test is fixed, but must be temporary.",
        "Sometimes the flakiness is a real product race condition worth fixing."]],
      ["In practice", "What you'll see at work", [
        "Flaky-test reports from CI history.",
        "Clock and network faked in tests.",
        "An owner and a deadline for each quarantined test."]],
    ], Q("qa-p-01", "mid", ["flaky tests"],
      "A test checks a 'created today' label and fails every night just after midnight UTC. What's the cause and fix?",
      ["It depends on the real clock and time zone; control the clock in the test (inject or fake the date)", "The server is slow at night", "Tests shouldn't run at night", "The label is wrong"],
      0, ["Tests that read the real clock change behaviour by time of day.", "Not about speed.", "Avoids rather than fixes.", "The product may be fine."])),

    D("qa-p-02", "patterns", "Contract testing", ["contract testing", "pact", "microservices"], [
      ["What it is", "Checking services agree, without running them all", [
        "Contract tests check that a provider (an API) still gives what each consumer expects.",
        "They catch breaking changes between services earlier and faster than full end-to-end tests."]],
      ["Core ideas", "Consumer-driven contracts", [
        "Each consumer records the requests it makes and the responses it relies on (a contract).",
        "The provider's CI replays those contracts against its own code.",
        "A change that breaks a consumer's contract fails the provider's build.",
        "Tools like Pact manage contracts and versions."]],
      ["The trade-offs", "Narrow but fast", [
        "Contracts check shape and key behaviour, not whole business flows.",
        "Keeping contracts up to date takes discipline from both teams.",
        "They don't replace a few end-to-end tests of critical journeys."]],
      ["In practice", "What you'll see at work", [
        "A contract broker showing which versions are compatible.",
        "Deploys blocked when a contract isn't verified.",
        "Schema checks (OpenAPI) as a lighter alternative."]],
    ], Q("qa-p-02", "mid", ["contract testing"],
      "A backend team renames a response field and two frontend apps break in production. How would contract testing have helped?",
      ["The consumers' contracts would fail in the backend's CI before the change merged", "It would rename the field automatically", "It would make the apps faster", "It wouldn't help"],
      0, ["The provider learns it breaks a consumer before shipping.", "It doesn't change code.", "Unrelated.", "This is exactly what it catches."])),

    D("qa-p-03", "patterns", "Performance testing", ["performance testing", "load testing"], [
      ["What it is", "Will it hold up under load?", [
        "Performance tests measure response times and capacity under realistic and extreme load.",
        "They find bottlenecks before users do."]],
      ["Core ideas", "Load, stress, soak", [
        "Load test: expected traffic, checking latency percentiles against targets.",
        "Stress test: beyond expected, to find the breaking point and how it fails.",
        "Soak test: steady load for hours, finding memory leaks and slow degradation.",
        "Use production-like data volumes; small data hides slow queries."]],
      ["The trade-offs", "Realism costs effort", [
        "Unrealistic scripts (one endpoint hammered) give misleading results.",
        "Testing shared environments disturbs other teams.",
        "Averages hide the slow tail; report p95 and p99."]],
      ["In practice", "What you'll see at work", [
        "k6, Gatling, Locust or JMeter scripts in version control.",
        "Performance budgets checked before big releases.",
        "Results compared with the previous run to catch regressions."]],
    ], Q("qa-p-03", "mid", ["load testing"],
      "A load test against a database with 1,000 rows shows great response times. Production has 10 million rows. What's the concern?",
      ["Queries that are fast on tiny data can be slow at production size; test with production-like volumes", "None; the code is the same", "The test ran too long", "Load tests should use no data"],
      0, ["Data size changes query plans and timings.", "Data volume matters a lot.", "Not the issue.", "Unrealistic."])),

    D("qa-p-04", "patterns", "Accessibility testing", ["accessibility testing", "wcag"], [
      ["What it is", "Checking the product works for everyone", [
        "Accessibility testing checks that people using keyboards, screen readers, magnification or voice can use the product.",
        "It combines automated checks with manual testing."]],
      ["Core ideas", "Automated plus manual", [
        "Automated tools (axe, Lighthouse) catch missing labels, low contrast and invalid ARIA, about a third of issues.",
        "Keyboard testing: every action reachable with Tab, Enter and Space, with visible focus.",
        "Screen-reader testing (VoiceOver, NVDA): content announced sensibly, in order.",
        "Zoom to 200 % and large text sizes without breaking layouts."]],
      ["The trade-offs", "Early is cheap", [
        "Fixing accessibility late means rework; test components as they're built.",
        "Passing automated checks doesn't mean usable.",
        "Testing with disabled users finds what experts miss."]],
      ["In practice", "What you'll see at work", [
        "axe checks in component and end-to-end tests.",
        "An accessibility checklist in the definition of done.",
        "Issues ranked by WCAG level and impact."]],
    ], Q("qa-p-04", "mid", ["accessibility testing"],
      "Automated accessibility checks report zero issues. Is the page accessible?",
      ["Not necessarily: automated tools catch only some issues; test with a keyboard and a screen reader too", "Yes, zero issues means accessible", "Only if it's also fast", "Only on mobile"],
      0, ["Much of accessibility needs human judgement.", "Tools miss many problems.", "Unrelated.", "Unrelated."])),
  ],
});
