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
 * The generate request coreGenerateResume sends. With an active job profile the caller supplies the
 * role family and domain, and Resume Master resolves the domain module exactly as draft's
 * qualificationResolver did for that path; without one, Resume Master classifies.
 */
export function generateRequest({ profile, job, baseResumeText, mode, employers = [], domainProfile = null,
                                  claims = null, includeSummary = false }) {
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
    options: { includeSummary: includeSummary === true },
  };
}
