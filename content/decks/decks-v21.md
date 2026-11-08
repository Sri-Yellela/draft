# Decks v21 — QA and SDET, Specialisation and Interview; engineering management, Foundations (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 7 five-slide decks; each ends with one new question (drafts for the bank). **Nothing is live until you approve** — say "approve decks-v21" (or name the decks to change).

## qa-s-01 · Risk-based test strategy
*Skills:* test strategy, risk · *Check yourself:* qa-s-01-q1

**1. What it is — Testing where failure would hurt most**
- There's never time to test everything equally. A risk-based strategy spends effort where the likelihood and impact of failure are highest.
- It turns 'test everything' into a plan people can agree on.

**2. Core ideas — Likelihood × impact**
- List features and changes; rate how likely each is to break (new, complex, changed often) and how bad that would be (money, safety, data, reputation).
- High-risk areas get deep testing at several layers; low-risk ones get a light check.
- Revisit the ratings as the product and incidents change.
- Share the plan with product and engineering, including what won't be tested.

**3. The trade-offs — Explicit gaps**
- Writing down what isn't tested feels uncomfortable and is honest.
- Ratings are judgement calls; use incident history and data where you can.
- Low-risk areas still break sometimes; monitoring in production backs up testing.

**4. In practice — What you'll see at work**
- A risk matrix in the release plan.
- Payments, sign-in and data deletion always in the high-risk group.
- Exploratory sessions aimed at the riskiest changes.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-s-01-q1).** A release changes the payment flow and the 'About us' page. You have one day. How do you split testing?
- ✅ Most effort on the payment flow (high impact, complex change), a quick check of the About page — *Effort follows risk: money paths first.*
- Equal time on both — *Ignores very different risks.*
- Only the About page, it's quicker — *Inverts the priorities.*
- Skip testing and monitor production — *Too risky for payments.*

## qa-s-02 · Exploratory testing
*Skills:* exploratory testing · *Check yourself:* qa-s-02-q1

**1. What it is — Learning, designing and testing at once**
- Exploratory testing is skilled, unscripted investigation: the tester uses what each step reveals to choose the next.
- It finds bugs scripted tests weren't written to look for.

**2. Core ideas — Charters and time boxes**
- A charter gives a focus: 'Explore checkout with unusual addresses to find data-handling problems.'
- A time box (60–90 minutes) keeps sessions focused.
- Notes record what was tried, what was found and questions raised.
- Heuristics guide ideas: boundaries, interruptions, odd data, different devices, going back and forth.

**3. The trade-offs — Depth against repeatability**
- Exploration finds surprising bugs but isn't repeatable like automation.
- It depends on the tester's skill and knowledge of the product.
- Its findings should become automated checks where useful.

**4. In practice — What you'll see at work**
- Session-based test management with debriefs.
- Bug bashes before big releases.
- Exploration paired with developers on new features.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-s-02-q1).** Which is a good exploratory testing charter?
- ✅ 'Explore the file upload with large, empty and oddly named files to find failures in validation and error messages' (90 minutes) — *Focused area, technique and goal, time-boxed.*
- 'Test everything' — *No focus.*
- 'Run the regression suite' — *That's scripted testing.*
- 'Click around' — *No direction or goal.*

## qa-iv-01 · Test-design rounds
*Skills:* test design interview · *Check yourself:* qa-iv-01-q1

**1. What it is — 'How would you test this?'**
- Interviewers name something (a login page, a lift, a search box) and ask how you'd test it.
- They're scoring structure, coverage and prioritisation.

**2. Core ideas — A structure to follow**
- Clarify requirements and users first.
- Cover functional cases, edge and negative cases, then non-functional ones: performance, security, accessibility, usability.
- Use named techniques (boundaries, partitions, state transitions).
- Prioritise: what you'd test first and what you'd automate.

**3. The trade-offs — Breadth with judgement**
- Listing 50 cases without priority shows less than 10 well-chosen ones.
- Ask questions; assumptions change the answer.
- Mention how you'd know it works in production.

**4. In practice — How to prepare**
- Practise on everyday objects and simple web features.
- Know a few techniques by name and example.
- End with risks and what you'd automate.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-iv-01-q1).** Asked 'How would you test a login page?', what's the strongest opening?
- ✅ Ask about requirements (password rules, lockout, SSO, 2FA, who uses it), then cover functional, negative, security and accessibility cases by priority — *Clarifying and structuring show test thinking.*
- Start typing test cases immediately — *Misses context.*
- Say login pages are simple — *Misses the risks.*
- Only mention automation tools — *Tools aren't test design.*

## qa-iv-02 · Automation exercises
*Skills:* automation interview · *Check yourself:* qa-iv-02-q1

**1. What it is — Write a working test, live**
- SDET interviews often ask you to automate a scenario: a UI flow with Playwright or Selenium, or an API test.
- They're checking clean code, stable selectors, waits and assertions.

**2. Core ideas — What good looks like**
- Clear arrange-act-assert structure.
- Robust locators and condition-based waits.
- Meaningful assertions on outcomes, not on implementation details.
- Independent tests with their own data, and readable names.

**3. The trade-offs — Done and right**
- A working simple test beats an unfinished framework.
- Explain what you'd add with more time (page objects, data setup, CI).
- Avoid sleeps; say why.

**4. In practice — How to prepare**
- Write a few tests against a public demo app.
- Practise API tests with assertions on status and body.
- Talk while coding.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (qa-iv-02-q1).** In a live automation exercise you add `sleep(5000)` before clicking a button. What will the interviewer likely say?
- ✅ Use a wait for the button to be visible and enabled instead; fixed sleeps are slow and still flaky — *Condition-based waits are faster and reliable.*
- Good, it's safe — *It's neither fast nor reliable.*
- Use sleep(10000) — *Worse.*
- Remove all waits — *Then it fails on slow loads.*

## mg-f-01 · One-to-ones
*Skills:* one-to-ones, management · *Check yourself:* mg-f-01-q1

**1. What it is — Regular time for each person**
- A one-to-one is a recurring private conversation between a manager and each report, usually weekly or every two weeks.
- It's the report's meeting more than the manager's.

**2. Core ideas — Their agenda, consistently**
- Let them bring topics first: blockers, concerns, ideas, career.
- Keep it regular; cancelling often tells people they don't matter.
- Ask open questions, listen more than you talk, and follow up on what you promised.
- Use some sessions for longer-term topics: growth, goals, feedback both ways.

**3. The trade-offs — Not a status meeting**
- Turning one-to-ones into project updates wastes the one private channel.
- Too rigid an agenda stifles; no structure drifts.
- Some people need prompting to raise concerns; ask directly.

**4. In practice — What you'll see at work**
- A shared running doc of topics and actions.
- Thirty minutes, protected on the calendar.
- Early warning of problems because people trust the space.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (mg-f-01-q1).** A new manager uses one-to-ones to go through each report's ticket status. What's being lost?
- ✅ The private space for the report's concerns, growth and feedback; status belongs in the team's tools or stand-ups — *One-to-ones are where trust and early warnings come from.*
- Nothing, status is the point — *Status has other channels.*
- Too much time on careers — *It's the opposite.*
- Meetings are too long — *Length isn't the issue.*

## mg-f-02 · Feedback
*Skills:* feedback, management · *Check yourself:* mg-f-02-q1

**1. What it is — Helping people see what works and what doesn't**
- Feedback is specific information about someone's behaviour and its effect, given so they can keep doing it or change.
- Frequent small feedback beats a big annual surprise.

**2. Core ideas — Situation, behaviour, impact**
- Describe the situation, the specific behaviour, and its impact ('In Tuesday's review, you interrupted Sam twice; Sam stopped sharing ideas').
- Give positive feedback as specifically as corrective feedback.
- Give it soon, in private for corrections, and ask for their view.
- Ask for feedback on yourself, and act on it.

**3. The trade-offs — Kind and clear**
- Softening too much hides the message; harshness shuts people down.
- Feedback about personality ('you're careless') can't be acted on; behaviour can.
- Saving feedback for reviews makes it stale and surprising.

**4. In practice — What you'll see at work**
- Feedback in one-to-ones as a habit, not an event.
- Peer feedback gathered before reviews.
- Follow-up to see whether things changed.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (mg-f-02-q1).** Which is the most useful corrective feedback?
- ✅ 'In yesterday's incident call, you started changing production without telling the commander; two fixes clashed. Next time, announce changes first.' — *Specific behaviour, impact, and what to do next.*
- 'You're reckless.' — *A label, not a behaviour.*
- 'Be better in incidents.' — *Too vague to act on.*
- Nothing until the annual review — *Too late to help.*

## mg-f-03 · Delegation
*Skills:* delegation, management · *Check yourself:* mg-f-03-q1

**1. What it is — Giving work away well**
- Delegation hands ownership of work to someone else, with the context and authority to do it.
- Managers who don't delegate become the bottleneck and stop their team growing.

**2. Core ideas — Outcome, context, authority**
- Describe the outcome and why it matters, not every step.
- Share constraints and the decisions they can make alone.
- Agree check-in points matched to their experience.
- Match the task to their growth: stretch, with support.

**3. The trade-offs — Short-term speed against long-term capacity**
- Doing it yourself is faster this week and slower forever.
- Delegating without context sets people up to fail.
- Taking work back at the first problem teaches people not to try.

**4. In practice — What you'll see at work**
- Clear owners for projects and decisions.
- Regular check-ins rather than surprise reviews at the end.
- Credit given publicly to the person who did the work.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (mg-f-03-q1).** A manager delegates a project but then rewrites the person's design doc without discussion. What's the likely effect?
- ✅ The person loses ownership and motivation, and stops bringing their best thinking; discuss changes instead — *Taking work back undermines delegation and trust.*
- The project goes faster — *Short-term at best.*
- The person learns more — *They learn not to try.*
- Nothing — *It has an effect.*
