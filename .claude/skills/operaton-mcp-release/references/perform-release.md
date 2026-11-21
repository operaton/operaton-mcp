# PERFORM release

Drives `.github/workflows/release.yml` (npm publish + JReleaser). Only on an explicit "perform release …" request.

## release.yml (workflow_dispatch)

| Input | Values | Notes |
|-------|--------|-------|
| `release_type` | `final` / `preliminary` | `preliminary` publishes `X.Y.Z-SNAPSHOT` to npm dist-tag `next` (once per SNAPSHOT version — npm never reuses a version) |
| `dry_run` | `true` / `false` | `true`: npm `publish --dry-run`, JReleaser `--dry-run`, no tag, no push |
| `otp` | npm one-time password | required when `dry_run=false`; masked in logs |

Real runs only from `main` or `release/X.Y.x` (workflow enforces it). A final run, in order:
set version `VER` → `npm pack` → **push tag `vVER`** → choose dist-tag → **`npm publish`** → **JReleaser** (GitHub release with changelog, `released` label + comment on referenced issues/PRs, milestone `VER` applied and closed) → **push next SNAPSHOT** (`main`: next minor, `release/*`: next patch).

npm dist-tag: `latest`, except on `release/*` when `VER` is not newer than the current `latest` → `release-X.Y` (an older line must not steal `latest`).

## Procedure

1. **Gate:** PREPARE 🟢 (or accepted 🟡) this session.
2. **Dry run on BRANCH:**
   ```bash
   gh workflow run release.yml --ref BRANCH -f release_type=final -f dry_run=true
   gh run list --workflow release.yml --branch BRANCH -L 1 --json databaseId --jq '.[0].databaseId'
   gh run watch <id> --exit-status
   gh run view <id> --log | grep -E 'filename: operaton-mcp-|npm dist-tag:|JReleaser (succeeded|failed)|issue\(s\)'
   ```
   Expect `operaton-mcp-VER.tgz`, the dist-tag you expect, `JReleaser succeeded`.
3. **Confirm** with the maintainer: "Release `VER` from `BRANCH` to npm dist-tag `<tag>` — irreversible. Ready?"
4. **Hand over the real command** — the maintainer runs it with the `!` prefix so the OTP stays with them:
   ```
   ! gh workflow run release.yml --ref BRANCH -f release_type=final -f dry_run=false -f otp=<OTP>
   ```
   Then find and watch the run (`gh run list … -L 1`, `gh run watch <id> --exit-status`).
5. **On failure** — find the failed step (`gh run view <id> --json jobs --jq '.jobs[0].steps[]|"\(.conclusion)\t\(.name)"'`) and use the table below. Never re-run the whole workflow blindly.
6. **Verify** (all must hold):
   ```bash
   npm view @operaton/mcp dist-tags                 # registry, not the npmjs.com page (page caches for minutes)
   git ls-remote --tags origin vVER
   gh release view vVER --json url,isDraft,isPrerelease,assets --jq '{url,isDraft,isPrerelease,assets:[.assets[].name]}'
   gh api "repos/operaton/operaton-mcp/milestones?state=all" --jq '.[]|select(.title=="VER")|[.state,.closed_issues]'
   gh issue list --state closed --label released --milestone VER
   gh api "repos/operaton/operaton-mcp/contents/package.json?ref=BRANCH" --jq .content | base64 -d | grep '"version"'   # next SNAPSHOT
   ```
7. **Curated release notes** (JReleaser keeps its generated body; `overwrite: false`):
   `gh release edit vVER --notes-file <scratchpad>/release-notes-VER.md` — show the file to the maintainer first.
8. **Patch: backmerge** `release/X.Y.x` → `main` (see below).
9. **Report:** run URL, npm dist-tags, release URL, milestone state, labelled items, SNAPSHOT commit, PRs opened, anything left manual.

## Recovery

| Failed step | State | Action |
|-------------|-------|--------|
| before "Create and push semver tag" | nothing published | fix, re-dry-run, maintainer re-dispatches |
| after tag push, before/at "Publish to NPM" | tag `vVER` exists, npm not published | ask the maintainer, then `git push origin :refs/tags/vVER`, fix, re-dispatch with a fresh OTP. `EOTP`/`E401` = expired OTP: same path |
| at/after JReleaser | npm published, tag exists | **do not re-run** (npm publish would fail). Ask: run JReleaser locally (`JRELEASER_GITHUB_TOKEN=$(gh auth token) JRELEASER_PROJECT_VERSION=VER jreleaser full-release` on a clone at `vVER` with `operaton-mcp-VER.tgz` from `npm pack`) or create the release by hand |
| "Bump to next SNAPSHOT" | released | open a PR setting `X.Y.(Z+1)-SNAPSHOT` (patch) / `X.(Y+1).0-SNAPSHOT` (main) |

## Patch: backmerge to `main`

Fixes land on `release/X.Y.x` first; `main` gets them through one merge commit so history shows the line was merged.

```bash
git switch -c merge/release-X.Y.x-into-main-VER origin/main
git merge --no-ff origin/release/X.Y.x
# conflicts in package.json / package-lock.json: keep main's version
git checkout --ours package.json && npm install --package-lock-only && git add package.json package-lock.json
git commit --no-edit && npm ci && npm run build && npm test
git push -u origin merge/release-X.Y.x-into-main-VER
gh pr create --base main --title "chore: backmerge release/X.Y.x (VER) into main"
```
The PR must be merged with **"Create a merge commit"** (not squash). `main`'s version must stay unchanged — check `git diff origin/main -- package.json`. If `main` moved after the PR was opened, merge `origin/release/X.Y.x` and `origin/main` into the branch again.

## Creating a release branch (first patch of a line)

```bash
git switch -c release/X.Y.x vX.Y.0
npm version X.Y.1-SNAPSHOT --no-git-tag-version
git commit -am "chore: set version X.Y.1-SNAPSHOT"
git push -u origin release/X.Y.x
```
Ask before pushing a new long-lived branch. Fix PRs then target `release/X.Y.x`; keep the version change a separate commit so fixes cherry-pick cleanly.
