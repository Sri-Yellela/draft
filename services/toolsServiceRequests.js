/**
 * draft's database rows -> Resume Master's request bodies (contract v1, contract/resume-master/).
 *
 * THIS MAPPING IS WHAT KEEPS THE PROMPT UNCHANGED. Resume Master renders the runtime-inputs text
 * from these fields, and at the A2 move its rendering was compared with draft's buildRuntimeInputs
 * over 324 cases using exactly this mapping — 0 differed. test/toolsService.test.js pins
 * each field so a "harmless" rename cannot quietly change what the model reads.
 *
 * yearsOfExperience and seniority are passed RAW, as draft's claim guard received them: they are
 * the authority Resume Master's guard enforces, and normalising them here would move the ceiling.
 */

/** user_profile row -> Candidate */
export function candidateFromProfile(profile = {}) {
  return {
    fullName: profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "",
    phone: profile?.phone || "",
    email: profile?.email || "",
    linkedinUrl: profile?.linkedin_url || "",
    githubUrl: profile?.github_url || "",
    location: profile?.location || "",
    yearsOfExperience: profile?.years_of_experience ?? null,
  };
}

/** domain_profiles row -> JobProfile. JSON columns parse as draft's prompt builder parsed them. */
export function jobProfileFromDomainProfile(dp) {
  if (!dp) return null;
  return {
    name: dp.profile_name,
    seniority: dp.seniority ?? null,
    keywords: JSON.parse(dp.selected_keywords || "[]"),
    tools: JSON.parse(dp.selected_tools || "[]"),
    actionVerbs: JSON.parse(dp.selected_verbs || "[]"),
  };
}

export function jobForResumeMaster(job = {}) {
  return { title: job.title, company: job.company, category: job.category, description: job.description, stack: job.stack ?? null };
}

/**
 * ⭐ D70 Phase 3 · THE PROMPT CACHE IS A PER-CALLER CHOICE — bursts on, one-shots off.
 *
 * Phase 0 read production's ledger: 11 resume_generate rows, every one WROTE the ~6,700-token static
 * prefix at 1.25x and NONE read it (0 of 11) — an interactive Generate is a one-shot, and the next one
 * is minutes away, past the 5-minute TTL. So the interactive caller asks for `cache: false` (saves
 * ~0.35¢ a call); a burst caller (the apply worker, D52's N approvals in a row) leaves it unset and
 * keeps the breakpoints, which is where AL6 measured caching paying for itself.
 *
 * ⛔ IT IS ONLY PUT ON THE WIRE ONCE RESUME MASTER DECLARES IT. Resume Master's assemblePrompt has had
 * the lever since AL6 (`options.cache`, default true), but its HTTP contract (1.4.0) declares only
 * `options.includeSummary` and generate.js does not forward a `cache` option to assemblePrompt. An
 * undeclared key would be silently ignored there AND fail draft's own strict contract check
 * (test/toolsService.test.js). So the choice is computed per caller here and withheld until the
 * vendored contract declares `GenerateRequest.options.cache`; test/d70Phase3.test.js holds this
 * constant equal to the vendored contract, so re-vendoring a contract that declares it turns that test
 * red until this is flipped.
 */
export const RESUME_MASTER_ACCEPTS_CACHE_OPTION = false;

/**
 * The generate request coreGenerateResume sends. With an active job profile the caller supplies the
 * role family and domain, and Resume Master resolves the domain module exactly as draft's
 * qualificationResolver did for that path; without one, Resume Master classifies.
 *
 * `cache`: false from a one-shot caller (D70 Phase 3, above); anything else leaves the body
 * byte-for-byte what it was, so a batch caller is unchanged.
 */
export function generateRequest({ profile, job, baseResumeText, mode, employers = [], domainProfile = null,
                                  claims = null, includeSummary = false, cache = undefined },
                                { cacheOptionAccepted = RESUME_MASTER_ACCEPTS_CACHE_OPTION } = {}) {
  return {
    mode,
    // With a profile, draft NEVER classified: a missing role_family resolved straight to "general".
    // Resume Master classifies (a model call) when no family is sent at all, so "general" is sent
    // instead — which resolves to the same module draft used.
    ...(domainProfile ? { roleFamily: domainProfile.role_family || "general", domain: domainProfile.domain ?? undefined } : {}),
    candidate: candidateFromProfile(profile),
    profile: jobProfileFromDomainProfile(domainProfile),
    claims: claims && (claims.skills?.length || claims.actionVerbs?.length) ? { skills: claims.skills || [], actionVerbs: claims.actionVerbs || [] } : null,
    employers: employers || [],
    job: jobForResumeMaster(job),
    baseResumeText,
    options: { includeSummary: includeSummary === true, ...(cache === false && cacheOptionAccepted === true ? { cache: false } : {}) },
  };
}
