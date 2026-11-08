#!/usr/bin/env node
// ⭐ D155 Part C · decks-v6 — software engineering, Specialisation: mobile (6) and Interview (4), drafted by the agent
// 2026-11-08 for the owner's review. node scripts/decks/decksV6.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const M = (n, title, skills, pieces, slides, q) => deck(`sw-mo-0${n}`, "software", "specialisation-mobile", title, skills, pieces, slides, q);
const MQ = (n, skills, pieces, stem, choices, correct, why) => question(`sw-mo-0${n}-q1`, "Mobile Engineer", "mid", skills, pieces, stem, choices, correct, why);
const I = (n, title, skills, pieces, slides, q) => deck(`sw-iv-0${n}`, "software", "interview", title, skills, pieces, slides, q);
const IQ = (n, skills, pieces, stem, choices, correct, why) => question(`sw-iv-0${n}-q1`, "Software Engineer", "entry", skills, pieces, stem, choices, correct, why);

writeBatch({
  version: 6,
  title: "software engineering, Specialisation: mobile, and Interview",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C, approved; D154 P4 format). Pathway 'software', stages 'specialisation-mobile' (6) and 'interview' (4), in Part C's order. Nothing is live until approved (status: draft).",
  decks: [
    M(1, "The app lifecycle", ["mobile", "ios", "android"], ["l2"], [
      ["What it is", "Apps don't run when you think", [
        "A mobile app is started, sent to the background, suspended and killed by the operating system, often without warning, to save battery and memory.",
        "Code has to expect being stopped at any moment and brought back later."]],
      ["Core ideas", "States and callbacks", [
        "iOS and Android report state changes (foreground, background, terminated) through lifecycle callbacks.",
        "In the background an app gets little or no time; heavy work must be handed to the system's background APIs.",
        "The system can kill a backgrounded app to free memory; the next launch starts fresh, so screen state must be restorable.",
        "On Android, a screen rotation recreates the screen by default; state survives in a ViewModel or saved state."]],
      ["The trade-offs", "Responsiveness against battery", [
        "Keeping work running feels responsive but drains battery and gets the app killed or flagged.",
        "Saving state often costs a little time; losing a half-written message costs a user.",
        "Platform behaviour changes with OS versions; test on old and new."]],
      ["In practice", "What you'll see at work", [
        "Drafts saved as the user types; the last screen restored on relaunch.",
        "Network calls cancelled or handed off when the screen goes away.",
        "Crash and 'app not responding' rates watched per release."]],
    ], MQ(1, ["mobile"], ["l2"],
      "Users say a half-written message disappears if they switch to another app for a while and come back. Why, and what fixes it?",
      ["The OS killed the backgrounded app to free memory; save the draft as they type and restore it on launch", "The keyboard deletes text; use a custom keyboard",
        "The network dropped; retry the request", "Users pressed back; disable the back button"],
      0, ["A killed app restarts fresh unless it saved its state.", "The keyboard doesn't keep or delete the app's text.", "Nothing was sent yet; the draft lived only in memory.", "Breaking navigation doesn't stop the OS freeing memory."])),

    M(2, "Offline and sync", ["offline", "sync", "mobile"], ["x1"], [
      ["What it is", "Working without a connection", [
        "Phones lose signal in lifts, trains and basements. An offline-capable app keeps working and syncs when the connection returns.",
        "The hard part is merging changes made in two places."]],
      ["Core ideas", "Local first, then sync", [
        "Keep a local database (SQLite, Room, Core Data) as what the screen reads; the network updates it in the background.",
        "Queue writes made offline, each with a unique id, and send them when online, safely repeatable.",
        "Conflicts happen when the same item changed on the device and on the server; choose a rule (last write wins, merge fields, ask the person).",
        "Sync changes only since the last sync (a cursor or timestamp), not everything."]],
      ["The trade-offs", "Always usable, sometimes out of date", [
        "Offline support is a big design commitment; decide per feature whether it's needed.",
        "Last-write-wins is simple and silently loses one side's edit.",
        "Showing what's waiting to sync builds trust; hiding it causes confusion."]],
      ["In practice", "What you'll see at work", [
        "A small 'Saved on this phone, will sync' indicator.",
        "Server endpoints that accept batched, idempotent changes.",
        "Tests that switch the network off mid-action."]],
    ], MQ(2, ["sync"], ["x1"],
      "Someone edits a note offline on their phone while also editing it on the web. When the phone reconnects, the web edit vanishes. What's happening?",
      ["Last-write-wins sync replaced the whole note; merge field by field or show both versions", "The web app has a bug", "The phone's clock is wrong, so nothing can be done", "Offline edits should never be allowed"],
      0, ["Overwriting the whole item loses the other side's change; a merge or a choice keeps it.", "Both apps did what the sync rule says.", "Clock skew can matter, but the rule itself loses data.", "That gives up a feature people need."])),

    M(3, "Main-thread performance and images", ["mobile performance", "images"], ["o3"], [
      ["What it is", "Smooth scrolling, no freezes", [
        "Mobile UIs update on one main thread; anything slow there makes scrolling stutter or the app freeze.",
        "Images are the usual culprit: big to download, slow to decode, heavy in memory."]],
      ["Core ideas", "Keep the main thread for drawing", [
        "Network, disk, JSON parsing and image decoding go on background threads; only UI updates happen on the main thread.",
        "Decode images at the size they're shown: a 4000-pixel photo in a 100-point thumbnail wastes memory.",
        "Cache images in memory and on disk (Glide, Coil, Kingfisher, SDWebImage do this).",
        "Lists reuse rows (RecyclerView, UICollectionView, LazyColumn) rather than creating one per item."]],
      ["The trade-offs", "Memory against speed", [
        "Caching more makes scrolling faster and raises memory, which can get the app killed.",
        "Prefetching images ahead of scrolling uses data the user may never need.",
        "Measuring on a high-end phone hides problems that every mid-range phone has."]],
      ["In practice", "What you'll see at work", [
        "Profilers (Instruments, Android Studio) show frames over 16 ms and what ran on the main thread.",
        "The server sends image sizes suited to the screen.",
        "Android's StrictMode or iOS's main-thread checker flags disk and network work on the main thread."]],
    ], MQ(3, ["mobile performance"], ["o3"],
      "A product list stutters while scrolling. Profiling shows full-size photos being decoded on the main thread. What fixes it?",
      ["Decode images off the main thread at the displayed size, with caching", "Make the list shorter", "Use a faster phone for testing", "Load all images when the app starts"],
      0, ["The main thread stays free to draw, and smaller bitmaps decode faster and use less memory.", "Fewer items doesn't fix each one being slow.", "Your users don't all have fast phones.", "That moves the delay to launch and wastes memory."])),

    M(4, "Staged releases and old versions", ["mobile releases", "versioning"], ["l2"], [
      ["What it is", "You can't make everyone update", [
        "A web deploy reaches everyone at once; a mobile release goes through store review and people update when they choose.",
        "So several versions of your app talk to your servers at the same time, for months."]],
      ["Core ideas", "Roll out slowly, stay compatible", [
        "Staged (phased) rollouts release to a small share first; pause them if crash rates rise.",
        "APIs must stay backwards compatible with every version still in use.",
        "A minimum supported version, checked at launch, can ask very old apps to update when a change truly can't be supported.",
        "Feature flags and remote config let you turn features on or off without a new release."]],
      ["The trade-offs", "Speed against reach", [
        "A bug shipped to phones can't be rolled back; the fix is another release and another review.",
        "Supporting old versions slows server changes; forcing updates annoys users.",
        "Store review timing is outside your control; plan releases with slack."]],
      ["In practice", "What you'll see at work", [
        "Crash-free session rates per version, watched during each rollout.",
        "Server logs that record the app version on every request.",
        "Release trains on a fixed schedule rather than one-off releases."]],
    ], MQ(4, ["mobile releases"], ["l2"],
      "Your backend team wants to remove an API field. 18 % of users are still on app versions that read it. What should happen first?",
      ["Keep the field until those versions are below an agreed threshold, or ship a forced-update path first", "Remove it; users should update", "Rename it so old apps fail more clearly", "Remove it on weekends only"],
      0, ["Old apps can't change; the server has to keep serving them until they're gone or blocked deliberately.", "Those users' apps break today.", "Failing clearly is still failing.", "Timing doesn't change who breaks."])),

    M(5, "Push and background work", ["push notifications", "background tasks"], ["x1"], [
      ["What it is", "Doing things when the app isn't open", [
        "Push notifications reach the device through Apple's APNs or Google's FCM, even when the app isn't running.",
        "Background work (syncing, uploading) must go through the system's schedulers, which decide when it runs."]],
      ["Core ideas", "Tokens, permission, schedulers", [
        "Each install registers for a push token and sends it to your server; tokens change and must be refreshed.",
        "iOS, and recent Android, require the person's permission to show notifications; ask when it makes sense, not at first launch.",
        "Silent (data) pushes can wake the app briefly to fetch something; they're limited and not guaranteed.",
        "WorkManager (Android) and BGTaskScheduler (iOS) run deferred work under conditions like 'on Wi-Fi and charging'."]],
      ["The trade-offs", "Reliability is not guaranteed", [
        "The system may delay or drop background work to save battery; never rely on exact timing.",
        "Too many notifications get the app's notifications turned off, or the app deleted.",
        "Payloads should hold ids, not private content; the app fetches the details securely."]],
      ["In practice", "What you'll see at work", [
        "A notification service on the server with per-user preferences and quiet hours.",
        "Invalid tokens cleaned up when the provider says they're dead.",
        "Uploads that survive the app being closed by using the system's background transfer."]],
    ], MQ(5, ["push notifications"], ["x1"],
      "Your app asks for notification permission on the very first screen, and most people say no. What usually works better?",
      ["Ask at a moment the value is clear, such as after they follow an order or a job, explaining what they'll get", "Ask again every launch", "Skip asking and send anyway", "Ask in a long settings page"],
      0, ["People say yes when the reason is in front of them.", "Repeated prompts annoy, and iOS shows the system prompt only once.", "The system won't show them without permission.", "Few people will find it there."])),

    M(6, "Platform guidelines", ["ios", "android", "design"], ["l2"], [
      ["What it is", "Feeling at home on each phone", [
        "Apple's Human Interface Guidelines and Google's Material Design describe how apps on each platform look and behave.",
        "Following them makes an app easier to learn and helps it through store review."]],
      ["Core ideas", "Navigation, controls, system features", [
        "Navigation differs: tab bars and back-swipe on iOS; navigation patterns and the system back gesture on Android.",
        "Use system controls and fonts; they handle accessibility, dynamic text size and dark mode for you.",
        "Touch targets at least about 44 points (iOS) or 48 dp (Android).",
        "Respect safe areas (notches, home indicators) and the system's text size setting."]],
      ["The trade-offs", "Native feel or one design everywhere", [
        "One identical design on both platforms is cheaper to build and feels foreign on both.",
        "Cross-platform frameworks (React Native, Flutter) share code; they still need platform-specific touches.",
        "Store rules (payments, privacy labels) are requirements, not suggestions."]],
      ["In practice", "What you'll see at work", [
        "Screens tested with the largest text size and with VoiceOver and TalkBack.",
        "Privacy disclosures kept in step with what the app actually collects.",
        "Design reviews that check each platform separately."]],
    ], MQ(6, ["design", "accessibility"], ["l2"],
      "Users with large text settings say buttons overlap and labels are cut off. What's the root fix?",
      ["Use layouts that grow with the text (no fixed heights), and test at the largest text size", "Ignore the system text size", "Make all text smaller", "Use images of text"],
      0, ["Layouts that adapt keep everything readable at any size.", "That fails the people who need larger text, and store reviewers notice.", "That hurts everyone's readability.", "Images of text don't scale and aren't read by screen readers."])),

    I(1, "Coding interview patterns", ["coding interview", "algorithms"], ["g4"], [
      ["What it is", "A couple of dozen patterns behind most problems", [
        "Coding rounds ask you to solve a small problem in 30–45 minutes while explaining your thinking.",
        "Most problems are variations of known patterns; the Library's Coding interview patterns course covers each one with practice links."]],
      ["Core ideas", "How a round goes", [
        "Clarify first: inputs, outputs, edge cases, size limits. Say the brute-force approach and its cost.",
        "Spot the pattern: two pointers, sliding window, hashing, BFS/DFS, binary search, dynamic programming.",
        "Write clean code, then test it by hand on a small example and an edge case.",
        "State the time and space complexity, and how you'd improve it."]],
      ["The trade-offs", "Speed against communication", [
        "Silent coding, even when correct, leaves the interviewer guessing; talking through it is part of the score.",
        "Jumping to an optimal trick you can't explain is worse than a clear, slightly slower solution.",
        "Memorising answers breaks on a small twist; practise recognising patterns."]],
      ["In practice", "How to prepare", [
        "Practise a few problems per pattern, out loud, against a timer.",
        "Review each one: which clue pointed to the pattern?",
        "Mock interviews with a friend expose habits that solo practice hides."]],
    ], IQ(1, ["coding interview"], ["g4"],
      "In a coding interview you're given a problem and immediately see a clever solution. What's the best first move?",
      ["Restate the problem, ask about inputs and edge cases, then outline your approach before coding", "Start typing the solution straight away", "Ask for a harder problem", "Stay quiet so you don't distract yourself"],
      0, ["Clarifying catches misunderstandings, and outlining shows your thinking, both part of the score.", "A misread problem wastes the whole round.", "Solve the one in front of you well.", "The interviewer can't score thinking they can't hear."])),

    I(2, "System design rounds", ["system design interview"], ["x2"], [
      ["What it is", "Designing a big system in 45 minutes", [
        "You're asked to design something like a URL shortener, a feed or a chat app, and to talk through the choices.",
        "There's no single right answer; they're judging how you reason about trade-offs."]],
      ["Core ideas", "A structure to follow", [
        "Requirements: what must it do, and how big (users, requests per second, data size)?",
        "High-level design: clients, services, data stores, caches, queues, drawn as boxes and arrows.",
        "Deep dive into the hardest part: the data model, scaling the hot path, consistency.",
        "Wrap up: bottlenecks, failure modes, what you'd do next."]],
      ["The trade-offs", "Depth where it matters", [
        "Spending 20 minutes on requirements leaves no time to design; skipping them means designing the wrong thing.",
        "Naming technologies isn't designing; say why a cache, a queue or a particular database fits.",
        "Every choice costs something; say what you're giving up."]],
      ["In practice", "How to prepare", [
        "Work through the classic cases (see the Case studies stage).",
        "Practise rough estimates: requests per second, storage per year.",
        "Draw while you talk, and check in with the interviewer about where to go deeper."]],
    ], IQ(2, ["system design interview"], ["x2"],
      "Ten minutes into a system design round, you've listed technologies but haven't discussed requirements or scale. What's the risk?",
      ["You may be designing for the wrong problem and can't justify any choice; go back and agree requirements and scale", "None, technologies are what they're scoring", "You're moving too slowly", "You should switch to coding"],
      0, ["Choices only make sense against requirements; without them every choice looks arbitrary.", "They score reasoning, not a list of names.", "Speed isn't the issue; direction is.", "It's a design round."])),

    I(3, "Behavioural interviews", ["behavioural interview", "star"], ["l2"], [
      ["What it is", "Stories that show how you work", [
        "Behavioural questions ask about real past situations: 'Tell me about a time you disagreed with a teammate.'",
        "They check judgement, ownership and collaboration, which code can't show."]],
      ["Core ideas", "Situation, task, action, result", [
        "Situation: the context, briefly. Task: what you were responsible for.",
        "Action: what you did, in the first person; most of the answer belongs here.",
        "Result: what happened, with a number where you can, and what you learned.",
        "Prepare six to eight stories that can each answer several questions (conflict, failure, leadership, ambiguity)."]],
      ["The trade-offs", "Honest and specific", [
        "'We' hides your part; say 'I' for what you did.",
        "A story where everything went well teaches less than one where you made a mistake and fixed it.",
        "Rehearsed stories help; reciting a script sounds hollow."]],
      ["In practice", "How to prepare", [
        "Write each story in four short lines, then practise telling it in two minutes.",
        "Match stories to the company's stated values.",
        "Have questions of your own ready for the end."]],
    ], IQ(3, ["behavioural interview"], ["l2"],
      "Asked about a project that failed, a candidate spends most of the answer on the context and the team's work, and one sentence on their own part. What should change?",
      ["Spend most of the answer on their own actions and what they learned, with the result", "Pick a project that succeeded instead", "Talk more about the team", "Keep it under 20 seconds"],
      0, ["The interviewer is scoring the candidate's actions and learning.", "The question asked about a failure; dodging it is noticed.", "That's already the problem.", "Too short leaves no evidence."])),

    I(4, "AI-enabled coding", ["ai-assisted coding", "llm tools"], ["s9"], [
      ["What it is", "Working well with AI coding tools", [
        "Many teams now use AI assistants to write, explain and review code, and some interviews let you use them.",
        "What's tested is judgement: directing the tool, checking its work, and owning the result."]],
      ["Core ideas", "Direct, verify, own", [
        "Give the tool context and constraints: the language, the existing code, what must not change.",
        "Read every line it writes; it can produce plausible code that's subtly wrong or insecure.",
        "Run tests, and write the tests yourself for anything that matters.",
        "Know when to stop prompting and write the tricky part by hand."]],
      ["The trade-offs", "Speed against understanding", [
        "AI speeds up boilerplate and unfamiliar APIs; it can slow you down on subtle logic if you keep re-prompting.",
        "Pasting private code or keys into an external tool may break your company's rules.",
        "Code you can't explain is code you can't debug at 3 a.m."]],
      ["In practice", "What you'll see at work and in interviews", [
        "Interviewers watch how you check and adjust the tool's output, not just the final code.",
        "Teams have rules about which tools may see which code.",
        "Review AI-written code as carefully as a colleague's, or more."]],
    ], IQ(4, ["ai-assisted coding"], ["s9"],
      "An AI assistant writes a function that passes your one test. What should you do before relying on it?",
      ["Read it line by line and test edge cases (empty input, large input, errors) you'd expect a reviewer to ask about", "Ship it; the test passed", "Ask the assistant whether it's correct", "Rewrite it in another language"],
      0, ["One passing test proves little; you own the code.", "Untested edge cases are where bugs live.", "Its answer isn't evidence.", "That doesn't check correctness."])),
  ],
});
