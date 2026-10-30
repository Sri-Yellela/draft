// extension/jobSignals.js — ⭐⭐ D112 item 4 (T35 = A, owner 10-30: "global read … no clicks needed") · THE LOCAL DETECTOR.
//
// A CLASSIC script (no imports, no exports): it defines ONE function, globalThis.__draftJobSignals(document, location),
// and does nothing else. It is loaded in two ways, and both share this one definition:
//   · registered for https://*/* (autoRead.js desiredRegistrations, only after the user's ONE "Allow" on the global ask)
//     BEFORE globalReadDetector.js, which calls it once the page is idle;
//   · injected by the service worker (runAutoPass) before every automatic pass on a site no list names, to re-check
//     that the page still looks like a job page (an SPA may have moved to a page that is not one).
//
// ⛔ WHAT IT DOES ON A PAGE THAT IS NOT A JOB PAGE: NOTHING. It reads the page's address, its JSON-LD script tags, its
//   iframes' addresses and whether it has certain form controls (their TYPE and NAME attributes — never a value). It
//   makes no request, writes no storage, sends no message and keeps nothing: "a page that is not a posting sends
//   nothing, not its address, not a hash" (the store listing's promise) — test/d112GlobalRead.test.js.
// ⛔ Never on LinkedIn, Indeed or Glassdoor — the SAME pattern as autoRead.js NEVER_HOSTS (pinned equal by the test),
//   and the registration excludes them too (NEVER_MATCHES). Never on draft's own site.
(function draftJobSignalsModule() {
  if (typeof globalThis.__draftJobSignals === 'function') return;

  // = autoRead.js NEVER_HOSTS (D78 / D97) — test/d112GlobalRead.test.js pins the two sources equal
  var NEVER_HOSTS = /(?:^|\.)(?:linkedin|indeed|glassdoor)\.[a-z.]+$/i;
  var OWN_HOSTS = /(?:^|\.)jobsviadraft\.com$/i;
  // = the hosts of autoRead.js SITES (the preset ATS sites) — pinned by the test: every preset host is an ATS host here
  var ATS_HOSTS = /(?:^|\.)(?:greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|myworkdayjobs\.com|myworkdaysite\.com|smartrecruiters\.com)$/i;
  // = autoRead.js looksLikeJobPage's words and parameters
  var JOB_WORDS = /(?:^|[/._-])(?:jobs?|careers?|positions?|openings?|vacanc(?:y|ies)|apply|applications?|requisitions?|opportunit(?:y|ies)|join-us|work-with-us|hiring)(?=[/._?=#-]|$)/i;
  var JOB_PARAMS = /[?&](?:gh_jid|ashby_jid|lever-origin|jobid|job_id|jid|req(?:uisition)?_?id)=/i;

  function hostOf(href) {
    try { var u = new URL(href); return u.protocol === 'https:' ? u.hostname.toLowerCase() : ''; } catch (e) { return ''; }
  }
  function hasJsonLdPosting(doc) {
    var isPosting = function (n) {
      if (!n || typeof n !== 'object') return false;
      if (Array.isArray(n)) return n.some(isPosting);
      var t = n['@type'];
      if (t === 'JobPosting' || (Array.isArray(t) && t.indexOf('JobPosting') >= 0)) return true;
      return isPosting(n['@graph']);
    };
    var tags = doc.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < tags.length; i++) {
      try { if (isPosting(JSON.parse(tags[i].textContent || 'null'))) return true; } catch (e) { /* not JSON */ }
    }
    return false;
  }
  // An application form: a file upload (the résumé) beside an email box — or a name, an email and a phone box.
  function hasApplicationForm(doc) {
    var file = doc.querySelector('input[type="file"]');
    var email = doc.querySelector('input[type="email"], input[name*="email" i], input[autocomplete="email"]');
    if (file && email) return true;
    var name = doc.querySelector('input[name*="name" i], input[autocomplete="given-name"], input[autocomplete="name"]');
    var phone = doc.querySelector('input[type="tel"], input[name*="phone" i], input[autocomplete="tel"]');
    return !!(name && email && phone);
  }

  /**
   * → { job: boolean, why: 'ats_host' | 'json_ld' | 'ats_frame' | 'apply_form' | null }. Pure over `doc` and `loc`.
   * `top`: false in a sub-frame — there only a known ATS site's frame counts (the form of a careers page).
   */
  function draftJobSignals(doc, loc, top) {
    var no = { job: false, why: null };
    var host = hostOf(loc && loc.href);
    if (!host || NEVER_HOSTS.test(host) || OWN_HOSTS.test(host)) return no;
    if (ATS_HOSTS.test(host)) return { job: true, why: 'ats_host' };
    if (top === false) return no;
    if (hasJsonLdPosting(doc)) return { job: true, why: 'json_ld' };
    var frames = doc.querySelectorAll('iframe[src]');
    for (var i = 0; i < frames.length && i < 20; i++) {
      var fh = hostOf(frames[i].src);
      if (fh && ATS_HOSTS.test(fh) && !NEVER_HOSTS.test(fh)) return { job: true, why: 'ats_frame' };
    }
    var path = '', search = '';
    try { var u = new URL(loc.href); path = u.pathname; search = u.search; } catch (e) { return no; }
    var jobAddress = JOB_WORDS.test(path) || JOB_PARAMS.test(search) || /^(?:jobs?|careers?)\./i.test(host);
    if (jobAddress && hasApplicationForm(doc)) return { job: true, why: 'apply_form' };
    return no;
  }

  globalThis.__draftJobSignals = draftJobSignals;
})();
