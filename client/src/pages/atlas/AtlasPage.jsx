// ⭐ D105 P4 · THE ATLAS — a dictionary of roles, skills, tools and stacks, linked to each other and to the board.
//
// ONE page, two mounts: PUBLIC at /atlas and /atlas/:slug (no sign-in — useful to anyone, found by search engines;
// `publicChrome` draws the marketing dock and footer), and inside the app at /app/atlas(/:slug) for a signed-in
// reader, under the top bar's Atlas tab (D102's navigation gains one place). `base` is the mount; the slug and the
// search are read from the address, so a link, the back button and a reload all land on the same page.
//
// The page, top to bottom (D105): name, aliases, kind · the definition in draft's words · On the board (computed,
// with "computed from N active postings on <date>") · Related (typed link lists + the first-ring graph) · Resources
// (free first; level · format · hours · cost · last checked; links out) · From Wikipedia (its OWN block, its licence
// line and links — never merged into the definition) · "You: have / partial / missing" only when the API sent `you`.
// ⭐ D105 P12: a ROLE's page is the board's own data (`roleBoard`): skills with shares, levels, pay, companies hiring,
// then "To reach the next level"; its definition shows on top when one exists, and no "not written yet" line otherwise.
// Every colour is a theme token (AtlasPage.css); no pills — marks and depth boxes (D60).
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";   // A154 (45s): the Compete switches
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import ScrollDock from "../../components/ScrollDock.jsx";
import { Footer } from "../../components/Footer.jsx";
import DepthButton from "../../components/DepthButton.jsx";
import { BRAND } from "../../../../shared/brand.js";
import AtlasGraph from "./AtlasGraph.jsx";
import { RoleMap, FamilyMap } from "./YourMap.jsx";
import SkillMap from "./SkillMap.jsx";   // ⭐ A228: Your map
import PlaceNav from "../../components/PlaceNav.jsx";
import { OverviewPanel, YourSkillsSlot, YourRoutePanel, TodaysQuestionPanel, HowItWorksPanel, AuditPanel, RolesPanel, MarketPanel, GlossaryPanel,
  PanelHead } from "./AtlasPanels.jsx";
import { panelFor, isPanelSlug, PANEL_LABEL, navGroups, panelHref, courseIdOf } from "./atlasPanels.js";
import { LeaguePanel, ChallengesPanel, SharedBar } from "./CompetePanels.jsx";   // A154 / D172 (4) (45s): behind their switches
import { LibraryShelf, CoursePage, PatternCoursePage, COURSES, courseKind } from "./LibraryPanel.jsx";
import { LibraryItem } from "./LibraryGuides.jsx";
import YourRun from "./YourRun.jsx";
import TrackBoard from "./TrackBoard.jsx";
import {
  KIND_LABEL, relatedGroups, resolveSearch, loadNode, payLine, computedLine, orderedResources, resourceMeta, FEW_POSTINGS_LINE,
  WIKI_LICENCE, YOU_LABEL, YOU_MARK, LEVEL_READ_LABEL, shareText, stepTitle, stepEmptyLine, roleBoardParts, nodePanes, nodeHeadline,
} from "./atlasModel.js";
import { SponsorshipChip } from "../../components/SponsorshipSignal.jsx";
import ResourceTile, { ResourceGrid } from "../../components/ResourceTile.jsx";
import "./AtlasPage.css";
import { NoteCard } from "../../components/TextBlocks.jsx";   // A233

function SearchBox({ base, initial = "" }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(initial);
  useEffect(() => { setQ(initial); }, [initial]);
  return (
    <form className="atl__search" role="search" data-atlas-search=""
      onSubmit={(e) => { e.preventDefault(); const t = q.trim(); if (t) navigate(`${base}?q=${encodeURIComponent(t)}`); }}>
      <input className="atl__input" type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80}
        aria-label="Look up a role, skill, tool or stack" placeholder="Look up a role, skill or tool — k8s, PyTorch, ML engineer…" />
      <DepthButton primary type="submit">Look up</DepthButton>
    </form>
  );
}

/** /atlas and /atlas?q= — the search. An exact name or an alias lands straight on its page. */
function AtlasSearch({ base, q }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: q ? "loading" : "idle", results: [] });
  useEffect(() => {
    let live = true;
    if (!q) { setState({ status: "idle", results: [] }); return undefined; }
    setState({ status: "loading", results: [] });
    resolveSearch(q).then((r) => {
      if (!live) return;
      if (r.go) navigate(`${base}/${encodeURIComponent(r.go)}`, { replace: true, state: { from: r.q, via: r.via } });
      else setState({ status: "done", results: r.results });
    }).catch((e) => live && setState({ status: "error", results: [], error: e.message }));
    return () => { live = false; };
  }, [q, base, navigate]);
  return (
    <>
      <header className="atl__head">
        <p className="atl__kicker">The Atlas</p>
        <h1 className="atl__title">Roles, skills, tools and stacks — and how they connect</h1>
        <p className="atl__lede">Look one up: what it is, what jobs ask for with it, and where to learn it.</p>
      </header>
      <SearchBox base={base} initial={q} />
      {state.status === "loading" && <p className="atl__quiet" role="status">Looking up “{q}”…</p>}
      {state.status === "error" && <p className="atl__quiet" role="alert">The Atlas could not be reached: {state.error}</p>}
      {state.status === "done" && (state.results.length === 0
        ? <p className="atl__quiet" role="status" data-atlas-none="">Nothing in the Atlas matches “{q}” yet.</p>
        : (
          <ul className="atl__results" data-atlas-results="">
            {state.results.map(r => (
              <li key={r.slug}><Link to={`${base}/${encodeURIComponent(r.slug)}`} className="atl__link">{r.name}</Link>
                {" "}<span className="mark mark--dim">{KIND_LABEL[r.kind] || r.kind}</span>
                {/* BUG 10-31: why it matched — "k8s → Kubernetes", a typo, "in its definition" */}
                {r.why && <span className="atl__quiet" data-atlas-why=""> · {r.why}</span>}</li>
            ))}
          </ul>
        ))}
    </>
  );
}

function LinkList({ base, items }) {
  return (
    <ul className="atl__links">
      {items.map(i => <li key={i.slug}><Link to={`${base}/${encodeURIComponent(i.slug)}`} className="atl__link">{i.name}</Link>
        {i.postings != null && <span className="atl__count"> · {i.postings}</span>}</li>)}
    </ul>
  );
}

/** "From Wikipedia" — Wikipedia's words in Wikipedia's block: the licence line, the article and the licence linked. */
export function WikipediaBlock({ wiki }) {
  if (!wiki || !wiki.extract) return null;
  const licence = wiki.licence?.line ? wiki.licence : WIKI_LICENCE;
  return (
    <section className="atl__section atl__wiki" data-atlas-wiki="" aria-labelledby="atl-wiki">
      <h2 className="atl__h2" id="atl-wiki">From Wikipedia</h2>
      <div className="atl__wiki-body">
        {wiki.thumbnailUrl && <img className="atl__wiki-img" src={wiki.thumbnailUrl} alt="" loading="lazy" />}
        <blockquote className="atl__wiki-text" cite={wiki.pageUrl || undefined}>{wiki.extract}</blockquote>
      </div>
      <p className="atl__wiki-credit" data-wiki-licence="">
        {licence.line} ·{" "}
        {wiki.pageUrl && <><a href={wiki.pageUrl} target="_blank" rel="noopener noreferrer">the article “{wiki.title}”</a> ·{" "}</>}
        <a href={licence.url} target="_blank" rel="noopener noreferrer license">the licence</a>
      </p>
    </section>
  );
}

/**
 * ⭐ D105 P12 · a ROLE's "On the board" — the board's own data, which is the page when no one has written a definition:
 * the skills its postings ask for with their shares, its postings by real level (D106), pay, and the companies hiring.
 */
function RoleBoard({ base, rb, payText }) {
  const parts = roleBoardParts(rb);
  const href = (slug) => `${base}/${encodeURIComponent(slug)}`;
  return (
    <div className="atl__cols" data-atlas-role-board="">
      {parts.skills && (
        <div data-role-skills="">
          <h3 className="atl__h3">Skills its jobs ask for</h3>
          <ul className="atl__links">
            {rb.topSkills.map(s => (
              <li key={s.slug}><Link to={href(s.slug)} className="atl__link">{s.name}</Link>
                <span className="atl__count" data-share={s.share}> · {shareText(s.share)}</span></li>
            ))}
          </ul>
        </div>
      )}
      {parts.levels && (
        <div data-role-levels="">
          <h3 className="atl__h3">Levels its jobs ask for</h3>
          <ul className="atl__links">
            {rb.levels.read.filter(l => l.postings > 0).map(l => (
              <li key={l.level} data-level={l.level}>{LEVEL_READ_LABEL[l.level] || l.level}
                <span className="atl__count"> · {l.postings} job{l.postings === 1 ? "" : "s"} · {l.share} %</span></li>
            ))}
          </ul>
          {rb.levels.unread > 0 && <p className="atl__quiet">{rb.levels.unread} more say nothing that reads as a level.</p>}
        </div>
      )}
      {parts.pay && payText && (
        <div data-role-pay=""><h3 className="atl__h3">Pay range</h3>
          <p className="atl__pay" data-atlas-pay="">{payText}<br /><span className="atl__quiet">from {rb.pay.n} job{rb.pay.n === 1 ? "" : "s"} that state pay</span></p></div>
      )}
      {parts.companies && (
        <div data-role-companies="">
          <h3 className="atl__h3">Companies hiring</h3>
          <ul className="atl__links">
            {rb.companies.items.map(c => <li key={c.company}>{c.company}<span className="atl__count"> · {c.postings}</span></li>)}
          </ul>
          {rb.companies.total > rb.companies.items.length && <p className="atl__quiet">and {rb.companies.total - rb.companies.items.length} more</p>}
        </div>
      )}
    </div>
  );
}

/** ⭐ D105 P12 · D116's "to reach the next level" for this role — every step, measured from the board, not opinion. */
function RoleNextLevel({ base, steps }) {
  const href = (slug) => `${base}/${encodeURIComponent(slug)}`;
  return (
    <section className="atl__section" data-atlas-next-level="" aria-labelledby="atl-next">
      <h2 className="atl__h2" id="atl-next">To reach the next level</h2>
      <div className="atl__cols">
        {steps.map(step => (
          <div key={`${step.from}-${step.to}`} data-next-step={`${step.from}-${step.to}`}>
            <h3 className="atl__h3">{stepTitle(step)}</h3>
            {step.items.length === 0 ? <p className="atl__quiet">{stepEmptyLine(step)}</p> : (
              <ul className="atl__links">
                {step.items.map(i => (
                  <li key={i.slug}><Link to={href(i.slug)} className="atl__link">{i.name}</Link>
                    <div className="atl__quiet">{i.line}</div></li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <p className="atl__quiet">Skills asked for more as the level goes up, read from the jobs themselves.</p>
    </section>
  );
}

/** /atlas/:slug — one page. */
export function AtlasNodeView({ base, node, from, onWalk, signedIn = false }) {
  const stats = node.onTheBoard;
  const groups = relatedGroups(node.related);
  const resources = orderedResources(node.resources || []);
  const pay = payLine(stats?.pay);
  const href = (slug) => `${base}/${encodeURIComponent(slug)}`;
  // ⭐ D105 P12: a role's page is the board's own data; its definition, when one exists, stays on top.
  const rb = node.kind === "role" ? node.roleBoard || null : null;
  // ⭐ D172 (owner APPROVED 11-06, atlas-redesign-sketch.html → Kafka): ONE CARD — the name, the definition, one number, your
  // standing, Learn it / Prove it — and every older section on demand, one at a time (atlasModel.js nodePanes). The panes
  // not shown stay in the page, `hidden`: the public page keeps its whole text for search engines and screen readers.
  const panes = nodePanes(node);
  const [pane, setPane] = useState(null);
  useEffect(() => { setPane(null); }, [node.slug]);
  const headline = nodeHeadline(node);
  // The readiness check covers the skills and tools on a Profile — never a role, a concept or a pattern.
  const canProve = signedIn && (node.kind === "skill" || node.kind === "tool");
  const navigate = useNavigate();
  const learnHref = node.learn ? `${base}/learn#step-${encodeURIComponent(node.learn.stepId)}` : null;
  const proveHref = `${base}/your-skills?prove=${encodeURIComponent(node.name)}`;
  const body = {
    board: (
      <>
        {rb ? <RoleBoard base={base} rb={rb} payText={payLine(rb.pay)} /> : null}
        {stats && <p className="atl__quiet" data-atlas-computed="">{computedLine(stats)}</p>}
      </>
    ),
    map: <RoleMap base={base} slug={node.slug} />,
    next: rb && roleBoardParts(rb).nextLevel ? <RoleNextLevel base={base} steps={rb.nextLevel} /> : null,
    sponsors: node.sponsors?.length > 0 && (
      <>
        <ul className="atl__links">
          {node.sponsors.map(s => (
            <li key={s.company} data-atlas-sponsor-level={s.level || undefined}>
              <b>{s.company}</b>{s.signal ? <> <SponsorshipChip signal={s.signal} needed /></> : null}
              {" "}· {s.titleLine || s.text} · {s.postings} open job{s.postings === 1 ? "" : "s"}
            </li>
          ))}
        </ul>
        <p className="atl__quiet">
          Companies with open postings for this role and certified LCAs on record ·{" "}
          {node.sponsors[0].source?.url
            ? <a href={node.sponsors[0].source.url} target="_blank" rel="noopener noreferrer">{node.sponsors[0].source.name}</a>
            : node.sponsors[0].source?.name}
          {node.sponsors[0].source?.through ? `, through ${node.sponsors[0].source.through}` : ""}. A record of filings, not a promise about any posting.
        </p>
      </>
    ),
    roles: stats?.topRoles?.length > 0 && (
      <>
        <LinkList base={base} items={stats.topRoles} />
        <p className="atl__quiet" data-atlas-computed="">{computedLine(stats)}</p>
      </>
    ),
    pay: pay && <p className="atl__pay" data-atlas-pay="">{pay}<br /><span className="atl__quiet">from {stats.pay.n} job{stats.pay.n === 1 ? "" : "s"} that state pay</span></p>,
    related: (
      <div className="atl__related">
        <div className="atl__cols">
          {node.kind !== "role" && stats?.topSkills?.length > 0 && <div data-edge-group="seen-with"><h3 className="atl__h3">Often asked for with it</h3><LinkList base={base} items={stats.topSkills} /></div>}
          {groups.map(g => <div key={g.title} data-edge-group={g.type}><h3 className="atl__h3">{g.title}</h3><LinkList base={base} items={g.items} /></div>)}
        </div>
        {groups.length > 0 && <AtlasGraph node={node} hrefFor={href} onWalk={onWalk} />}
      </div>
    ),
    resources: (
      <>
        {node.learn && (
          <ul className="atl__res">
            {/* ⭐ D115 P4(b): the step of the owner's learning path that teaches it — first, above Wikidata's links. */}
            <li data-atlas-learn={node.learn.stepId}>
              <Link to={`${base}/learn#step-${encodeURIComponent(node.learn.stepId)}`} className="atl__link atl__res-learn">Learn it: {node.learn.label}</Link>
              <div className="atl__quiet">{node.learn.title} · From silicon to software</div>
            </li>
          </ul>
        )}
        {/* ⭐ D119: the resources as tiles — the one ResourceTile, each with its stored picture (or what it is, in type). */}
        {resources.length > 0 && (
          <ResourceGrid>
            {resources.map(r => (
              <li key={r.url} data-resource-cost={r.cost || ""}>
                <ResourceTile item={{ id: null, k: r.format ? r.format.charAt(0).toUpperCase() + r.format.slice(1) : "Article", u: r.url, t: r.title, s: resourceMeta(r).join(" · ") }}
                  thumb={r.thumb || null} extra={r.cost === "free" ? <span className="mark mark--ok">Free</span> : null} />
              </li>
            ))}
          </ResourceGrid>
        )}
      </>
    ),
    wikipedia: <WikipediaBlock wiki={node.wikipedia} />,
  };
  return (
    <article className="atl__node atl-card" data-atlas-node={node.slug} data-atlas-card="">
      <header className="atl__head">
        <p className="atl__kicker"><Link to={base} className="atl__link">The Atlas</Link> · <span className="mark mark--accent">{KIND_LABEL[node.kind] || node.kind}</span></p>
        <h1 className="atl__title">{node.name}</h1>
        {from?.via === "alias" && (
          <p className="atl__quiet" data-atlas-from="">“{from.q}” is another name for {node.name}.</p>
        )}
        {node.aliases?.length > 0 && <p className="atl__aliases" data-atlas-aliases="">Also called: {node.aliases.join(", ")}</p>}
      </header>

      {(node.definition || !rb) && (
        <section className="atl__section" data-atlas-definition="">
          {node.definition
            ? <p className="atl__def">{node.definition}</p>
            : <p className="atl__quiet">{BRAND}'s own definition has not been written yet.</p>}
        </section>
      )}

      <div className="atl-card__facts" data-atlas-board="">
        {headline
          ? <p className="atl-card__fact atl__big"><b>{headline.value}</b> {headline.words}</p>
          : <NoteCard id={`node-${node.slug}`} title="Numbers arrive tonight">Every night draft counts the open jobs for this page: how many, what they pay, what they ask for.</NoteCard>}
        {node.you && (
          <div className="atl__you atl-card__fact" data-atlas-you={node.you.status}>
            <span className={`mark ${YOU_MARK[node.you.status] || "mark--dim"}`}>{YOU_LABEL[node.you.status] || node.you.status}</span>
            {node.you.have?.length > 0 && <span className="atl__quiet"> Have: {node.you.have.map(h => h.name).join(", ")}.</span>}
            {node.you.missing?.length > 0 && (
              <span className="atl__quiet"> Missing: {node.you.missing.map((m, i) => (
                <span key={m.slug}>{i ? ", " : ""}<Link to={href(m.slug)} className="atl__link">{m.name}</Link></span>))}.</span>
            )}
          </div>
        )}
      </div>
      {node.fewOpenPostings && <p className="atl__quiet" data-atlas-few="">{FEW_POSTINGS_LINE}</p>}

      {(node.learn || canProve) && (
        <div className="atl-card__acts" data-atlas-card-actions="">
          {/* The one depth box (A93): DepthButton, navigating in the app; data-href names where each goes. */}
          {learnHref && <span data-atlas-learn-it="" data-href={learnHref}><DepthButton primary onClick={() => navigate(learnHref)}>Learn it</DepthButton></span>}
          {canProve && <span data-atlas-prove-it="" data-href={proveHref}><DepthButton onClick={() => navigate(proveHref)}>Prove it · 1 min</DepthButton></span>}
        </div>
      )}

      {panes.length > 0 && (
        <div className="atl-card__panes" role="group" aria-label="Show" data-atlas-panes="">
          {panes.map(p => (
            <DepthButton key={p.id} pressed={pane === p.id} onClick={() => setPane(pane === p.id ? null : p.id)}>
              <span data-atlas-pane-btn={p.id}>{p.label}</span>
            </DepthButton>
          ))}
        </div>
      )}
      {panes.map(p => (
        <section key={p.id} className="atl__section atl-card__pane" data-atlas-pane={p.id} hidden={pane !== p.id} aria-label={p.label}
          data-atlas-related={p.id === "related" ? "" : undefined} data-atlas-resources={p.id === "resources" ? "" : undefined}
          data-atlas-sponsors={p.id === "sponsors" ? "" : undefined} data-atlas-role-pane={p.id === "board" ? "" : undefined}>
          {body[p.id]}
        </section>
      ))}
    </article>
  );
}

export default function AtlasPage({ base = "/atlas", publicChrome = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const slug = decodeURIComponent(location.pathname.slice(base.length).replace(/^\/+|\/+$/g, "")) || null;
  const q = new URLSearchParams(location.search).get("q") || "";
  const [page, setPage] = useState({ status: "idle", node: null });

  useEffect(() => {
    let live = true;
    // ⭐ D167: a panel's address (/atlas/<panel>) is never a node — "learn" and "check" were the first reserved slugs.
    if (!slug || slug === "learn" || slug === "check" || isPanelSlug(slug) || slug.startsWith("family/") || slug.startsWith("bar/") || courseIdOf(slug)) { setPage({ status: "idle", node: null }); return undefined; }
    setPage({ status: "loading", node: null });
    loadNode(slug).then(n => live && setPage({ status: n ? "done" : "missing", node: n }))
      .catch(e => live && setPage({ status: "error", node: null, error: e.message }));
    return () => { live = false; };
  }, [slug]);

  useEffect(() => {
    const name = slug === "learn" ? "Learn" : isPanelSlug(slug) ? PANEL_LABEL[panelFor(slug)] : page.node?.name;
    document.title = name ? `${name} · Atlas · ${BRAND}` : `Atlas · ${BRAND}`;
  }, [page.node, slug]);

  // ⭐ D115: /atlas/learn is the owner's learning path, not a node (the slug "learn" is reserved for it).
  const learning = slug === "learn";
  // ⭐ D142: /atlas/check is the readiness check (the slug "check" is reserved, like "learn").
  const checking = slug === "check";
  // ⭐ D116 M7: /atlas/family/<key> is a family's page (a node slug never holds a "/").
  const familyKey = slug && slug.startsWith("family/") ? slug.slice("family/".length) : null;
  // ⭐ D172 (2): /atlas/library/<course> is a course's page (a node slug never holds a "/").
  const courseId = courseIdOf(slug);
  const wide = !slug || !!familyKey;
  // ⭐ D167 (owner APPROVED 11-06) · ATLAS IS A PRODUCT WITH ITS OWN NAVIGATION: a card of panels (components/PlaceNav.jsx,
  // the one implementation Profile and Interview use — A136) beside the
  // panel it opens. Every address lights the panel it belongs to (atlasPanels.js panelFor); the older addresses keep
  // working — a node page and a search open in Roles and skills, a family in Your map, /learn in Learn, /check in Your
  // skills. docs/D167_ATLAS_MAP.md maps every surface that existed to its panel.
  const signedIn = base.startsWith("/app");
  // ⭐ A154 / D172 (4) (45s): Compete shows only the panels whose switch the owner turned on (GET /api/atlas/compete).
  const [compete, setCompete] = useState(null);
  useEffect(() => {
    let live = true;
    if (!signedIn) return undefined;
    api("/api/atlas/compete").then(r => live && setCompete(r)).catch(() => live && setCompete(null));
    return () => { live = false; };
  }, [signedIn]);
  // ⭐ A154: /atlas/bar/<code> is a shared Beat-the-bar score (a node slug never holds a "/").
  const barCode = slug && slug.startsWith("bar/") ? slug.slice("bar/".length) : null;
  // ⭐ 46u (owner 11-17): signed in, Atlas opens on Your map (D178 opened Your run; Overview is the signed-out front page).
  const panel = panelFor(slug, q) === "overview" && signedIn ? "your-map" : panelFor(slug, q);
  const panelOnly = !slug ? !q : (isPanelSlug(slug) && !learning && !checking);
  const body = (
    <main className={`atl atl--panels${wide ? " atl--wide" : ""}`} data-atlas-page={learning ? "learn" : checking ? "check" : familyKey ? "family" : courseId ? "course" : panelOnly ? "panel" : slug ? "node" : "search"}
      data-atlas-panel={panel}>
     <PlaceNav place="atlas" name="Atlas" eyebrow="Your way through the market" title="Atlas" fill panelId="atlas-panel"
       groups={navGroups(compete).map(g => ({ label: g.group, items: g.panels }))} current={panel} hrefFor={(id) => panelHref(base, id)}>
      {/* ⭐ D120 P2 · THE HOME IS YOUR MAP (owner 10-31: "very text rich with no direction"): signed in, the direction
          line, the tree, the course and the five sections, with the families in a side column; signed out (or no
          résumé), Learn (the full circle). ⭐ D167: it is the Your map panel now; search, Explore by role and the recent
          pages are Roles and skills', the navigator is Your route's. A query is the search page as before. */}
      {!slug && q && <AtlasSearch base={base} q={q} />}
      {panelOnly && panel === "overview" && <OverviewPanel base={base} />}
      {/* ⭐ D178: Learn's address → the course's circle view, the same piece selected (#step-<id> carried). */}
      {learning && <Navigate replace to={`${base}/library/silicon-to-software?view=circle${location.hash || ""}`} />}
      {panel === "your-map" && !familyKey && (
        <div className="atl-pan" data-atlas-panel-body="your-map">
          {/* ⭐ A228 (46r, owner 11-16 "Build it"): Your map IS the skill map — the jobs you can apply for today, how close
              you are to the rest, what the role's jobs want, Learn next and the jobs you could move to (SkillMap.jsx).
              It retires the market tree (the five sections, the families list), Your skills' ring map, For a role and
              Compare roles. */}
          {/* ⭐ D200 (a) (47h): the page IS Your survey (its own head, SkillMap.jsx); D172 (4) / D178's track board and
              the route (D143's navigator) stay, inside its 05 "Your route, step by step" (routeMore). */}
          <SkillMap base={base} signedIn={signedIn} routeMore={signedIn && (
            <details className="atl-more skm-route-more" data-atlas-route-more="">
              <summary className="atl__link">Fly my route · the track board and the navigator</summary>
              <TrackBoard base={base} signedIn={signedIn} />
              <section className="atl__section" data-atlas-route-in-map=""><YourRoutePanel base={base} signedIn={signedIn} /></section>
            </details>
          )} />
        </div>
      )}
      {panel === "your-skills" && <YourSkillsSlot signedIn={signedIn} base={base} />}
      {panel === "todays-question" && <TodaysQuestionPanel base={base} />}
      {panel === "how-it-works" && <HowItWorksPanel base={base} />}
      {panel === "the-audit" && <AuditPanel base={base} />}
      {panel === "roles-and-skills" && panelOnly && (
        <RolesPanel base={base} search={<section className="atl__section" data-atlas-home-search=""><h2 className="atl__h2">Search the Atlas</h2><SearchBox base={base} /></section>} />
      )}
      {panel === "this-weeks-market" && <MarketPanel base={base} />}
      {panel === "glossary" && <GlossaryPanel base={base} />}
      {familyKey && <FamilyMap base={base} familyKey={familyKey} />}
      {panel === "your-run" && <YourRun base={base} signedIn={signedIn} />}
      {/* ⭐ A154 / D172 (4): Compete — drawn only with its switch on; off, the address says so (the server 404s too). */}
      {panel === "league" && (compete?.league ? <LeaguePanel base={base} /> : <p className="atl__quiet" role="status" data-compete-off="league">{compete ? "This isn't available yet." : signedIn ? "Opening…" : "Sign in to see this week's league."}</p>)}
      {panel === "challenges" && (compete?.challenges ? <ChallengesPanel base={base} /> : <p className="atl__quiet" role="status" data-compete-off="challenges">{compete ? "This isn't available yet." : signedIn ? "Opening…" : "Sign in to see the challenges."}</p>)}
      {barCode && <SharedBar base={base} code={barCode} />}
      {panel === "library" && panelOnly && <LibraryShelf base={base} signedIn={signedIn} />}
      {/* ⭐ D172 (2b): /atlas/library/<id> is a course, a guide (a level) or a deck. */}
      {courseId && (COURSES.some(c => c.id === courseId)
        ? (courseKind(courseId) === "patterns" ? <PatternCoursePage base={base} id={courseId} /> : <CoursePage base={base} id={courseId} signedIn={signedIn} />)
        : <LibraryItem base={base} id={courseId} />)}
      {slug && !learning && !checking && !familyKey && !courseId && !barCode && !panelOnly && (
        <>
          <SearchBox base={base} />
          {page.status === "loading" && <p className="atl__quiet" role="status">Opening…</p>}
          {page.status === "error" && <p className="atl__quiet" role="alert">The Atlas could not be reached: {page.error}</p>}
          {page.status === "missing" && (
            <p className="atl__quiet" role="status" data-atlas-missing="">There's no Atlas page by that name. <Link to={base} className="atl__link">Search the Atlas</Link></p>
          )}
          {page.status === "done" && page.node && (
            <AtlasNodeView base={base} node={page.node} signedIn={signedIn} from={location.state?.from ? { q: location.state.from, via: location.state.via } : null}
              onWalk={(s) => navigate(`${base}/${encodeURIComponent(s)}`)} />
          )}
        </>
      )}
     </PlaceNav>
    </main>
  );
  if (!publicChrome) return body;
  return (
    <div className="scroll-dock-page atl-page">
      <ScrollDock variant="marketing" />
      {body}
      <Footer />
    </div>
  );
}
