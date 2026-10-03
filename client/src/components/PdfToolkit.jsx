// A69 — draft's mount of @draft/pdf-toolkit: the SAME component resumemaster.one mounts, not a copy
// (A52's lesson). The package is framework-free; this wrapper only loads the libraries — lazily, so
// nobody downloads ~2 MB of PDF code until they open the tools — and maps draft's tokens onto the
// toolkit's --pt-host-* variables. Everything runs in the browser; the file is never uploaded.
import { useEffect, useRef, useState } from "react";
import "../../../packages/pdf-toolkit/src/styles.css";

const HOST_VARS = {
  "--pt-host-surface": "var(--c-surface-solid)",
  "--pt-host-text": "var(--c-ink)",
  "--pt-host-muted": "var(--c-ink-muted)",
  "--pt-host-border": "var(--c-border-control)",
  "--pt-host-accent": "var(--c-accent)",
  "--pt-host-on-accent": "var(--c-on-accent)",
  "--pt-host-good": "var(--c-success)",
  "--pt-host-bad": "var(--c-danger)",
  "--pt-host-radius": "12px",
};

let libsPromise = null;
function loadLibs() {
  libsPromise ??= Promise.all([
    import("@cantoo/pdf-lib"),
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    import("../../../packages/pdf-toolkit/src/ui.js"),
  ]).then(([lib, pdfjs, worker, ui]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return { lib, pdfjs, mountPdfToolkit: ui.mountPdfToolkit };
  });
  return libsPromise;
}

export function PdfToolkit({ initial = "merge" }) {
  const ref = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = null, cancelled = false;
    loadLibs()
      .then(({ lib, pdfjs, mountPdfToolkit }) => {
        if (cancelled || !ref.current) return;
        mounted = mountPdfToolkit(ref.current, { lib, pdfjs, initial });
        setReady(true);
      })
      .catch(e => setError(`The PDF tools could not load: ${e?.message || e}`));
    return () => { cancelled = true; mounted?.destroy(); };
  }, [initial]);
  return (
    <div style={HOST_VARS} data-pdf-toolkit>
      {!ready && !error && <p style={{ color: "var(--c-ink-muted)" }}>Loading the PDF tools…</p>}
      {error && <p role="alert" style={{ color: "var(--c-danger)" }}>{error}</p>}
      <div ref={ref}/>
    </div>
  );
}
