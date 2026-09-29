// A1 — draft's side of the @draft/ats-scorer extraction. The package's own promises are tested in
// packages/ats-scorer/test; these are the promises draft makes about HOW it consumes the package.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import * as wrapper from "../services/localAtsScorer.js";
import * as pkg from "@draft/ats-scorer";

const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("⛔ the package's registries are the same bytes as draft's registry/ copies (LF-normalised)", () => {
  // Two copies exist on purpose: registry/ still feeds the domain picker (routes/domainProfiles.js),
  // and A1 did not move that. A copy with no drift check is how the scorer and the picker would
  // start disagreeing about what a skill is. (Moved from data/ on 09-29 — data/ is production's
  // runtime volume, which hides image files mounted under it.)
  for (const f of pkg.REGISTRY_FILES) {
    assert.equal(lf(path.join(pkg.REGISTRY_DIR, f)), lf(path.join("registry", f)),
      `packages/ats-scorer/data/${f} and registry/${f} have drifted — copy the changed one over the ` +
      `other, then run \`npm run checksums\` in packages/ats-scorer`);
  }
});

test("⛔ every file the package's manifest lists is TRACKED by git, not merely present on disk", async () => {
  // .gitignore's unanchored `data/` silently ignored packages/ats-scorer/data. Every other test here
  // passes on the machine that has the files; a fresh clone — and Railway's build — would not.
  const { execFileSync } = await import("node:child_process");
  const tracked = new Set(execFileSync("git", ["ls-files", "--cached", "packages/ats-scorer"], { encoding: "utf8" })
    .split("\n").filter(Boolean));
  const manifest = JSON.parse(fs.readFileSync("packages/ats-scorer/CHECKSUMS.json", "utf8"));
  for (const rel of Object.keys(manifest.files)) {
    assert.ok(tracked.has(`packages/ats-scorer/${rel}`),
      `packages/ats-scorer/${rel} is not tracked — check .gitignore, then \`git add\` it`);
  }
});

test("the scorer is the PACKAGE's — draft resolves it through node_modules, not a stale copy", () => {
  assert.equal(path.resolve(pkg.REGISTRY_DIR), path.resolve("packages/ats-scorer/data"));
  assert.equal(fs.existsSync("services/skillVocabulary.js") && /readFileSync/.test(lf("services/skillVocabulary.js")), false,
    "services/skillVocabulary.js reads files again — it must only re-export the package");
});

test("the wrapper adds resume_depth and nothing else", () => {
  const job = {
    title: "Backend Engineer", company: "Acme",
    description: "Python, Kubernetes, Kafka, Terraform, AWS.",
    skills_json: JSON.stringify(["Python", "Kubernetes", "Kafka", "Terraform", "AWS"].map(skill => ({ skill, type: "hard" }))),
  };
  const basis = pkg.buildRuntimeAtsBasis({ resumeText: "Python Kubernetes", signalProfile: {}, domainProfile: {} });
  const fromPackage = pkg.scoreAtsLocally({ job, runtimeBasis: basis });
  const fromWrapper = wrapper.scoreAtsLocally({ job, runtimeBasis: basis });
  const { resume_depth, ...rest } = fromWrapper;
  assert.deepEqual(rest, fromPackage, "the wrapper changed a scored field — scoring changes belong in the package");
  assert.ok(resume_depth, "a two-word résumé must raise the depth warning");
});

test("the wrapper's own source makes no scoring decision", () => {
  const src = lf("services/localAtsScorer.js");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(code, /score\s*[-+*/]=|Math\.(min|max)|weights|synonyms\s*=/,
    "services/localAtsScorer.js is computing something about the score — move it into the package");
});

test("the Docker build copies the package before `npm install`, or the file: dependency cannot resolve", () => {
  const docker = lf("Dockerfile");
  const copyPkg = docker.indexOf("COPY packages/");
  const install = docker.indexOf("RUN npm install");
  assert.ok(copyPkg >= 0, "Dockerfile never copies packages/ — the image would have no scorer");
  assert.ok(copyPkg < install, "packages/ must be copied BEFORE the first npm install");
  // .dockerignore patterns are anchored at the context root: `data` excludes ./data only, which is
  // why the package's own data/ reaches the image while draft's does not.
  const ignore = lf(".dockerignore").split("\n").map(s => s.trim());
  assert.ok(!ignore.some(l => /^(\*\*\/)?packages\b/.test(l) || l === "**/data" || l === "**/data/"),
    ".dockerignore would exclude the package or its registries from the image");
});
