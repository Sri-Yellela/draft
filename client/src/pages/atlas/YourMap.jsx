// ⭐ D116 · the Atlas tree's page wrappers and the readers of GET /api/atlas/me that outlive YOUR MAP's old home.
// ⭐ A228 (46r, owner 11-16 "Build it"): Your map is the skill map now (SkillMap.jsx). The market tree it replaces — the
// home drawn from /api/atlas/me (AtlasHome / ExploreHome), the five sections (mapSections), the families list and
// Your course on it — is retired. What stays: the same tree on a role page (RoleMap) and a family page (FamilyMap),
// Explore by role and Recently published (Roles and skills), the direction line (Overview) and useAtlasMe.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import AtlasTree from "./AtlasTree.jsx";

/** ⭐ D120 P2 · the side column's Explore by role — the board's biggest roles, each opening its role page. */
export function ExploreByRole({ roles = [], base }) {
  if (!roles.length) return null;
  return (
    <section className="atl__section" data-atlas-explore="" aria-labelledby="atl-explore">
      <h2 className="atl__h2" id="atl-explore">Explore by role</h2>
      <ul className="atl__links">
        {roles.map(r => (
          <li key={r.slug}><Link to={`${base}/${encodeURIComponent(r.slug)}`} className="atl__link">{r.name}</Link>
            <span className="atl__count"> · {r.postings} jobs{r.topSkills.length ? ` · ${r.topSkills.map(s => s.name).join(", ")}` : ""}</span></li>
        ))}
      </ul>
    </section>
  );
}

/** ⭐ D120 P2 · the pages published most recently. */
export function Recent({ items = [], base }) {
  if (!items.length) return null;
  return (
    <section className="atl__section" data-atlas-home-recent="" aria-labelledby="atl-recent">
      <h2 className="atl__h2" id="atl-recent">New in the Atlas</h2>
      <ul className="atl__links">
        {items.map(n => <li key={n.slug}><Link to={`${base}/${encodeURIComponent(n.slug)}`} className="atl__link">{n.name}</Link></li>)}
      </ul>
    </section>
  );
}

/**
 * ⭐ D120 P2 · the ONE line of direction, first on the home — "Next up: Model serving · 81 % close · start with Running
 * models (Part 8)" — from the tree's own Next up (M5) and its course step. Pure: the page's test reads it.
 */
export function directionLine(tree) {
  const n = (tree?.nodes || []).find(x => x.slug === tree?.nextUp);
  if (!n) return null;
  const part = n.courseStep?.label ? n.courseStep.label.split(" · ")[0] : null;
  const start = n.courseStep ? ` · start with ${n.courseStep.title}${part ? ` (${part})` : ""}` : "";
  return { slug: n.slug, stepId: n.courseStep?.stepId || null, text: `Next up: ${n.name} · ${n.closeness ?? 0} % close${start}` };
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
        <p className="atl__lede">{t.centre.postings} open jobs ask for a {t.centre.name} skill.{t.signedIn ? " Coloured squares are yours." : ""}</p>
      </header>
      {t.nodes.length ? <AtlasTree tree={t} base={base} /> : <p className="atl__quiet" data-atlas-family-empty="">No job asks for a skill in this family yet.</p>}
    </article>
  );
}

/** GET /api/atlas/me, once per mount — Your map, Roles and skills and Overview read the same answer. */
export function useAtlasMe() {
  const [me, setMe] = useState(null);
  useEffect(() => {
    let live = true;
    api("/api/atlas/me").then(r => live && setMe(r)).catch(() => live && setMe(false));
    return () => { live = false; };
  }, []);
  return me;
}
