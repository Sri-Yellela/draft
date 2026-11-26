// ⭐ D197 Wave 2 · M3 (47j, lane w2-person) · #9 PROFILE → *YOUR PASSPORT* — the mock (docs/revamp/profile.md).
// Built only from the plate library (plate/) and --pl-* tokens, with fixture data (a synthetic person, the gallery's
// Maya Chen). Nothing here reads the server. The one operable model: the visa switch (Only you · Connections · Public),
// its consent before widening, and *View as the public* — the sections a visitor would see, with a caption that says so.
import { useState } from "react";
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { AreaNav } from "../../../plate/Shell.jsx";
import { Kickers, LetterTile } from "../../../plate/Marks.jsx";
import { PageTitle, StatsStrip, LegHeader, PlateHero } from "../../../plate/Plates.jsx";
import { Ticket } from "../../../plate/Tickets.jsx";
import { FactSheet } from "../../../plate/Cards.jsx";
import { RouteLine } from "../../../plate/Lists.jsx";
import { CompassDial, RegionEmblem } from "../../../plate/Drawings.jsx";
import { PassportIdentity, VisibilityControl, PassportStamps, SettingsSheet, DrawingToCome, LabelledField } from "../../../plate/Person.jsx";
import PlaceHazardSeal from "../../../plate/drawings/PlaceHazardSeal.jsx";
import MarketSurveyPlate from "../../../plate/drawings/MarketSurveyPlate.jsx";

const RANK = { only_me: 0, connections: 1, public: 2 };
const WORD = { only_me: "only you", connections: "your connections", public: "the public" };
export const PASSPORT_VIEWS = [
  { id: "passport", label: "Your passport", href: "#passport", icon: "starred" },
  { id: "answers", label: "Saved answers", href: "#answers", icon: "list" },
  { id: "autoapply", label: "Auto-apply", href: "#autoapply", icon: "progress" },
  { id: "connections", label: "Connections", href: "#connections", icon: "network" },
];
export const PASSPORT_MORE = [
  { label: "Appearance", href: "#appearance" }, { label: "Notifications", href: "#notifications" },
  { label: "Privacy and your data", href: "#privacy" }, { label: "Account", href: "#account" },
];
const SECTIONS = [["about", "About"], ["road", "The road so far"], ["stamps", "Stamps"], ["fit", "Where you fit"], ["work", "Work you can show"], ["school", "Schooling"]];
const PROMISES = {
  public: ["Anyone with the link can read the sections you leave open", "Search engines stay away unless you switch them on", "Contact details, job profiles and saved answers are never shown"],
  connections: ["Only people you've connected with on draft can read it", "Each section's eye can still close it", "Contact details are never shown"],
};
const row = { display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start", marginTop: 18 };
const main = { flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 };
const side = { flex: "1 1 240px", minWidth: 0, maxWidth: 420 };

export default function ProfileMock({ width = 1280 }) {
  const phone = width <= 480;
  const [page, setPage] = useState("only_me");
  const [asking, setAsking] = useState(null);
  const [eyes, setEyes] = useState({ about: "public", road: "public", stamps: "public", fit: "connections", work: "public", school: "only_me" });
  const [preview, setPreview] = useState(false);
  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState("Frontend engineer · checkout flows and design systems");
  const [open, setOpen] = useState(null);
  const seen = (id) => Math.min(RANK[page], RANK[eyes[id]]);
  const shown = (id) => !preview || seen(id) === 2;
  const choose = (k) => (RANK[k] > RANK[page] ? setAsking(k) : setPage(k));
  const eye = (id, name) => (
    <VisibilityControl compact value={RANK[eyes[id]] > RANK[page] ? page : eyes[id]} cap={page} label={`Who can see ${name}`} onChange={(k) => setEyes({ ...eyes, [id]: k })}/>
  );
  const publicCount = SECTIONS.filter(([id]) => seen(id) === 2).length;
  const caption = preview
    ? `Seen by the public: ${publicCount} of ${SECTIONS.length} sections shown, the sealed pages never.`
    : `Your view. Your passport is seen by ${WORD[page]}.`;

  return (
    <PlateRoot region="V" style={{ minHeight: "100vh", paddingBottom: 72 }} data-mock="profile">
      <AreaNav area="Your passport" views={PASSPORT_VIEWS} current="passport" more={PASSPORT_MORE} phone={phone}
        home={{ href: "#home", label: "draft — the market" }} search={phone ? { onOpen: () => {} } : { placeholder: "Search your passport…" }}/>

      {/* the hero: the person's page is a destination (D200 Rule 3) — the name as the title, the passport drawing to come */}
      <header className="pl-hero">
        <div className="pl-hero__main">
          <Kickers parts={["YOUR PASSPORT", `SEEN BY ${WORD[page].toUpperCase()}`, "BUILT FROM MAYA_CHEN.PDF · NOV 8"]}/>
          <PageTitle>Maya Chen</PageTitle>
          <p className="pl-lead">{headline}</p>
          <StatsStrip label="Your passport at a glance" cells={[
            { value: 2, label: "PROVEN", onClick: () => {} }, { value: 9, label: "FROM YOUR RÉSUMÉ", onClick: () => {} },
            { value: `${publicCount} / ${SECTIONS.length}`, label: "SECTIONS PUBLIC", onClick: () => setPreview(true) }, { value: "8 / 9", label: "COMPLETE", onClick: () => {} },
          ]}/>
          <div className="pl-actions">
            <button type="button" className="pl-btn" aria-pressed={preview} onClick={() => setPreview((p) => !p)}>{preview ? "Back to your view" : "View as the public"}</button>
            <button type="button" className="pl-btn" disabled={page !== "public"} title={page === "public" ? "Copy your public link" : "Your public link comes with the public page"}>Share link</button>
            <button type="button" className="pl-btn" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Edit"}</button>
          </div>
          <p className="pl-label pl-muted" aria-live="polite" data-passport-caption="">{caption}</p>
        </div>
        <div style={{ flex: "1 1 300px", minWidth: 0, maxWidth: 520 }}>
          <DrawingToCome what="the passport, open at its identity page — the photo square, the printed fields, three stamps on the facing visa page"/>
        </div>
      </header>

      {/* 01 · who can see it — the operable model */}
      <section className="pl-section" aria-labelledby="pp-visa">
        <LegHeader n={1} meta="THE VISA PAGE · ONLY YOU BY DEFAULT · EACH SECTION'S EYE NARROWS IT" title={<span id="pp-visa">Who can see it</span>}/>
        <div style={row}>
          <div style={main}>
            <VisibilityControl value={page} onChange={choose}/>
            {asking ? (
              <SettingsSheet kicker={asking === "public" ? "IF YOU MAKE IT PUBLIC" : "IF YOU SHOW IT TO CONNECTIONS"} title={`Make your passport ${asking === "public" ? "public" : "seen by connections"}?`}
                rows={PROMISES[asking].map((p) => ({ label: `✓ ${p}`, value: "" }))}
                actions={<><button type="button" className="pl-btn pl-btn--ink" onClick={() => { setPage(asking); setAsking(null); }}>{asking === "public" ? "Make it public" : "Show it to connections"}</button>
                  <button type="button" className="pl-btn" onClick={() => setAsking(null)}>Keep it as it is</button></>}/>
            ) : null}
            <label className="pl-body" style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 44 }}>
              <input type="checkbox" className="pl-check" disabled={page !== "public"}/> Let search engines find it {page !== "public" ? "(only when public)" : ""}
            </label>
            <PassportIdentity name="Maya Chen" headline={headline} region="V" level={page} open="Open to work · referrals welcome"
              fields={[{ label: "HANDLE", value: "draft.work/in/maya-chen" }, { label: "FITS", value: "Frontend · mid · also Design systems" }, { label: "LOCATION · YEARS", value: "Boston, MA · 4 years" }]}
              photoAction={<button type="button" className="pl-btn">Change photo</button>}
              actions={editing ? null : <span className="pl-muted">Edit opens the headline and the link here.</span>}>
              {editing ? (
                <div style={{ padding: "0 16px 16px", display: "grid", gap: 12 }}>
                  <LabelledField label="Headline" value={headline} onChange={setHeadline} note="Up to 160 characters."/>
                  <LabelledField label="Your public link · draft.work/in/" value="maya-chen" onChange={() => {}}/>
                </div>
              ) : null}
            </PassportIdentity>
          </div>
          <div style={side}>
            <PlateHero aspect="280 / 280" caption={<span className="pl-label">THE SEALED DOOR · VISITORS WAIT OUTSIDE</span>}>
              <PlaceHazardSeal label="Your passport behind a sealed door: only you inside; connections and the public wait outside until you open it"/>
            </PlateHero>
          </div>
        </div>
      </section>

      {/* 02 · about */}
      {shown("about") ? (
        <section className="pl-section" aria-labelledby="pp-about">
          <LegHeader n={2} meta="ABOUT · FROM YOUR RÉSUMÉ · EDITED BY YOU" title={<span id="pp-about">About</span>}/>
          <div style={row}>
            <div style={main}>
              {preview ? null : eye("about", "About")}
              <p className="pl-body">Four years building checkout and design-system work for restaurant software. Happiest where a form has to be fast, accessible and right the first time.</p>
            </div>
            <div style={side}><DrawingToCome aspect="4 / 3" what="a field-book page with a pencilled summary"/></div>
          </div>
        </section>
      ) : null}

      {/* 03 · the road so far */}
      {shown("road") ? (
        <section className="pl-section" aria-labelledby="pp-road">
          <LegHeader n={3} meta="EXPERIENCE · LOGOS FROM YOUR RÉSUMÉ · YOUR SKILLS IN BOLD" title={<span id="pp-road">The road so far</span>}/>
          <div style={row}>
            <div style={main}>
              {preview ? null : eye("road", "The road so far")}
              <RouteLine label="Where you've worked" stops={[{ name: "Northeastern co-op · 2020", state: "lit", stage: "start" }, { name: "Brightline Health · 2021–22", state: "lit", stage: "build" },
                { name: "Toast · Software Engineer II · now", state: "next", stage: "deepen" }]}/>
              <FactSheet kicker="TOAST · SOFTWARE ENGINEER II · 2022 – NOW · 3 YRS" rows={[
                { label: "Rebuilt the checkout in React and TypeScript", value: "proof link" }, { label: "Cut form errors 38 % with Playwright checks", value: "proof link" }]}
                foot="Bold words are your skills where the résumé says them; each line can carry a proof link."/>
            </div>
            <div style={side}><DrawingToCome aspect="4 / 3" what="employers as stops on a route, the current one beaconed"/></div>
          </div>
        </section>
      ) : null}

      {/* 04 · stamps */}
      {shown("stamps") ? (
        <section className="pl-section" aria-labelledby="pp-stamps">
          <LegHeader n={4} meta="SKILLS · GREEN = PROVEN IN ATLAS · DASHED = NOT YET" title={<span id="pp-stamps">Stamps</span>}/>
          <div style={row}>
            <div style={main}>
              {preview ? null : eye("stamps", "Stamps")}
              <PassportStamps proven={[{ name: "React", how: "built", at: "Nov 12", href: "#proof" }, { name: "TypeScript", how: "passed a check", at: "Nov 18" }]}
                listed={preview ? [] : [{ name: "Playwright", href: "#prove" }, { name: "Next.js", href: "#prove" }, { name: "Datadog RUM", href: "#prove" }]}/>
            </div>
            <div style={side}><CompassDial lit={2} total={11} size={phone ? 112 : 128} label="Compass dial: 2 of your 11 résumé skills proven"/></div>
          </div>
        </section>
      ) : null}

      {/* 05 · where you fit */}
      {shown("fit") ? (
        <section className="pl-section" aria-labelledby="pp-fit">
          <LegHeader n={5} meta="YOUR BEARING ON THE MARKET · 71 % READY" title={<span id="pp-fit">Where you fit</span>}/>
          <div style={row}>
            <div style={main}>
              {preview ? null : eye("fit", "Where you fit")}
              <p className="pl-body">71 % ready for Frontend engineer, mid — the proven skills count most. <b>— 6 picks today.</b></p>
              <div className="pl-actions"><button type="button" className="pl-btn">Keep</button><button type="button" className="pl-btn">Change back</button></div>
            </div>
            <div style={side}>
              <PlateHero aspect="640 / 520"><MarketSurveyPlate label="The market as a survey plate: you marked in Software engineering, Frontend"/></PlateHero>
            </div>
          </div>
        </section>
      ) : null}

      {/* 06 · work you can show · 07 · schooling */}
      {shown("work") ? (
        <section className="pl-section" aria-labelledby="pp-work">
          <LegHeader n={6} meta="PROJECTS · ACHIEVEMENTS · LINKS" title={<span id="pp-work">Work you can show</span>}/>
          <div style={row}>
            <div style={main}>
              {preview ? null : eye("work", "Work you can show")}
              <FactSheet kicker="PROJECTS · 2" rows={[{ label: "Tip calculator kit", value: "Counts as proof for React" }, { label: "A11y form audit", value: "GitHub" }]}/>
              <FactSheet kicker="ACHIEVEMENTS · 1" rows={[{ label: "AWS Cloud Practitioner", value: "2024" }]}/>
              <div className="pl-actions"><LetterTile name="GitHub" size="sm"/><LetterTile name="LinkedIn" size="sm"/></div>
            </div>
            <div style={side}><DrawingToCome aspect="4 / 3" what="a specimen drawer of projects"/></div>
          </div>
        </section>
      ) : null}
      {shown("school") ? (
        <section className="pl-section" aria-labelledby="pp-school">
          <LegHeader n={7} meta="EDUCATION · HIGHEST DEGREE FROM THE SECTION" title={<span id="pp-school">Schooling</span>}/>
          <div style={row}>
            <div style={main}>
              {preview ? null : eye("school", "Schooling")}
              <FactSheet kicker="NORTHEASTERN UNIVERSITY" rows={[{ label: "BS, Computer Science", value: "2021" }]}/>
            </div>
            <div style={side}><DrawingToCome aspect="4 / 3" what="a schoolhouse on the ground strip"/></div>
          </div>
        </section>
      ) : null}

      {/* 08 · the sealed pages — never public */}
      {preview ? null : (
        <section className="pl-section" aria-labelledby="pp-sealed">
          <LegHeader n={8} meta="ONLY YOU · USED TO APPLY AND TO RANK YOUR JOBS · NEVER PUBLIC" title={<span id="pp-sealed">The sealed pages</span>}/>
          <div style={row}>
            <div style={main}>
              <SettingsSheet kicker="BEHIND YOUR PASSPORT" title="Six sealed pages" lead="One opens at a time; each mounts its editor only when opened."
                rows={[["contact", "Contact details for application forms", "Name, email, phone, address, work authorisation — filled into forms"],
                  ["defaults", "Application defaults", "The answers forms ask every time"], ["resumes", "Base résumés and job profiles", "Your résumé per kind of job · Manage → Your bearings"],
                  ["skills", "Skills and keywords that rank your board", "Weighted terms, each removable"], ["tailoring", "How your résumés are tailored", "The rules a tailored résumé follows"],
                  ["proofpage", "Proof page", "What you've proven in Atlas, on its own page"]].map(([id, label, note]) => ({
                  label, note, control: <button type="button" className="pl-btn" aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>{open === id ? "Close" : "Open"}</button> }))}>
                {open ? <p className="pl-body" role="status">The {open} editor opens here — the same fields and save bar as today.</p> : null}
              </SettingsSheet>
            </div>
            <div style={side}><RegionEmblem kind="lock" region="V" size={phone ? 96 : 120} label="Security emblem: a lock — the sealed pages"/></div>
          </div>
        </section>
      )}

      {/* onward */}
      <section className="pl-section pl-section--last" aria-labelledby="pp-onward">
        <LegHeader n={9} meta="ONWARD · FROM YOUR PASSPORT" title={<span id="pp-onward">Tickets out</span>}/>
        <div className="pl-tickets">
          <Ticket tone="clay-tint" kicker="YOUR NEXT STAMP · 5 MIN" title="Prove Playwright" line="The top résumé skill you haven't proven yet." go="Set out →" href="#atlas"/>
          <Ticket kicker="YOUR PUBLIC PAGE" title="draft.work/in/maya-chen" line={page === "public" ? "Open — what a visitor sees." : "Private until you open the visa page."} go="Open →" href="#in"/>
          <Ticket kicker="THE MARKET · YOUR BEARINGS" title="Job profiles" line="Every bearing you keep, and what you follow." go="Manage →" href="#bearings"/>
        </div>
      </section>
    </PlateRoot>
  );
}
