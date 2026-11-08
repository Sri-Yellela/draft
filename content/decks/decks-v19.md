# Decks v19 — embedded and systems, Patterns, Specialisation and Interview (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 9 five-slide decks, each with one new question. **APPROVED by the owner 2026-11-08** — served in the Library; the questions are live in the bank.

## em-p-01 · Memory pools and fragmentation
*Skills:* memory management, fragmentation · *Check yourself:* em-p-01-q1

**1. What it is — Allocating memory that never runs out unexpectedly**
- On a device with kilobytes of RAM that runs for years, general-purpose malloc and free can fragment memory until an allocation fails.
- Memory pools avoid that with fixed-size blocks.

**2. Core ideas — Fixed blocks, known limits**
- Fragmentation: free memory exists but in pieces too small for the request.
- A pool pre-allocates N blocks of one size; allocation and free are fast and can't fragment.
- Static allocation at start-up (no heap afterwards) makes worst-case memory use known at build time.
- Track pool high-water marks to size pools correctly.

**3. The trade-offs — Predictable against flexible**
- Pools waste space when objects are smaller than the block.
- Several pools of different sizes cover varied needs.
- A pool that runs out still needs a defined behaviour (reject, drop the oldest).

**4. In practice — What you'll see at work**
- RTOS memory pools or a project's own block allocator.
- Rules that forbid malloc after initialisation.
- Long-running soak tests watching free memory.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (em-p-01-q1).** A device crashes after about three weeks of uptime with an allocation failure, though total free heap is still large. What's happening?
- ✅ Fragmentation: free memory is split into small pieces; use fixed-size pools or allocate everything at start-up — *Plenty free in total but no single piece big enough is the signature of fragmentation.*
- A hardware fault — *It's a software pattern.*
- The clock overflowed — *Possible in other bugs, but not this symptom.*
- The battery is low — *Unrelated.*

## em-p-02 · Watchdogs and field diagnostics
*Skills:* watchdog, diagnostics, reliability · *Check yourself:* em-p-02-q1

**1. What it is — Recovering, and knowing why**
- A watchdog timer resets the device if the software stops checking in, so a hang doesn't last forever.
- Field diagnostics record what happened, so failures in customers' hands can be understood.

**2. Core ideas — Kick correctly, record failures**
- Kick the watchdog only when the whole system is healthy (every critical task has reported), not from a timer interrupt that runs regardless.
- Record the reset reason (watchdog, brown-out, crash) in memory that survives the reset.
- Crash dumps: save the program counter, stack and a small log before resetting.
- Upload diagnostics when the device next connects.

**3. The trade-offs — Resetting hides bugs**
- A watchdog that silently resets makes devices look fine while bugs persist; count and report resets.
- Diagnostics use flash and bandwidth; keep them compact.
- Too short a timeout resets during legitimate slow operations.

**4. In practice — What you'll see at work**
- Reset counters per cause in device telemetry.
- Crash reports grouped by firmware version.
- The watchdog tested deliberately before shipping.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (em-p-02-q1).** The watchdog is kicked from a 1 ms timer interrupt. A task deadlocks, but the device never resets. Why?
- ✅ The timer interrupt keeps kicking it regardless of the tasks' health; kick only after every critical task has checked in — *A watchdog must prove the system is alive, not just that one interrupt runs.*
- The watchdog is too slow — *The timeout isn't the issue.*
- Deadlocks can't happen in firmware — *They can.*
- The timer is too accurate — *Unrelated.*

## em-p-03 · Safe firmware updates
*Skills:* ota, bootloader, firmware updates · *Check yourself:* em-p-03-q1

**1. What it is — Updating without bricking**
- Over-the-air (OTA) updates fix bugs and add features on devices already in the field.
- A failed update must never leave the device unusable.

**2. Core ideas — Two slots, verify, roll back**
- A/B slots: write the new image to the inactive slot while the old one keeps running.
- Verify the image's signature and integrity before switching.
- Boot the new image on trial; if it doesn't confirm it's healthy, the bootloader rolls back.
- Power can fail at any moment; every step must survive it.

**3. The trade-offs — Flash space for safety**
- Two slots need twice the flash; compressed or delta updates reduce size and add complexity.
- Unsigned updates let anyone install firmware; signing needs key management.
- Staged rollouts catch bad releases before every device takes them.

**4. In practice — What you'll see at work**
- MCUboot or a vendor bootloader with signature checks.
- Rollouts to a small fleet first, watching reset and crash rates.
- Anti-rollback counters to stop downgrades to vulnerable versions.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (em-p-03-q1).** During an OTA update, power is lost halfway through writing. Which design keeps the device working?
- ✅ A/B slots: the update writes to the inactive slot, so the old firmware still boots — *The running image is never touched until the new one is complete and verified.*
- Write over the running firmware quickly — *Half-written firmware won't boot.*
- Ask users not to unplug devices — *Users can't guarantee power.*
- Update only at night — *Power still fails at night.*

## em-s-01 · Linux internals and drivers
*Skills:* embedded linux, device drivers, kernel · *Check yourself:* em-s-01-q1

**1. What it is — Linux on devices**
- Larger embedded systems (routers, cameras, cars) run Linux, with drivers that connect the kernel to the hardware.
- It brings networking, file systems and tools, and its own complexity.

**2. Core ideas — Kernel space, device tree, drivers**
- The kernel runs with full privileges; user programs talk to it through system calls and device files.
- The device tree describes the board's hardware so one kernel can run on many boards.
- A driver registers for a device, handles its interrupts and exposes it to user space.
- Build systems (Yocto, Buildroot) assemble the kernel, bootloader and root file system.

**3. The trade-offs — Capability against footprint**
- Linux needs megabytes of RAM and storage and seconds to boot.
- It isn't hard real-time by default; real-time patches or a separate microcontroller handle tight timing.
- Kernel bugs crash everything; prefer user-space drivers where they're fast enough.

**4. In practice — What you'll see at work**
- dmesg for kernel messages; /sys and /proc to inspect hardware and processes.
- Upstream drivers preferred over vendor forks.
- Security updates for the kernel planned for the device's lifetime.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (em-s-01-q1).** A new sensor on an embedded Linux board isn't detected, though its driver is built into the kernel. What should you check first?
- ✅ The device tree: is the sensor described with the right bus, address and compatible string? — *Drivers bind to devices the device tree declares.*
- Reinstall Linux — *Drastic and unlikely to help.*
- Replace the CPU — *Not the cause.*
- Increase the swap file — *Unrelated.*

## em-s-02 · Performance profiling
*Skills:* profiling, optimisation · *Check yourself:* em-s-02-q1

**1. What it is — Measuring where the time goes**
- Embedded performance is about meeting deadlines and saving power with limited CPU.
- Profiling finds the real hot spots; guessing usually finds the wrong ones.

**2. Core ideas — Measure first**
- Toggle a GPIO at the start and end of a function and watch it on a scope: exact timing, nearly free.
- Cycle counters (like the DWT counter on Cortex-M) time code precisely.
- Sampling profilers and trace tools show where the CPU spends its time.
- Optimise the measured hot spot: better algorithms, DMA, fixed-point maths, avoiding copies.

**3. The trade-offs — Fast against readable**
- Hand-optimised code is harder to maintain; optimise only what measurements justify.
- Compiler optimisation levels change timing and can hide or reveal bugs.
- Measuring adds overhead; keep instrumentation light.

**4. In practice — What you'll see at work**
- Timing budgets per task, checked in tests.
- Logic analysers and oscilloscopes on the bench.
- Profiles compared before and after each optimisation.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (em-s-02-q1).** A control loop misses its 1 ms deadline. Someone wants to rewrite the maths in assembly. What first?
- ✅ Measure where the time goes (GPIO toggles or cycle counters), then optimise the actual hot spot — *Without measurement, effort goes to the wrong place.*
- Rewrite it all in assembly — *Expensive and maybe not where the time goes.*
- Add a faster crystal — *May help but costs power and redesign.*
- Remove error checking — *Risky and unmeasured.*

## em-s-03 · Hardware debugging
*Skills:* debugging, jtag, oscilloscope · *Check yourself:* em-s-03-q1

**1. What it is — When the bug might be in the hardware**
- Embedded bugs live in software, hardware, or the gap between them.
- Hardware debugging tools let you see both.

**2. Core ideas — Probe, observe, isolate**
- A debug probe (JTAG/SWD) lets you halt the CPU, step code, read memory and set breakpoints.
- An oscilloscope shows voltages over time: noise, slow edges, brown-outs.
- A logic analyser decodes buses (I2C, SPI, UART) to show what was actually sent.
- Isolate: known-good board, minimal firmware, one change at a time.

**3. The trade-offs — Tools and patience**
- Breakpoints change timing; some bugs disappear when observed (use trace instead).
- Probes and scopes cost money and bench time; they pay for themselves quickly.
- Blaming hardware too early wastes time; so does blaming software.

**4. In practice — What you'll see at work**
- Test points on boards for probing.
- A bring-up checklist for new boards: power rails, clocks, debug link, then peripherals.
- Notes of every measurement during an investigation.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (em-s-03-q1).** An I2C sensor returns wrong values occasionally. The code looks correct. What's a good next step?
- ✅ Capture the bus with a logic analyser (and check signal edges with a scope) to see what's really transmitted — *Seeing the real traffic separates software bugs from signal problems.*
- Rewrite the driver from scratch — *Without evidence, a rewrite may keep the bug.*
- Add retries until it works — *Hides the cause.*
- Replace the microcontroller — *Unlikely to be the problem.*

## em-iv-01 · Low-level coding rounds
*Skills:* c interview, bit manipulation · *Check yourself:* em-iv-01-q1

**1. What it is — C on a whiteboard**
- Embedded interviews often ask for C: bit manipulation, pointer handling, a ring buffer, a simple driver.
- They're checking for correctness with memory, types and edge cases.

**2. Core ideas — Common asks**
- Set, clear, toggle and test bits with masks and shifts.
- Implement a ring buffer safely, including full and empty conditions.
- Explain volatile, const, static and integer promotion.
- Reason about endianness, alignment and structure padding.

**3. The trade-offs — Clear and safe**
- Clever one-liners with undefined behaviour cost more than plain code.
- Say the assumptions: integer sizes, interrupt context, concurrency.
- Test by hand on edge cases: zero, full, wrap-around.

**4. In practice — How to prepare**
- Write a ring buffer, a bit-field register driver and a fixed-point function from scratch.
- Practise explaining memory layout of a struct.
- Review undefined behaviour cases in C.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (em-iv-01-q1).** Which expression clears bit 3 of `reg` and leaves the others unchanged?
- ✅ reg &= ~(1u << 3); — *AND with the inverted mask clears exactly that bit.*
- reg |= (1u << 3); — *That sets the bit.*
- reg ^= 3; — *That toggles bits 0 and 1.*
- reg = 0; — *That clears everything.*

## em-iv-02 · Debugging scenarios
*Skills:* debugging interview · *Check yourself:* em-iv-02-q1

**1. What it is — 'The device resets randomly. What do you do?'**
- Interviewers describe a field failure and ask how you'd find the cause.
- They're scoring method across software and hardware.

**2. Core ideas — Narrow it down**
- Gather facts: how often, which units, since which firmware, under what conditions.
- Read the reset reason and any crash dump.
- Form hypotheses (stack overflow, watchdog, brown-out, memory corruption) and test the cheapest first.
- Reproduce on the bench, then fix and verify.

**3. The trade-offs — Evidence over hunches**
- Guessing a favourite cause wastes time.
- Fixes without reproduction are hopes.
- Say when you'd involve hardware engineers.

**4. In practice — How to prepare**
- Have a real debugging story with your steps.
- Know the usual causes of random resets and how to tell them apart.
- Talk through tools: debugger, scope, logs.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (em-iv-02-q1).** Units in the field reset when a motor starts. What's a strong first hypothesis to check?
- ✅ A brown-out: the motor's current draw dips the supply voltage; check the reset reason and the rail on a scope — *The timing points at power; the reset cause and a scope confirm it.*
- A bug in the display code — *No link to the motor.*
- A firmware version mismatch — *Possible, but timing points to power.*
- The users — *Not useful.*

## em-iv-03 · Designing a device's firmware
*Skills:* firmware design interview · *Check yourself:* em-iv-03-q1

**1. What it is — Design the software for a product**
- You're asked to design firmware for a device: a smart thermostat, a fitness band, an industrial sensor.
- They're scoring architecture, constraints and reliability thinking.

**2. Core ideas — Cover the essentials**
- Requirements and constraints: power budget, memory, connectivity, safety.
- Architecture: tasks or a state machine, drivers, communication, storage.
- Reliability: watchdog, error handling, safe updates, diagnostics.
- Testing: unit tests on host, hardware-in-the-loop, field telemetry.

**3. The trade-offs — Say the costs**
- An RTOS versus bare metal: justify it.
- Battery life against responsiveness and features.
- Security of updates and communication from the start.

**4. In practice — How to prepare**
- Practise two designs end to end on paper.
- Draw the task diagram and the update flow.
- Mention how you'd test without the hardware.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (em-iv-03-q1).** Designing firmware for a battery-powered sensor that reports every 10 minutes, what drives most decisions?
- ✅ The power budget: sleep most of the time, wake on a timer, measure and send in one short burst — *Battery life dominates; duty cycling decides the architecture.*
- Maximum CPU speed — *Wastes power.*
- A rich user interface — *Not for this device.*
- Logging everything locally — *Costs power and flash.*
