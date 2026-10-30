// ── A résumé FILE → its text — THE one reader (A93: built once) ──────────────────────────────────────
// PDF goes to the server's /api/parse-pdf (the text layer, never a model); Word is read in the browser by mammoth;
// anything else is read as text. Used by Job profiles' upload and A104's "start from your résumé".
import { authHeaders } from "./api.js";

export async function parseResumeFile(file) {
  const ext = String(file?.name || "").split(".").pop().toLowerCase();
  if (ext === "pdf") {
    const fd = new FormData();
    fd.append("file", file);
    const response = await fetch("/api/parse-pdf", { method: "POST", credentials: "include", headers: authHeaders(), body: fd });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || "PDF parse failed");
    return data.text || "";
  }
  if (ext === "docx") {
    const mammoth = (await import("mammoth")).default;
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  }
  return file.text();
}
