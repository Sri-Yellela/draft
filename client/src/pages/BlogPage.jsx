// /blog — ⭐ 47m (D197 · marketing.md 16q, M5): kept (it is on the approved mock's nav) and drawn as the plate's NOT YET
// drawer under the public nav — the same words, the 🚧 emoji gone (the plate has no emoji). ⚠ agent's pick (owner may
// reverse): when posts exist, the Library's field-notes drawer is their natural home (marketing.md).
import { Kickers } from "../plate/Marks.jsx";
import { Drawer } from "../plate/PlateState.jsx";
import { PublicPage } from "../components/PublicChrome.jsx";

export default function BlogPage() {
  return (
    <PublicPage region="I" data-blog-page="">
      <main className="pl-page" style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 32 }}>
        <Kickers parts={["FIELD NOTES"]}/>
        <h1 className="pl-mk-hero__title">Blog & Changelog</h1>
        <p className="pl-mk-hero__line">Product updates, job search tips, and resume advice.</p>
        <div style={{ maxWidth: 640, marginTop: 18 }}>
          <Drawer kicker="NOT YET" text="This page is coming soon."/>
        </div>
      </main>
    </PublicPage>
  );
}
