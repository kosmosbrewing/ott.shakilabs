// SBOM 신원 검증 — 재생성/diff가 아니라 "이 산출물이 이 저장소 것인가"만 본다.
// 재생성 후 diff는 CycloneDX metadata.timestamp·SPDX documentNamespace(UUID)·npm CLI 버전
// 때문에 항상 실패하므로 쓰지 않는다. 여기서 보는 값은 전부 결정적이다.
// SBOM 파일이 없으면 즉시 통과한다 — 12개 앱에 그대로 복사해도 무해하게 no-op.
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sbomDir = resolve(projectRoot, "artifacts", "sbom");
const cyclonedxPath = resolve(sbomDir, "production.cyclonedx.json");
const spdxPath = resolve(sbomDir, "production.spdx.json");

if (!existsSync(cyclonedxPath)) {
  console.log("verify-sbom-identity: no committed/generated SBOM, skipping");
  process.exit(0);
}

const pkg = readJson(resolve(projectRoot, "package.json"));
const errors = [];

const cyclonedx = readJson(cyclonedxPath);
const component = cyclonedx.metadata?.component ?? {};
expect("cyclonedx metadata.component.name", component.name, pkg.name);
expect("cyclonedx metadata.component.version", component.version, pkg.version);

const repositoryUrl = resolveRepositoryUrl();
if (repositoryUrl) {
  const vcs = (component.externalReferences ?? []).find((ref) => ref.type === "vcs");
  expect("cyclonedx vcs externalReference", vcs && stripGitSuffix(vcs.url), repositoryUrl);
} else {
  console.log("verify-sbom-identity: repository URL unknown, skipping vcs check");
}

if (existsSync(spdxPath)) {
  const spdx = readJson(spdxPath);
  const rootId = spdx.documentDescribes?.[0];
  const rootPackage = spdx.packages?.find((item) => item.SPDXID === rootId);
  expect("spdx root package name", rootPackage?.name, pkg.name);
  expect("spdx root package versionInfo", rootPackage?.versionInfo, pkg.version);
}

if (errors.length > 0) {
  console.error("verify-sbom-identity: FAILED");
  for (const error of errors) console.error(`  - ${error}`);
  console.error("  SBOM이 다른 저장소 것으로 오염됐을 수 있다. npm run sbom:prod 로 재생성하라.");
  process.exit(1);
}

console.log(`verify-sbom-identity: OK (${pkg.name}@${pkg.version})`);

function expect(label, actual, expected) {
  if (actual !== expected) {
    errors.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// CI에서는 GITHUB_REPOSITORY가 정답이고, 로컬에서는 origin 리모트로 대체한다.
function resolveRepositoryUrl() {
  if (process.env.GITHUB_REPOSITORY) {
    return `https://github.com/${process.env.GITHUB_REPOSITORY}`;
  }

  try {
    const raw = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (raw.startsWith("git@github.com:")) {
      return `https://github.com/${stripGitSuffix(raw.slice("git@github.com:".length))}`;
    }

    return stripGitSuffix(raw);
  } catch {
    return "";
  }
}

function stripGitSuffix(url) {
  return (url ?? "").replace(/\.git$/, "");
}
