// crawler/lib/atsHosts.js — the hosts an ATS serves a BOARD from, so the worker knows when it has found
// one. ⚠ It only decides "this URL is evidence"; draft turns evidence into (vendor, slug) with its own
// harvestPairOf (services/slugHarvest.js) — one parser — and test/d75Crawler.test.js holds this list to
// agree with it on every vendor it names.
export const ATS_HOST_PATTERNS = Object.freeze([
  /(^|\.)greenhouse\.io$/i, /^jobs\.lever\.co$/i, /^api\.lever\.co$/i, /^jobs\.ashbyhq\.com$/i, /^api\.ashbyhq\.com$/i,
  /^apply\.workable\.com$/i, /\.recruitee\.com$/i, /^jobs\.smartrecruiters\.com$/i, /^api\.smartrecruiters\.com$/i,
  /\.myworkdayjobs\.com$/i, /\.myworkdaysite\.com$/i, /(^|\.)icims\.com$/i, /\.applytojob\.com$/i, /\.oraclecloud\.com$/i,
  /\.eightfold\.ai$/i, /^jobs\.gem\.com$/i, /\.pinpointhq\.com$/i, /^jobs\.jobvite\.com$/i, /\.bamboohr\.com$/i,
  /\.taleo\.net$/i, /\.successfactors\.(com|eu)$/i, /\.ultipro\.com$/i,
]);
export function isAtsUrl(rawUrl) {
  let h; try { h = new URL(String(rawUrl)).hostname; } catch { return false; }
  return ATS_HOST_PATTERNS.some(re => re.test(h));
}
