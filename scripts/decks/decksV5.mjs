#!/usr/bin/env node
// ⭐ D155 Part C · decks-v5 — software engineering, Specialisation: frontend (7 decks), drafted by the agent 2026-11-08 for
// the owner's review. node scripts/decks/decksV5.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const D = (n, title, skills, pieces, slides, q) => deck(`sw-fe-0${n}`, "software", "specialisation-frontend", title, skills, pieces, slides, q);
const Q = (n, skills, pieces, stem, choices, correct, why) => question(`sw-fe-0${n}-q1`, "Frontend Engineer", "mid", skills, pieces, stem, choices, correct, why);

writeBatch({
  version: 5,
  title: "software engineering, Specialisation: frontend",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C, approved; D154 P4 format). Pathway 'software', stage 'specialisation-frontend': 7 five-slide decks in Part C's order. Nothing is live until approved (status: draft).",
  decks: [
    D(1, "The DOM and rendering", ["dom", "rendering", "browsers"], ["w4"], [
      ["What it is", "From HTML to pixels", [
        "The browser parses HTML into the DOM (a tree of elements) and CSS into style rules, then works out what to draw.",
        "JavaScript changes the DOM, and the browser redraws what changed."]],
      ["Core ideas", "Style, layout, paint, composite", [
        "Style: work out each element's final CSS. Layout: work out sizes and positions. Paint: fill in pixels. Composite: stack the painted layers.",
        "Changing size or position triggers layout again (a reflow), which can cascade through the page.",
        "Changing only transform or opacity can skip layout and paint, which is why smooth animations use them.",
        "Reading a layout value (offsetHeight) right after writing a style forces the browser to lay out immediately."]],
      ["The trade-offs", "Convenience against cost", [
        "Frameworks (React, Vue, Svelte) work out the DOM changes for you, at the cost of their own work and bundle size.",
        "Server rendering shows content sooner but must then be made interactive (hydration).",
        "Very long lists need virtualisation: render only what's on screen."]],
      ["In practice", "What you'll see at work", [
        "The browser's Performance panel shows long tasks, layout and paint per frame.",
        "Batch DOM reads, then writes, rather than alternating them.",
        "Aim for each frame's work under about 16 ms, so the page stays at 60 frames a second."]],
    ], Q(1, ["rendering", "performance"], ["w4"],
      "An animation that moves a box by changing its `left` property stutters. What usually makes it smooth?",
      ["Animate `transform: translateX()` instead, which can skip layout and paint", "Use a bigger setTimeout interval", "Animate `margin-left` instead", "Add more elements around the box"],
      0, ["Transforms are handled at the compositing step, often on the GPU.", "Fewer updates make it choppier, not smoother.",
        "Margin also changes layout on every frame.", "More elements make layout more expensive."])),

    D(2, "CSS layout", ["css", "flexbox", "grid"], ["w4"], [
      ["What it is", "Where everything goes", [
        "CSS layout decides how boxes are sized and placed: in normal flow, in rows and columns (flexbox), or on a two-dimensional grid.",
        "Good layout adapts to any screen without fixed pixel positions."]],
      ["Core ideas", "The box, flex, grid", [
        "Every element is a box: content, padding, border, margin. box-sizing: border-box makes width include padding and border.",
        "Flexbox lays items out along one axis, with control over growing, shrinking, alignment and wrapping.",
        "Grid defines rows and columns at once; items can span cells, and the fr unit shares leftover space.",
        "Media queries and container queries change the layout when the screen or the containing box is narrower."]],
      ["The trade-offs", "One axis or two", [
        "Flexbox suits toolbars, rows of cards and centring; grid suits whole-page structure and anything aligned in two directions.",
        "Absolute positioning takes an element out of flow, which is precise but breaks easily when content changes.",
        "Fixed widths look exact on one screen and overflow on another; prefer flexible units (%, fr, rem, min/max)."]],
      ["In practice", "What you'll see at work", [
        "Mobile first: the narrow layout is the default, and wider screens add columns.",
        "min-width: 0 on a flex or grid child lets long text shrink instead of overflowing.",
        "Design tokens (spacing, colours) as CSS variables keep layouts consistent."]],
    ], Q(2, ["css", "flexbox"], ["w4"],
      "A flex row holds a long URL that pushes the page wider than the phone's screen. What's the usual fix?",
      ["Set `min-width: 0` on the flex child (and let the text wrap or truncate)", "Give the row a fixed width of 1200px", "Use `position: absolute` on the URL", "Remove the flex layout entirely"],
      0, ["Flex items won't shrink below their content's width by default; min-width: 0 lets them.", "A fixed width makes the overflow worse on small screens.",
        "It takes the URL out of flow and it will overlap other content.", "The layout isn't the problem; the shrinking rule is."])),

    D(3, "Accessibility", ["accessibility", "aria", "wcag"], ["w4"], [
      ["What it is", "Usable by everyone", [
        "Accessibility means people using screen readers, keyboards, magnification or voice can use the product too.",
        "The WCAG guidelines are the common standard, and many laws require them."]],
      ["Core ideas", "Semantics first", [
        "Use the right element: a <button> for actions, <a> for links, <label> tied to every input. They come with keyboard support and meaning built in.",
        "Everything must work with a keyboard alone, with a visible focus outline.",
        "Text needs enough contrast against its background (4.5 : 1 for normal text).",
        "ARIA attributes describe custom widgets to assistive technology, but no ARIA is better than wrong ARIA."]],
      ["The trade-offs", "Custom looks, built-in behaviour", [
        "A <div> styled as a button looks the same but isn't focusable or announced; rebuilding the behaviour is easy to get wrong.",
        "Motion and auto-playing media can make people ill; respect prefers-reduced-motion.",
        "Automated checkers find perhaps a third of problems; the rest need a keyboard and a screen reader."]],
      ["In practice", "What you'll see at work", [
        "Every image has alt text (or alt=\"\" if decorative); every icon button has an accessible name.",
        "Dialogs trap focus while open and return it to the opener when closed.",
        "Test with the keyboard, then with VoiceOver or NVDA, before calling a screen done."]],
    ], Q(3, ["accessibility"], ["w4"],
      "A team builds a menu toggle as a `<div onclick=…>` with an icon. Keyboard and screen-reader users can't use it. What's the best fix?",
      ["Use a `<button>` with an accessible name (aria-label or visible text)", "Add `cursor: pointer` to the div", "Make the icon bigger", "Add a tooltip on hover"],
      0, ["A button is focusable, works with Enter and Space, and is announced as a button with its name.", "That only changes the mouse pointer.",
        "Size doesn't make it focusable or named.", "Hover doesn't exist for keyboard and screen-reader users."])),

    D(4, "State management", ["state management", "react"], ["w4"], [
      ["What it is", "Where the data lives", [
        "State is the data that changes while the app runs: what's typed, what's open, what came from the server.",
        "Most front-end bugs are two copies of the same state disagreeing."]],
      ["Core ideas", "Local, shared, server, URL", [
        "Local state belongs to one component (is this menu open?).",
        "Shared state is needed by distant parts of the screen; lift it to a common parent, or use a context or store.",
        "Server state is a cached copy of data from an API: it can be stale and needs refetching (libraries like TanStack Query handle this).",
        "URL state (filters, the selected tab) survives reloads and can be shared as a link."]],
      ["The trade-offs", "One source of truth", [
        "A global store makes data easy to reach and easy to tangle; keep things local until they need sharing.",
        "Derive values instead of storing them: compute a filtered list from the list and the filter, don't keep both.",
        "Optimistic updates feel instant but must roll back cleanly when the server refuses."]],
      ["In practice", "What you'll see at work", [
        "Forms keep their own draft state and send it on submit.",
        "Server data is fetched by key and invalidated after a mutation.",
        "Redux, Zustand, signals or plain context: the choice matters less than having one place for each piece of data."]],
    ], Q(4, ["state management"], ["w4"],
      "A page keeps `items` and also `visibleItems` (items filtered by a search box) in state. After deleting an item it still shows in the list. What's the cleaner design?",
      ["Store only `items` and the search text, and compute the visible list from them on each render", "Delete from both lists every time", "Reload the page after each delete", "Keep a third list for deleted items"],
      0, ["One source of truth: the visible list can't disagree with what it's derived from.", "It works until someone forgets one of the two.",
        "That hides the bug and loses everything else on the page.", "More copies mean more ways to disagree."])),

    D(5, "Front-end performance", ["web performance", "core web vitals", "bundles"], ["w4"], [
      ["What it is", "Fast to show, fast to respond, steady", [
        "Front-end performance is how quickly the page appears, becomes usable, and responds to input, especially on mid-range phones.",
        "Core Web Vitals measure it: LCP (the main content appears), INP (responses to input), CLS (nothing jumps around)."]],
      ["Core ideas", "Less to download, less to run, nothing shifting", [
        "Ship less JavaScript: split bundles by route, load rarely used code on demand, drop heavy libraries.",
        "Images: the right size and format (WebP, AVIF), lazy-loaded below the fold, with width and height set.",
        "Layout shift happens when space isn't reserved for images, ads or late content; reserve it.",
        "Long tasks over 50 ms block input; break them up or move them to a worker."]],
      ["The trade-offs", "Features against weight", [
        "Every dependency adds bytes for every visitor; weigh it against what it saves you.",
        "Caching and CDNs make repeat visits fast; the first visit is what new users judge.",
        "Lab tests on a fast laptop mislead; field data from real users shows the truth."]],
      ["In practice", "What you'll see at work", [
        "A bundle analyser in CI, with a size budget that fails the build when exceeded.",
        "Lighthouse in the lab; real-user monitoring in production.",
        "Fonts load with font-display: swap, and critical CSS comes first."]],
    ], Q(5, ["web performance"], ["w4"],
      "As a page loads, text jumps down when a banner image appears above it (a poor CLS score). What fixes it?",
      ["Set the image's width and height (or aspect-ratio) so its space is reserved before it loads", "Load the image later", "Compress the image more", "Hide the text until everything has loaded"],
      0, ["With space reserved, nothing moves when the image arrives.", "Later loading makes the jump happen later, not go away.",
        "Smaller files load faster but still push the text when they arrive.", "That makes the page slower to read."])),

    D(6, "Web security: XSS and CSP", ["web security", "xss", "csp"], ["k2"], [
      ["What it is", "Keeping other people's code out of your page", [
        "Cross-site scripting (XSS) is when attacker-controlled text ends up running as script in your page, with your users' sessions.",
        "It's one of the most common web vulnerabilities."]],
      ["Core ideas", "Escape output, restrict scripts", [
        "Treat all user input as text: escape it when inserting into HTML. Frameworks do this by default; innerHTML and dangerouslySetInnerHTML skip it.",
        "If you must render user HTML, sanitise it with a vetted library (such as DOMPurify).",
        "A Content Security Policy (CSP) header tells the browser which scripts may run; a strict policy blocks injected inline script.",
        "Cookies marked HttpOnly can't be read by script, limiting what a successful XSS can steal."]],
      ["The trade-offs", "Strict policies need tidy code", [
        "A strict CSP breaks inline scripts and event handlers; moving them to files, or using nonces, takes work.",
        "Allowing many third-party domains in the CSP weakens it.",
        "Sanitisers must be kept up to date; homemade ones get bypassed."]],
      ["In practice", "What you'll see at work", [
        "Code review flags every innerHTML-style call.",
        "CSP rolled out in report-only mode first, to see what would break.",
        "Other headers alongside it: X-Content-Type-Options, frame-ancestors (clickjacking), Referrer-Policy."]],
    ], Q(6, ["xss", "web security"], ["k2"],
      "A comments feature renders each comment with `element.innerHTML = comment.text`. What's the risk and the fix?",
      ["Stored XSS: a comment containing script runs for every reader; insert it as text (textContent) or sanitise it", "None, comments are short", "Slow rendering; use a faster loop", "Spam; add a captcha"],
      0, ["innerHTML parses the comment as HTML, so markup and script in it become live.", "An attack fits in one line.",
        "Speed isn't the problem here.", "A captcha doesn't stop a human attacker posting script."])),

    D(7, "Testing interfaces", ["testing", "ui testing", "e2e"], ["l2"], [
      ["What it is", "Proving the screen works", [
        "Interface tests check what a person sees and does: text appears, buttons work, forms submit.",
        "The aim is confidence without slow, flaky tests."]],
      ["Core ideas", "Unit, component, end to end", [
        "Unit tests check pure logic (formatting, validation) quickly.",
        "Component tests render a component and interact with it as a user would (Testing Library: find by role and text, not by class names).",
        "End-to-end tests drive a real browser through whole journeys (Playwright, Cypress).",
        "Visual regression tests compare screenshots to catch unintended changes in look."]],
      ["The trade-offs", "Confidence against speed and flakiness", [
        "End-to-end tests catch the most but are slowest and flakiest; keep them for the critical paths.",
        "Testing implementation details (internal state, CSS classes) breaks on every refactor; test behaviour.",
        "Flaky tests usually wait on time instead of on a condition; wait for the element or the network call."]],
      ["In practice", "What you'll see at work", [
        "A few end-to-end journeys (sign up, checkout), many component tests, and unit tests for logic.",
        "Mock the network at its boundary (MSW), not inside components.",
        "Run accessibility checks (axe) inside component tests."]],
    ], Q(7, ["ui testing"], ["l2"],
      "An end-to-end test clicks 'Save', waits 2 seconds, then checks for 'Saved'. It fails now and then in CI. What's the better approach?",
      ["Wait for the 'Saved' text (or the save request) to appear, with a timeout, instead of a fixed sleep", "Wait 10 seconds instead", "Retry the whole test three times and ignore failures", "Delete the test"],
      0, ["Waiting on the condition passes as soon as it's true and only fails when it really doesn't happen.", "Slower, and still fails on a slow run.",
        "Retries hide real failures as well as flaky ones.", "You lose the coverage."])),
  ],
});
