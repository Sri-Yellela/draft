// ⭐ D116 · YOUR MAP — the Atlas home built from the reader's résumé (GET /api/atlas/me). Signed in with skills on the
// Atlas: THE TREE (AtlasTree.jsx) and, below it, the five sections (M6) — To reach senior <role> · Adjacent · Branches
// · Learn next · You have — every chip opening the same node on the tree. Signed out / no résumé (M9): the signed-out
// home — Explore by role (the board's biggest roles, each opening its role page) and "Upload a résumé and this page
// becomes your map." Search and Learn sit above it on the page (AtlasPage.jsx).
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import AtlasTree from "./AtlasTree.jsx";
import { headerLine } from "./atlasTreeModel.js";

/** The five sections' chips, in M6's order. Pure: the page's test reads it. */
export function mapSections(me) {
  const nl = me.nextLevel || { items: [] };
  const role = nl.items[0]?.role?.name || me.targetRoles?.[0]?.name || "";
  return [
    { id: "nextLevel", title: `To reach ${nl.items[0] ? nl.items[0].to.level : "the next level"}${role ? ` ${role}` : ""}`,
      why: "Skills whose share of postings rises most from your level to the next, for your role.",
      chips: nl.items.map(i => ({ slug: i.slug, name: i.name, line: `${i.from.share} % at ${i.from.level} → ${i.to.share} % at ${i.to.level}`, bar: i.to.share })),
      empty: nl.reason === "no_target_role" ? "Set an aim to see what seniority adds." : "Nothing measured rises by enough yet." },
    { id: "adjacent", title: "Adjacent", why: "Asked for alongside what you already have.",
      chips: (me.adjacent?.items || []).map(i => ({ slug: i.slug, name: i.name, line: `${i.line} · ${i.postings} postings` })), empty: "Nothing yet." },
    { id: "branches", title: "Branches", why: "Other roles you already mostly cover.",
      chips: (me.branches?.items || []).map(b => ({ role: b.slug, name: b.name, line: b.line.replace(/^You cover /, ""), bar: Math.round(b.coverage * 100) })), empty: "No other role is close enough yet." },
    { id: "learnNext", title: "Learn next", why: "Course steps that close your biggest gaps. Start at any of them.",
      chips: (me.learnNext?.items || []).map(s => ({ step: s.stepId, name: s.title, line: `Enter the course here${s.progress ? ` · ${s.progress.done} of ${s.progress.total}` : ""}` })), empty: "No step teaches these gaps yet." },
    { id: "haveSkills", title: "You have", why: "From your résumé, with how many open postings ask for each.",
      chips: (me.haveSkills?.groups || []).flatMap(g => g.items).map(i => ({ slug: i.slug, name: i.name, line: `${i.postings} postings` })), empty: "" },
  ];
}

function Sections({ me, base, onOpen }) {
  const famOf = new Map((me.tree?.nodes || []).map(n => [n.slug, n]));
  const sq = (slug, fallback = "off") => {
    const n = famOf.get(slug);
    return <span className={`atree__fsq ${n && (n.have || n.learned) ? `atree__sq--${n.family}` : `atree__sq--${fallback}`} atree__fsq--${n?.ring || "none"}`} aria-hidden="true">{(n?.name || " ").charAt(0)}</span>;
  };
  return mapSections(me).map(sec => (
    <section key={sec.id} className="atree-sec" data-map-section={sec.id} aria-labelledby={`map-${sec.id}`}>
      <h2 id={`map-${sec.id}`}>{sec.title}</h2>
      <p className="atree-sec__why">{sec.why}</p>
      {sec.chips.length === 0 ? <p className="atree-sec__why">{sec.empty}</p> : (
        <div className="atree-sec__row">
          {sec.chips.map(c => {
            const body = (<span><span className="atree-chip__t">{c.name}</span><span className="atree-chip__s">{c.line}</span>
              {c.bar != null && <span className={`atree-chip__bar${c.role ? " atree-chip__bar--branch" : ""}`}><i style={{ width: `${c.bar}%` }} /></span>}</span>);
            if (c.role) return <Link key={c.role} className="dbx-depth atree-chip" to={`${base}/${encodeURIComponent(c.role)}`} data-map-chip={c.role}><span className="atree__fsq atree__sq--systems" aria-hidden="true">{c.name.charAt(0)}</span>{body}</Link>;
            if (c.step) return <Link key={c.step} className="dbx-depth atree-chip" to={`${base}/learn#step-${encodeURIComponent(c.step)}`} data-map-chip={c.step}><span className="atree__fsq atree__sq--data" aria-hidden="true">▸</span>{body}</Link>;
            return <button key={c.slug} type="button" className="dbx-depth atree-chip" data-map-chip={c.slug} onClick={() => onOpen(c.slug)}>{sq(c.slug)}{body}</button>;
          })}
        </div>
      )}
    </section>
  ));
}

/** The signed-out (or no résumé) home: Explore by role, and the one line that says what a résumé would do. */
export function ExploreHome({ me, base }) {
  const roles = me.exploreByRole?.items || [];
  return (
    <section className="atl__section" data-atlas-explore="" aria-labelledby="atl-explore">
      <p className="atl__lede" data-atlas-upload="">{me.prompt}</p>
      {roles.length > 0 && (<>
        <h2 className="atl__h2" id="atl-explore">Explore by role</h2>
        <ul className="atl__links">
          {roles.map(r => (
            <li key={r.slug}><Link to={`${base}/${encodeURIComponent(r.slug)}`} className="atl__link">{r.name}</Link>
              <span className="atl__count"> · {r.postings} postings{r.topSkills.length ? ` · ${r.topSkills.map(s => s.name).join(", ")}` : ""}</span></li>
          ))}
        </ul>
      </>)}
    </section>
  );
}

/** ⭐ M7 · the same tree on a role page: centre = the role, its top skills; signed in, the reader's own colours. */
export function RoleMap({ base, slug }) {
  const [tree, setTree] = useState(null);
  useEffect(() => {
    let live = true;
    api(`/api/atlas/tree/role/${encodeURIComponent(slug)}`).then(t => live && setTree(t)).catch(() => live && setTree(null));
    return () => { live = false; };
  }, [slug]);
  if (!tree || !tree.nodes.length) return null;
  return (
    <section className="atl__section atree-map" data-atlas-role-map={slug} aria-labelledby="atl-role-map">
      <h2 className="atl__h2" id="atl-role-map">The role as a tree</h2>
      <AtlasTree tree={tree} base={base} />
    </section>
  );
}

/** ⭐ M7 · /atlas/family/:key — a family's page: centre = the family, the full circle. */
export function FamilyMap({ base, familyKey }) {
  const [state, setState] = useState({ status: "loading", tree: null });
  useEffect(() => {
    let live = true;
    setState({ status: "loading", tree: null });
    api(`/api/atlas/tree/family/${encodeURIComponent(familyKey)}`).then(t => live && setState({ status: "done", tree: t }))
      .catch(() => live && setState({ status: "missing", tree: null }));
    return () => { live = false; };
  }, [familyKey]);
  if (state.status === "loading") return <p className="atl__quiet" role="status">Opening…</p>;
  if (!state.tree) return <p className="atl__quiet" role="status" data-atlas-missing="">There is no family by that name. <Link to={base} className="atl__link">The Atlas</Link></p>;
  const t = state.tree;
  return (
    <article className="atree-map" data-atlas-family={familyKey}>
      <header className="atl__head">
        <p className="atl__kicker"><Link to={base} className="atl__link">The Atlas</Link> · <span className="mark mark--accent">Family</span></p>
        <h1 className="atl__title">{t.centre.name}</h1>
        <p className="atl__lede">{t.centre.postings} open postings ask for at least one {t.centre.name} skill. The tree shows what the family is made of{t.signedIn ? "; coloured squares are yours" : ""}.</p>
      </header>
      {t.nodes.length ? <AtlasTree tree={t} base={base} /> : <p className="atl__quiet" data-atlas-family-empty="">No published skill in this family is asked for by an open posting yet.</p>}
    </article>
  );
}

export default function YourMap({ base }) {
  const [me, setMe] = useState(null);
  const [request, setRequest] = useState(null);
  const top = useRef(null);
  useEffect(() => {
    let live = true;
    api("/api/atlas/me").then(r => live && setMe(r)).catch(() => live && setMe(null));
    return () => { live = false; };
  }, []);
  if (!me) return null;
  if (!me.map || !me.tree) return <ExploreHome me={me} base={base} />;
  const open = (slug) => { setRequest(r => ({ slug, n: (r?.n || 0) + 1 })); top.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }); };
  return (
    <div className="atree-map" data-your-map="" ref={top}>
      <header className="atl__head">
        <h2 className="atl__title">Your map</h2>
        <p className="atl__lede" data-map-header="">{headerLine(me.tree)}</p>
        {me.nudge && <p className="atl__quiet" data-map-nudge="">Drawn from your résumé's skills. <Link to="/app/profile" className="atl__link">{me.nudge}</Link>.</p>}
      </header>
      <AtlasTree tree={me.tree} base={base} request={request} />
      <Sections me={me} base={base} onOpen={open} />
    </div>
  );
}
