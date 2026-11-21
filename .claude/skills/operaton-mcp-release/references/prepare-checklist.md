# PREPARE checklist

Read-only except for PRs and milestone/label fixes. `REPO=operaton/operaton-mcp`, `VER=X.Y.Z`, `BRANCH` as resolved in SKILL.md, `PREV` = previous release tag on the line (`git describe --tags --abbrev=0 origin/BRANCH`).

## 1. Branch & version
- [ ] `git fetch origin --tags` (local branches are often stale — always use `origin/BRANCH`). "would clobber existing tag" = a local tag differs from the remote one: report it, do not `--force` it away; use `git ls-remote --tags origin` for tag facts
- [ ] `git ls-remote --heads origin BRANCH` exists
- [ ] `git show origin/BRANCH:package.json | grep '"version"'` == `VER-SNAPSHOT`
- [ ] `git ls-remote --tags origin vVER` empty (exists → 🔴)
- [ ] `npm view @operaton/mcp versions --json` does not contain `VER` (contains → 🔴, npm never reuses a version)

## 2. Content since `PREV`
- [ ] `git log --oneline PREV..origin/BRANCH` and `git diff --stat PREV origin/BRANCH`
- [ ] No change under `src/`, `scripts/`, `config/`, `resources/` and no runtime dependency bump → **ask the maintainer** what 1.x.y should contain before going further. Do not vote 🟢 on an empty release.
- [ ] Patch: fixes on `main` that the line still lacks: `git log --no-merges --oneline origin/BRANCH..origin/main` — flag `fix:` commits for backport (ask; don't backport on your own).

## 3. CI & dependencies
- [ ] `gh run list --branch BRANCH --workflow ci.yml -L 3` — head commit green
- [ ] `gh run list --branch main --workflow integration.yml -L 3` — note result (it only runs on `main`; known pre-existing failures are not a blocker, new ones are)
- [ ] `gh api "repos/$REPO/dependabot/alerts?state=open&per_page=100" --jq '.[]|[.security_advisory.severity,.dependency.package.name,.dependency.scope]|@tsv'` — open HIGH/CRITICAL in `runtime` scope → 🔴; `development` scope → non-blocking, list it
- [ ] Open Dependabot PRs against BRANCH: `gh pr list --base BRANCH --author app/dependabot` — runtime bumps worth merging first?

## 4. Milestones & labels
JReleaser (`jreleaser.yml`) applies milestone `VER` to every issue/PR referenced as `#N` in the changelog, labels it `released`, comments, and closes the milestone. The milestone must exist and be named exactly `VER` (no `v`). Issues that already carry `released` are skipped, and `applyMilestone: ALWAYS` only fills an empty milestone — `#N` refs to already-released issues (e.g. in a forward-port commit body) do not move them.
- [ ] Milestone exists: `gh api "repos/$REPO/milestones?state=all&per_page=100" --jq '.[]|[.number,.title,.state,.due_on]|@tsv'`. Missing → create it (due date = planned release day; send `T12:00:00Z`, GitHub shifts `T00:00:00Z` a day back):
  `gh api repos/$REPO/milestones -f title=VER -f due_on=YYYY-MM-DDT12:00:00Z`
- [ ] Closed issues/merged PRs since `PREV` without milestone:
  `gh issue list --state closed --search "no:milestone closed:>=PREV_DATE" ; gh pr list --state merged --search "no:milestone merged:>=PREV_DATE"` → assign: merged into BRANCH → `VER`; merged into `main` while releasing a patch → the next minor milestone.
- [ ] Next milestone exists (`X.(Y+1).0` for a minor; for a patch the line's next patch is created only when needed).

## 5. Documentation drift
The README ships in the npm tarball; npmjs.com shows the README of the latest published version.
- [ ] `git checkout --detach origin/BRANCH && npm ci && npm run build && node .claude/skills/operaton-mcp-release/scripts/list-tools.mjs` — tool count and names (use `--json` for parameters)
- [ ] README: feature bullets (tool count), per-group tool lists, examples, project structure match the build
- [ ] `operaton/documentation` → `docs/documentation/user-guide/mcp-server/{index,capabilities,configuration}.md`:
  `gh api repos/operaton/documentation/contents/docs/documentation/user-guide/mcp-server/FILE.md --jq .content | base64 -d`
  — same claims (tool count, supported resource types, tool groups, env vars, guard modes) match the build and `docs/configuration.md`
- [ ] Drift → PR on this repo (target BRANCH; for a patch also `main`) and/or PR on `operaton/documentation` (ask before opening a PR in another repo).

## 6. Release notes
Draft per `references/release-notes.md`. Save as `release-notes-VER.md` in the scratchpad, show the path.

## 7. Patch only: backmerge plan
After the release, `release/X.Y.x` must be merged back into `main` (merge commit, `main` keeps its version). Check now whether that merge will conflict beyond `package.json`/`package-lock.json`:
`git merge-tree --write-tree origin/main origin/BRANCH` (non-zero exit = conflicts; list the files).

## 8. Vote
Per SKILL.md rubric. Include the exact dry-run command for PERFORM.
