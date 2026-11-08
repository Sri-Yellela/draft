#!/usr/bin/env node
// ⭐ D155 Part C · decks-v18 — embedded and systems: Foundations (3) and Building blocks (4), drafted by the agent
// 2026-11-08 for the owner's review. node scripts/decks/decksV18.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const D = (id, stage, title, skills, pieces, slides, q) => deck(id, "embedded", stage, title, skills, pieces, slides, q);
const Q = (id, skills, pieces, stem, choices, correct, why) => question(`${id}-q1`, "Embedded Engineer", "entry", skills, pieces, stem, choices, correct, why);

writeBatch({
  version: 18,
  title: "embedded and systems, Foundations and Building blocks",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C, approved; D154 P4 format). Pathway 'embedded', stages 'foundations' (3) and 'building-blocks' (4), in Part C's order. Nothing is live until approved (status: draft).",
  decks: [
    D("em-f-01", "foundations", "C and memory", ["c", "pointers", "memory"], ["s3x"], [
      ["What it is", "The language closest to the hardware", [
        "Most firmware is written in C (or C++), because it maps directly to memory and registers with predictable cost.",
        "That closeness is also why its bugs are dangerous."]],
      ["Core ideas", "Pointers, layout, lifetimes", [
        "A pointer holds an address; dereferencing it reads or writes that memory, with no checks.",
        "Variables live in static memory (globals), on the stack (locals) or on the heap (malloc); each has a different lifetime.",
        "volatile tells the compiler a value can change outside the program (a hardware register), so it must re-read it every time.",
        "Fixed-width types (uint8_t, int32_t) say exactly how many bits a value has."]],
      ["The trade-offs", "Control without a safety net", [
        "Out-of-bounds writes, use-after-free and uninitialised reads corrupt memory silently.",
        "Undefined behaviour lets the compiler do surprising things; enable warnings and sanitisers.",
        "Many embedded projects ban heap allocation after start-up to avoid fragmentation."]],
      ["In practice", "What you'll see at work", [
        "MISRA C or a similar coding standard in safety work.",
        "Static analysis and compiler warnings treated as errors.",
        "Register access through volatile pointers or vendor headers."]],
    ], Q("em-f-01", ["c", "volatile"], ["s3x"],
      "A loop waits for a hardware status bit: while (!(*STATUS & READY)) {}. With optimisation on, it hangs forever. Why?",
      ["STATUS isn't declared volatile, so the compiler reads it once and loops on the cached value", "The bit is never set by hardware", "The loop is too fast", "C can't read registers"],
      0, ["volatile forces a fresh read each time, as hardware can change it.", "It works without optimisation, so the hardware does set it.", "Speed isn't the issue.", "It can, through pointers."])),

    D("em-f-02", "foundations", "Computer architecture", ["computer architecture", "microcontrollers"], ["s3x", "a3"], [
      ["What it is", "What's inside the chip", [
        "A microcontroller combines a CPU core, flash for code, RAM for data and peripherals (timers, ADCs, serial ports) on one chip.",
        "Knowing the pieces explains timing, memory limits and power."]],
      ["Core ideas", "Core, memory map, buses", [
        "The CPU fetches, decodes and executes instructions; clock speed sets how many per second.",
        "Memory-mapped I/O: peripherals appear as addresses; writing a register configures hardware.",
        "Flash is large and slow to write; RAM is small and fast; caches (on bigger chips) speed access.",
        "Buses connect the core, memory and peripherals; DMA moves data without the CPU."]],
      ["The trade-offs", "Small, cheap, low-power", [
        "Kilobytes of RAM shape every design decision.",
        "Higher clock speeds cost power; many devices run slow and sleep often.",
        "Choosing a chip trades cost, peripherals, power and toolchain support."]],
      ["In practice", "What you'll see at work", [
        "Datasheets and reference manuals read constantly.",
        "Linker maps checked for flash and RAM use.",
        "ARM Cortex-M, RISC-V and vendor families (STM32, ESP32, nRF)."]],
    ], Q("em-f-02", ["dma"], ["s3x"],
      "Reading a fast sensor stream byte by byte in an interrupt uses most of the CPU. What hardware feature usually helps?",
      ["DMA: let the peripheral move data into a buffer directly, interrupting only when the buffer is full", "A faster clock only", "More flash", "Printing each byte"],
      0, ["DMA offloads the copying from the CPU.", "Helps a little, costs power, keeps the waste.", "Flash doesn't affect CPU load.", "That adds load."])),

    D("em-f-03", "foundations", "Operating-system basics", ["operating systems", "scheduling"], ["s3x"], [
      ["What it is", "Bare metal or an OS", [
        "Small devices often run 'bare metal': one main loop plus interrupts. Larger ones run a real-time OS or Linux.",
        "Either way you need the ideas of tasks, scheduling and shared resources."]],
      ["Core ideas", "Tasks, scheduling, shared state", [
        "A super-loop runs each job in turn; simple, but one slow job delays the rest.",
        "An OS splits work into tasks (threads) and a scheduler decides which runs.",
        "Pre-emptive scheduling lets a higher-priority task interrupt a lower one.",
        "Shared data needs protection: mutexes, disabling interrupts briefly, or message queues."]],
      ["The trade-offs", "Simplicity against structure", [
        "Bare metal is small and predictable until the logic grows tangled.",
        "An OS adds memory use and new failure modes (deadlock, priority inversion).",
        "Linux gives drivers, networking and files, but isn't real-time by default."]],
      ["In practice", "What you'll see at work", [
        "FreeRTOS or Zephyr on microcontrollers; embedded Linux on bigger systems.",
        "Task stack sizes measured, not guessed.",
        "State machines to keep main loops readable."]],
    ], Q("em-f-03", ["scheduling"], ["s3x"],
      "In a super-loop, a slow SD-card write delays the button handling so presses are missed. What's a common fix?",
      ["Handle the button in an interrupt or a higher-priority task, and make the SD write non-blocking or chunked", "Press the button longer", "Remove the SD card", "Add a bigger delay in the loop"],
      0, ["Time-critical work must not wait behind slow work.", "Pushes the problem onto users.", "Removes the feature.", "Makes it worse."])),

    D("em-b-01", "building-blocks", "Interrupts and concurrency", ["interrupts", "concurrency", "isr"], ["s3x"], [
      ["What it is", "Responding to the outside world at once", [
        "An interrupt makes the CPU pause normal code and run a handler (ISR) when hardware needs attention.",
        "It's how devices react within microseconds, and a classic source of race conditions."]],
      ["Core ideas", "Short handlers, shared data", [
        "Keep ISRs short: record the event, maybe copy data, set a flag, and leave.",
        "Do the slow work later in the main loop or a task.",
        "Data shared between ISR and main code must be volatile and accessed atomically (or with interrupts briefly disabled).",
        "Interrupt priorities decide which can pre-empt which."]],
      ["The trade-offs", "Responsive but tricky", [
        "Long ISRs delay other interrupts and can miss events.",
        "Disabling interrupts protects data and adds latency; keep it brief.",
        "Ring buffers are a common lock-free way to pass data from ISR to main code."]],
      ["In practice", "What you'll see at work", [
        "No printf, malloc or blocking calls inside ISRs.",
        "Interrupt latency measured with a logic analyser or GPIO toggles.",
        "Bugs that appear only under load, from unprotected shared state."]],
    ], Q("em-b-01", ["interrupts"], ["s3x"],
      "An ISR formats a log message with printf and writes it over UART. Other interrupts start getting missed. Why?",
      ["The ISR is too slow; set a flag or push raw data to a buffer, and format and send it outside the interrupt", "UART is broken", "printf is too fast", "There are too many interrupts in general"],
      0, ["Slow ISRs block other interrupts; defer the work.", "It's working, just slowly.", "It's the opposite.", "The handler length is the cause."])),

    D("em-b-02", "building-blocks", "RTOS and scheduling", ["rtos", "scheduling", "priority inversion"], ["sc1"], [
      ["What it is", "Meeting deadlines on purpose", [
        "A real-time operating system schedules tasks so time-critical work meets its deadline, every time.",
        "Real-time means predictable, not necessarily fast."]],
      ["Core ideas", "Priorities, blocking, inversion", [
        "Each task has a priority; the highest-priority ready task runs.",
        "Tasks block on queues, semaphores or delays, freeing the CPU for others.",
        "Priority inversion: a low-priority task holding a lock blocks a high-priority one while a medium task runs; priority inheritance fixes it.",
        "Worst-case execution time, not average time, decides whether deadlines are met."]],
      ["The trade-offs", "Predictable needs discipline", [
        "Too many tasks waste RAM on stacks and complicate reasoning.",
        "Dynamic allocation in tasks risks fragmentation; allocate up front.",
        "Debugging timing issues needs tracing tools."]],
      ["In practice", "What you'll see at work", [
        "FreeRTOS, Zephyr or a vendor RTOS.",
        "Trace tools (SEGGER SystemView, Tracealyzer) showing task timing.",
        "Stack high-water marks checked for every task."]],
    ], Q("em-b-02", ["priority inversion"], ["sc1"],
      "A high-priority task sometimes misses its deadline while waiting for a mutex held by a low-priority task, as medium-priority tasks keep running. What's this and the usual fix?",
      ["Priority inversion; use a mutex with priority inheritance", "A memory leak; restart the device", "Too few tasks; add more", "Normal; deadlines don't matter"],
      0, ["Inheritance raises the lock holder's priority so it finishes quickly.", "Not a leak.", "More tasks make it worse.", "In real-time systems they do."])),

    D("em-b-03", "building-blocks", "Peripherals and protocols: I2C, SPI, UART", ["i2c", "spi", "uart"], ["em4"], [
      ["What it is", "How chips talk to each other", [
        "Sensors, displays, memory and radios connect to the microcontroller over simple serial buses.",
        "Choosing and debugging these buses is daily embedded work."]],
      ["Core ideas", "Three common buses", [
        "UART: two wires (TX, RX), no clock, both sides agree on a baud rate; good for debug consoles and modules.",
        "I2C: two wires (clock, data) shared by many devices, each with an address; slower, needs pull-up resistors.",
        "SPI: a clock, two data lines and a chip-select per device; fast and simple, more wires.",
        "Each device's datasheet defines the register map and timing."]],
      ["The trade-offs", "Wires against speed", [
        "I2C saves pins but a stuck device can hang the whole bus.",
        "SPI is fast but needs a select line per device.",
        "UART needs both sides on matching settings; a wrong baud rate gives garbage."]],
      ["In practice", "What you'll see at work", [
        "A logic analyser to see what's actually on the wire.",
        "Bus recovery code for stuck I2C devices.",
        "Drivers that check every transaction's result."]],
    ], Q("em-b-03", ["uart"], ["em4"],
      "A UART debug console prints garbled characters. What's the first thing to check?",
      ["That the baud rate and frame settings (data bits, parity, stop bits) match on both sides", "That the CPU is fast enough", "That the code has comments", "That I2C pull-ups are fitted"],
      0, ["Mismatched settings are the classic cause of garbage.", "Not usually the cause.", "Unrelated.", "Pull-ups belong to I2C."])),

    D("em-b-04", "building-blocks", "Power management", ["low power", "sleep modes", "battery"], ["em4"], [
      ["What it is", "Making a battery last", [
        "Many devices run for months or years on a battery, so most of their life is spent asleep.",
        "Power management decides when and how deeply to sleep, and what wakes the device."]],
      ["Core ideas", "Sleep, wake, measure", [
        "Sleep modes trade wake-up time for current: light sleep wakes fast; deep sleep draws microamps but loses more state.",
        "Wake sources: timers, pin changes, radio events.",
        "Turn off peripherals and clocks that aren't in use.",
        "Average current = time-weighted mix of active and sleep currents; measure it, don't guess."]],
      ["The trade-offs", "Responsiveness against battery life", [
        "Waking more often feels responsive and drains the battery.",
        "Radios are often the biggest consumer; send less, less often.",
        "A floating input pin or a leaky circuit can dominate sleep current."]],
      ["In practice", "What you'll see at work", [
        "Current measured with a power profiler over a full cycle.",
        "Battery-life estimates from measured profiles.",
        "Firmware that batches work into short active bursts."]],
    ], Q("em-b-04", ["low power"], ["em4"],
      "A sensor node should last a year but drains in a month. Sleep current measures 900 µA instead of the expected 5 µA. What's likely?",
      ["Something stays powered during sleep: a peripheral, a sensor, a floating pin or a debug interface left on", "The battery is the wrong colour", "The radio sends too rarely", "The CPU is too slow"],
      0, ["Sleep current that high means a part isn't shutting down.", "Not relevant.", "Sending rarely saves power.", "Speed isn't the issue in sleep."])),
  ],
});
