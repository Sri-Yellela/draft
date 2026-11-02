// shared/atlasFamilies.js — ⭐ D116 M1 · THE ATLAS FAMILIES, defined once: the server (the tree's data, the editor's
// check, the seed) and the client (the branch colours, the waypoints, the editor's choice) read this list.
// A family is a stored field on atlas_nodes (migration 201); its order here is the tree's order round the circle.
// More may be added (owner 10-31): one line here, one colour token in AtlasTree.css.
// ⭐ A111 P3 (11-02) · every family belongs to ONE D127 category (services/jobs/professionalScope.js CATEGORIES:
// computing · engineering · management · business · science · legal · arts_media · sales · marketing), so a node's
// family says its category and the Atlas can answer "this role's skills" without another category's. The first five are
// today's computing tree, unchanged. `workplace_tools` (Excel, Jira, Slack …) is asked for in every category: its
// category is null — no category's, never "another category's".

const fam = (key, name, category) => Object.freeze({ key, name, category });
export const FAMILIES = Object.freeze([
  fam("ml", "ML", "computing"),
  fam("systems", "Systems", "computing"),
  fam("infra", "Infra", "computing"),
  fam("data", "Data", "computing"),
  fam("backend", "Backend", "computing"),
  fam("business_analysis", "Business analysis", "business"),
  fam("accounting_audit", "Accounting & audit", "business"),
  fam("fpa", "Finance & FP&A", "business"),
  fam("consulting", "Consulting & strategy", "business"),
  fam("people", "People & HR", "business"),
  fam("project_management", "Project & program management", "management"),
  fam("product", "Product management", "management"),
  fam("operations", "Operations & supply chain", "management"),
  fam("marketing_digital", "Digital marketing", "marketing"),
  fam("marketing_brand", "Brand & product marketing", "marketing"),
  fam("marketing_content", "Content & lifecycle marketing", "marketing"),
  fam("sales", "Sales", "sales"),
  fam("legal_practice", "Legal practice", "legal"),
  fam("design", "Design & UX", "arts_media"),
  fam("writing_comms", "Writing & communications", "arts_media"),
  fam("research_science", "Research & science", "science"),
  fam("eng_mechanical", "Mechanical", "engineering"),
  fam("eng_electrical", "Electrical & hardware", "engineering"),
  fam("eng_civil", "Civil & structural", "engineering"),
  fam("eng_process", "Process & industrial", "engineering"),
  fam("eng_aerospace", "Aerospace", "engineering"),
  fam("eng_biomedical", "Biomedical", "engineering"),
  fam("workplace_tools", "Workplace tools", null),
]);

export const FAMILY_KEYS = Object.freeze(FAMILIES.map(f => f.key));
export const familyName = (key) => FAMILIES.find(f => f.key === key)?.name ?? null;
export const isFamily = (key) => FAMILY_KEYS.includes(key);
/** The D127 category a family belongs to (null for an unknown family and for the cross-category workplace tools). */
export const familyCategory = (key) => FAMILIES.find(f => f.key === key)?.category ?? null;
/** The families of one category, in the tree's order. */
export const familiesOfCategory = (category) => FAMILIES.filter(f => f.category === category);
