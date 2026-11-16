/* A228 sketches (46r) — the shared model for the three concepts. ⛔ SYNTHETIC: a made-up person ("Rin Calloway") and
   made-up market shares, shaped like draft's own data (job_tech asks per posting, atlas_role_level_stats per role × level,
   proof marks: a check passed / a build / on the résumé). No model call anywhere: every number below is counted. */
(function () {
  "use strict";
  // ── the person: each skill's state. proven = a check passed or a build linked; claimed = on the résumé (year last used)
  const SKILLS = [
    ["sql", "SQL", "Languages", "proven", "Passed the SQL check · 28 Oct"],
    ["python", "Python", "Languages", "proven", "Build: a bike-share ETL · Sep"],
    ["go", "Go", "Languages", "claimed", "On your résumé · used 2025", 2025],
    ["java", "Java", "Languages", "claimed", "On your résumé · used 2023", 2023],
    ["typescript", "TypeScript", "Languages", "claimed", "On your résumé · used 2025", 2025],
    ["scala", "Scala", "Languages", "missing"],
    ["spark", "Apache Spark", "Data processing", "missing"],
    ["kafka", "Kafka", "Data processing", "claimed", "On your résumé · used 2022", 2022],
    ["airflow", "Apache Airflow", "Data processing", "missing"],
    ["dbt", "dbt", "Data processing", "missing"],
    ["flink", "Flink", "Data processing", "missing"],
    ["postgres", "PostgreSQL", "Storage", "proven", "Passed the PostgreSQL check · 2 Nov"],
    ["redis", "Redis", "Storage", "claimed", "On your résumé · used 2025", 2025],
    ["snowflake", "Snowflake", "Storage", "missing"],
    ["bigquery", "BigQuery", "Storage", "missing"],
    ["aws", "AWS", "Cloud & delivery", "claimed", "On your résumé · used 2025", 2025],
    ["docker", "Docker", "Cloud & delivery", "proven", "Build: the ETL ships as a container"],
    ["k8s", "Kubernetes", "Cloud & delivery", "claimed", "On your résumé · used 2024", 2024],
    ["terraform", "Terraform", "Cloud & delivery", "missing"],
    ["cicd", "CI/CD", "Cloud & delivery", "claimed", "On your résumé · used 2025", 2025],
    ["grpc", "gRPC", "Cloud & delivery", "claimed", "On your résumé · used 2025", 2025],
    ["react", "React", "Product", "claimed", "On your résumé · used 2023", 2023],
    ["pytorch", "PyTorch", "ML & analysis", "missing"],
    ["stats", "Statistics", "ML & analysis", "missing"],
  ].map(([id, name, family, state, evidence = "Not on your résumé", year = null]) => ({ id, name, family, state, evidence, year }));
  const S = Object.fromEntries(SKILLS.map(s => [s.id, s]));
  const FAMILIES = ["Languages", "Data processing", "Storage", "Cloud & delivery", "Product", "ML & analysis"];

  // ── the market: each role's open postings and the share of its postings that ask for each skill (job_tech counts)
  const ROLES = [
    { id: "backend", name: "Backend Engineer", open: 3940, current: true,
      asks: { go: .38, java: .41, python: .44, sql: .52, postgres: .46, redis: .29, aws: .48, docker: .43, k8s: .36, kafka: .22, grpc: .19, typescript: .21, cicd: .30, terraform: .12 } },
    { id: "data", name: "Data Engineer", open: 1842, target: true,
      asks: { sql: .91, python: .84, spark: .58, airflow: .47, aws: .46, dbt: .39, snowflake: .36, kafka: .33, docker: .31, postgres: .29, bigquery: .21, k8s: .18, java: .17, scala: .15, terraform: .14, flink: .09, go: .06 } },
    { id: "platform", name: "Platform Engineer", open: 1120,
      asks: { k8s: .72, aws: .69, terraform: .64, docker: .58, cicd: .52, go: .41, python: .38, grpc: .15, postgres: .14, kafka: .12, redis: .10 } },
    { id: "analytics", name: "Analytics Engineer", open: 540,
      asks: { sql: .96, dbt: .74, python: .55, snowflake: .52, bigquery: .33, stats: .31, airflow: .28, postgres: .18 } },
    { id: "ml", name: "ML Engineer", open: 960,
      asks: { python: .93, pytorch: .61, stats: .44, sql: .42, aws: .38, docker: .33, spark: .31, k8s: .29, airflow: .14, scala: .06 } },
    { id: "fullstack", name: "Full-stack Engineer", open: 2310,
      asks: { typescript: .71, react: .68, postgres: .38, sql: .34, aws: .33, docker: .30, python: .26, cicd: .25, java: .22, redis: .14, go: .12 } },
  ];
  // hours to a proof (the Library's course length + its check) — atlas_resources.hours in draft
  const HOURS = { spark: 30, airflow: 14, dbt: 10, snowflake: 12, scala: 40, terraform: 16, bigquery: 8, flink: 24, pytorch: 36, stats: 28, kafka: 6, k8s: 8, aws: 6, redis: 3, go: 4, java: 5, typescript: 4, react: 6, cicd: 3, grpc: 3 };
  const PROOF = { spark: "Spark check + a batch build on the bike data", airflow: "Schedule the ETL as a DAG (a build)", dbt: "dbt models on the ETL's tables (a build)", snowflake: "Snowflake check", scala: "Scala check", terraform: "Terraform check + the ETL's infra as code", bigquery: "BigQuery check", flink: "Flink check", pytorch: "PyTorch check + a small model build", stats: "Statistics check" };
  const LEVELS = [["entry", .22], ["mid", .46], ["senior", .32]];
  const REACH = 0.6;   // "within reach": you have at least 60% of what the posting asks

  // ── a seeded board: postings drawn from each role's asks (deterministic, so every view agrees)
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function simulate(role, seed) {
    const r = rng(seed), n = Math.min(role.open, 900), out = [];
    for (let i = 0; i < n; i++) {
      const x = r(); let acc = 0, level = "mid";
      for (const [l, p] of LEVELS) { acc += p; if (x < acc) { level = l; break; } }
      const lift = level === "senior" ? 1.18 : level === "entry" ? 0.82 : 1;
      const asks = Object.entries(role.asks).filter(([, p]) => r() < Math.min(.98, p * lift)).map(([id]) => id);
      if (asks.length < 2) { const top = Object.entries(role.asks).sort((a, b) => b[1] - a[1]); for (const [id] of top) { if (!asks.includes(id)) asks.push(id); if (asks.length >= 2) break; } }
      out.push({ level, asks });
    }
    return { postings: out, scale: role.open / n };
  }
  const has = (id, extra) => (S[id] && S[id].state !== "missing") || (extra && extra.has(id));
  // a posting is met by how strongly you've shown each ask: proven whole, on the résumé half (a quarter if last used
  // before 2024), not yet nothing. A skill on the route (extra) counts as proven once its proof is in.
  const creditOf = (id, extra) => (extra && extra.has(id)) ? 1 : credit(S[id]);
  const shareMet = (p, extra) => p.asks.reduce((a, id) => a + creditOf(id, extra), 0) / p.asks.length;
  function within(sim, extra, level) {
    const ps = level ? sim.postings.filter(p => p.level === level) : sim.postings;
    return Math.round(ps.filter(p => shareMet(p, extra) >= REACH).length * sim.scale);
  }
  function histogram(sim, extra, level) {
    const bins = Array.from({ length: 10 }, (_, i) => ({ from: i / 10, n: 0 }));
    for (const p of sim.postings) { if (level && p.level !== level) continue; bins[Math.min(9, Math.floor(shareMet(p, extra) * 10))].n += sim.scale; }
    bins.forEach(b => (b.n = Math.round(b.n)));
    return bins;
  }
  // demand-weighted coverage: proven counts whole, on the résumé half (a quarter if last used before 2024), not yet nothing
  function credit(s) { return s.state === "proven" ? 1 : s.state === "claimed" ? (s.year && s.year < 2024 ? .25 : .5) : 0; }
  const creditUnused = (s) => s.state === "proven" ? 1 : s.state === "claimed" ? (s.year && s.year < 2024 ? .25 : .5) : 0;
  function coverage(role) { let a = 0, b = 0; for (const [id, p] of Object.entries(role.asks)) { a += p * credit(S[id]); b += p; } return a / b; }
  function overlap(role) { let a = 0, b = 0; for (const [id, p] of Object.entries(role.asks)) { if (has(id)) a += p; b += p; } return a / b; }
  // the route: greedy — the missing skill that brings the most postings within reach per hour, then the next, …
  function route(role, sim, steps = 5) {
    const extra = new Set(), out = [];
    let base = within(sim, extra);
    const cands = Object.keys(role.asks).filter(id => S[id].state !== "proven");
    for (let k = 0; k < steps && cands.length; k++) {
      let best = null;
      for (const id of cands) {
        const t = new Set(extra); t.add(id);
        const gain = within(sim, t) - base, score = gain / (HOURS[id] || 20);
        if (!best || score > best.score) best = { id, gain, score };
      }
      if (!best || best.gain <= 0) break;
      extra.add(best.id); cands.splice(cands.indexOf(best.id), 1);
      base += best.gain;
      out.push({ id: best.id, name: S[best.id].name, kind: S[best.id].state === "missing" ? "learn" : "prove", gain: best.gain, total: base, hours: HOURS[best.id] || 20, proof: PROOF[best.id] || (S[best.id].state === "claimed" ? `Prove it: the ${S[best.id].name} check` : `${S[best.id].name} check`), ask: role.asks[best.id] });
    }
    return out;
  }
  function model(targetId = "data") {
    const roles = ROLES.map((role, i) => {
      const sim = simulate(role, 1000 + i * 77);
      const rt = route(role, sim);
      return { ...role, sim, coverage: coverage(role), overlap: overlap(role), within: within(sim), route: rt,
        hoursToHalf: (() => { let h = 0; const half = role.open * .3; if (within(sim) >= half) return 0; for (const s of rt) { h += s.hours; if (s.total >= half) return h; } return null; })(),
        carries: Object.keys(role.asks).filter(id => has(id)).sort((a, b) => role.asks[b] - role.asks[a]),
        missing: Object.keys(role.asks).filter(id => !has(id)).sort((a, b) => role.asks[b] - role.asks[a]) };
    });
    const target = roles.find(r => r.id === targetId);
    return { person: { name: "Rin Calloway", now: "Backend Engineer · mid · 4 years", note: "Synthetic person" }, skills: SKILLS, S, FAMILIES, roles, target, REACH, LEVELS: LEVELS.map(l => l[0]),
      histogram, within, shareMet, credit };
  }

  // ── pieces every sketch uses
  const NS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs = {}, kids = []) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); for (const c of [].concat(kids)) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c))); return e; }
  function defs() { return svg("defs", {}, [svg("pattern", { id: "hatch", width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, [svg("rect", { width: 5, height: 5, fill: "var(--surface)" }), svg("rect", { width: 2, height: 5, fill: "var(--accent)", "fill-opacity": .45 })])]); }
  const fillOf = (s) => `f-${s.state}`;
  const stateWord = (s) => s.state === "proven" ? "Proven" : s.state === "claimed" ? (s.year && s.year < 2024 ? `On your résumé · last used ${s.year}` : "On your résumé") : "Not yet";
  let tipEl;
  function tips(root = document) {
    tipEl = tipEl || Object.assign(document.createElement("div"), { className: "tip", hidden: true, role: "tooltip" });
    if (!tipEl.isConnected) document.body.append(tipEl);
    const show = (t, x, y) => { const [h, ...rest] = t.split("\n"); tipEl.innerHTML = ""; const b = document.createElement("b"); b.textContent = h; tipEl.append(b); for (const l of rest) { const d = document.createElement("div"); d.textContent = l; tipEl.append(d); } tipEl.hidden = false; const w = tipEl.offsetWidth, hh = tipEl.offsetHeight; tipEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 14)) + "px"; tipEl.style.top = Math.max(8, Math.min(innerHeight - hh - 8, y + 14)) + "px"; };
    root.addEventListener("pointermove", (e) => { const m = e.target.closest?.("[data-tip]"); if (m) show(m.getAttribute("data-tip"), e.clientX, e.clientY); else tipEl.hidden = true; });
    root.addEventListener("pointerleave", () => (tipEl.hidden = true));
    root.addEventListener("focusin", (e) => { const m = e.target.closest?.("[data-tip]"); if (m) { const r = m.getBoundingClientRect(); show(m.getAttribute("data-tip"), r.right, r.top); } });
    root.addEventListener("focusout", () => (tipEl.hidden = true));
  }
  function table(host, head, rows, label = "Show as a table") {
    const d = document.createElement("details"); d.className = "table";
    d.innerHTML = `<summary>${label}</summary><div class="tw"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    host.append(d);
  }
  // draw on resize: fn(width) returns an <svg>; redrawn when the box changes width
  function responsive(host, fn) { let w0 = 0; const draw = () => { const w = Math.round(host.clientWidth); if (!w || w < 120 || w === w0) return; w0 = w; host.replaceChildren(fn(w)); }; new ResizeObserver(draw).observe(host); draw(); }
  // the sketch bar: concept links + the four themes (kept per viewer; storage may be blocked)
  function sketchBar(current) {
    const bar = document.querySelector(".sk-bar"); if (!bar) return;
    const skins = [["", "Auto"], ["dusk-light", "Dusk light"], ["dusk-dark", "Dusk dark"], ["plain-light", "Plain light"], ["plain-dark", "Plain dark"]];
    let cur = ""; try { cur = localStorage.getItem("a228-skin") || ""; } catch { /* blocked */ }
    const set = (v) => { if (v) document.documentElement.setAttribute("data-skin", v); else document.documentElement.removeAttribute("data-skin"); try { localStorage.setItem("a228-skin", v); } catch { /* blocked */ } bar.querySelectorAll("[data-skin-btn]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.skinBtn === v))); };
    const box = bar.querySelector(".sk-themes");
    for (const [v, l] of skins) { const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.dataset.skinBtn = v; b.textContent = l; b.onclick = () => set(v); box.append(b); }
    set(cur);
  }
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const pct = (x) => `${Math.round(x * 100)}%`;
  window.A228 = { model, svg, defs, fillOf, stateWord, tips, table, responsive, sketchBar, fmt, pct };
})();
