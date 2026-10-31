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
import { Link, useLocation, useNavigate } from "react-router-dom";
import ScrollDock from "../../components/ScrollDock.jsx";
import { Footer } from "../../components/Footer.jsx";
import DepthButton from "../../components/DepthButton.jsx";
import { BRAND } from "../../../../shared/brand.js";
import AtlasGraph from "./AtlasGraph.jsx";
import LearnView from "./LearnView.jsx";
import YourMap, { RoleMap, FamilyMap } from "./YourMap.jsx";
import {
  KIND_LABEL, relatedGroups, resolveSearch, loadNode, payLine, computedLine, orderedResources, resourceMeta, FEW_POSTINGS_LINE,
  WIKI_LICENCE, YOU_LABEL, YOU_MARK, LEVEL_READ_LABEL, shareText, stepTitle, stepEmptyLine, roleBoardParts,
} from "./atlasModel.js";
import "./AtlasPage.css";

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
        <p className="atl__lede">Look one up to see what it is, what the board asks for alongside it, how it links to the rest, and where to learn it.</p>
      </header>
      <SearchBox base={base} initial={q} />
      {state.status === "loading" && <p className="atl__quiet" role="status">Looking up “{q}”…</p>}
      {state.status === "error" && <p className="atl__quiet" role="alert">The Atlas could not be reached: {state.error}</p>}
      {state.status === "done" && (state.results.length === 0
        ? <p className="atl__quiet" role="status" data-atlas-none="">No published page matches “{q}” yet.</p>
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
          <h3 className="atl__h3">Skills its postings ask for</h3>
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
          <h3 className="atl__h3">Levels the postings ask for</h3>
          <ul className="atl__links">
            {rb.levels.read.filter(l => l.postings > 0).map(l => (
              <li key={l.level} data-level={l.level}>{LEVEL_READ_LABEL[l.level] || l.level}
                <span className="atl__count"> · {l.postings} posting{l.postings === 1 ? "" : "s"} · {l.share} %</span></li>
            ))}
          </ul>
          {rb.levels.unread > 0 && <p className="atl__quiet">{rb.levels.unread} more say nothing that reads as a level.</p>}
        </div>
      )}
      {parts.pay && payText && (
        <div data-role-pay=""><h3 className="atl__h3">Pay range</h3>
          <p className="atl__pay" data-atlas-pay="">{payText}<br /><span className="atl__quiet">from {rb.pay.n} posting{rb.pay.n === 1 ? "" : "s"} that state pay</span></p></div>
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
      <p className="atl__quiet">Skills whose share of this role's postings rises from one level to the next, read from the postings' own asks.</p>
    </section>
  );
}

/** /atlas/:slug — one page. */
export function AtlasNodeView({ base, node, from, onWalk }) {
  const stats = node.onTheBoard;
  const groups = relatedGroups(node.related);
  const resources = orderedResources(node.resources || []);
  const pay = payLine(stats?.pay);
  const href = (slug) => `${base}/${encodeURIComponent(slug)}`;
  // ⭐ D105 P12: a role's page is the board's own data; its definition, when one exists, stays on top.
  const rb = node.kind === "role" ? node.roleBoard || null : null;
  return (
    <article className="atl__node" data-atlas-node={node.slug}>
      <header className="atl__head">
        <p className="atl__kicker"><Link to={base} className="atl__link">The Atlas</Link> · <span className="mark mark--accent">{KIND_LABEL[node.kind] || node.kind}</span></p>
        <h1 className="atl__title">{node.name}</h1>
        {from?.via === "alias" && (
          <p className="atl__quiet" data-atlas-from="">“{from.q}” is another name for {node.name}.</p>
        )}
        {node.aliases?.length > 0 && <p className="atl__aliases" data-atlas-aliases="">Also called: {node.aliases.join(", ")}</p>}
        {node.you && (
          <div className="atl__you" data-atlas-you={node.you.status}>
            <span className={`mark ${YOU_MARK[node.you.status] || "mark--dim"}`}>{YOU_LABEL[node.you.status] || node.you.status}</span>
            {node.you.have?.length > 0 && <span className="atl__quiet"> Have: {node.you.have.map(h => h.name).join(", ")}.</span>}
            {node.you.missing?.length > 0 && (
              <span className="atl__quiet"> Missing: {node.you.missing.map((m, i) => (
                <span key={m.slug}>{i ? ", " : ""}<Link to={href(m.slug)} className="atl__link">{m.name}</Link></span>))}.</span>
            )}
          </div>
        )}
      </header>

      {(node.definition || !rb) && (
        <section className="atl__section" data-atlas-definition="">
          {node.definition
            ? <p className="atl__def">{node.definition}</p>
            : <p className="atl__quiet">{BRAND}'s own definition has not been written yet.</p>}
        </section>
      )}

      <section className="atl__section" data-atlas-board="" aria-labelledby="atl-board">
        <h2 className="atl__h2" id="atl-board">On the board</h2>
        {!stats ? <p className="atl__quiet">Not computed yet — the numbers come from the board's active postings after the nightly crawl.</p> : (
          <>
            <p className="atl__big"><b>{stats.postings}</b> open posting{stats.postings === 1 ? "" : "s"} {node.kind === "role" ? "for this role" : "ask for it"}</p>
            {rb ? <RoleBoard base={base} rb={rb} payText={payLine(rb.pay)} /> : (
              <div className="atl__cols">
                {stats.topSkills?.length > 0 && <div><h3 className="atl__h3">Seen with it most</h3><LinkList base={base} items={stats.topSkills} /></div>}
                {stats.topRoles?.length > 0 && <div><h3 className="atl__h3">Roles that ask for it</h3><LinkList base={base} items={stats.topRoles} /></div>}
                {pay && <div><h3 className="atl__h3">Pay range</h3><p className="atl__pay" data-atlas-pay="">{pay}<br /><span className="atl__quiet">from {stats.pay.n} posting{stats.pay.n === 1 ? "" : "s"} that state pay</span></p></div>}
              </div>
            )}
            <p className="atl__quiet" data-atlas-computed="">{computedLine(stats)}</p>
          </>
        )}
        {node.fewOpenPostings && <p className="atl__quiet" data-atlas-few="">{FEW_POSTINGS_LINE}</p>}
      </section>

      {/* ⭐ D116 M7 · the same tree as Your map, centred on the role (its top skills; distance = the share asking). */}
      {node.kind === "role" && <RoleMap base={base} slug={node.slug} />}

      {rb && roleBoardParts(rb).nextLevel && <RoleNextLevel base={base} steps={rb.nextLevel} />}

      {node.kind === "role" && node.sponsors?.length > 0 && (
        <section className="atl__section" data-atlas-sponsors="" aria-labelledby="atl-sponsors">
          <h2 className="atl__h2" id="atl-sponsors">Sponsors who hire this role</h2>
          <ul className="atl__links">
            {node.sponsors.map(s => (
              <li key={s.company}>
                <b>{s.company}</b> · {s.text} · {s.postings} open posting{s.postings === 1 ? "" : "s"}
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
        </section>
      )}

      {groups.length > 0 && (
        <section className="atl__section" data-atlas-related="" aria-labelledby="atl-related">
          <h2 className="atl__h2" id="atl-related">Related</h2>
          <div className="atl__related">
            <div className="atl__cols">
              {groups.map(g => <div key={g.title} data-edge-group={g.type}><h3 className="atl__h3">{g.title}</h3><LinkList base={base} items={g.items} /></div>)}
            </div>
            <AtlasGraph node={node} hrefFor={href} onWalk={onWalk} />
          </div>
        </section>
      )}

      {(resources.length > 0 || node.learn) && (
        <section className="atl__section" data-atlas-resources="" aria-labelledby="atl-res">
          <h2 className="atl__h2" id="atl-res">Resources</h2>
          <ul className="atl__res">
            {/* ⭐ D115 P4(b): the step of the owner's learning path that teaches it — first, above Wikidata's links. */}
            {node.learn && (
              <li data-atlas-learn={node.learn.stepId}>
                <Link to={`${base}/learn#step-${encodeURIComponent(node.learn.stepId)}`} className="atl__link atl__res-learn">Learn it: {node.learn.label}</Link>
                <div className="atl__quiet">{node.learn.title} · From silicon to software</div>
              </li>
            )}
            {resources.map(r => (
              <li key={r.url} data-resource-cost={r.cost || ""}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="atl__link">{r.title}</a>
                {r.cost === "free" && <> <span className="mark mark--ok">Free</span></>}
                <div className="atl__quiet">{resourceMeta(r).join(" · ")}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <WikipediaBlock wiki={node.wikipedia} />
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
    if (!slug || slug === "learn" || slug.startsWith("family/")) { setPage({ status: "idle", node: null }); return undefined; }
    setPage({ status: "loading", node: null });
    loadNode(slug).then(n => live && setPage({ status: n ? "done" : "missing", node: n }))
      .catch(e => live && setPage({ status: "error", node: null, error: e.message }));
    return () => { live = false; };
  }, [slug]);

  useEffect(() => {
    const name = slug === "learn" ? "Learn" : page.node?.name;
    document.title = name ? `${name} · Atlas · ${BRAND}` : `Atlas · ${BRAND}`;
  }, [page.node, slug]);

  // ⭐ D115: /atlas/learn is the owner's learning path, not a node (the slug "learn" is reserved for it).
  const learning = slug === "learn";
  // ⭐ D116 M7: /atlas/family/<key> is a family's page (a node slug never holds a "/").
  const familyKey = slug && slug.startsWith("family/") ? slug.slice("family/".length) : null;
  const wide = !slug || !!familyKey;
  const body = (
    <main className={`atl${wide ? " atl--wide" : ""}`} data-atlas-page={learning ? "learn" : familyKey ? "family" : slug ? "node" : "search"}>
      {!slug && <AtlasSearch base={base} q={q} />}
      {!slug && <p className="atl__quiet" data-atlas-learn-link=""><Link to={`${base}/learn`} className="atl__link">Learn — From silicon to software</Link>: a path from a flashlight signal to today's machines, step by step.</p>}
      {/* ⭐ D116 · the home: Your map (signed in, from the résumé) or the signed-out home (Explore by role). */}
      {!slug && !q && <YourMap base={base} />}
      {learning && <LearnView signedIn={base.startsWith("/app")} />}
      {familyKey && <FamilyMap base={base} familyKey={familyKey} />}
      {slug && !learning && !familyKey && (
        <>
          <SearchBox base={base} />
          {page.status === "loading" && <p className="atl__quiet" role="status">Opening…</p>}
          {page.status === "error" && <p className="atl__quiet" role="alert">The Atlas could not be reached: {page.error}</p>}
          {page.status === "missing" && (
            <p className="atl__quiet" role="status" data-atlas-missing="">There is no published Atlas page by that name. <Link to={base} className="atl__link">Search the Atlas</Link></p>
          )}
          {page.status === "done" && page.node && (
            <AtlasNodeView base={base} node={page.node} from={location.state?.from ? { q: location.state.from, via: location.state.via } : null}
              onWalk={(s) => navigate(`${base}/${encodeURIComponent(s)}`)} />
          )}
        </>
      )}
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
