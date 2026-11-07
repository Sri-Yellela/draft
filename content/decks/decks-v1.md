# Decks v1 — software engineering, Foundations (for your review)

Drafted by the chat assistant. Eight five-slide decks in the approved pathway order. Each ends with questions already in the bank (by id), plus one new question where none fitted. Diagrams can be added per slide later.

## sw-f-01 · How a program runs
*Skills:* memory, processes, threads · *Check yourself:* sw-f-01-q1

**1. What it is — A program in motion**
- A program is instructions plus data. When you run it, the operating system creates a process for it: its own memory, its open files, and at least one thread carrying out the instructions.
- The rest of this deck is about how those three pieces behave.

**2. Core ideas — Stack, heap, process, thread**
- The stack holds each function call's local variables. It's fast and freed automatically when the call returns, but it's small.
- The heap holds data that outlives a single call, like objects you create and keep. It's freed by you, or by a garbage collector.
- A process has its own memory, so one crashing process can't corrupt another.
- A thread is one path of execution inside a process. Threads in the same process share its memory.

**3. The trade-offs — Sharing is cheap, and risky**
- Threads share memory, so they pass data instantly, but two threads changing the same data at once can corrupt it. That's a race condition.
- Processes are isolated, so they're safer, but talking between them (pipes, sockets, queues) costs more.
- Garbage collection prevents many memory bugs but adds pauses; managing memory yourself gives control but risks leaks and crashes.

**4. In practice — What you'll see at work**
- Web servers either run several processes (often one per CPU core), each with a pool of threads, or one process with an event loop that never waits on slow input and output.
- A stack overflow means calls nested too deeply. An out-of-memory error usually means the heap kept growing, often from a cache or list that never shrinks.

**5. Check yourself — One question**
- Answer it, then read the why.

## sw-f-02 · Data structures
*Skills:* data-structures · *Check yourself:* prac-m-02, aud-swe-03

**1. What it is — Choosing how to hold your data**
- A data structure arranges data so the operations you need most are fast. The same data can be held many ways; the right one depends on what you do with it.

**2. Core ideas — The ones you'll use most**
- Arrays keep items side by side: instant access by position, slow to insert in the middle.
- Linked lists point from item to item: cheap inserts, slow to reach the n-th item.
- Hash maps find a value by its key in constant time on average.
- Stacks are last in, first out; queues are first in, first out.
- Trees keep data ordered; heaps keep the top item ready to take.

**3. The trade-offs — Fast here, slower there**
- Every structure makes some operations fast by making others slower, or by using more memory.
- Hash maps are fast for lookups but don't keep order; balanced trees keep order at O(log n) per operation.
- Arrays are compact and friendly to the CPU's cache; pointer-based structures scatter data across memory.

**4. In practice — Pick by the operations**
- List what you'll do most (look up by id, keep things sorted, take the smallest, check membership) and choose the structure that makes those cheap.
- Most everyday code uses arrays and hash maps. The others solve specific problems: a heap for scheduling, a trie for prefix search.

**5. Check yourself — Two questions**
- Match the structures to their jobs, then a quick scenario.

## sw-f-03 · Algorithms and complexity
*Skills:* algorithms, complexity · *Check yourself:* aud-swe-03

**1. What it is — How work grows with input**
- An algorithm is a step-by-step method. Its complexity describes how the time or memory it needs grows as the input grows, written in Big-O notation.

**2. Core ideas — The common growth rates**
- O(1) is constant, like a hash-map lookup.
- O(log n) halves the problem each step, like binary search.
- O(n) looks at each item once.
- O(n log n) is what efficient sorting costs.
- O(n²) compares every pair: fine for hundreds of items, hopeless for millions.

**3. The trade-offs — Memory for time**
- You can often trade memory for time: a hash set of the items you've seen turns an O(n²) pair check into O(n), at the cost of storing the set.
- Big-O ignores constant factors, so on small inputs a 'slower' algorithm can be faster in practice.

**4. In practice — Estimate before you build**
- A million items compared pairwise is around a trillion steps: minutes to hours. A million hash lookups take milliseconds.
- Many interview problems come down to spotting the pattern that cuts the complexity: two pointers, a sliding window, hashing, binary search, or a graph search.

**5. Check yourself — One question**
- A classic case of trading memory for time.

## sw-f-04 · Git
*Skills:* git, version-control · *Check yourself:* aud-swe-02, prac-o-05

**1. What it is — History you can trust**
- Git records a project as a series of snapshots called commits. Branches let you work on changes in parallel without disturbing the main line.

**2. Core ideas — Commits, branches, merges, remotes**
- A commit is a snapshot, a message, and a pointer to the commit before it.
- A branch is just a movable name that points at a commit.
- Merging joins two lines of work; rebasing replays your commits on top of another branch.
- A remote, such as GitHub, is a shared copy: you push your commits and pull everyone else's.

**3. The trade-offs — Merge or rebase**
- Merging keeps the true history but can be noisy. Rebasing gives a clean line but rewrites commits, so never rebase work other people have already pulled.
- Small, frequent commits are easy to review and to undo; large ones hide mistakes.

**4. In practice — The everyday loop**
- Branch from main, commit your change with its tests, open a pull request, address the review, and merge when CI passes.
- To undo safely on a shared branch, use git revert, which adds a commit that undoes an old one. Keep reset, which rewrites history, for your own local work.

**5. Check yourself — Two questions**
- A commit in the wrong place, then the review loop in order.

## sw-f-05 · Testing
*Skills:* testing · *Check yourself:* aud-swe-05, aud-qa-01

**1. What it is — Proof that it still works**
- Tests are code that checks your code. They catch mistakes early and let you change things without fear.

**2. Core ideas — The kinds of tests**
- Unit tests check one small piece on its own, quickly.
- Integration tests check that pieces work together, such as your code and a real database.
- End-to-end tests drive the whole system the way a user would.
- The testing pyramid: many unit tests, fewer integration tests, a handful of end-to-end tests.

**3. The trade-offs — Realistic or fast**
- End-to-end tests catch the most realistic problems but are slow and brittle; unit tests are fast but can miss how the pieces fit together.
- Mocks make tests fast and focused, but they can drift away from how the real dependency behaves.

**4. In practice — Habits that pay off**
- Write the failing test first, then make it pass.
- Test behaviour, not implementation details, so refactoring doesn't break the tests.
- Keep tests independent (each sets up its own data) and deterministic (control time and randomness), or they'll turn flaky.

**5. Check yourself — Two questions**
- A flaky test, then a suite that's too slow.

## sw-f-06 · Debugging
*Skills:* debugging · *Check yourself:* aud-swe-01, aud-swe-06

**1. What it is — From symptom to cause**
- Debugging is a method for getting from a symptom to its cause, then proving the fix.

**2. Core ideas — Four steps**
- Reproduce it reliably, ideally as a failing test.
- Isolate it: shrink the input or the code until the bug still appears.
- Test one hypothesis at a time.
- Verify the fix, and keep the test so the bug can't come back.

**3. The trade-offs — Quick or thorough**
- Print statements are quick but scattered; a debugger shows everything but takes setting up.
- Guessing a fix under pressure feels fast and often makes things worse.

**4. In practice — Where to look first**
- Read the error message and the stack trace first; they usually point to the line.
- git bisect finds the commit that introduced a bug by binary-searching through history.
- In production, logs carrying request ids, plus metrics, tell you where to look before you touch any code.

**5. Check yourself — Two questions**
- A bug you can reproduce, then a release that went wrong.

## sw-f-07 · The web: DNS, TCP, TLS and HTTP
*Skills:* networking, http · *Check yourself:* prac-o-01, prac-m-01

**1. What it is — What happens when you open a page**
- Opening a page chains four protocols: DNS finds the server, TCP connects to it, TLS encrypts the connection, and HTTP carries the request and the response.

**2. Core ideas — One job each**
- DNS turns a name like example.com into an IP address, with caching at every step.
- TCP gives a reliable, ordered stream of bytes between two machines.
- TLS proves the server's identity with a certificate, then encrypts everything after.
- HTTP is the request (method, path, headers, body) and the response (status code, headers, body).

**3. The trade-offs — Round trips cost time**
- Every new connection costs round trips for TCP and TLS, so reusing connections and HTTP/2's multiplexing make pages faster.
- Caching in the browser, a CDN or the server saves round trips, but risks serving stale content.

**4. In practice — Reading the signs**
- Status codes tell the story: 2xx success, 3xx redirect, 4xx the client's mistake, 5xx the server's.
- When a site is slow, the browser's developer tools show where the time goes: looking up the name, connecting, waiting for the server, or downloading.

**5. Check yourself — Two questions**
- The steps in order, then the status codes.

## sw-f-08 · SQL basics
*Skills:* sql, databases · *Check yourself:* prac-m-03, aud-ae-02, aud-sec-01

**1. What it is — Asking a database questions**
- SQL is the language for storing and querying data in tables. You describe what you want; the database works out how to get it.

**2. Core ideas — The pieces**
- Tables have rows and columns, and a primary key identifies each row.
- SELECT … FROM … WHERE filters rows; ORDER BY sorts them.
- JOIN combines tables on a matching key; GROUP BY with COUNT or SUM summarises them.
- An index is a lookup structure that makes filtering and joining fast.

**3. The trade-offs — Joins or copies, reads or writes**
- Normalised tables avoid duplicated data but need joins; denormalised ones read faster but must be kept in sync.
- Indexes speed up reads, slow down writes, and take space.

**4. In practice — Habits that save you**
- Know each table's grain (what one row means) before you join, or rows multiply.
- Use parameterised queries, never string concatenation, to stay safe from SQL injection.
- When a query is slow, read its plan with EXPLAIN before adding hardware.

**5. Check yourself — Three questions**
- Joins, a total that came out too high, and an injection.

## New question (enters the bank as a draft)

Two threads each add 1 to a shared counter 1,000 times. The final value is sometimes below 2,000. Why?

- A. The CPU is too slow to keep up with two threads  
  *Why:* Speed doesn't lose updates; the order of the steps does.
- B. Threads always run one after the other, so it should be exactly 2,000  
  *Why:* Threads can interleave at any point unless you coordinate them.
- **✓** C. Each increment is a read, an add and a write; when both threads read the same value before either writes, one update is lost  
  *Why:* That's a race condition. A lock or an atomic increment makes the three steps happen as one.
- D. Integers overflow at 2,000  
  *Why:* Integers can hold far larger numbers; this isn't overflow.