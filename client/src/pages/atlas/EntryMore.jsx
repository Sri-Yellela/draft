// ⭐ 47m (D200 Rule 1 — nothing lost) · AN ENTRY'S "MORE ABOUT IT" — what the old node page (AtlasPage's AtlasNodeView,
// replaced by the Gazetteer entry, D201) showed on demand and the entry's own sections don't carry: for a ROLE, the board's
// own data (D105 P12: the skills its jobs ask for with their shares, its levels read from the jobs (D106), the pay range, the
// companies hiring), its map (D116 M7 RoleMap), "to reach the next level", every sponsor with its signal (D108 P3); for a
// skill or tool, the roles that ask for it and its pay; for every entry the typed related lists, the "few open postings"
// line (D105 P7). One pane open at a time, all closed until pressed (the D172 one-card rule), drawn in the Gazetteer's card.
import { useEffect, useState } from "react";
import { GzCard, GoLink } from "../../plate/Gazetteer.jsx";
import { RoleMap } from "./YourMap.jsx";
import { SponsorshipChip } from "../../components/SponsorshipSignal.jsx";
import { roleBoardParts, shareText, LEVEL_READ_LABEL, stepTitle, stepEmptyLine, relatedGroups, FEW_POSTINGS_LINE, computedLine, payLine } from "./atlasModel.js";

const LABEL = { board: "On the board", map: "Its map", next: "To reach the next level", sponsors: "Sponsors who hire it", roles: "Roles that ask for it", pay: "Pay", related: "Related" };

/** Which panes this entry has (the old nodePanes, minus what the entry draws itself: resources, Wikipedia). */
export function entryMorePanes(node = {}) {
  const stats = node.onTheBoard || null;
  const rb = node.kind === "role" ? node.roleBoard || null : null;
  const out = [];
  const add = (id, ok) => { if (ok) out.push(id); };
  if (node.kind === "role") {
    add("board", !!rb || !!stats);
    add("map", true);
    add("next", !!(rb && roleBoardParts(rb).nextLevel));
    add("sponsors", (node.sponsors?.length ?? 0) > 0);
  } else {
    add("roles", (stats?.topRoles?.length ?? 0) > 0);
    add("pay", !!payLine(stats?.pay));
  }
  add("related", relatedGroups(node.related).length > 0);
  return out;
}

function Links({ base, items, onGo }) {
  return (
    <ul className="pl-gz-more__list">
      {items.map((i) => <li key={i.slug}><GoLink href={`${base}/${encodeURIComponent(i.slug)}`} onGo={onGo}>{i.name}</GoLink>
        {i.postings != null ? <span className="pl-gz-more__n"> · {i.postings}</span> : null}</li>)}
    </ul>
  );
}

function RoleBoard({ base, rb, onGo }) {
  const parts = roleBoardParts(rb);
  const pay = payLine(rb.pay);
  return (
    <div className="pl-gz-more__cols" data-atlas-role-board="">
      {parts.skills ? <div data-role-skills=""><h3 className="pl-gz-more__h">SKILLS ITS JOBS ASK FOR</h3>
        <ul className="pl-gz-more__list">{rb.topSkills.map((s) => <li key={s.slug}><GoLink href={`${base}/${encodeURIComponent(s.slug)}`} onGo={onGo}>{s.name}</GoLink>
          <span className="pl-gz-more__n" data-share={s.share}> · {shareText(s.share)}</span></li>)}</ul></div> : null}
      {parts.levels ? <div data-role-levels=""><h3 className="pl-gz-more__h">LEVELS ITS JOBS ASK FOR</h3>
        <ul className="pl-gz-more__list">{rb.levels.read.filter((l) => l.postings > 0).map((l) => <li key={l.level} data-level={l.level}>{LEVEL_READ_LABEL[l.level] || l.level}
          <span className="pl-gz-more__n"> · {l.postings} job{l.postings === 1 ? "" : "s"} · {l.share} %</span></li>)}</ul>
        {rb.levels.unread > 0 ? <p className="pl-gz-foot">{rb.levels.unread} more say nothing that reads as a level.</p> : null}</div> : null}
      {parts.pay && pay ? <div data-role-pay=""><h3 className="pl-gz-more__h">PAY RANGE</h3>
        <p className="pl-gz-empty" data-atlas-pay="">{pay} · from {rb.pay.n} job{rb.pay.n === 1 ? "" : "s"} that state pay</p></div> : null}
      {parts.companies ? <div data-role-companies=""><h3 className="pl-gz-more__h">COMPANIES HIRING</h3>
        <ul className="pl-gz-more__list">{rb.companies.items.map((c) => <li key={c.company}>{c.company}<span className="pl-gz-more__n"> · {c.postings}</span></li>)}</ul>
        {rb.companies.total > rb.companies.items.length ? <p className="pl-gz-foot">and {rb.companies.total - rb.companies.items.length} more</p> : null}</div> : null}
    </div>
  );
}

function NextLevel({ base, steps, onGo }) {
  return (
    <div data-atlas-next-level="">
      <div className="pl-gz-more__cols">
        {steps.map((step) => (
          <div key={`${step.from}-${step.to}`} data-next-step={`${step.from}-${step.to}`}>
            <h3 className="pl-gz-more__h">{stepTitle(step)}</h3>
            {step.items.length === 0 ? <p className="pl-gz-empty">{stepEmptyLine(step)}</p> : (
              <ul className="pl-gz-more__list">{step.items.map((i) => <li key={i.slug}><GoLink href={`${base}/${encodeURIComponent(i.slug)}`} onGo={onGo}>{i.name}</GoLink>
                <div className="pl-gz-foot">{i.line}</div></li>)}</ul>
            )}
          </div>
        ))}
      </div>
      <p className="pl-gz-foot">Skills asked for more as the level goes up, read from the jobs themselves.</p>
    </div>
  );
}

function Sponsors({ sponsors }) {
  const src = sponsors[0].source || {};
  return (
    <>
      <ul className="pl-gz-more__list">
        {sponsors.map((s) => (
          <li key={s.company} data-atlas-sponsor-level={s.level || undefined}>
            <b>{s.company}</b>{s.signal ? <> <SponsorshipChip signal={s.signal} needed/></> : null} · {s.titleLine || s.text} · {s.postings} open job{s.postings === 1 ? "" : "s"}
          </li>
        ))}
      </ul>
      <p className="pl-gz-foot">Companies with open postings for this role and certified LCAs on record ·{" "}
        {src.url ? <a href={src.url} target="_blank" rel="noopener noreferrer">{src.name}</a> : src.name}{src.through ? `, through ${src.through}` : ""}. A record of filings, not a promise about any posting.</p>
    </>
  );
}

/** The entry's "More about it": `node` = the Atlas node the entry reads (loadNode). Renders nothing when it has nothing more. */
export default function EntryMore({ base, node, onGo }) {
  const panes = entryMorePanes(node || {});
  const [open, setOpen] = useState(null);
  useEffect(() => { setOpen(null); }, [node?.slug]);
  if (!node) return null;
  const stats = node.onTheBoard || null;
  const rb = node.kind === "role" ? node.roleBoard || null : null;
  const groups = relatedGroups(node.related);
  const pay = payLine(stats?.pay);
  const body = {
    board: <>{rb ? <RoleBoard base={base} rb={rb} onGo={onGo}/> : null}{stats ? <p className="pl-gz-foot" data-atlas-computed="">{computedLine(stats)}</p> : null}</>,
    map: <RoleMap base={base} slug={node.slug}/>,
    next: rb && roleBoardParts(rb).nextLevel ? <NextLevel base={base} steps={rb.nextLevel} onGo={onGo}/> : null,
    sponsors: node.sponsors?.length ? <Sponsors sponsors={node.sponsors}/> : null,
    roles: stats?.topRoles?.length ? <><Links base={base} items={stats.topRoles} onGo={onGo}/><p className="pl-gz-foot" data-atlas-computed="">{computedLine(stats)}</p></> : null,
    pay: pay ? <p className="pl-gz-empty" data-atlas-pay="">{pay} · from {stats.pay.n} job{stats.pay.n === 1 ? "" : "s"} that state pay</p> : null,
    related: <div className="pl-gz-more__cols">{groups.map((g) => <div key={g.title} data-edge-group={g.type}><h3 className="pl-gz-more__h">{String(g.title).toUpperCase()}</h3><Links base={base} items={g.items} onGo={onGo}/></div>)}</div>,
  };
  if (!panes.length && !node.fewOpenPostings) return null;
  return (
    <GzCard title="MORE ABOUT IT · FROM THE BOARD" right={node.fewOpenPostings ? "FEW OPEN POSTINGS" : null} id="entry-more" data-atlas-more="">
      {node.fewOpenPostings ? <p className="pl-gz-foot" data-atlas-few="">{FEW_POSTINGS_LINE}</p> : null}
      {panes.length ? (
        <div className="pl-gz-more__panes" role="group" aria-label="Show" data-atlas-panes="">
          {panes.map((id) => <button key={id} type="button" className="pl-btn" aria-pressed={open === id} data-atlas-pane-btn={id} onClick={() => setOpen(open === id ? null : id)}>{LABEL[id]}</button>)}
        </div>
      ) : null}
      {panes.map((id) => (
        <section key={id} className="pl-gz-more__pane" data-atlas-pane={id} hidden={open !== id} aria-label={LABEL[id]}
          data-atlas-related={id === "related" ? "" : undefined} data-atlas-sponsors={id === "sponsors" ? "" : undefined} data-atlas-role-pane={id === "board" ? "" : undefined}>
          {open === id ? body[id] : null}
        </section>
      ))}
    </GzCard>
  );
}
