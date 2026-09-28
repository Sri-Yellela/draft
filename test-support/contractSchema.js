// Validates a value against the JSON Schema subset the generated tools-service contract uses
// ($ref, anyOf, type, enum, properties, required, items).
//
// `strict: true` is for REQUESTS draft sends: every required key present AND no undeclared key.
// That is stricter than the service's own envelope harness, which checks responses one-directionally
// (real -> declared) because responses carry legitimately conditional fields. A request is different:
// a missing required field is draft's bug, and an undeclared one is a field the service ignores.
const jsonType = (v) => v === null ? "null" : Array.isArray(v) ? "array" : typeof v;

export function validate(value, schema, components, { strict = false } = {}, path = "$") {
  if (!schema || Object.keys(schema).length === 0) return [];
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop();
    if (!components[name]) return [`${path}: $ref to undeclared schema ${name}`];
    return validate(value, components[name], components, { strict }, path);
  }
  if (schema.anyOf) {
    const r = schema.anyOf.map(s => validate(value, s, components, { strict }, path));
    return r.some(x => x.length === 0) ? [] : [`${path}: matches no branch (${r.map(x => x[0]).join(" / ")})`];
  }
  const t = jsonType(value);
  const allowed = [].concat(schema.type ?? []);
  if (allowed.length && !allowed.includes(t)) return [`${path}: is ${t}, declared ${allowed.join("|")}`];
  if (schema.enum && !schema.enum.includes(value)) return [`${path}: ${JSON.stringify(value)} not in ${JSON.stringify(schema.enum)}`];
  const out = [];
  if (t === "object" && schema.properties) {
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;                        // JSON.stringify drops it
      if (!(k in schema.properties)) out.push(`${path}.${k}: UNDECLARED`);
      else out.push(...validate(v, schema.properties[k], components, { strict }, `${path}.${k}`));
    }
    if (strict) for (const k of schema.required || []) if (value[k] === undefined) out.push(`${path}.${k}: REQUIRED but absent`);
  }
  if (t === "array" && schema.items) value.forEach((v, i) => out.push(...validate(v, schema.items, components, { strict }, `${path}[${i}]`)));
  return out;
}
