// shared/techVocabulary.js — ⭐ D179 P5a (45l) · THE TECHNOLOGIES A COMPANY'S STACK IS MADE OF, AND THEIR ALIASES.
//
// D179 (5): "technographics that earn their place — evidence, never guesses". A company's stack is read from its OWN
// postings: each technology below, found in a posting's text under its name or one of its aliases (k8s → Kubernetes,
// Postgres → PostgreSQL, GCP → Google Cloud), counts once for that posting. Only technologies — never soft skills
// ("problem solving", "code review" polluted the old company_technographics table, services/kb/technographics.js).
//
// Each entry: [canonical name, group, ...aliases]. Groups are the company page's (D179 (5)): languages · frameworks ·
// data · cloud · devops · ml-ai · tools. Matching is whole-word and case-insensitive; `caseSensitive` aliases (short or
// ambiguous words: "Go", "R", "C", "Rust"…) match only as written, and some only in a technology context (CONTEXT_ONLY).
export const TECH_GROUPS = Object.freeze(["languages", "frameworks", "data", "cloud", "devops", "ml-ai", "tools"]);

export const TECHNOLOGIES = Object.freeze([
  // ── languages ──
  ["Python", "languages"], ["Java", "languages"], ["JavaScript", "languages", "javascript", "ecmascript"],
  ["TypeScript", "languages"], ["Go", "languages", "golang"], ["Rust", "languages"], ["C++", "languages", "cpp"],
  ["C#", "languages", "csharp", "c sharp"], ["C", "languages"], ["Kotlin", "languages"], ["Swift", "languages"],
  ["Objective-C", "languages", "objective c", "objc"], ["Ruby", "languages"], ["PHP", "languages"], ["Scala", "languages"],
  ["R", "languages"], ["MATLAB", "languages"], ["Julia", "languages"], ["Perl", "languages"], ["Elixir", "languages"],
  ["Erlang", "languages"], ["Haskell", "languages"], ["Clojure", "languages"], ["Dart", "languages"], ["Lua", "languages"],
  ["SQL", "languages"], ["Bash", "languages", "shell scripting"], ["PowerShell", "languages"], ["Verilog", "languages"],
  ["VHDL", "languages"], ["SystemVerilog", "languages"], ["Solidity", "languages"], ["Fortran", "languages"], ["COBOL", "languages"],
  // ── frameworks ──
  ["React", "frameworks", "react.js", "reactjs"], ["React Native", "frameworks"], ["Next.js", "frameworks", "nextjs"],
  ["Vue", "frameworks", "vue.js", "vuejs"], ["Angular", "frameworks", "angularjs"], ["Svelte", "frameworks"],
  ["Node.js", "frameworks", "nodejs", "node js"], ["Express", "frameworks", "express.js", "expressjs"],
  ["Django", "frameworks"], ["Flask", "frameworks"], ["FastAPI", "frameworks"], ["Spring", "frameworks", "spring boot", "springboot"],
  ["Ruby on Rails", "frameworks", "rails"], ["Laravel", "frameworks"], [".NET", "frameworks", "dotnet", "asp.net", ".net core"],
  ["Flutter", "frameworks"], ["SwiftUI", "frameworks"], ["Jetpack Compose", "frameworks"], ["GraphQL", "frameworks"],
  ["gRPC", "frameworks"], ["Redux", "frameworks"], ["Tailwind CSS", "frameworks", "tailwind"], ["jQuery", "frameworks"],
  ["Unity", "frameworks"], ["Unreal Engine", "frameworks", "unreal"], ["ROS", "frameworks", "robot operating system"],
  // ── data ──
  ["PostgreSQL", "data", "postgres", "postgresql"], ["MySQL", "data"], ["SQL Server", "data", "mssql", "microsoft sql server"],
  ["Oracle Database", "data", "oracle db", "pl/sql"], ["SQLite", "data"], ["MongoDB", "data", "mongo"], ["Redis", "data"],
  ["Cassandra", "data"], ["DynamoDB", "data"], ["Elasticsearch", "data", "elastic search", "opensearch"],
  ["Snowflake", "data"], ["BigQuery", "data", "big query"], ["Redshift", "data"], ["Databricks", "data"],
  ["Apache Spark", "data", "spark", "pyspark"], ["Apache Kafka", "data", "kafka"], ["Apache Airflow", "data", "airflow"],
  ["dbt", "data"], ["Hadoop", "data"], ["Apache Flink", "data", "flink"], ["ClickHouse", "data"], ["Neo4j", "data"],
  ["Tableau", "data"], ["Power BI", "data", "powerbi"], ["Looker", "data"], ["pandas", "data"], ["NumPy", "data", "numpy"],
  ["Excel", "data", "microsoft excel"],
  // ── cloud ──
  ["AWS", "cloud", "amazon web services"], ["Google Cloud", "cloud", "gcp", "google cloud platform"],
  ["Azure", "cloud", "microsoft azure"], ["AWS Lambda", "cloud", "lambda functions"], ["Amazon S3", "cloud", "s3"],
  ["Amazon EC2", "cloud", "ec2"], ["Cloudflare", "cloud"], ["Vercel", "cloud"], ["Heroku", "cloud"], ["Firebase", "cloud"],
  ["Supabase", "cloud"], ["Salesforce", "cloud"], ["SAP", "cloud"], ["ServiceNow", "cloud"], ["Workday", "cloud"],
  // ── devops ──
  ["Kubernetes", "devops", "k8s"], ["Docker", "devops"], ["Terraform", "devops"], ["Ansible", "devops"], ["Helm", "devops"],
  ["Jenkins", "devops"], ["GitHub Actions", "devops"], ["GitLab CI", "devops", "gitlab ci/cd"], ["CircleCI", "devops"],
  ["Argo CD", "devops", "argocd"], ["Prometheus", "devops"], ["Grafana", "devops"], ["Datadog", "devops"],
  ["Splunk", "devops"], ["New Relic", "devops"], ["Linux", "devops"], ["Nginx", "devops"], ["Istio", "devops"],
  ["Pulumi", "devops"], ["Chef", "devops"], ["Puppet", "devops"], ["Vault", "devops", "hashicorp vault"],
  // ── ml-ai ──
  ["PyTorch", "ml-ai"], ["TensorFlow", "ml-ai"], ["JAX", "ml-ai"], ["scikit-learn", "ml-ai", "sklearn", "scikit learn"],
  ["Keras", "ml-ai"], ["XGBoost", "ml-ai"], ["Hugging Face", "ml-ai", "huggingface", "transformers library"],
  ["LangChain", "ml-ai"], ["LlamaIndex", "ml-ai"], ["OpenAI API", "ml-ai", "openai api"], ["CUDA", "ml-ai"],
  ["MLflow", "ml-ai"], ["Kubeflow", "ml-ai"], ["SageMaker", "ml-ai", "amazon sagemaker"], ["Vertex AI", "ml-ai"],
  ["OpenCV", "ml-ai"], ["Ray", "ml-ai"], ["vLLM", "ml-ai"], ["ONNX", "ml-ai"], ["Triton", "ml-ai"],
  // ── tools ──
  ["Git", "tools"], ["GitHub", "tools"], ["GitLab", "tools"], ["Jira", "tools"], ["Confluence", "tools"], ["Figma", "tools"],
  ["Postman", "tools"], ["Webpack", "tools"], ["Vite", "tools"], ["Bazel", "tools"], ["Gradle", "tools"], ["Maven", "tools"],
  ["Selenium", "tools"], ["Cypress", "tools"], ["Playwright", "tools"], ["Jest", "tools"], ["pytest", "tools"],
  ["AutoCAD", "tools"], ["SolidWorks", "tools"], ["Revit", "tools"], ["Procore", "tools"], ["Primavera P6", "tools", "primavera"],
  ["Microsoft Project", "tools", "ms project"], ["Bluebeam", "tools"], ["ANSYS", "tools"], ["Simulink", "tools"],
  ["Altium", "tools", "altium designer"], ["Cadence", "tools"], ["LabVIEW", "tools"], ["CATIA", "tools"], ["Creo", "tools"],
  ["Smartsheet", "tools"], ["Asana", "tools"], ["HubSpot", "tools"], ["Zendesk", "tools"], ["NetSuite", "tools"],
  ["QuickBooks", "tools"], ["Adobe Creative Suite", "tools", "adobe creative cloud", "photoshop", "illustrator"],
]);

// Names that are ordinary words or letters: matched ONLY as written (case-sensitive), never lower-cased.
const CASE_SENSITIVE = new Set(["Go", "R", "C", "Rust", "Swift", "Ruby", "Julia", "Spring", "Express", "Flask", "Unity",
  "Helm", "Chef", "Puppet", "Vault", "Ray", "Triton", "Git", "Jest", "Excel", "Spark", "Lambda", "Looker", "Creo", "Cadence",
  "Dart", "Lua", "Vue", "Angular", "Redux", "React", "Docker", "Linux", "Asana", "SAP", "ROS", "SQL", "JAX", "CUDA", "Workday",
  "Hadoop", "Kafka", "Airflow", "Snowflake", "Databricks", "Tableau", "Figma", "Jira", "Bazel", "Vite", "Maven", "Gradle"]);
// Names that are also everyday words even when capitalised at a sentence's start — counted only next to another
// technology-ish word ("Go and Python", "written in Go", "R or Python").
const CONTEXT_ONLY = new Set(["Go", "R", "C", "Rust", "Swift", "Ruby", "Spring", "Express", "Unity", "Helm", "Chef", "Puppet",
  "Vault", "Ray", "Triton", "Cadence", "Creo", "Spark", "Lambda", "Dart", "Lua", "Julia", "Excel", "Workday"]);
const CONTEXT = /\b(languages?|frameworks?|stack|experience (?:with|in)|proficien\w*|written in|using|tools?|technolog\w*|Python|Java|JavaScript|TypeScript|C\+\+|SQL|Kubernetes|AWS|Docker|Scala|Kotlin)\b/;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BOUND_L = "(?<![A-Za-z0-9_+#.])";
const BOUND_R = "(?![A-Za-z0-9_+#])";

let _matchers = null;
function matchers() {
  if (_matchers) return _matchers;
  _matchers = TECHNOLOGIES.map(([name, group, ...aliases]) => {
    const cs = CASE_SENSITIVE.has(name);
    const forms = [...new Set([name, ...aliases])];
    // A case-sensitive name matches as written; its aliases (always longer, unambiguous) match in any case.
    const exact = cs ? new RegExp(`${BOUND_L}${esc(name)}${BOUND_R}`) : null;
    const loose = new RegExp(`${BOUND_L}(?:${forms.filter(f => !cs || f !== name).map(esc).join("|") || "(?!)"})${BOUND_R}`, "i");
    return { name, group, exact, loose, context: CONTEXT_ONLY.has(name) };
  });
  return _matchers;
}

/** The technologies a posting's text names: [{ name, group }], each once. */
export function technologiesIn(text) {
  const t = String(text || "");
  if (!t) return [];
  const out = [];
  for (const m of matchers()) {
    let hit = m.loose.test(t);
    if (!hit && m.exact) {
      const r = m.exact.exec(t);
      if (r) {
        if (!m.context) hit = true;
        else {
          const around = t.slice(Math.max(0, r.index - 80), r.index + m.name.length + 80);
          hit = CONTEXT.test(around.replace(new RegExp(`${BOUND_L}${esc(m.name)}${BOUND_R}`, "g"), " "));
        }
      }
    }
    if (hit) out.push({ name: m.name, group: m.group });
  }
  return out;
}

/** name → group, for a reader. */
export const TECH_GROUP_OF = Object.freeze(Object.fromEntries(TECHNOLOGIES.map(([n, g]) => [n, g])));
