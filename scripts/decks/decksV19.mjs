#!/usr/bin/env node
// ⭐ D155 Part C · decks-v19 — embedded and systems: Patterns (3), Specialisation (3), Interview (3), drafted by the agent
// 2026-11-08 for the owner's review. node scripts/decks/decksV19.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const D = (id, stage, title, skills, pieces, slides, q) => deck(id, "embedded", stage, title, skills, pieces, slides, q);
const Q = (id, level, skills, pieces, stem, choices, correct, why) => question(`${id}-q1`, "Embedded Engineer", level, skills, pieces, stem, choices, correct, why);

writeBatch({
  version: 19,
  title: "embedded and systems, Patterns, Specialisation and Interview",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C, approved; D154 P4 format). Pathway 'embedded', stages 'patterns' (3), 'specialisation' (3) and 'interview' (3), in Part C's order. Nothing is live until approved (status: draft).",
  decks: [
    D("em-p-01", "patterns", "Memory pools and fragmentation", ["memory management", "fragmentation"], ["s3x"], [
      ["What it is", "Allocating memory that never runs out unexpectedly", [
        "On a device with kilobytes of RAM that runs for years, general-purpose malloc and free can fragment memory until an allocation fails.",
        "Memory pools avoid that with fixed-size blocks."]],
      ["Core ideas", "Fixed blocks, known limits", [
        "Fragmentation: free memory exists but in pieces too small for the request.",
        "A pool pre-allocates N blocks of one size; allocation and free are fast and can't fragment.",
        "Static allocation at start-up (no heap afterwards) makes worst-case memory use known at build time.",
        "Track pool high-water marks to size pools correctly."]],
      ["The trade-offs", "Predictable against flexible", [
        "Pools waste space when objects are smaller than the block.",
        "Several pools of different sizes cover varied needs.",
        "A pool that runs out still needs a defined behaviour (reject, drop the oldest)."]],
      ["In practice", "What you'll see at work", [
        "RTOS memory pools or a project's own block allocator.",
        "Rules that forbid malloc after initialisation.",
        "Long-running soak tests watching free memory."]],
    ], Q("em-p-01", "mid", ["fragmentation"], ["s3x"],
      "A device crashes after about three weeks of uptime with an allocation failure, though total free heap is still large. What's happening?",
      ["Fragmentation: free memory is split into small pieces; use fixed-size pools or allocate everything at start-up", "A hardware fault", "The clock overflowed", "The battery is low"],
      0, ["Plenty free in total but no single piece big enough is the signature of fragmentation.", "It's a software pattern.", "Possible in other bugs, but not this symptom.", "Unrelated."])),

    D("em-p-02", "patterns", "Watchdogs and field diagnostics", ["watchdog", "diagnostics", "reliability"], ["sc1"], [
      ["What it is", "Recovering, and knowing why", [
        "A watchdog timer resets the device if the software stops checking in, so a hang doesn't last forever.",
        "Field diagnostics record what happened, so failures in customers' hands can be understood."]],
      ["Core ideas", "Kick correctly, record failures", [
        "Kick the watchdog only when the whole system is healthy (every critical task has reported), not from a timer interrupt that runs regardless.",
        "Record the reset reason (watchdog, brown-out, crash) in memory that survives the reset.",
        "Crash dumps: save the program counter, stack and a small log before resetting.",
        "Upload diagnostics when the device next connects."]],
      ["The trade-offs", "Resetting hides bugs", [
        "A watchdog that silently resets makes devices look fine while bugs persist; count and report resets.",
        "Diagnostics use flash and bandwidth; keep them compact.",
        "Too short a timeout resets during legitimate slow operations."]],
      ["In practice", "What you'll see at work", [
        "Reset counters per cause in device telemetry.",
        "Crash reports grouped by firmware version.",
        "The watchdog tested deliberately before shipping."]],
    ], Q("em-p-02", "mid", ["watchdog"], ["sc1"],
      "The watchdog is kicked from a 1 ms timer interrupt. A task deadlocks, but the device never resets. Why?",
      ["The timer interrupt keeps kicking it regardless of the tasks' health; kick only after every critical task has checked in", "The watchdog is too slow", "Deadlocks can't happen in firmware", "The timer is too accurate"],
      0, ["A watchdog must prove the system is alive, not just that one interrupt runs.", "The timeout isn't the issue.", "They can.", "Unrelated."])),

    D("em-p-03", "patterns", "Safe firmware updates", ["ota", "bootloader", "firmware updates"], ["sc1"], [
      ["What it is", "Updating without bricking", [
        "Over-the-air (OTA) updates fix bugs and add features on devices already in the field.",
        "A failed update must never leave the device unusable."]],
      ["Core ideas", "Two slots, verify, roll back", [
        "A/B slots: write the new image to the inactive slot while the old one keeps running.",
        "Verify the image's signature and integrity before switching.",
        "Boot the new image on trial; if it doesn't confirm it's healthy, the bootloader rolls back.",
        "Power can fail at any moment; every step must survive it."]],
      ["The trade-offs", "Flash space for safety", [
        "Two slots need twice the flash; compressed or delta updates reduce size and add complexity.",
        "Unsigned updates let anyone install firmware; signing needs key management.",
        "Staged rollouts catch bad releases before every device takes them."]],
      ["In practice", "What you'll see at work", [
        "MCUboot or a vendor bootloader with signature checks.",
        "Rollouts to a small fleet first, watching reset and crash rates.",
        "Anti-rollback counters to stop downgrades to vulnerable versions."]],
    ], Q("em-p-03", "mid", ["ota"], ["sc1"],
      "During an OTA update, power is lost halfway through writing. Which design keeps the device working?",
      ["A/B slots: the update writes to the inactive slot, so the old firmware still boots", "Write over the running firmware quickly", "Ask users not to unplug devices", "Update only at night"],
      0, ["The running image is never touched until the new one is complete and verified.", "Half-written firmware won't boot.", "Users can't guarantee power.", "Power still fails at night."])),

    D("em-s-01", "specialisation", "Linux internals and drivers", ["embedded linux", "device drivers", "kernel"], ["s3x"], [
      ["What it is", "Linux on devices", [
        "Larger embedded systems (routers, cameras, cars) run Linux, with drivers that connect the kernel to the hardware.",
        "It brings networking, file systems and tools, and its own complexity."]],
      ["Core ideas", "Kernel space, device tree, drivers", [
        "The kernel runs with full privileges; user programs talk to it through system calls and device files.",
        "The device tree describes the board's hardware so one kernel can run on many boards.",
        "A driver registers for a device, handles its interrupts and exposes it to user space.",
        "Build systems (Yocto, Buildroot) assemble the kernel, bootloader and root file system."]],
      ["The trade-offs", "Capability against footprint", [
        "Linux needs megabytes of RAM and storage and seconds to boot.",
        "It isn't hard real-time by default; real-time patches or a separate microcontroller handle tight timing.",
        "Kernel bugs crash everything; prefer user-space drivers where they're fast enough."]],
      ["In practice", "What you'll see at work", [
        "dmesg for kernel messages; /sys and /proc to inspect hardware and processes.",
        "Upstream drivers preferred over vendor forks.",
        "Security updates for the kernel planned for the device's lifetime."]],
    ], Q("em-s-01", "mid", ["embedded linux"], ["s3x"],
      "A new sensor on an embedded Linux board isn't detected, though its driver is built into the kernel. What should you check first?",
      ["The device tree: is the sensor described with the right bus, address and compatible string?", "Reinstall Linux", "Replace the CPU", "Increase the swap file"],
      0, ["Drivers bind to devices the device tree declares.", "Drastic and unlikely to help.", "Not the cause.", "Unrelated."])),

    D("em-s-02", "specialisation", "Performance profiling", ["profiling", "optimisation"], ["s3x"], [
      ["What it is", "Measuring where the time goes", [
        "Embedded performance is about meeting deadlines and saving power with limited CPU.",
        "Profiling finds the real hot spots; guessing usually finds the wrong ones."]],
      ["Core ideas", "Measure first", [
        "Toggle a GPIO at the start and end of a function and watch it on a scope: exact timing, nearly free.",
        "Cycle counters (like the DWT counter on Cortex-M) time code precisely.",
        "Sampling profilers and trace tools show where the CPU spends its time.",
        "Optimise the measured hot spot: better algorithms, DMA, fixed-point maths, avoiding copies."]],
      ["The trade-offs", "Fast against readable", [
        "Hand-optimised code is harder to maintain; optimise only what measurements justify.",
        "Compiler optimisation levels change timing and can hide or reveal bugs.",
        "Measuring adds overhead; keep instrumentation light."]],
      ["In practice", "What you'll see at work", [
        "Timing budgets per task, checked in tests.",
        "Logic analysers and oscilloscopes on the bench.",
        "Profiles compared before and after each optimisation."]],
    ], Q("em-s-02", "mid", ["profiling"], ["s3x"],
      "A control loop misses its 1 ms deadline. Someone wants to rewrite the maths in assembly. What first?",
      ["Measure where the time goes (GPIO toggles or cycle counters), then optimise the actual hot spot", "Rewrite it all in assembly", "Add a faster crystal", "Remove error checking"],
      0, ["Without measurement, effort goes to the wrong place.", "Expensive and maybe not where the time goes.", "May help but costs power and redesign.", "Risky and unmeasured."])),

    D("em-s-03", "specialisation", "Hardware debugging", ["debugging", "jtag", "oscilloscope"], ["em4"], [
      ["What it is", "When the bug might be in the hardware", [
        "Embedded bugs live in software, hardware, or the gap between them.",
        "Hardware debugging tools let you see both."]],
      ["Core ideas", "Probe, observe, isolate", [
        "A debug probe (JTAG/SWD) lets you halt the CPU, step code, read memory and set breakpoints.",
        "An oscilloscope shows voltages over time: noise, slow edges, brown-outs.",
        "A logic analyser decodes buses (I2C, SPI, UART) to show what was actually sent.",
        "Isolate: known-good board, minimal firmware, one change at a time."]],
      ["The trade-offs", "Tools and patience", [
        "Breakpoints change timing; some bugs disappear when observed (use trace instead).",
        "Probes and scopes cost money and bench time; they pay for themselves quickly.",
        "Blaming hardware too early wastes time; so does blaming software."]],
      ["In practice", "What you'll see at work", [
        "Test points on boards for probing.",
        "A bring-up checklist for new boards: power rails, clocks, debug link, then peripherals.",
        "Notes of every measurement during an investigation."]],
    ], Q("em-s-03", "mid", ["debugging"], ["em4"],
      "An I2C sensor returns wrong values occasionally. The code looks correct. What's a good next step?",
      ["Capture the bus with a logic analyser (and check signal edges with a scope) to see what's really transmitted", "Rewrite the driver from scratch", "Add retries until it works", "Replace the microcontroller"],
      0, ["Seeing the real traffic separates software bugs from signal problems.", "Without evidence, a rewrite may keep the bug.", "Hides the cause.", "Unlikely to be the problem."])),

    D("em-iv-01", "interview", "Low-level coding rounds", ["c interview", "bit manipulation"], ["s3x"], [
      ["What it is", "C on a whiteboard", [
        "Embedded interviews often ask for C: bit manipulation, pointer handling, a ring buffer, a simple driver.",
        "They're checking for correctness with memory, types and edge cases."]],
      ["Core ideas", "Common asks", [
        "Set, clear, toggle and test bits with masks and shifts.",
        "Implement a ring buffer safely, including full and empty conditions.",
        "Explain volatile, const, static and integer promotion.",
        "Reason about endianness, alignment and structure padding."]],
      ["The trade-offs", "Clear and safe", [
        "Clever one-liners with undefined behaviour cost more than plain code.",
        "Say the assumptions: integer sizes, interrupt context, concurrency.",
        "Test by hand on edge cases: zero, full, wrap-around."]],
      ["In practice", "How to prepare", [
        "Write a ring buffer, a bit-field register driver and a fixed-point function from scratch.",
        "Practise explaining memory layout of a struct.",
        "Review undefined behaviour cases in C."]],
    ], Q("em-iv-01", "entry", ["bit manipulation"], ["s3x"],
      "Which expression clears bit 3 of `reg` and leaves the others unchanged?",
      ["reg &= ~(1u << 3);", "reg |= (1u << 3);", "reg ^= 3;", "reg = 0;"],
      0, ["AND with the inverted mask clears exactly that bit.", "That sets the bit.", "That toggles bits 0 and 1.", "That clears everything."])),

    D("em-iv-02", "interview", "Debugging scenarios", ["debugging interview"], ["em4"], [
      ["What it is", "'The device resets randomly. What do you do?'", [
        "Interviewers describe a field failure and ask how you'd find the cause.",
        "They're scoring method across software and hardware."]],
      ["Core ideas", "Narrow it down", [
        "Gather facts: how often, which units, since which firmware, under what conditions.",
        "Read the reset reason and any crash dump.",
        "Form hypotheses (stack overflow, watchdog, brown-out, memory corruption) and test the cheapest first.",
        "Reproduce on the bench, then fix and verify."]],
      ["The trade-offs", "Evidence over hunches", [
        "Guessing a favourite cause wastes time.",
        "Fixes without reproduction are hopes.",
        "Say when you'd involve hardware engineers."]],
      ["In practice", "How to prepare", [
        "Have a real debugging story with your steps.",
        "Know the usual causes of random resets and how to tell them apart.",
        "Talk through tools: debugger, scope, logs."]],
    ], Q("em-iv-02", "entry", ["debugging interview"], ["em4"],
      "Units in the field reset when a motor starts. What's a strong first hypothesis to check?",
      ["A brown-out: the motor's current draw dips the supply voltage; check the reset reason and the rail on a scope", "A bug in the display code", "A firmware version mismatch", "The users"],
      0, ["The timing points at power; the reset cause and a scope confirm it.", "No link to the motor.", "Possible, but timing points to power.", "Not useful."])),

    D("em-iv-03", "interview", "Designing a device's firmware", ["firmware design interview"], ["sc1"], [
      ["What it is", "Design the software for a product", [
        "You're asked to design firmware for a device: a smart thermostat, a fitness band, an industrial sensor.",
        "They're scoring architecture, constraints and reliability thinking."]],
      ["Core ideas", "Cover the essentials", [
        "Requirements and constraints: power budget, memory, connectivity, safety.",
        "Architecture: tasks or a state machine, drivers, communication, storage.",
        "Reliability: watchdog, error handling, safe updates, diagnostics.",
        "Testing: unit tests on host, hardware-in-the-loop, field telemetry."]],
      ["The trade-offs", "Say the costs", [
        "An RTOS versus bare metal: justify it.",
        "Battery life against responsiveness and features.",
        "Security of updates and communication from the start."]],
      ["In practice", "How to prepare", [
        "Practise two designs end to end on paper.",
        "Draw the task diagram and the update flow.",
        "Mention how you'd test without the hardware."]],
    ], Q("em-iv-03", "entry", ["firmware design interview"], ["sc1"],
      "Designing firmware for a battery-powered sensor that reports every 10 minutes, what drives most decisions?",
      ["The power budget: sleep most of the time, wake on a timer, measure and send in one short burst", "Maximum CPU speed", "A rich user interface", "Logging everything locally"],
      0, ["Battery life dominates; duty cycling decides the architecture.", "Wastes power.", "Not for this device.", "Costs power and flash."])),
  ],
});
