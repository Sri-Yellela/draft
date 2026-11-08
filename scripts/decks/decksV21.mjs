#!/usr/bin/env node
// ⭐ D155 Part C · decks-v21 — QA and SDET: Specialisation (2) and Interview (2); engineering management: Foundations (3).
// Drafted by the agent 2026-11-08 for the owner's review. node scripts/decks/decksV21.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const D = (id, pathway, stage, title, skills, pieces, slides, q) => deck(id, pathway, stage, title, skills, pieces, slides, q);
const Q = (id, role, level, skills, pieces, stem, choices, correct, why) => question(`${id}-q1`, role, level, skills, pieces, stem, choices, correct, why);

writeBatch({
  version: 21,
  title: "QA and SDET, Specialisation and Interview; engineering management, Foundations",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C, approved; D154 P4 format). Pathway 'qa': 'specialisation' (2) and 'interview' (2); pathway 'management': 'foundations' (3). Nothing is live until approved (status: draft).",
  decks: [
    D("qa-s-01", "qa", "specialisation", "Risk-based test strategy", ["test strategy", "risk"], ["l2"], [
      ["What it is", "Testing where failure would hurt most", [
        "There's never time to test everything equally. A risk-based strategy spends effort where the likelihood and impact of failure are highest.",
        "It turns 'test everything' into a plan people can agree on."]],
      ["Core ideas", "Likelihood × impact", [
        "List features and changes; rate how likely each is to break (new, complex, changed often) and how bad that would be (money, safety, data, reputation).",
        "High-risk areas get deep testing at several layers; low-risk ones get a light check.",
        "Revisit the ratings as the product and incidents change.",
        "Share the plan with product and engineering, including what won't be tested."]],
      ["The trade-offs", "Explicit gaps", [
        "Writing down what isn't tested feels uncomfortable and is honest.",
        "Ratings are judgement calls; use incident history and data where you can.",
        "Low-risk areas still break sometimes; monitoring in production backs up testing."]],
      ["In practice", "What you'll see at work", [
        "A risk matrix in the release plan.",
        "Payments, sign-in and data deletion always in the high-risk group.",
        "Exploratory sessions aimed at the riskiest changes."]],
    ], Q("qa-s-01", "QA Engineer", "mid", ["test strategy"], ["l2"],
      "A release changes the payment flow and the 'About us' page. You have one day. How do you split testing?",
      ["Most effort on the payment flow (high impact, complex change), a quick check of the About page", "Equal time on both", "Only the About page, it's quicker", "Skip testing and monitor production"],
      0, ["Effort follows risk: money paths first.", "Ignores very different risks.", "Inverts the priorities.", "Too risky for payments."])),

    D("qa-s-02", "qa", "specialisation", "Exploratory testing", ["exploratory testing"], ["l2"], [
      ["What it is", "Learning, designing and testing at once", [
        "Exploratory testing is skilled, unscripted investigation: the tester uses what each step reveals to choose the next.",
        "It finds bugs scripted tests weren't written to look for."]],
      ["Core ideas", "Charters and time boxes", [
        "A charter gives a focus: 'Explore checkout with unusual addresses to find data-handling problems.'",
        "A time box (60–90 minutes) keeps sessions focused.",
        "Notes record what was tried, what was found and questions raised.",
        "Heuristics guide ideas: boundaries, interruptions, odd data, different devices, going back and forth."]],
      ["The trade-offs", "Depth against repeatability", [
        "Exploration finds surprising bugs but isn't repeatable like automation.",
        "It depends on the tester's skill and knowledge of the product.",
        "Its findings should become automated checks where useful."]],
      ["In practice", "What you'll see at work", [
        "Session-based test management with debriefs.",
        "Bug bashes before big releases.",
        "Exploration paired with developers on new features."]],
    ], Q("qa-s-02", "QA Engineer", "mid", ["exploratory testing"], ["l2"],
      "Which is a good exploratory testing charter?",
      ["'Explore the file upload with large, empty and oddly named files to find failures in validation and error messages' (90 minutes)", "'Test everything'", "'Run the regression suite'", "'Click around'"],
      0, ["Focused area, technique and goal, time-boxed.", "No focus.", "That's scripted testing.", "No direction or goal."])),

    D("qa-iv-01", "qa", "interview", "Test-design rounds", ["test design interview"], ["l2"], [
      ["What it is", "'How would you test this?'", [
        "Interviewers name something (a login page, a lift, a search box) and ask how you'd test it.",
        "They're scoring structure, coverage and prioritisation."]],
      ["Core ideas", "A structure to follow", [
        "Clarify requirements and users first.",
        "Cover functional cases, edge and negative cases, then non-functional ones: performance, security, accessibility, usability.",
        "Use named techniques (boundaries, partitions, state transitions).",
        "Prioritise: what you'd test first and what you'd automate."]],
      ["The trade-offs", "Breadth with judgement", [
        "Listing 50 cases without priority shows less than 10 well-chosen ones.",
        "Ask questions; assumptions change the answer.",
        "Mention how you'd know it works in production."]],
      ["In practice", "How to prepare", [
        "Practise on everyday objects and simple web features.",
        "Know a few techniques by name and example.",
        "End with risks and what you'd automate."]],
    ], Q("qa-iv-01", "QA Engineer", "entry", ["test design interview"], ["l2"],
      "Asked 'How would you test a login page?', what's the strongest opening?",
      ["Ask about requirements (password rules, lockout, SSO, 2FA, who uses it), then cover functional, negative, security and accessibility cases by priority", "Start typing test cases immediately", "Say login pages are simple", "Only mention automation tools"],
      0, ["Clarifying and structuring show test thinking.", "Misses context.", "Misses the risks.", "Tools aren't test design."])),

    D("qa-iv-02", "qa", "interview", "Automation exercises", ["automation interview"], ["l2"], [
      ["What it is", "Write a working test, live", [
        "SDET interviews often ask you to automate a scenario: a UI flow with Playwright or Selenium, or an API test.",
        "They're checking clean code, stable selectors, waits and assertions."]],
      ["Core ideas", "What good looks like", [
        "Clear arrange-act-assert structure.",
        "Robust locators and condition-based waits.",
        "Meaningful assertions on outcomes, not on implementation details.",
        "Independent tests with their own data, and readable names."]],
      ["The trade-offs", "Done and right", [
        "A working simple test beats an unfinished framework.",
        "Explain what you'd add with more time (page objects, data setup, CI).",
        "Avoid sleeps; say why."]],
      ["In practice", "How to prepare", [
        "Write a few tests against a public demo app.",
        "Practise API tests with assertions on status and body.",
        "Talk while coding."]],
    ], Q("qa-iv-02", "SDET", "entry", ["automation interview"], ["l2"],
      "In a live automation exercise you add `sleep(5000)` before clicking a button. What will the interviewer likely say?",
      ["Use a wait for the button to be visible and enabled instead; fixed sleeps are slow and still flaky", "Good, it's safe", "Use sleep(10000)", "Remove all waits"],
      0, ["Condition-based waits are faster and reliable.", "It's neither fast nor reliable.", "Worse.", "Then it fails on slow loads."])),

    D("mg-f-01", "management", "foundations", "One-to-ones", ["one-to-ones", "management"], ["l2"], [
      ["What it is", "Regular time for each person", [
        "A one-to-one is a recurring private conversation between a manager and each report, usually weekly or every two weeks.",
        "It's the report's meeting more than the manager's."]],
      ["Core ideas", "Their agenda, consistently", [
        "Let them bring topics first: blockers, concerns, ideas, career.",
        "Keep it regular; cancelling often tells people they don't matter.",
        "Ask open questions, listen more than you talk, and follow up on what you promised.",
        "Use some sessions for longer-term topics: growth, goals, feedback both ways."]],
      ["The trade-offs", "Not a status meeting", [
        "Turning one-to-ones into project updates wastes the one private channel.",
        "Too rigid an agenda stifles; no structure drifts.",
        "Some people need prompting to raise concerns; ask directly."]],
      ["In practice", "What you'll see at work", [
        "A shared running doc of topics and actions.",
        "Thirty minutes, protected on the calendar.",
        "Early warning of problems because people trust the space."]],
    ], Q("mg-f-01", "Engineering Manager", "entry", ["one-to-ones"], ["l2"],
      "A new manager uses one-to-ones to go through each report's ticket status. What's being lost?",
      ["The private space for the report's concerns, growth and feedback; status belongs in the team's tools or stand-ups", "Nothing, status is the point", "Too much time on careers", "Meetings are too long"],
      0, ["One-to-ones are where trust and early warnings come from.", "Status has other channels.", "It's the opposite.", "Length isn't the issue."])),

    D("mg-f-02", "management", "foundations", "Feedback", ["feedback", "management"], ["l2"], [
      ["What it is", "Helping people see what works and what doesn't", [
        "Feedback is specific information about someone's behaviour and its effect, given so they can keep doing it or change.",
        "Frequent small feedback beats a big annual surprise."]],
      ["Core ideas", "Situation, behaviour, impact", [
        "Describe the situation, the specific behaviour, and its impact ('In Tuesday's review, you interrupted Sam twice; Sam stopped sharing ideas').",
        "Give positive feedback as specifically as corrective feedback.",
        "Give it soon, in private for corrections, and ask for their view.",
        "Ask for feedback on yourself, and act on it."]],
      ["The trade-offs", "Kind and clear", [
        "Softening too much hides the message; harshness shuts people down.",
        "Feedback about personality ('you're careless') can't be acted on; behaviour can.",
        "Saving feedback for reviews makes it stale and surprising."]],
      ["In practice", "What you'll see at work", [
        "Feedback in one-to-ones as a habit, not an event.",
        "Peer feedback gathered before reviews.",
        "Follow-up to see whether things changed."]],
    ], Q("mg-f-02", "Engineering Manager", "entry", ["feedback"], ["l2"],
      "Which is the most useful corrective feedback?",
      ["'In yesterday's incident call, you started changing production without telling the commander; two fixes clashed. Next time, announce changes first.'", "'You're reckless.'", "'Be better in incidents.'", "Nothing until the annual review"],
      0, ["Specific behaviour, impact, and what to do next.", "A label, not a behaviour.", "Too vague to act on.", "Too late to help."])),

    D("mg-f-03", "management", "foundations", "Delegation", ["delegation", "management"], ["l2"], [
      ["What it is", "Giving work away well", [
        "Delegation hands ownership of work to someone else, with the context and authority to do it.",
        "Managers who don't delegate become the bottleneck and stop their team growing."]],
      ["Core ideas", "Outcome, context, authority", [
        "Describe the outcome and why it matters, not every step.",
        "Share constraints and the decisions they can make alone.",
        "Agree check-in points matched to their experience.",
        "Match the task to their growth: stretch, with support."]],
      ["The trade-offs", "Short-term speed against long-term capacity", [
        "Doing it yourself is faster this week and slower forever.",
        "Delegating without context sets people up to fail.",
        "Taking work back at the first problem teaches people not to try."]],
      ["In practice", "What you'll see at work", [
        "Clear owners for projects and decisions.",
        "Regular check-ins rather than surprise reviews at the end.",
        "Credit given publicly to the person who did the work."]],
    ], Q("mg-f-03", "Engineering Manager", "entry", ["delegation"], ["l2"],
      "A manager delegates a project but then rewrites the person's design doc without discussion. What's the likely effect?",
      ["The person loses ownership and motivation, and stops bringing their best thinking; discuss changes instead", "The project goes faster", "The person learns more", "Nothing"],
      0, ["Taking work back undermines delegation and trust.", "Short-term at best.", "They learn not to try.", "It has an effect."])),
  ],
});
