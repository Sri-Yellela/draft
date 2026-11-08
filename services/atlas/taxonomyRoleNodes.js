// services/atlas/taxonomyRoleNodes.js — ⭐ D179 P6 (owner 11-08: "yes, create the 134 roles as drafts").
//
// Every subcategory of the approved taxonomy (content/taxonomy/roles-v1.json — not the held categories, not the
// "general" ones) becomes an Atlas ROLE node, as a DRAFT for the Atlas desk (Admin → Atlas): the owner reviews,
// edits and publishes each; nothing appears on the public Atlas until published.
//   · name    — the subcategory's first job-title alias, title-cased ("backend engineer" → "Backend Engineer"); a bare
//               subcategory name ("Backend") would read as a skill, not a role. With no alias: "<name> role".
//   · reuse   — a role node that already exists by that name is NOT duplicated: the subcategory is linked to it.
//   · family  — the subcategory's Atlas family when Atlas has it (the names match shared/atlasFamilies.js); the taxonomy's
//               "NEW: …" families (Security, Mobile, Frontend, QA …) do not exist yet → no family, for the desk to set.
//               family_by = 'taxonomy', so the boot family seed never overwrites it.
//   · definition — a draft line in draft's own words from the taxonomy's signals (definition_by NULL: the desk's to edit).
//   · atlas_taxonomy_roles links node ↔ subcategory (the board's role ↔ the Atlas's role).
// Idempotent: run on every boot; a subcategory already linked is skipped.
import { upsertNode } from "./atlasStore.js";
import { FAMILIES } from "../../shared/atlasFamilies.js";

const FAMILY_BY_NAME = new Map(FAMILIES.map(f => [f.name.toLowerCase(), f.key]));
// Title case, but a word that already carries capitals ("iOS", "ML", "FPGA") is left as written.
const title = (s) => String(s || "").trim().split(/(\s+)/).map(w => (/[A-Z]/.test(w) || /^\s+$/.test(w) ? w
  : /^(and|of|for|the|in|on|to)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join("");

export function roleNameFor(sub) {
  const alias = (sub.aliases || []).find(a => /\b(engineer|manager|scientist|analyst|designer|developer|architect|specialist|lead|director|consultant|administrator|coordinator|writer|researcher|technician|counsel|attorney|accountant|recruiter|representative|executive|planner|officer|strategist|editor|producer|buyer|auditor)\b/i.test(a))
    || (sub.aliases || [])[0];
  return alias ? title(alias) : `${sub.name} role`;
}

export function seedTaxonomyRoles(db, taxonomyJson, { log = console } = {}) {
  const out = { created: 0, linked: 0, skipped: 0 };
  if (!taxonomyJson?.categories || !/^APPROVED/i.test(String(taxonomyJson.status || ""))) return out;
  const linked = new Set(db.prepare(`SELECT subcategory FROM atlas_taxonomy_roles`).all().map(r => r.subcategory));
  db.transaction(() => {
    for (const c of taxonomyJson.categories) {
      if (c.held) continue;
      for (const s of c.subcategories || []) {
        if (/\.general$/.test(s.id)) continue;
        if (linked.has(s.id)) { out.skipped++; continue; }
        const name = roleNameFor(s);
        const signals = (s.signals || []).slice(0, 5);
        const definition = `${c.name} › ${s.name}.${signals.length ? ` The work centres on ${signals.join(", ")}.` : ""}`;
        // upsertNode writes the definition only when it creates the node — an existing role keeps its own.
        const { id, created } = upsertNode(db, { kind: "role", name, source: "taxonomy", definition, status: "draft" });
        const node = db.prepare(`SELECT id, kind FROM atlas_nodes WHERE id = ?`).get(id);
        if (!node || node.kind !== "role") { out.skipped++; continue; }   // a SKILL by that name exists — never turned into a role
        if (created) {
          const fam = FAMILY_BY_NAME.get(String(s.family || "").toLowerCase()) || null;
          if (fam) { try { db.prepare(`UPDATE atlas_nodes SET family = ?, family_by = 'taxonomy' WHERE id = ?`).run(fam, id); } catch { /* no family column */ } }
          out.created++;
        } else out.linked++;
        db.prepare(`INSERT OR IGNORE INTO atlas_taxonomy_roles (subcategory, node_id, category) VALUES (?, ?, ?)`).run(s.id, id, c.id);
      }
    }
  })();
  if (out.created || out.linked) log.log?.(`[atlas] taxonomy roles: ${out.created} drafts created, ${out.linked} linked to existing roles`);
  return out;
}
