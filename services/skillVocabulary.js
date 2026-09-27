// The scorer's vocabulary moved into @draft/ats-scorer with the scorer (A1). Re-exported so the
// harnesses that read it (scripts/ah3TermQuality.mjs) see the PACKAGE's registries — the ones the
// scorer actually uses — rather than a second copy.
export {
  skillVocabularyTerms, actionVerbVocabularyTerms, companyStackTerms, resetSkillVocabularyCache,
  REGISTRY_DIR, REGISTRY_FILES,
} from "@draft/ats-scorer";
