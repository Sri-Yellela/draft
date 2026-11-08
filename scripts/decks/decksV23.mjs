#!/usr/bin/env node
// ⭐ D155 Part C · decks-v23 — beyond computing (D127, "once those fields are live"): Mechanical (5) and Electrical (5),
// drafted by the agent 2026-11-08 for the owner's review. node scripts/decks/decksV23.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const M = (n, title, skills, slides, q) => deck(`bx-me-0${n}`, "beyond", "mechanical", title, skills, ["em4"], slides, q);
const E = (n, title, skills, slides, q) => deck(`bx-ee-0${n}`, "beyond", "electrical", title, skills, ["em4", "rf2"], slides, q);
const Q = (id, role, skills, stem, choices, correct, why) => question(`${id}-q1`, role, "entry", skills, ["em4"], stem, choices, correct, why);

writeBatch({
  version: 23,
  title: "beyond computing, Mechanical and Electrical",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C C.9 — the fields beyond computing, to go live once those fields are on the board, D127; D154 P4 format). Stages 'mechanical' (5) and 'electrical' (5). Nothing is live until approved (status: draft).",
  decks: [
    M(1, "Statics and materials", ["statics", "materials", "stress"], [
      ["What it is", "Will it hold?", [
        "Statics works out the forces on a part at rest; materials science says how the material responds.",
        "Together they answer whether a bracket, beam or bolt will bend, break or wear out."]],
      ["Core ideas", "Forces, stress, strength", [
        "Free-body diagrams: draw every force and moment; at rest they sum to zero.",
        "Stress is force per area; strain is how much the material stretches.",
        "Each material has a yield strength (where it starts to bend permanently) and an ultimate strength (where it breaks).",
        "A safety factor divides the strength by the expected stress, leaving margin for the unknown."]],
      ["The trade-offs", "Strong, light, cheap", [
        "Stronger materials usually cost more or weigh more; aluminium versus steel is a classic trade.",
        "Repeated loads cause fatigue failure far below the static strength.",
        "Stress concentrates at sharp corners and holes; fillets spread it."]],
      ["In practice", "What you'll see at work", [
        "Hand calculations to sanity-check simulations.",
        "Material datasheets and standards (ASTM, ISO).",
        "Design reviews that ask about the worst-case load."]],
    ], Q("bx-me-01", "Mechanical Engineer", ["statics"],
      "A bracket cracks after months of vibration, though its static stress is well below the yield strength. What's the likely cause?",
      ["Fatigue from repeated loading, worsened by a sharp corner concentrating stress", "The material was too strong", "Static overload", "Temperature had no effect, so it's random"],
      0, ["Cyclic loads cause cracks below static strength, starting at stress raisers.", "Not a failure cause.", "Stress was below yield.", "It isn't random."])),

    M(2, "CAD and GD&T", ["cad", "gd&t", "drawings"], [
      ["What it is", "Describing parts exactly", [
        "CAD (SolidWorks, Fusion, Creo, CATIA) models parts and assemblies in 3D.",
        "GD&T (geometric dimensioning and tolerancing) says on the drawing how much each feature may vary and still work."]],
      ["Core ideas", "Datums and tolerances", [
        "Parametric models capture design intent, so changing one dimension updates the rest sensibly.",
        "Datums are the reference features everything is measured from.",
        "GD&T controls form (flatness), orientation (perpendicularity), location (position) and runout.",
        "Tolerances should reflect function: tight only where it matters."]],
      ["The trade-offs", "Tight tolerances cost money", [
        "Every tighter tolerance raises machining and inspection cost.",
        "Loose tolerances may let assemblies not fit.",
        "Tolerance stack-up: small variations add up across an assembly."]],
      ["In practice", "What you'll see at work", [
        "Drawings reviewed with manufacturing before release.",
        "Tolerance stack-up analysis for critical fits.",
        "Revision control on every drawing."]],
    ], Q("bx-me-02", "Mechanical Engineer", ["gd&t"],
      "A drawing puts ±0.01 mm on every dimension, including a decorative edge. What's the problem?",
      ["Needless cost: tight tolerances should apply only where function requires them", "The tolerances are too loose", "GD&T doesn't allow tolerances", "Nothing"],
      0, ["Tight tolerances everywhere make the part expensive to make and inspect.", "They're very tight.", "It's all about tolerances.", "It wastes money."])),

    M(3, "Simulation (FEA)", ["fea", "simulation"], [
      ["What it is", "Testing designs on the computer", [
        "Finite element analysis (FEA) splits a part into small elements and solves for stress, deflection, heat or vibration.",
        "It finds problems before building prototypes."]],
      ["Core ideas", "Mesh, loads, constraints", [
        "The mesh: smaller elements where stresses change quickly, larger elsewhere.",
        "Loads and boundary conditions must match reality; wrong supports give wrong answers.",
        "Check convergence: refine the mesh until results stop changing.",
        "Validate against hand calculations or test data."]],
      ["The trade-offs", "Pretty pictures can lie", [
        "Colourful stress plots look convincing even when inputs are wrong.",
        "Singularities (sharp corners, point loads) show unrealistically high stress.",
        "Detailed models take long to solve; simplify where it doesn't matter."]],
      ["In practice", "What you'll see at work", [
        "ANSYS, Abaqus or built-in CAD simulation.",
        "Simulation reports listing assumptions.",
        "Physical tests to confirm critical results."]],
    ], Q("bx-me-03", "Mechanical Engineer", ["fea"],
      "An FEA shows extreme stress exactly at a sharp internal corner, and it keeps rising as the mesh is refined. What's going on?",
      ["A stress singularity from the idealised sharp corner; model the real fillet radius or judge it with care", "The part will certainly fail", "The mesh is too coarse, so refine more", "The software is broken"],
      0, ["A perfectly sharp corner gives infinite theoretical stress; real parts have a radius.", "Not necessarily; the number isn't physical.", "Refining makes it grow without converging.", "It's behaving as the maths says."])),

    M(4, "Manufacturing processes", ["manufacturing", "machining", "moulding"], [
      ["What it is", "How parts actually get made", [
        "The process chosen (machining, moulding, casting, sheet metal, 3D printing) shapes the design, the cost and the lead time.",
        "Designers who know processes design parts that are easy to make."]],
      ["Core ideas", "Match process to volume and shape", [
        "CNC machining: precise, flexible, costly per part; good for prototypes and low volume.",
        "Injection moulding: expensive tooling, very cheap per part; good for high volume plastics.",
        "Sheet metal: bending and cutting flat stock; cheap for enclosures and brackets.",
        "Additive (3D printing): complex shapes, quick changes, slower and pricier per part at volume."]],
      ["The trade-offs", "Tooling against per-part cost", [
        "A mould costs tens of thousands up front and pays back only at volume.",
        "Changing a moulded design after tooling is slow and costly.",
        "Surface finish and tolerances vary by process."]],
      ["In practice", "What you'll see at work", [
        "Quotes compared across processes at different volumes.",
        "Prototypes machined or printed before tooling.",
        "Supplier capability checked before design freeze."]],
    ], Q("bx-me-04", "Mechanical Engineer", ["manufacturing"],
      "You need 50 prototype housings next week, and 100,000 per year later. Which plan fits?",
      ["3D-print or machine the prototypes now; design for injection moulding for volume", "Injection-mould the 50 prototypes", "Machine all 100,000", "Hand-carve them"],
      0, ["Fast, tool-free methods for prototypes; tooling pays off at volume.", "Tooling takes weeks and costs too much for 50.", "Far too costly per part.", "Not repeatable."])),

    M(5, "Design for manufacture", ["dfm", "design for assembly"], [
      ["What it is", "Designing parts that are easy and cheap to make", [
        "Design for manufacture (DFM) and assembly (DFA) shape a design so it's simpler to make, assemble and inspect.",
        "Most of a product's cost is decided in design."]],
      ["Core ideas", "Fewer parts, simpler features", [
        "Reduce part count: combine parts, use snap fits instead of screws where sensible.",
        "Follow process rules: draft angles and uniform walls for moulding, standard bend radii for sheet metal.",
        "Standard fasteners and materials lower cost and risk.",
        "Parts that can only assemble one way prevent mistakes (poka-yoke)."]],
      ["The trade-offs", "Elegant against makeable", [
        "A clever shape that needs a five-axis machine costs far more.",
        "Fewer parts can mean harder servicing; balance repairability.",
        "Early supplier input finds problems cheaply."]],
      ["In practice", "What you'll see at work", [
        "DFM reviews with suppliers before release.",
        "Part-count and assembly-time estimates in design reviews.",
        "Checklists per manufacturing process."]],
    ], Q("bx-me-05", "Mechanical Engineer", ["dfm"],
      "An injection-moulded part has vertical walls with no draft and thick and thin sections side by side. What will the moulder say?",
      ["Add draft angles so it releases from the mould, and make wall thickness uniform to avoid sink marks and warping", "It's fine", "Make it thicker everywhere", "Switch to wood"],
      0, ["Draft and uniform walls are basic moulding rules.", "It will stick and warp.", "Wastes material and worsens cooling.", "Not relevant."])),

    E(1, "Circuits", ["circuits", "ohm's law"], [
      ["What it is", "How electricity flows through components", [
        "Circuit analysis predicts voltages and currents through resistors, capacitors, inductors and semiconductors.",
        "Everything in electronics builds on it."]],
      ["Core ideas", "Ohm, Kirchhoff, components", [
        "Ohm's law: V = I × R.",
        "Kirchhoff: currents into a node sum to zero; voltages round a loop sum to zero.",
        "Capacitors store charge and pass changing signals; inductors resist changes in current.",
        "Diodes let current flow one way; transistors switch or amplify."]],
      ["The trade-offs", "Ideal against real", [
        "Real components have tolerances, temperature drift and parasitics.",
        "Power dissipated as heat (P = V × I) limits component choices.",
        "Simulation (SPICE) helps, but bench measurement decides."]],
      ["In practice", "What you'll see at work", [
        "Multimeters and oscilloscopes on the bench.",
        "Datasheets checked for ratings and derating.",
        "Simulation before building."]],
    ], Q("bx-ee-01", "Electrical Engineer", ["ohm's law"],
      "A 1 kΩ resistor has 5 V across it. How much current flows, and how much power does it dissipate?",
      ["5 mA and 25 mW", "5 A and 25 W", "0.2 mA and 1 mW", "1 A and 5 W"],
      0, ["I = V/R = 5/1000 = 5 mA; P = V × I = 25 mW.", "Off by a factor of 1,000.", "Wrong calculation.", "Wrong calculation."])),

    E(2, "PCB design", ["pcb design", "layout"], [
      ["What it is", "Turning a circuit into a board", [
        "PCB design takes a schematic and places components and routes copper traces on a board that can be manufactured.",
        "Layout affects noise, heat and reliability as much as the schematic."]],
      ["Core ideas", "Placement, routing, grounding", [
        "Place components by function and signal flow; keep sensitive analogue parts away from noisy switching parts.",
        "Solid ground planes give low-impedance return paths.",
        "Trace widths sized for current; high-speed signals need controlled impedance and short returns.",
        "Decoupling capacitors placed right next to each chip's power pins."]],
      ["The trade-offs", "Layers, size, cost", [
        "More layers make routing easier and cost more.",
        "Smaller boards cost less and are harder to route and cool.",
        "Design rules from the fabricator must be followed."]],
      ["In practice", "What you'll see at work", [
        "KiCad, Altium or Cadence tools.",
        "Design rule checks before ordering.",
        "Test points and debug headers on early boards."]],
    ], Q("bx-ee-02", "Electrical Engineer", ["pcb design"],
      "A microcontroller resets randomly. Its decoupling capacitors are placed 5 cm away from the power pins. What's a likely fix?",
      ["Place decoupling capacitors right next to the power pins with short paths to ground", "Use a bigger microcontroller", "Lengthen the traces", "Remove the capacitors"],
      0, ["Long paths add inductance, so the capacitors can't supply fast current spikes.", "Doesn't address power noise.", "Makes it worse.", "Makes it worse."])),

    E(3, "Signals", ["signals", "sampling", "filters"], [
      ["What it is", "Information as voltage over time", [
        "Signals carry information: audio, sensor readings, radio, data.",
        "Signal processing filters, samples and transforms them."]],
      ["Core ideas", "Frequency, sampling, filtering", [
        "Any signal can be seen as a mix of frequencies (Fourier).",
        "Sampling must be at least twice the highest frequency present (Nyquist) to avoid aliasing.",
        "Filters keep wanted frequencies and remove others: low-pass, high-pass, band-pass.",
        "Noise and interference are reduced by filtering, shielding and good layout."]],
      ["The trade-offs", "Sharp filters cost something", [
        "Steeper filters need more components or computation and add delay.",
        "Higher sample rates mean more data and power.",
        "Analogue filtering before sampling prevents aliasing that software can't undo."]],
      ["In practice", "What you'll see at work", [
        "Anti-aliasing filters before ADCs.",
        "Spectrum analysis to find noise sources.",
        "Digital filters in firmware or DSP."]],
    ], Q("bx-ee-03", "Electrical Engineer", ["sampling"],
      "A signal contains content up to 10 kHz and is sampled at 12 kHz. What happens?",
      ["Aliasing: frequencies above 6 kHz fold back as false lower frequencies; filter first or sample above 20 kHz", "Nothing; 12 kHz is above 10 kHz", "The signal gets louder", "The ADC breaks"],
      0, ["Sampling must exceed twice the highest frequency, or use an anti-aliasing filter.", "Nyquist needs more than twice.", "Not the effect.", "It doesn't."])),

    E(4, "Power electronics", ["power electronics", "converters"], [
      ["What it is", "Converting and controlling power efficiently", [
        "Power electronics converts electricity from one form to another: AC to DC, one DC voltage to another, DC to AC for motors.",
        "Efficiency and heat are the central concerns."]],
      ["Core ideas", "Linear against switching", [
        "Linear regulators are simple and quiet but waste the voltage difference as heat.",
        "Switching converters (buck, boost) switch rapidly and use inductors and capacitors, reaching 85–95 % efficiency.",
        "MOSFETs are the usual switches; their losses come from switching and conduction.",
        "Inverters drive motors with variable frequency."]],
      ["The trade-offs", "Efficiency against noise", [
        "Switching converters are efficient and make electrical noise; layout and filtering matter.",
        "Higher switching frequency shrinks components and raises switching losses.",
        "Thermal design (heatsinks, airflow) is part of the circuit design."]],
      ["In practice", "What you'll see at work", [
        "Efficiency curves measured across loads.",
        "Thermal cameras on prototypes.",
        "EMC testing for emissions."]],
    ], Q("bx-ee-04", "Electrical Engineer", ["power electronics"],
      "A linear regulator drops 24 V to 5 V at 1 A and overheats. Why, and what's the usual fix?",
      ["It dissipates (24 − 5) × 1 = 19 W as heat; use a switching (buck) converter", "The output voltage is too low", "Linear regulators can't supply 1 A", "Use a smaller heatsink"],
      0, ["Linear regulators burn the voltage difference; a buck converter is far more efficient.", "Not the cause.", "Some can; the heat is the problem.", "Worse."])),

    E(5, "Embedded control", ["control systems", "pid"], [
      ["What it is", "Making things follow commands", [
        "Control systems measure something (speed, temperature, position) and adjust an output to keep it on target.",
        "Most run on microcontrollers in a loop."]],
      ["Core ideas", "Feedback and PID", [
        "Closed loop: measure, compare with the set point, correct, repeat.",
        "A PID controller combines proportional (react to error), integral (remove steady offset) and derivative (damp fast changes) terms.",
        "Tuning trades speed of response against overshoot and stability.",
        "The loop must run at a steady, fast enough rate."]],
      ["The trade-offs", "Fast against stable", [
        "Aggressive tuning responds fast and may oscillate.",
        "Integral wind-up: the integral grows while the output is saturated; limit it.",
        "Sensor noise feeds into the derivative term; filter it."]],
      ["In practice", "What you'll see at work", [
        "Step-response tests to tune gains.",
        "Fixed-rate timer interrupts for control loops.",
        "Simulation (MATLAB/Simulink) before hardware."]],
    ], Q("bx-ee-05", "Electrical Engineer", ["pid"],
      "A temperature controller overshoots badly and oscillates around the set point. Which change usually helps first?",
      ["Reduce the proportional gain (and add some derivative damping), retuning step by step", "Increase all gains", "Remove the feedback", "Run the loop less often"],
      0, ["Lower gain and damping reduce overshoot and oscillation.", "Makes oscillation worse.", "Then it can't regulate.", "Slower loops usually worsen stability."])),
  ],
});
