// ── D24 · GET /api/jobs/facets — the counts the sentence's popovers show ────────────────────────────
//
// The response shape is shared/filterSentence.js's FacetsResponse typedef. The request takes EXACTLY
// the querystring GET /api/jobs takes, so the caller passes buildParams' own output and there is still
// one param builder.
//
// The fetch is INJECTED. JobsPanel hands in lib/api.js's `api`; the tests hand in a stub. Nothing here
// imports the network layer, which is what lets the 404 path be tested without a server.
//
// THREE OUTCOMES, AND ONLY ONE OF THEM HAS NUMBERS:
//   ready        — a well-formed FacetsResponse. The sentence draws counts from it.
//   unavailable  — the endpoint answered 404: the server half has not landed on this build. The UI
//                  says counts are not available and draws none. ⛔ Never zeros in place of unknowns:
//                  a zero dims an option and warns that it would empty the board, and both would be
//                  lies.
//   error        — anything else (network, 5xx, a malformed body). Same rule: no numbers.
export const FACETS_PATH = "/api/jobs/facets";

/** Strip the paging keys: facets describe the whole result, not one page of it. */
export function facetsQuery(qs) {
  const p = new URLSearchParams(qs || "");
  for (const k of ["page", "pageSize", "cursor"]) p.delete(k);
  return p.toString();
}

const wellFormed = (d) =>
  !!d && Number.isFinite(d.total) && !!d.clauses && typeof d.clauses === "object";

export async function loadFacets(qs, fetchImpl) {
  const q = facetsQuery(qs);
  try {
    const data = await fetchImpl(`${FACETS_PATH}${q ? `?${q}` : ""}`);
    return wellFormed(data) ? { status: "ready", data } : { status: "error", data: null };
  } catch (e) {
    return { status: e?.status === 404 ? "unavailable" : "error", data: null };
  }
}
