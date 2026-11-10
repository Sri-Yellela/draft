// ⭐ 46a (owner 11-10) · THE SALARY ANSWER AN APPLICATION GIVES — the user's choice, read on the server for every build of
// the autofill answers (routes/apply.js withHowHeard) and in Auto settings to preview it.
//
// "for autoapply user should be able to choose amongst 3 options for salary, a preset salary that they choose and doesnt
//  change, a slider when the comapny has a propsed range, or a preset amount the user can set to avoid answering the
//  question that fits their expecteation, such as higher end or lower end or the mean or median, upper limit, lower limit."
//
//   mode "profile"   (the default — unchanged) the Profile's desired salary
//   mode "fixed"     `amount`, always
//   mode "position"  a point on the POSTING's own range: `position` 0–100 (0 = its minimum, 100 = its maximum)
//   mode "preset"    a named point on that range: lower_limit (min) · lower_end (25 %) · midpoint (50 % — a posted range
//                    is two numbers, so its mean and its median are the same point) · higher_end (75 %) · upper_limit (max)
//   whenNoRange      a posting that states no range: "fixed" (answer `amount`, or the Profile's) or "ask" (leave it for you)
//   floor            optional — the answer is never below it (null = no floor)
// The answer is in the posting's own unit (annual / hourly / monthly) when it comes from its range; rounded to $1,000 a
// year, $0.50 an hour, $50 a month.
export const SALARY_MODES = Object.freeze(["profile", "fixed", "position", "preset"]);
export const SALARY_PRESETS = Object.freeze({ lower_limit: 0, lower_end: 25, midpoint: 50, higher_end: 75, upper_limit: 100 });
export const SALARY_PRESET_LABELS = Object.freeze({
  lower_limit: "Lower limit (the posting's minimum)", lower_end: "Lower end (a quarter of the way up)",
  midpoint: "Midpoint (the range's mean and median)", higher_end: "Higher end (three quarters of the way up)",
  upper_limit: "Upper limit (the posting's maximum)",
});
export const SALARY_DEFAULTS = Object.freeze({ mode: "profile", amount: null, position: 50, preset: "midpoint", whenNoRange: "fixed", floor: null });

const money = (n) => Number.isFinite(n) && n > 0 && n < 10_000_000;

/** Validate a salary block (shared/autoSettings.js calls this). @returns { ok, value } | { ok: false, error, message } */
export function normaliseSalarySettings(input) {
  const fail = (error, message) => ({ ok: false, error, message });
  if (input == null || typeof input !== "object" || Array.isArray(input)) return fail("bad_salary", "The salary answer is an object.");
  const v = { ...SALARY_DEFAULTS };
  if ("mode" in input) { if (!SALARY_MODES.includes(input.mode)) return fail("bad_salary_mode", `The salary answer is one of: ${SALARY_MODES.join(", ")}.`); v.mode = input.mode; }
  if ("amount" in input) { if (!(input.amount === null || money(input.amount))) return fail("bad_salary_amount", "The salary amount is a positive number."); v.amount = input.amount; }
  if ("position" in input) {
    if (!(Number.isInteger(input.position) && input.position >= 0 && input.position <= 100)) return fail("bad_salary_position", "The point on the range is 0 to 100.");
    v.position = input.position;
  }
  if ("preset" in input) { if (!(input.preset in SALARY_PRESETS)) return fail("bad_salary_preset", `The preset is one of: ${Object.keys(SALARY_PRESETS).join(", ")}.`); v.preset = input.preset; }
  if ("whenNoRange" in input) { if (!["fixed", "ask"].includes(input.whenNoRange)) return fail("bad_salary_no_range", "Without a posted range the answer is your amount, or left for you."); v.whenNoRange = input.whenNoRange; }
  if ("floor" in input) { if (!(input.floor === null || money(input.floor))) return fail("bad_salary_floor", "The floor is a positive number, or none."); v.floor = input.floor; }
  if (v.mode === "fixed" && v.amount == null) return fail("bad_salary_amount", "A fixed salary answer needs its amount.");
  return { ok: true, value: v };
}

const roundFor = (period, n) => period === "hourly" ? Math.round(n * 2) / 2 : period === "monthly" ? Math.round(n / 50) * 50 : Math.round(n / 1000) * 1000;

/**
 * The number an application answers with.
 * @param settings  the salary block (SALARY_DEFAULTS when absent)
 * @param profileSalary  the Profile's desired salary (a number or null)
 * @param job  { salary_min_usd, salary_max_usd, salary_period }
 * @returns { value: number|null, basis: string, period: string|null } — value null means "leave this question for you"
 */
export function salaryAnswerFor(settings, { profileSalary = null, job = {} } = {}) {
  const s = { ...SALARY_DEFAULTS, ...(settings || {}) };
  const profile = money(Number(profileSalary)) ? Number(profileSalary) : null;
  const floored = (n, basis, period) => {
    if (n == null) return { value: null, basis, period };
    if (money(s.floor) && n < s.floor) return { value: s.floor, basis: `${basis} — raised to your floor`, period: period ?? "annual" };
    return { value: n, basis, period };
  };
  if (s.mode === "profile") return floored(profile, "your Profile's desired salary", null);
  if (s.mode === "fixed") return floored(money(s.amount) ? s.amount : profile, "your fixed amount", null);
  const lo = Number(job?.salary_min_usd), hi = Number(job?.salary_max_usd);
  const period = job?.salary_period || "annual";
  const hasRange = money(lo) && money(hi) && hi >= lo;
  if (!hasRange) {
    if (s.whenNoRange === "ask") return { value: null, basis: "the posting states no range — left for you", period: null };
    return floored(money(s.amount) ? s.amount : profile, "the posting states no range — your amount", null);
  }
  const pct = s.mode === "preset" ? SALARY_PRESETS[s.preset] ?? 50 : s.position;
  const at = roundFor(period, lo + (hi - lo) * (pct / 100));
  const label = s.mode === "preset" ? (SALARY_PRESET_LABELS[s.preset] || "midpoint").split(" (")[0].toLowerCase() : `${pct}% up the range`;
  return floored(at, `${label} of the posted ${Math.round(lo).toLocaleString("en-US")}–${Math.round(hi).toLocaleString("en-US")}${period === "annual" ? "" : ` (${period})`}`, period);
}
