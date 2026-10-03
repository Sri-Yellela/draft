// RETIRED (D17, A80 V4 — 2026-10-03). This script sent the enrichment backlog to a model (Haiku, one
// call per posting). D17: a model is for résumé generation only — so enrichment is the manual round
// trip, and this refuses rather than run.
//
//   node scripts/am4Enrich.mjs export --out FILE      # the backlog, as JSONL
//   (enrich the file outside the product)
//   node scripts/am4Enrich.mjs import FILE            # dry run; add --apply to write a revertible batch
//
// The same round trip is in the admin DB inspector ("Enrichment Round Trip"). The history of what
// this script did is in git (before this commit).
console.error("scripts/runEnrichment.mjs is retired: enrichment no longer calls a model (D17).\n" +
  "Use the export → import round trip: node scripts/am4Enrich.mjs export, then import (see the header).");
process.exit(1);
