// ⭐ D200 (a) (47h, the yoursurvey lane) · D196 F5's build side for Your survey — the page (SkillMapView) drawn from the
// `YourSurvey` board's own example data (docs/sketches/final/project/YourSurvey.dc.html): the same role, counts, skills,
// states, steps, companies' letters and roles, in the board's order. A fixture is never tuned to pass: a failing diff is
// fixed in the component (D196 F5), and this keeps the board's data. Registered in plate/fixtures.jsx (FIXTURES).
import { useLayoutEffect, useRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { SkillMapView } from "./SkillMap.jsx";

const slug = (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const JUDGED = 164;   // the board's histogram: 15 + 13 + 24 + 37 + 26 + 28 + 15 + 1 + 3 + 2
let nid = 100;
const ask = (name, familyName, share, state) => ({ id: nid++, slug: slug(name), name, family: familyName.toLowerCase(), familyName, share, jobs: Math.round(share * JUDGED), state, thumb: null });
const node = (name) => ({ id: nid++, slug: slug(name), name, thumb: null });
const cos = (...names) => names.map((name, i) => ({ name, iconUrl: null, jobs: 3 - i }));
const step = (name, gain, total) => ({ id: nid++, slug: slug(name), name, kind: "learn", gain, total, hours: 20, estimated: true, published: true, stepId: null, thumb: null });
const role = (id, name, open, coverage, applicable, carries, missing, hoursTo30, more = {}) => ({
  id, slug: slug(name), name, open, judged: open, coverage, applicable, carries: carries.map(node), missing: missing.map(node), hoursTo30,
  isAim: false, isCurrent: false, isShown: false, ...more });

export const BOARD_SURVEY = {
  found: true,
  role: { id: 1, slug: "devops-engineer", name: "DevOps Engineer", open: 195, judged: JUDGED, published: true },
  aim: { id: 1, slug: "devops-engineer", name: "DevOps Engineer", thumb: null },
  current: { id: 2, slug: "software-engineer", name: "Software Engineer", thumb: null },
  threshold: 0.6, skills: { proven: 0, claimed: 9 }, applicable: 21,
  histogram: [15, 13, 24, 37, 26, 28, 15, 1, 3, 2].map((jobs, i) => ({ from: i / 10, to: (i + 1) / 10, jobs })),
  levels: [{ level: "entry", open: 7, applicable: 1 }, { level: "early", open: 5, applicable: 0 }, { level: "mid", open: 40, applicable: 5 }, { level: "senior", open: 38, applicable: 3 }],
  asks: [
    ask("CI/CD", "Infra", 0.67, "claimed"), ask("AWS", "Infra", 0.65, "missing"), ask("Kubernetes", "Infra", 0.52, "claimed"), ask("Terraform", "Infra", 0.47, "claimed"),
    ask("Reliability", "Infra", 0.41, "missing"), ask("Observability", "Infra", 0.37, "missing"), ask("Cloud infra", "Infra", 0.33, "missing"), ask("Linux", "Infra", 0.33, "missing"),
    ask("Networking", "Infra", 0.31, "missing"), ask("Docker", "Infra", 0.29, "claimed"), ask("Azure", "Infra", 0.29, "missing"), ask("GCP", "Infra", 0.22, "missing"),
    ask("Git", "Infra", 0.18, "claimed"), ask("Grafana", "Infra", 0.16, "claimed"), ask("Prometheus", "Infra", 0.15, "claimed"),
    ask("Python", "Backend", 0.48, "claimed"), ask("Scala", "Backend", 0.12, "missing"), ask("Elasticsearch", "Backend", 0.10, "missing")],
  route: { hours: 100, estimated: true, steps: [
    { ...step("AWS", 19, 40), companies: cos("Kestrel", "Cobalt", "Tidewater") },
    { ...step("observability", 14, 54), companies: cos("Tern", "Northwind", "Vantage") },
    { ...step("Azure", 19, 73), companies: cos("Atlasware", "Driftwood", "Alder") },
    { ...step("reliability", 14, 87), companies: cos("1Password", "Halcyon", "Ardent") },
    { ...step("cloud infrastructure", 12, 99), companies: cos("Ambit", "Tessel", "Quarry") }] },
  move: [
    role(1, "DevOps Engineer", 195, 0.38, 21, ["CI/CD", "Kubernetes", "Python", "Terraform", "Docker"], ["AWS", "Reliability", "Observability"], 40, { isAim: true, isShown: true }),
    role(2, "Software Engineer", 4965, 0.30, 503, ["Python", "TypeScript", "Kubernetes", "React", "Java"], ["Reliability", "AWS", "Observability"], 80, { isCurrent: true }),
    role(3, "Frontend Engineer", 48, 0.42, 14, ["React", "TypeScript", "Rails", "CI/CD", "Python"], ["Web accessibility", "Observability"], 20),
    role(4, "Full Stack Engineer", 216, 0.41, 38, ["React", "TypeScript", "Python", "CI/CD", "PG"], ["AWS", "Reliability"], 20),
    role(5, "Security Researcher", 13, 0.38, 2, ["Python", "CI/CD", "Docker"], ["Machine learning", "GCP", "C"], 20),
    role(6, "Software Developer", 109, 0.36, 15, ["Python", "Java", "TypeScript", "CI/CD", "SQL"], ["Reliability", "AWS"], 60),
    role(7, "Mobile Engineer", 24, 0.35, 3, ["React", "Kotlin", "CI/CD", "TypeScript", "Java"], ["Redux", "Cloud functions", "Design systems"], 20)],
};
BOARD_SURVEY.roles = BOARD_SURVEY.move.map(m => ({ id: m.id, slug: m.slug, name: m.name, isAim: m.isAim, isCurrent: m.isCurrent }));

/** The board's page: the rail beside it is 98 px (14 + 84), the content column 1182 wide; each section is put at the
 *  board piece's own sub-pixel offset after layout — measured, never computed (#oy, sel from scripts/d196Regress.mjs). */
export function YourSurveyBoard() {
  const wrap = useRef(null);
  useLayoutEffect(() => {
    const q = new URLSearchParams((globalThis.location?.hash || "").slice(1));
    const sel = q.get("sel"), want = Number(q.get("oy")) || 0;
    // 47i: once now and again after the web fonts have laid the text out (the first pass ran on the fallback fonts)
    const place = () => {
      const el = sel && document.querySelector(sel);
      if (!el || !wrap.current) return;
      const pad = parseFloat(wrap.current.style.paddingTop) || 0;
      const got = (el.getBoundingClientRect().top + scrollY - pad) % 1;
      wrap.current.style.paddingTop = `${(((want - got) % 1) + 1) % 1}px`;
    };
    place();
    let live = true;
    globalThis.document?.fonts?.ready?.then(() => { if (live) place(); });
    return () => { live = false; };
  }, []);
  // 47i: the board keeps its 98 px rail at every width — the column is the viewport less 98 (1182 at 1280, 292 at 390)
  // (#w = the board section's own width, as the market's final fixtures draw at theirs: the board caps its sections at 1180)
  const col = Number(new URLSearchParams((globalThis.location?.hash || "").slice(1)).get("w")) || Math.max(240, (globalThis.innerWidth || 1280) - 98);
  return (
    <MemoryRouter>
      <div ref={wrap} data-your-survey-fixture="" style={{ marginLeft: 98, width: col }}>
        <SkillMapView m={BOARD_SURVEY} base="/atlas" />
      </div>
    </MemoryRouter>
  );
}

export const YS_FIXTURES = { YourSurveyBoard };
