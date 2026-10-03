// client/src/pages/tools/PdfToolPage.jsx — A69: the PDF tools, free, in the browser.
// ⭐ Why draft carries them: ATS portals cap upload size (compress), and a cover letter merged onto
// a résumé is a one-click job people do by hand (merge). Same component as the tools service's site.
import { useSearchParams } from "react-router-dom";
import { useTheme } from "../../styles/theme.jsx";
import { Footer } from "../../components/Footer.jsx";
import ScrollDock from "../../components/ScrollDock.jsx";
import { PdfToolkit } from "../../components/PdfToolkit.jsx";

export function PdfToolPage() {
  const { theme } = useTheme();
  const [params] = useSearchParams();
  return (
    <div className="scroll-dock-page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
                  background: theme.bg, color: theme.text, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <ScrollDock variant="tools" />
      <main style={{ flex: 1, maxWidth: 860, margin: "0 auto", padding: "48px 24px", width: "100%", boxSizing: "border-box" }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif",
                     letterSpacing: "-1px", marginBottom: 10, color: theme.text }}>
          PDF tools that never upload your file
        </h1>
        <p style={{ fontSize: 15, color: theme.textMuted, marginBottom: 28, lineHeight: 1.6 }}>
          Merge, split, compress for an upload limit, protect, unlock, turn into images, read the text.
        </p>
        <PdfToolkit initial={params.get("tool") || "merge"} />
      </main>
      <Footer />
    </div>
  );
}
