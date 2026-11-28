# Atlas audit across domains (47n, 2026-11-27) — measured read-only on production `ee60644`

The owner (11-27): *"atlas audit across domains, i know cs has been the core focus but we need to cater for finance, analysts
like financial, analytics, data analytics, cloud, and project manager, and also other engineering roles having their own
gazetteers and all that are linked across as needed, for example a cpu or gpu has several domains related stuff and should
be reachable from any point of learning to any other … lets do a visual example of this so that we are on the same page"*.

**The visual (for the owner's look, nothing built):** https://claude.ai/artifact/N9pAT1AnDLgTwqKZvopDHV ("Atlas Crossroads":
the GPU at the centre, eight domain gazetteers round it, today's links solid, proposed bridges dashed, six walkable routes,
the domain table). Its source: `tmp/atlas-crossroads.html`; the measuring scripts `tmp/atlasAudit47n.mjs`,
`tmp/atlasCross47n.mjs` (their raw output `tmp/atlasAudit47n.json`, `tmp/atlasCross47n.json`). Sources: the public
`/api/atlas/tree/family/<key>` (a family's `total`, its centre's `postings`) and `/api/atlas/node/<slug>` (`related`, 404 = no node).

## Findings
1. **12 of 40 families hold 0 nodes:** frontend, mobile, game_graphics, qa, quant, it, security, robotics, architecture,
   geospatial, bioinformatics, science (`shared/atlasFamilies.js` defines them; D179 added them, nothing filled them).
   Shader / OpenGL / Vulkan exist as nodes with NO family.
2. **≈ half of linked nodes have no family:** GPU links 88 nodes, 46 family-less; Python 530 / 309; SQL 246 / 125;
   Excel 448 / 263. A family-less node is reachable by a link, never by browsing a gazetteer.
3. **Every link is `used_with` or `requires`** (co-occurrence in postings, the registry). No typed bridge says why two
   things join (is_a, part_of, runs_on, applied_in). Finance reaches GPU today only as Financial models → Excel → SQL →
   Python → GPU.
4. **Missing hub nodes (404):** cpu, computer-architecture, microarchitecture, statistics, data-analysis,
   data-visualization, cloud-computing, monte-carlo, linear-algebra, parallel-computing, hpc / high-performance-computing,
   gpu-computing, derivatives, risk-modeling, budgeting, semiconductor, soc, rapids, unity, unreal-engine.
5. **Cross-family links do exist** (co-occurrence): GPU → ASIC → Verilog / Physical design; AWS → Kubernetes → GPU;
   Excel → SQL → Python → PyTorch → GPU. ASIC and FPGA are filed under Systems, so the Electrical gazetteer never lists them.

## The domains the owner named (nodes · postings)
| Domain | Family today | Nodes | Postings | State |
|---|---|---|---|---|
| Finance | fpa | 52 | 5,973 | covered; no Quant (0), no Monte Carlo / derivatives / budgeting |
| Finance | accounting_audit | 45 | 3,931 | covered |
| Analysts | business_analysis | 42 | 1,954 | covered |
| Analytics / data analytics | data (computing) | 29 | 7,570 | mixed with data engineering; no statistics / data analysis / visualization |
| Cloud | infra | 26 | 14,086 | no Cloud gazetteer, no cloud-computing node |
| Project manager | project_management | 66 | 11,284 | construction PM (commissioning, AutoCAD, change orders) mixed with tech PM |
| Product | product | 15 | 15,166 | thinnest per posting |
| Engineering | mech 47 · elec 64 · civil 38 · process 49 · aero 24 · biomed 20 | | | covered; robotics / architecture / geospatial 0 |
| CS core | ml 31 · systems 56 · infra 26 · data 29 · backend 33 | | | the core |

## ⛔ Superseded by the owner's correction (11-27)
*"I meant shared like how wiki has links of a keyword and the keyword can be found across domains but the keyword itself
means the same and would lead to the same specific thing, although same words with diff meanings might have to be programmed
specially. and i said visualise an example of this not an artifact to visualise the problem."* — one entry per meaning,
linked inline from every domain; disambiguation for same-word-different-meaning. 47o: an example visualisation of that
target + an audit to plan it (docs/WORKLOG.md, 47n END block). The findings above stay as input; the proposal below does not.

## Proposal (SUPERSEDED — kept as history)
1. A gazetteer per domain: fill the 12 empty families; split Data & analytics from data engineering, Cloud from Infra,
   Quant under finance, tech program management from construction PM.
2. One home family per node + listed-in for hubs (GPU home Systems, listed in ML / Cloud / Game & graphics / Electrical /
   Quant); place the ~50 % family-less nodes.
3. Typed bridge edges beside co-occurrence (`is_a`, `part_of`, `runs_on`, `applied_in`) from curation + Wikidata (CC0) — no
   model (D190).
4. The hub concepts first (CPU, computer architecture, statistics, data analysis, cloud computing, Monte Carlo, linear
   algebra, parallel computing) — each opens several routes.
5. A route finder: shortest path preferring typed links, drawn with `plate/RouteMap.jsx` (the Gazetteer's Routes view).
