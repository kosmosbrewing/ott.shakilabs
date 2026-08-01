# ShakiLabs UI artifact

`shakilabs-ui-0.3.10.tgz` is the active exact artifact for `@shakilabs/ui` 0.3.10.

- Source repository: `kosmosbrewing/00.root-shakilabs` (`packages/ui`)
- Source commit: `7843f68e9e9b7dd1e4d43214e9a0933009412e53` — `feat(ui): 차트 수학 export + ShMetricBars·ShRankedBars 승격 (0.3.10)`
- SHA-256: `1c3285b26ae4fc4e0349091f898e0eccefefdb8d0699198adb024986336d4120`
- Referenced by: `client/package.json` → `"@shakilabs/ui": "file:vendor/shakilabs-ui-0.3.10.tgz"`
- Rollback artifacts: available from Git history when needed

Only the active exact artifact is committed so an isolated Vercel checkout can run `npm ci` without a private registry token.

## Verify

```sh
shasum -a 256 client/vendor/shakilabs-ui-0.3.10.tgz
```

The digest must equal the SHA-256 above. `npm run verify:supply-chain` (also run in CI) checks the
same three facts automatically: the digest, the version in the filename, and the `file:vendor/...`
reference in `client/package.json`.

## When bumping the version

1. `npm pack` the new `@shakilabs/ui` release from `00.root-shakilabs` and drop the tgz here.
2. Delete the previous tgz — exactly one artifact stays committed.
3. Update `client/package.json` + `client/package-lock.json` to the new `file:vendor/...` path.
4. Update this file: filename, version, source commit, SHA-256.
5. `npm run verify:supply-chain` must pass before opening the PR.
