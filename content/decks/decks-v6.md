# Decks v6 — software engineering, Specialisation: mobile, and Interview (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 10 five-slide decks; each ends with one new question (drafts for the bank). **Nothing is live until you approve** — say "approve decks-v6" (or name the decks to change).

## sw-mo-01 · The app lifecycle
*Skills:* mobile, ios, android · *Check yourself:* sw-mo-01-q1

**1. What it is — Apps don't run when you think**
- A mobile app is started, sent to the background, suspended and killed by the operating system, often without warning, to save battery and memory.
- Code has to expect being stopped at any moment and brought back later.

**2. Core ideas — States and callbacks**
- iOS and Android report state changes (foreground, background, terminated) through lifecycle callbacks.
- In the background an app gets little or no time; heavy work must be handed to the system's background APIs.
- The system can kill a backgrounded app to free memory; the next launch starts fresh, so screen state must be restorable.
- On Android, a screen rotation recreates the screen by default; state survives in a ViewModel or saved state.

**3. The trade-offs — Responsiveness against battery**
- Keeping work running feels responsive but drains battery and gets the app killed or flagged.
- Saving state often costs a little time; losing a half-written message costs a user.
- Platform behaviour changes with OS versions; test on old and new.

**4. In practice — What you'll see at work**
- Drafts saved as the user types; the last screen restored on relaunch.
- Network calls cancelled or handed off when the screen goes away.
- Crash and 'app not responding' rates watched per release.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-mo-01-q1).** Users say a half-written message disappears if they switch to another app for a while and come back. Why, and what fixes it?
- ✅ The OS killed the backgrounded app to free memory; save the draft as they type and restore it on launch — *A killed app restarts fresh unless it saved its state.*
- The keyboard deletes text; use a custom keyboard — *The keyboard doesn't keep or delete the app's text.*
- The network dropped; retry the request — *Nothing was sent yet; the draft lived only in memory.*
- Users pressed back; disable the back button — *Breaking navigation doesn't stop the OS freeing memory.*

## sw-mo-02 · Offline and sync
*Skills:* offline, sync, mobile · *Check yourself:* sw-mo-02-q1

**1. What it is — Working without a connection**
- Phones lose signal in lifts, trains and basements. An offline-capable app keeps working and syncs when the connection returns.
- The hard part is merging changes made in two places.

**2. Core ideas — Local first, then sync**
- Keep a local database (SQLite, Room, Core Data) as what the screen reads; the network updates it in the background.
- Queue writes made offline, each with a unique id, and send them when online, safely repeatable.
- Conflicts happen when the same item changed on the device and on the server; choose a rule (last write wins, merge fields, ask the person).
- Sync changes only since the last sync (a cursor or timestamp), not everything.

**3. The trade-offs — Always usable, sometimes out of date**
- Offline support is a big design commitment; decide per feature whether it's needed.
- Last-write-wins is simple and silently loses one side's edit.
- Showing what's waiting to sync builds trust; hiding it causes confusion.

**4. In practice — What you'll see at work**
- A small 'Saved on this phone, will sync' indicator.
- Server endpoints that accept batched, idempotent changes.
- Tests that switch the network off mid-action.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-mo-02-q1).** Someone edits a note offline on their phone while also editing it on the web. When the phone reconnects, the web edit vanishes. What's happening?
- ✅ Last-write-wins sync replaced the whole note; merge field by field or show both versions — *Overwriting the whole item loses the other side's change; a merge or a choice keeps it.*
- The web app has a bug — *Both apps did what the sync rule says.*
- The phone's clock is wrong, so nothing can be done — *Clock skew can matter, but the rule itself loses data.*
- Offline edits should never be allowed — *That gives up a feature people need.*

## sw-mo-03 · Main-thread performance and images
*Skills:* mobile performance, images · *Check yourself:* sw-mo-03-q1

**1. What it is — Smooth scrolling, no freezes**
- Mobile UIs update on one main thread; anything slow there makes scrolling stutter or the app freeze.
- Images are the usual culprit: big to download, slow to decode, heavy in memory.

**2. Core ideas — Keep the main thread for drawing**
- Network, disk, JSON parsing and image decoding go on background threads; only UI updates happen on the main thread.
- Decode images at the size they're shown: a 4000-pixel photo in a 100-point thumbnail wastes memory.
- Cache images in memory and on disk (Glide, Coil, Kingfisher, SDWebImage do this).
- Lists reuse rows (RecyclerView, UICollectionView, LazyColumn) rather than creating one per item.

**3. The trade-offs — Memory against speed**
- Caching more makes scrolling faster and raises memory, which can get the app killed.
- Prefetching images ahead of scrolling uses data the user may never need.
- Measuring on a high-end phone hides problems that every mid-range phone has.

**4. In practice — What you'll see at work**
- Profilers (Instruments, Android Studio) show frames over 16 ms and what ran on the main thread.
- The server sends image sizes suited to the screen.
- Android's StrictMode or iOS's main-thread checker flags disk and network work on the main thread.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-mo-03-q1).** A product list stutters while scrolling. Profiling shows full-size photos being decoded on the main thread. What fixes it?
- ✅ Decode images off the main thread at the displayed size, with caching — *The main thread stays free to draw, and smaller bitmaps decode faster and use less memory.*
- Make the list shorter — *Fewer items doesn't fix each one being slow.*
- Use a faster phone for testing — *Your users don't all have fast phones.*
- Load all images when the app starts — *That moves the delay to launch and wastes memory.*

## sw-mo-04 · Staged releases and old versions
*Skills:* mobile releases, versioning · *Check yourself:* sw-mo-04-q1

**1. What it is — You can't make everyone update**
- A web deploy reaches everyone at once; a mobile release goes through store review and people update when they choose.
- So several versions of your app talk to your servers at the same time, for months.

**2. Core ideas — Roll out slowly, stay compatible**
- Staged (phased) rollouts release to a small share first; pause them if crash rates rise.
- APIs must stay backwards compatible with every version still in use.
- A minimum supported version, checked at launch, can ask very old apps to update when a change truly can't be supported.
- Feature flags and remote config let you turn features on or off without a new release.

**3. The trade-offs — Speed against reach**
- A bug shipped to phones can't be rolled back; the fix is another release and another review.
- Supporting old versions slows server changes; forcing updates annoys users.
- Store review timing is outside your control; plan releases with slack.

**4. In practice — What you'll see at work**
- Crash-free session rates per version, watched during each rollout.
- Server logs that record the app version on every request.
- Release trains on a fixed schedule rather than one-off releases.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-mo-04-q1).** Your backend team wants to remove an API field. 18 % of users are still on app versions that read it. What should happen first?
- ✅ Keep the field until those versions are below an agreed threshold, or ship a forced-update path first — *Old apps can't change; the server has to keep serving them until they're gone or blocked deliberately.*
- Remove it; users should update — *Those users' apps break today.*
- Rename it so old apps fail more clearly — *Failing clearly is still failing.*
- Remove it on weekends only — *Timing doesn't change who breaks.*

## sw-mo-05 · Push and background work
*Skills:* push notifications, background tasks · *Check yourself:* sw-mo-05-q1

**1. What it is — Doing things when the app isn't open**
- Push notifications reach the device through Apple's APNs or Google's FCM, even when the app isn't running.
- Background work (syncing, uploading) must go through the system's schedulers, which decide when it runs.

**2. Core ideas — Tokens, permission, schedulers**
- Each install registers for a push token and sends it to your server; tokens change and must be refreshed.
- iOS, and recent Android, require the person's permission to show notifications; ask when it makes sense, not at first launch.
- Silent (data) pushes can wake the app briefly to fetch something; they're limited and not guaranteed.
- WorkManager (Android) and BGTaskScheduler (iOS) run deferred work under conditions like 'on Wi-Fi and charging'.

**3. The trade-offs — Reliability is not guaranteed**
- The system may delay or drop background work to save battery; never rely on exact timing.
- Too many notifications get the app's notifications turned off, or the app deleted.
- Payloads should hold ids, not private content; the app fetches the details securely.

**4. In practice — What you'll see at work**
- A notification service on the server with per-user preferences and quiet hours.
- Invalid tokens cleaned up when the provider says they're dead.
- Uploads that survive the app being closed by using the system's background transfer.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-mo-05-q1).** Your app asks for notification permission on the very first screen, and most people say no. What usually works better?
- ✅ Ask at a moment the value is clear, such as after they follow an order or a job, explaining what they'll get — *People say yes when the reason is in front of them.*
- Ask again every launch — *Repeated prompts annoy, and iOS shows the system prompt only once.*
- Skip asking and send anyway — *The system won't show them without permission.*
- Ask in a long settings page — *Few people will find it there.*

## sw-mo-06 · Platform guidelines
*Skills:* ios, android, design · *Check yourself:* sw-mo-06-q1

**1. What it is — Feeling at home on each phone**
- Apple's Human Interface Guidelines and Google's Material Design describe how apps on each platform look and behave.
- Following them makes an app easier to learn and helps it through store review.

**2. Core ideas — Navigation, controls, system features**
- Navigation differs: tab bars and back-swipe on iOS; navigation patterns and the system back gesture on Android.
- Use system controls and fonts; they handle accessibility, dynamic text size and dark mode for you.
- Touch targets at least about 44 points (iOS) or 48 dp (Android).
- Respect safe areas (notches, home indicators) and the system's text size setting.

**3. The trade-offs — Native feel or one design everywhere**
- One identical design on both platforms is cheaper to build and feels foreign on both.
- Cross-platform frameworks (React Native, Flutter) share code; they still need platform-specific touches.
- Store rules (payments, privacy labels) are requirements, not suggestions.

**4. In practice — What you'll see at work**
- Screens tested with the largest text size and with VoiceOver and TalkBack.
- Privacy disclosures kept in step with what the app actually collects.
- Design reviews that check each platform separately.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-mo-06-q1).** Users with large text settings say buttons overlap and labels are cut off. What's the root fix?
- ✅ Use layouts that grow with the text (no fixed heights), and test at the largest text size — *Layouts that adapt keep everything readable at any size.*
- Ignore the system text size — *That fails the people who need larger text, and store reviewers notice.*
- Make all text smaller — *That hurts everyone's readability.*
- Use images of text — *Images of text don't scale and aren't read by screen readers.*

## sw-iv-01 · Coding interview patterns
*Skills:* coding interview, algorithms · *Check yourself:* sw-iv-01-q1

**1. What it is — A couple of dozen patterns behind most problems**
- Coding rounds ask you to solve a small problem in 30–45 minutes while explaining your thinking.
- Most problems are variations of known patterns; the Library's Coding interview patterns course covers each one with practice links.

**2. Core ideas — How a round goes**
- Clarify first: inputs, outputs, edge cases, size limits. Say the brute-force approach and its cost.
- Spot the pattern: two pointers, sliding window, hashing, BFS/DFS, binary search, dynamic programming.
- Write clean code, then test it by hand on a small example and an edge case.
- State the time and space complexity, and how you'd improve it.

**3. The trade-offs — Speed against communication**
- Silent coding, even when correct, leaves the interviewer guessing; talking through it is part of the score.
- Jumping to an optimal trick you can't explain is worse than a clear, slightly slower solution.
- Memorising answers breaks on a small twist; practise recognising patterns.

**4. In practice — How to prepare**
- Practise a few problems per pattern, out loud, against a timer.
- Review each one: which clue pointed to the pattern?
- Mock interviews with a friend expose habits that solo practice hides.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-iv-01-q1).** In a coding interview you're given a problem and immediately see a clever solution. What's the best first move?
- ✅ Restate the problem, ask about inputs and edge cases, then outline your approach before coding — *Clarifying catches misunderstandings, and outlining shows your thinking, both part of the score.*
- Start typing the solution straight away — *A misread problem wastes the whole round.*
- Ask for a harder problem — *Solve the one in front of you well.*
- Stay quiet so you don't distract yourself — *The interviewer can't score thinking they can't hear.*

## sw-iv-02 · System design rounds
*Skills:* system design interview · *Check yourself:* sw-iv-02-q1

**1. What it is — Designing a big system in 45 minutes**
- You're asked to design something like a URL shortener, a feed or a chat app, and to talk through the choices.
- There's no single right answer; they're judging how you reason about trade-offs.

**2. Core ideas — A structure to follow**
- Requirements: what must it do, and how big (users, requests per second, data size)?
- High-level design: clients, services, data stores, caches, queues, drawn as boxes and arrows.
- Deep dive into the hardest part: the data model, scaling the hot path, consistency.
- Wrap up: bottlenecks, failure modes, what you'd do next.

**3. The trade-offs — Depth where it matters**
- Spending 20 minutes on requirements leaves no time to design; skipping them means designing the wrong thing.
- Naming technologies isn't designing; say why a cache, a queue or a particular database fits.
- Every choice costs something; say what you're giving up.

**4. In practice — How to prepare**
- Work through the classic cases (see the Case studies stage).
- Practise rough estimates: requests per second, storage per year.
- Draw while you talk, and check in with the interviewer about where to go deeper.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-iv-02-q1).** Ten minutes into a system design round, you've listed technologies but haven't discussed requirements or scale. What's the risk?
- ✅ You may be designing for the wrong problem and can't justify any choice; go back and agree requirements and scale — *Choices only make sense against requirements; without them every choice looks arbitrary.*
- None, technologies are what they're scoring — *They score reasoning, not a list of names.*
- You're moving too slowly — *Speed isn't the issue; direction is.*
- You should switch to coding — *It's a design round.*

## sw-iv-03 · Behavioural interviews
*Skills:* behavioural interview, star · *Check yourself:* sw-iv-03-q1

**1. What it is — Stories that show how you work**
- Behavioural questions ask about real past situations: 'Tell me about a time you disagreed with a teammate.'
- They check judgement, ownership and collaboration, which code can't show.

**2. Core ideas — Situation, task, action, result**
- Situation: the context, briefly. Task: what you were responsible for.
- Action: what you did, in the first person; most of the answer belongs here.
- Result: what happened, with a number where you can, and what you learned.
- Prepare six to eight stories that can each answer several questions (conflict, failure, leadership, ambiguity).

**3. The trade-offs — Honest and specific**
- 'We' hides your part; say 'I' for what you did.
- A story where everything went well teaches less than one where you made a mistake and fixed it.
- Rehearsed stories help; reciting a script sounds hollow.

**4. In practice — How to prepare**
- Write each story in four short lines, then practise telling it in two minutes.
- Match stories to the company's stated values.
- Have questions of your own ready for the end.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-iv-03-q1).** Asked about a project that failed, a candidate spends most of the answer on the context and the team's work, and one sentence on their own part. What should change?
- ✅ Spend most of the answer on their own actions and what they learned, with the result — *The interviewer is scoring the candidate's actions and learning.*
- Pick a project that succeeded instead — *The question asked about a failure; dodging it is noticed.*
- Talk more about the team — *That's already the problem.*
- Keep it under 20 seconds — *Too short leaves no evidence.*

## sw-iv-04 · AI-enabled coding
*Skills:* ai-assisted coding, llm tools · *Check yourself:* sw-iv-04-q1

**1. What it is — Working well with AI coding tools**
- Many teams now use AI assistants to write, explain and review code, and some interviews let you use them.
- What's tested is judgement: directing the tool, checking its work, and owning the result.

**2. Core ideas — Direct, verify, own**
- Give the tool context and constraints: the language, the existing code, what must not change.
- Read every line it writes; it can produce plausible code that's subtly wrong or insecure.
- Run tests, and write the tests yourself for anything that matters.
- Know when to stop prompting and write the tricky part by hand.

**3. The trade-offs — Speed against understanding**
- AI speeds up boilerplate and unfamiliar APIs; it can slow you down on subtle logic if you keep re-prompting.
- Pasting private code or keys into an external tool may break your company's rules.
- Code you can't explain is code you can't debug at 3 a.m.

**4. In practice — What you'll see at work and in interviews**
- Interviewers watch how you check and adjust the tool's output, not just the final code.
- Teams have rules about which tools may see which code.
- Review AI-written code as carefully as a colleague's, or more.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-iv-04-q1).** An AI assistant writes a function that passes your one test. What should you do before relying on it?
- ✅ Read it line by line and test edge cases (empty input, large input, errors) you'd expect a reviewer to ask about — *One passing test proves little; you own the code.*
- Ship it; the test passed — *Untested edge cases are where bugs live.*
- Ask the assistant whether it's correct — *Its answer isn't evidence.*
- Rewrite it in another language — *That doesn't check correctness.*
