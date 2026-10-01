// ── Cross-site writes, refused ────────────────────────────────────────────────────────────────
// A state-changing request whose Origin (or Referer) is another site is a 403. See server.js for
// why each exemption is safe. Same-host requests are always allowed (the server serves the client).
const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function originOf(value) {
  try { return new URL(value).origin; } catch { return null; }
}

export function rejectCrossSiteWrites({ allowedOrigins = new Set(), hasHeaderToken = () => false } = {}) {
  return (req, res, next) => {
    if (!WRITE.has(req.method) || hasHeaderToken(req)) return next();
    const claimed = originOf(req.get("origin") || "") || originOf(req.get("referer") || "");
    if (!claimed) return next();   // server-to-server, or a browser that sent neither (same-origin)
    const self = `${req.protocol}://${req.get("host")}`;
    if (claimed === self || allowedOrigins.has(claimed)) return next();
    return res.status(403).json({ error: "cross_site_request", message: "This request came from another site and was refused." });
  };
}
