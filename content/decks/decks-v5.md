# Decks v5 — software engineering, Specialisation: frontend (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 7 five-slide decks; each ends with one new question (drafts for the bank). **Nothing is live until you approve** — say "approve decks-v5" (or name the decks to change).

## sw-fe-01 · The DOM and rendering
*Skills:* dom, rendering, browsers · *Check yourself:* sw-fe-01-q1

**1. What it is — From HTML to pixels**
- The browser parses HTML into the DOM (a tree of elements) and CSS into style rules, then works out what to draw.
- JavaScript changes the DOM, and the browser redraws what changed.

**2. Core ideas — Style, layout, paint, composite**
- Style: work out each element's final CSS. Layout: work out sizes and positions. Paint: fill in pixels. Composite: stack the painted layers.
- Changing size or position triggers layout again (a reflow), which can cascade through the page.
- Changing only transform or opacity can skip layout and paint, which is why smooth animations use them.
- Reading a layout value (offsetHeight) right after writing a style forces the browser to lay out immediately.

**3. The trade-offs — Convenience against cost**
- Frameworks (React, Vue, Svelte) work out the DOM changes for you, at the cost of their own work and bundle size.
- Server rendering shows content sooner but must then be made interactive (hydration).
- Very long lists need virtualisation: render only what's on screen.

**4. In practice — What you'll see at work**
- The browser's Performance panel shows long tasks, layout and paint per frame.
- Batch DOM reads, then writes, rather than alternating them.
- Aim for each frame's work under about 16 ms, so the page stays at 60 frames a second.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-fe-01-q1).** An animation that moves a box by changing its `left` property stutters. What usually makes it smooth?
- ✅ Animate `transform: translateX()` instead, which can skip layout and paint — *Transforms are handled at the compositing step, often on the GPU.*
- Use a bigger setTimeout interval — *Fewer updates make it choppier, not smoother.*
- Animate `margin-left` instead — *Margin also changes layout on every frame.*
- Add more elements around the box — *More elements make layout more expensive.*

## sw-fe-02 · CSS layout
*Skills:* css, flexbox, grid · *Check yourself:* sw-fe-02-q1

**1. What it is — Where everything goes**
- CSS layout decides how boxes are sized and placed: in normal flow, in rows and columns (flexbox), or on a two-dimensional grid.
- Good layout adapts to any screen without fixed pixel positions.

**2. Core ideas — The box, flex, grid**
- Every element is a box: content, padding, border, margin. box-sizing: border-box makes width include padding and border.
- Flexbox lays items out along one axis, with control over growing, shrinking, alignment and wrapping.
- Grid defines rows and columns at once; items can span cells, and the fr unit shares leftover space.
- Media queries and container queries change the layout when the screen or the containing box is narrower.

**3. The trade-offs — One axis or two**
- Flexbox suits toolbars, rows of cards and centring; grid suits whole-page structure and anything aligned in two directions.
- Absolute positioning takes an element out of flow, which is precise but breaks easily when content changes.
- Fixed widths look exact on one screen and overflow on another; prefer flexible units (%, fr, rem, min/max).

**4. In practice — What you'll see at work**
- Mobile first: the narrow layout is the default, and wider screens add columns.
- min-width: 0 on a flex or grid child lets long text shrink instead of overflowing.
- Design tokens (spacing, colours) as CSS variables keep layouts consistent.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-fe-02-q1).** A flex row holds a long URL that pushes the page wider than the phone's screen. What's the usual fix?
- ✅ Set `min-width: 0` on the flex child (and let the text wrap or truncate) — *Flex items won't shrink below their content's width by default; min-width: 0 lets them.*
- Give the row a fixed width of 1200px — *A fixed width makes the overflow worse on small screens.*
- Use `position: absolute` on the URL — *It takes the URL out of flow and it will overlap other content.*
- Remove the flex layout entirely — *The layout isn't the problem; the shrinking rule is.*

## sw-fe-03 · Accessibility
*Skills:* accessibility, aria, wcag · *Check yourself:* sw-fe-03-q1

**1. What it is — Usable by everyone**
- Accessibility means people using screen readers, keyboards, magnification or voice can use the product too.
- The WCAG guidelines are the common standard, and many laws require them.

**2. Core ideas — Semantics first**
- Use the right element: a <button> for actions, <a> for links, <label> tied to every input. They come with keyboard support and meaning built in.
- Everything must work with a keyboard alone, with a visible focus outline.
- Text needs enough contrast against its background (4.5 : 1 for normal text).
- ARIA attributes describe custom widgets to assistive technology, but no ARIA is better than wrong ARIA.

**3. The trade-offs — Custom looks, built-in behaviour**
- A <div> styled as a button looks the same but isn't focusable or announced; rebuilding the behaviour is easy to get wrong.
- Motion and auto-playing media can make people ill; respect prefers-reduced-motion.
- Automated checkers find perhaps a third of problems; the rest need a keyboard and a screen reader.

**4. In practice — What you'll see at work**
- Every image has alt text (or alt="" if decorative); every icon button has an accessible name.
- Dialogs trap focus while open and return it to the opener when closed.
- Test with the keyboard, then with VoiceOver or NVDA, before calling a screen done.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-fe-03-q1).** A team builds a menu toggle as a `<div onclick=…>` with an icon. Keyboard and screen-reader users can't use it. What's the best fix?
- ✅ Use a `<button>` with an accessible name (aria-label or visible text) — *A button is focusable, works with Enter and Space, and is announced as a button with its name.*
- Add `cursor: pointer` to the div — *That only changes the mouse pointer.*
- Make the icon bigger — *Size doesn't make it focusable or named.*
- Add a tooltip on hover — *Hover doesn't exist for keyboard and screen-reader users.*

## sw-fe-04 · State management
*Skills:* state management, react · *Check yourself:* sw-fe-04-q1

**1. What it is — Where the data lives**
- State is the data that changes while the app runs: what's typed, what's open, what came from the server.
- Most front-end bugs are two copies of the same state disagreeing.

**2. Core ideas — Local, shared, server, URL**
- Local state belongs to one component (is this menu open?).
- Shared state is needed by distant parts of the screen; lift it to a common parent, or use a context or store.
- Server state is a cached copy of data from an API: it can be stale and needs refetching (libraries like TanStack Query handle this).
- URL state (filters, the selected tab) survives reloads and can be shared as a link.

**3. The trade-offs — One source of truth**
- A global store makes data easy to reach and easy to tangle; keep things local until they need sharing.
- Derive values instead of storing them: compute a filtered list from the list and the filter, don't keep both.
- Optimistic updates feel instant but must roll back cleanly when the server refuses.

**4. In practice — What you'll see at work**
- Forms keep their own draft state and send it on submit.
- Server data is fetched by key and invalidated after a mutation.
- Redux, Zustand, signals or plain context: the choice matters less than having one place for each piece of data.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-fe-04-q1).** A page keeps `items` and also `visibleItems` (items filtered by a search box) in state. After deleting an item it still shows in the list. What's the cleaner design?
- ✅ Store only `items` and the search text, and compute the visible list from them on each render — *One source of truth: the visible list can't disagree with what it's derived from.*
- Delete from both lists every time — *It works until someone forgets one of the two.*
- Reload the page after each delete — *That hides the bug and loses everything else on the page.*
- Keep a third list for deleted items — *More copies mean more ways to disagree.*

## sw-fe-05 · Front-end performance
*Skills:* web performance, core web vitals, bundles · *Check yourself:* sw-fe-05-q1

**1. What it is — Fast to show, fast to respond, steady**
- Front-end performance is how quickly the page appears, becomes usable, and responds to input, especially on mid-range phones.
- Core Web Vitals measure it: LCP (the main content appears), INP (responses to input), CLS (nothing jumps around).

**2. Core ideas — Less to download, less to run, nothing shifting**
- Ship less JavaScript: split bundles by route, load rarely used code on demand, drop heavy libraries.
- Images: the right size and format (WebP, AVIF), lazy-loaded below the fold, with width and height set.
- Layout shift happens when space isn't reserved for images, ads or late content; reserve it.
- Long tasks over 50 ms block input; break them up or move them to a worker.

**3. The trade-offs — Features against weight**
- Every dependency adds bytes for every visitor; weigh it against what it saves you.
- Caching and CDNs make repeat visits fast; the first visit is what new users judge.
- Lab tests on a fast laptop mislead; field data from real users shows the truth.

**4. In practice — What you'll see at work**
- A bundle analyser in CI, with a size budget that fails the build when exceeded.
- Lighthouse in the lab; real-user monitoring in production.
- Fonts load with font-display: swap, and critical CSS comes first.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-fe-05-q1).** As a page loads, text jumps down when a banner image appears above it (a poor CLS score). What fixes it?
- ✅ Set the image's width and height (or aspect-ratio) so its space is reserved before it loads — *With space reserved, nothing moves when the image arrives.*
- Load the image later — *Later loading makes the jump happen later, not go away.*
- Compress the image more — *Smaller files load faster but still push the text when they arrive.*
- Hide the text until everything has loaded — *That makes the page slower to read.*

## sw-fe-06 · Web security: XSS and CSP
*Skills:* web security, xss, csp · *Check yourself:* sw-fe-06-q1

**1. What it is — Keeping other people's code out of your page**
- Cross-site scripting (XSS) is when attacker-controlled text ends up running as script in your page, with your users' sessions.
- It's one of the most common web vulnerabilities.

**2. Core ideas — Escape output, restrict scripts**
- Treat all user input as text: escape it when inserting into HTML. Frameworks do this by default; innerHTML and dangerouslySetInnerHTML skip it.
- If you must render user HTML, sanitise it with a vetted library (such as DOMPurify).
- A Content Security Policy (CSP) header tells the browser which scripts may run; a strict policy blocks injected inline script.
- Cookies marked HttpOnly can't be read by script, limiting what a successful XSS can steal.

**3. The trade-offs — Strict policies need tidy code**
- A strict CSP breaks inline scripts and event handlers; moving them to files, or using nonces, takes work.
- Allowing many third-party domains in the CSP weakens it.
- Sanitisers must be kept up to date; homemade ones get bypassed.

**4. In practice — What you'll see at work**
- Code review flags every innerHTML-style call.
- CSP rolled out in report-only mode first, to see what would break.
- Other headers alongside it: X-Content-Type-Options, frame-ancestors (clickjacking), Referrer-Policy.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-fe-06-q1).** A comments feature renders each comment with `element.innerHTML = comment.text`. What's the risk and the fix?
- ✅ Stored XSS: a comment containing script runs for every reader; insert it as text (textContent) or sanitise it — *innerHTML parses the comment as HTML, so markup and script in it become live.*
- None, comments are short — *An attack fits in one line.*
- Slow rendering; use a faster loop — *Speed isn't the problem here.*
- Spam; add a captcha — *A captcha doesn't stop a human attacker posting script.*

## sw-fe-07 · Testing interfaces
*Skills:* testing, ui testing, e2e · *Check yourself:* sw-fe-07-q1

**1. What it is — Proving the screen works**
- Interface tests check what a person sees and does: text appears, buttons work, forms submit.
- The aim is confidence without slow, flaky tests.

**2. Core ideas — Unit, component, end to end**
- Unit tests check pure logic (formatting, validation) quickly.
- Component tests render a component and interact with it as a user would (Testing Library: find by role and text, not by class names).
- End-to-end tests drive a real browser through whole journeys (Playwright, Cypress).
- Visual regression tests compare screenshots to catch unintended changes in look.

**3. The trade-offs — Confidence against speed and flakiness**
- End-to-end tests catch the most but are slowest and flakiest; keep them for the critical paths.
- Testing implementation details (internal state, CSS classes) breaks on every refactor; test behaviour.
- Flaky tests usually wait on time instead of on a condition; wait for the element or the network call.

**4. In practice — What you'll see at work**
- A few end-to-end journeys (sign up, checkout), many component tests, and unit tests for logic.
- Mock the network at its boundary (MSW), not inside components.
- Run accessibility checks (axe) inside component tests.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-fe-07-q1).** An end-to-end test clicks 'Save', waits 2 seconds, then checks for 'Saved'. It fails now and then in CI. What's the better approach?
- ✅ Wait for the 'Saved' text (or the save request) to appear, with a timeout, instead of a fixed sleep — *Waiting on the condition passes as soon as it's true and only fails when it really doesn't happen.*
- Wait 10 seconds instead — *Slower, and still fails on a slow run.*
- Retry the whole test three times and ignore failures — *Retries hide real failures as well as flaky ones.*
- Delete the test — *You lose the coverage.*
