// vendor tgz ↔ vendor/README.md ↔ package.json 3자 대조.
// vendor README는 "오래된 문서"가 아니라 공급망 기록이다. 버전·SHA-256이 실제 tgz와
// 어긋나면 무결성 검증을 하려는 사람에게 오답을 준다. 네트워크·설치 없이 1초 미만.
// vendor 디렉터리가 없으면 no-op — 12개 앱에 그대로 복사 가능.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = resolve(projectRoot, "vendor");

if (!existsSync(vendorDir)) {
  console.log("verify-vendor: no vendor directory, skipping");
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
const tarballs = readdirSync(vendorDir).filter((name) => name.endsWith(".tgz"));
const errors = [];

// 정책: 활성 아티팩트 1개만 커밋한다(롤백본은 Git 히스토리에서 꺼낸다).
if (tarballs.length !== 1) {
  errors.push(`expected exactly 1 vendored .tgz, found ${tarballs.length}: ${tarballs.join(", ") || "none"}`);
}

for (const tarball of tarballs) {
  const sha256 = createHash("sha256").update(readFileSync(resolve(vendorDir, tarball))).digest("hex");
  const version = tarball.match(/-(\d+\.\d+\.\d+)\.tgz$/)?.[1];

  if (!version) {
    errors.push(`${tarball}: filename does not carry a semver version`);
  }

  // package.json이 실제로 이 파일을 가리키는가
  const reference = `file:vendor/${tarball}`;
  const dependent = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).find(
    ([, spec]) => spec === reference,
  );

  if (!dependent) {
    errors.push(`${tarball}: no package.json dependency references "${reference}"`);
  }

  // README가 파일명·버전·해시를 정확히 기록하고 있는가
  const readmePath = resolve(vendorDir, "README.md");

  if (!existsSync(readmePath)) {
    errors.push("vendor/README.md is missing");
    continue;
  }

  const readme = readFileSync(readmePath, "utf8");

  if (!readme.includes(tarball)) {
    errors.push(`vendor/README.md does not mention the vendored file "${tarball}"`);
  }

  if (!readme.includes(sha256)) {
    errors.push(`vendor/README.md SHA-256 does not match ${tarball} (actual ${sha256})`);
  }

  if (version && !readme.includes(version)) {
    errors.push(`vendor/README.md does not mention version ${version}`);
  }
}

if (errors.length > 0) {
  console.error("verify-vendor: FAILED");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`verify-vendor: OK (${tarballs.join(", ")})`);
