// shared/skillAliases.js — ⛔ D84 F6 · CANONICAL SKILL NAMES. "Postgres" and "PostgreSQL" are one skill, and two names
// for one skill are two terms to the scorer. Each group below is one skill; the CANONICAL name is the member the skills
// vocabulary holds (packages/ats-scorer's registries — the terms the scorer matches), else the group's first member.
// ⚠ So the canonical name follows the vocabulary, not a preference: it holds "GCP" and "AWS", so those win over
// "Google Cloud Platform" and "Amazon Web Services". A term in no group and not in the vocabulary is UNKNOWN — reported
// for the vocabulary's review (D72 P2's queue, when it exists), never invented into a group here.
// ⛔ Pure: read by the server's importer and by the prompt.

export const SKILL_GROUPS = [
  ["PostgreSQL", "Postgres", "Postgre SQL", "psql"],
  ["Kubernetes", "K8s", "kube"],
  ["GCP", "Google Cloud Platform", "Google Cloud"],
  ["AWS", "Amazon Web Services"],
  ["Azure", "Microsoft Azure"],
  ["JavaScript", "JS", "ECMAScript"],
  ["TypeScript", "TS"],
  ["Go", "Golang", "Go (Golang)"],
  ["React", "React.js", "ReactJS", "React JS"],
  ["Node.js", "Node", "NodeJS", "Node JS"],
  ["Next.js", "NextJS", "Next"],
  ["Vue.js", "Vue", "VueJS"],
  ["Kafka", "Apache Kafka"],
  ["Spark", "Apache Spark", "PySpark"],
  ["Airflow", "Apache Airflow"],
  ["C#", "C Sharp", "CSharp"],
  ["C++", "CPP"],
  [".NET", "dotnet", ".NET Core"],
  ["Machine Learning", "ML"],
  ["Artificial Intelligence", "AI"],
  ["CI/CD", "CICD", "CI / CD", "Continuous Integration"],
  ["MongoDB", "Mongo"],
  ["Elasticsearch", "Elastic Search"],
  ["GraphQL", "Graph QL"],
  ["REST", "REST APIs", "RESTful", "RESTful APIs", "REST API"],
  ["scikit-learn", "sklearn", "Scikit Learn"],
  ["TensorFlow", "TF"],
  ["PyTorch", "Torch"],
  ["Terraform", "HashiCorp Terraform"],
  ["SQL", "Structured Query Language"],
  ["NoSQL", "No SQL"],
  ["Large Language Models", "LLM", "LLMs"],
];

const byAlias = new Map();
for (const g of SKILL_GROUPS) for (const name of g) byAlias.set(name.toLowerCase(), g);

/**
 * The canonical name of a skill. `vocabulary` is a Map lowercase → display form of the vocabulary's terms.
 * @returns {{ name: string, known: boolean, aliased: boolean }}
 */
export function canonicalSkill(raw, vocabulary = new Map()) {
  const name = String(raw ?? "").trim();
  const group = byAlias.get(name.toLowerCase());
  if (group) {
    const inVocab = group.find((m) => vocabulary.has(m.toLowerCase()));
    const canonical = inVocab ? vocabulary.get(inVocab.toLowerCase()) : group[0];
    return { name: canonical, known: Boolean(inVocab), aliased: canonical !== name };
  }
  if (vocabulary.has(name.toLowerCase())) {
    const v = vocabulary.get(name.toLowerCase());
    return { name: v, known: true, aliased: v !== name };
  }
  return { name, known: false, aliased: false };
}

/** Examples for the prompt — each a group whose canonical form the vocabulary holds. */
export const PROMPT_EXAMPLES = ["PostgreSQL (not Postgres)", "Kubernetes (not K8s)", "Go (not Golang)", "React (not React.js)",
  "Node.js (not Node)", "Kafka (not Apache Kafka)"];
