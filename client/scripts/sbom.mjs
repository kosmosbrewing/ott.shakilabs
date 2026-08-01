import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const repoRoot = resolve(projectRoot, "..");
const outputDir = resolve(projectRoot, "artifacts", "sbom");

const packageJson = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
const repositoryUrl = resolveRepositoryUrl();
const baseArgs = [
  "sbom",
  "--package-lock-only",
  "--omit=dev",
  "--omit=optional",
  "--sbom-type",
  "application",
];

mkdirSync(outputDir, { recursive: true });

const cyclonedx = JSON.parse(runNpmSbom([...baseArgs, "--sbom-format", "cyclonedx"]));
normalizeCyclonedx(cyclonedx);

const spdx = JSON.parse(runNpmSbom([...baseArgs, "--sbom-format", "spdx"]));
normalizeSpdx(spdx);

writeJson(resolve(outputDir, "production.cyclonedx.json"), cyclonedx);
writeJson(resolve(outputDir, "production.spdx.json"), spdx);

console.log("Wrote client/artifacts/sbom/production.cyclonedx.json");
console.log("Wrote client/artifacts/sbom/production.spdx.json");

function runNpmSbom(args) {
  return execFileSync("npm", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function normalizeCyclonedx(document) {
  const component = document.metadata?.component ?? {};

  component.type = "application";
  component.name = packageJson.name;
  component.version = packageJson.version;
  component.purl = component.purl || toPurl(packageJson.name, packageJson.version);
  component.externalReferences = mergeVcsReference(component.externalReferences ?? []);
  component.properties = mergeProperties(component.properties ?? [], {
    "shakilabs:sbom:target": "production-artifact",
    "shakilabs:sbom:source": "npm sbom --package-lock-only --omit=dev --omit=optional",
  });

  document.metadata = {
    ...document.metadata,
    lifecycles: [{ phase: "build" }],
    component,
  };

  const componentRefs = new Set((document.components ?? []).map((item) => item["bom-ref"]));

  if (Array.isArray(document.dependencies)) {
    document.dependencies = document.dependencies
      .filter((entry) => entry.ref === component["bom-ref"] || componentRefs.has(entry.ref))
      .map((entry) => ({
        ...entry,
        dependsOn: (entry.dependsOn ?? []).filter((ref) => componentRefs.has(ref)),
      }));
  }
}

function normalizeSpdx(document) {
  const rootId = document.documentDescribes?.[0];
  const rootPackage = document.packages?.find((item) => item.SPDXID === rootId) ?? document.packages?.[0];

  if (!rootPackage) {
    return;
  }

  rootPackage.name = packageJson.name;
  rootPackage.versionInfo = packageJson.version;
  rootPackage.packageFileName = "client/dist";
  rootPackage.primaryPackagePurpose = "APPLICATION";
  rootPackage.comment = "Generated from the production dependency graph (package-lock-only, omit=dev, omit=optional).";

  document.comment = "Production artifact SBOM generated from npm lockfile.";
}

function mergeVcsReference(references) {
  if (!repositoryUrl) {
    return references;
  }

  const hasVcsReference = references.some(
    (reference) => reference.type === "vcs" && normalizeGitUrl(reference.url) === repositoryUrl,
  );

  if (hasVcsReference) {
    return references;
  }

  return [...references, { type: "vcs", url: repositoryUrl }];
}

function mergeProperties(properties, additions) {
  const merged = new Map(properties.map((property) => [property.name, property.value]));

  for (const [name, value] of Object.entries(additions)) {
    merged.set(name, value);
  }

  return [...merged.entries()].map(([name, value]) => ({ name, value }));
}

function resolveRepositoryUrl() {
  try {
    const raw = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return normalizeGitUrl(raw);
  } catch {
    return "";
  }
}

function normalizeGitUrl(url) {
  if (!url) {
    return "";
  }

  if (url.startsWith("git@github.com:")) {
    return `https://github.com/${url.slice("git@github.com:".length).replace(/\.git$/, "")}`;
  }

  return url.replace(/\.git$/, "");
}

function toPurl(name, version) {
  return `pkg:npm/${encodePurlName(name)}@${version}`;
}

function encodePurlName(name) {
  return name.replace(/^@/, "%40");
}

function writeJson(filePath, content) {
  writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`);
}
