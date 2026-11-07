// shared/atlasFamilyCount.js — ⭐ D178-2 · ONE sentence for a family's count, read by the server's tree tag
// (services/atlas/atlasTree.js) and the client's family list (client/src/pages/atlas/YourMap.jsx): "2 proven · 3 claimed
// · of 8" — never a flat "you have 0 of N" when the person has claims; with nothing yet, "none yet · of 8".
export function familyCountLine({ provenCount = 0, claimedCount = 0, learnedCount = 0, total = 0 } = {}) {
  const parts = [];
  if (provenCount) parts.push(`${provenCount} proven`);
  if (claimedCount) parts.push(`${claimedCount} claimed`);
  if (learnedCount) parts.push(`${learnedCount} learned`);
  return `${parts.length ? parts.join(" · ") : "none yet"} · of ${total}`;
}
