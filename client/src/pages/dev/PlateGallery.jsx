// ⭐ D196 F4 · /dev/plate — the plate system's gallery (Admin only): every component in every state (plate/registry.js),
// at 1280 or 390 px, with the sketch's example data, so a component can sit beside its sketch. The eight ported
// drawings follow. `?w=390` sets the frame's width; `?only=Name` shows one component (the regression harness uses it);
// `?state=name` one state; `?extremes=1` adds R2's extreme-data fixtures; `?plain=1` the Plain mapping.
import { lazy, Suspense, useMemo, useState } from "react";
import PlateRoot from "../../plate/PlateRoot.jsx";
import { PLATE_REGISTRY, PORTED_DRAWINGS } from "../../plate/registry.js";
import * as Shell from "../../plate/Shell.jsx";
import * as Marks from "../../plate/Marks.jsx";
import * as Plates from "../../plate/Plates.jsx";
import * as Tickets from "../../plate/Tickets.jsx";
import * as Cards from "../../plate/Cards.jsx";
import * as Lists from "../../plate/Lists.jsx";
import * as Drawings from "../../plate/Drawings.jsx";
import * as Explainer from "../../plate/explainer/Explainer.jsx";
import { FitCard } from "../../plate/FitCard.jsx";
import * as Dispatch from "../../plate/Dispatch.jsx";   // D197 Wave 2 #18 (47j): the email form
import * as Panels from "../../plate/Panels.jsx";   // D197 Wave 2 #19 (47j): the extension's floating panel + the /d square   // D202: the field card ⇄ the ATS card
import * as PublicPages from "../../plate/PublicPages.jsx";   // D197 Wave 2 (47j, w2-public): the public nav, the placeholder plate
import { CorrespondenceLetter } from "../../plate/Correspondence.jsx";   // D197 Wave 2 #14 (47j, w2-public)
import * as Person from "../../plate/Person.jsx";   // 47j (w2-person): the passport / setting out / settings pieces
import { DRAWINGS } from "../../plate/drawings/index.js";
import { PLATE_PAGES } from "./platePages/index.js";   // D197 Wave 2 · M3: the page mocks (`?page=<id>`)

const LIB = { ...Shell, ...Marks, ...Plates, ...Tickets, ...Cards, ...Lists, ...Drawings, ...Explainer, FitCard, ...Dispatch, ...Panels, ...PublicPages, CorrespondenceLetter, ...Person };

function params() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

/** What a gallery entry needs besides its data: children, callbacks, the drawing for a plate hero. */
function withWiring(entry, props, ctx) {
  const p = { ...props, onRetry: () => ctx.note(`${entry.name}: Try again`) };
  if (entry.name === "PlateHero") { const D = DRAWINGS[entry.drawing]; p.children = D ? <D/> : null; }
  if (entry.name === "DeckPile") p.children = <Tickets.Opening opening={PLATE_REGISTRY.find((e) => e.name === "Opening").states.ready.opening}/>;
  if (entry.name === "Opening") p.actions = (
    <>
      <button type="button" className="pl-btn">Pass</button><button type="button" className="pl-btn">Save</button>
      <button type="button" className="pl-btn">Send</button><span className="pl-grow"/>
      <a className="pl-btn pl-btn--primary" href="#draft">Draft this job</a>
    </>
  );
  if (entry.name === "Cartouche") p.actions = (
    <><button type="button" className="pl-btn pl-btn--paper">All filters</button><button type="button" className="pl-btn pl-btn--dashed">Back to my résumé’s bearing</button></>
  );
  if (entry.name === "BinderTabs") { p.selected = ctx.tab; p.onSelect = ctx.setTab; p.children = <p className="pl-body">The {ctx.tab} view goes here.</p>; }
  if (entry.name === "QuestionTicket") { p.onAnswer = (a) => ctx.note(`answered ${a}`); p.onBack = () => ctx.note("back"); p.more = <a href="#all">See all 4</a>; }
  if (entry.name === "Register") p.onBulk = (k, ids) => ctx.note(`${k} ${ids.length}`);
  if (entry.name === "FilterChips") p.onToggle = (id) => ctx.note(`toggle ${id}`);
  if (entry.name === "Cartouche") p.onPart = (id) => ctx.note(`change ${id}`);
  return p;
}

function Cell({ entry, stateName, props, ctx }) {
  const C = LIB[entry.name];
  if (!C) return <p className="pl-body">⚠ {entry.name} is not exported by the plate library.</p>;
  const p = withWiring(entry, props, ctx);
  const body = entry.name === "CalloutTag"
    ? <div style={{ position: "relative", height: 90 }}><C {...p} x={0} y={0}/></div>
    : <C {...p}/>;
  return (
    <div data-plate-cell={`${entry.name}${entry.variant ? `:${entry.variant}` : ""}:${stateName}`} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <span className="pl-label pl-muted">{stateName.toUpperCase()}</span>
      {body}
    </div>
  );
}

/** D197 Wave 2 · M3: one page mock, at the frame's width (`?page=<id>`, `&w=390`). */
function PageMock({ id, width }) {
  const entry = PLATE_PAGES[id];
  const Mock = useMemo(() => (entry ? lazy(entry.load) : null), [entry]);
  if (!Mock) return <PlateRoot style={{ minHeight: "100vh", padding: 24 }}><p className="pl-label">No page mock “{id}”. Mocks: {Object.keys(PLATE_PAGES).join(" · ") || "none yet"}</p></PlateRoot>;
  return (
    <div data-plate-page-mock={id} style={{ width, maxWidth: "100%", margin: "0 auto" }}>
      <Suspense fallback={null}><Mock width={width}/></Suspense>
    </div>
  );
}

export default function PlateGallery() {
  const q = useMemo(params, []);
  const [width, setWidth] = useState(q.get("w") === "390" ? 390 : 1280);
  const [tab, setTab] = useState("deck");
  const [log, setLog] = useState("");
  const only = q.get("only");
  const onlyState = q.get("state");
  const extremes = q.get("extremes") === "1";
  const ctx = { tab, setTab, note: setLog };
  if (q.get("page")) return <PageMock id={q.get("page")} width={width}/>;
  const entries = PLATE_REGISTRY.filter((e) => !only || e.name === only || `${e.name}:${e.variant}` === only);
  const groups = [...new Set(entries.map((e) => e.group))];
  return (
    <PlateRoot plain={q.get("plain") === "1"} style={{ minHeight: "100vh" }}>
      <div style={{ width, maxWidth: "100%", margin: "0 auto", padding: "24px 16px 72px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 40 }}>
        {only ? null : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <Plates.PageTitle>The plate system</Plates.PageTitle>
            <span className="pl-grow"/>
            <div role="group" aria-label="Frame width" style={{ display: "flex", gap: 6 }}>
              {[1280, 390].map((w) => <button key={w} type="button" className="pl-btn" aria-pressed={width === w} onClick={() => setWidth(w)}>{w} px</button>)}
            </div>
            <span className="pl-label pl-muted" aria-live="polite">{log}</span>
          </div>
        )}
        {groups.map((g) => (
          <section key={g} aria-label={g} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {only ? null : <Plates.LegHeader title={g} meta={`D196 · ${entries.filter((e) => e.group === g).length} COMPONENTS`}/>}
            {entries.filter((e) => e.group === g).map((e) => {
              const states = Object.entries(e.states).filter(([s]) => !onlyState || s === onlyState);
              if (extremes && e.extremes) states.push(["extremes", e.extremes]);
              return (
                <div key={`${e.name}:${e.variant || ""}`} data-plate-entry={e.name} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <span className="pl-kicker">{e.name}{e.variant ? ` · ${e.variant}` : ""}{e.awaiting ? " · ⏸ AWAITS THE V2 EXPORT" : ""}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
                    {states.map(([s, props]) => (
                      <div key={s} style={{ flex: e.width ? `0 0 ${Math.min(e.width, width - 32)}px` : "1 1 360px", minWidth: 0 }}>
                        <Cell entry={e} stateName={s} props={props} ctx={ctx}/>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
        {only && only !== "drawings" ? null : (
          <section aria-label="Ported drawings" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Plates.LegHeader title="The ported drawings" meta="D196 F2 · PATH FOR PATH FROM THE CANVAS EXPORT"/>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
              {PORTED_DRAWINGS.map((n) => {
                const D = DRAWINGS[n];
                return (
                  <figure key={n} data-plate-drawing={n} className="pl-figure" style={{ flex: "1 1 360px", minWidth: 0, maxWidth: 640 }}>
                    <D/>
                    <figcaption className="pl-platehero__cap"><span className="pl-label">{n}</span></figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </PlateRoot>
  );
}
