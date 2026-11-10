// ⭐ A167 (h) (owner 11-10) · THE EXTENSION'S POP-UP PANEL — where to get it (the store listing and / or the direct
// download, from GET /api/config — never a URL built into the client) and, in a few plain lines, how it helps. Shown on
// the posting (a quiet "Get the extension" that opens it) and in Settings. Nothing shows when neither link is configured.
import { useEffect, useRef, useState } from "react";
import { usePhase1 } from "../lib/monetisation.jsx";
import "./ExtensionPanel.css";

const HOW_IT_HELPS = [
  "Fills the company's application form from your Profile and saved answers — you read it and press Submit.",
  "Attaches the résumé draft tailored for that posting.",
  "Saves a posting you find anywhere to your board, with its ATS match.",
];

export function extensionLinksOf(phase1) {
  const e = phase1?.extension || {};
  return { storeUrl: e.storeUrl || null, downloadUrl: e.downloadUrl || null, any: !!(e.storeUrl || e.downloadUrl) };
}

/** The panel's body — the links and the three lines. */
export function ExtensionPanelBody({ links }) {
  return (
    <div className="ext-panel__body" data-extension-panel="">
      <ul className="ext-panel__how">
        {HOW_IT_HELPS.map(l => <li key={l}>{l}</li>)}
      </ul>
      <div className="ext-panel__links">
        {links.storeUrl && <a className="rm-btn rm-btn-sm" data-extension-store="" href={links.storeUrl} target="_blank" rel="noreferrer">Add it from the Chrome Web Store</a>}
        {links.downloadUrl && <a className="rm-btn rm-btn-ghost rm-btn-sm" data-extension-download="" href={links.downloadUrl} target="_blank" rel="noreferrer">Download it directly</a>}
      </div>
    </div>
  );
}

/** A small "Get the extension" link that opens the panel in place (the posting's). */
export default function ExtensionPanel({ label = "Get the extension" }) {
  const links = extensionLinksOf(usePhase1());
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!links.any) return null;
  return (
    <div className="ext-panel" ref={ref} data-extension-promo="">
      <button type="button" className="rm-btn rm-btn-ghost rm-btn-sm" aria-expanded={open} onClick={() => setOpen(o => !o)}>{label}</button>
      {open && (
        <div role="dialog" aria-label="The draft extension" className="ext-panel__pop">
          <p className="ext-panel__t">The draft extension</p>
          <ExtensionPanelBody links={links} />
          <button type="button" className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
}
