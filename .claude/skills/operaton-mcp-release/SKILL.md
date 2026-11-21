---
name: operaton-mcp-release
description: Use when preparing, performing, or announcing a release of operaton-mcp (npm package @operaton/mcp). Triggers include "prepare release X.Y.Z", "perform release X.Y.Z", "release a patch", "cut 1.4.0", "announce release X.Y.Z", and questions about release.yml, JReleaser, npm dist-tags or OTP, release/X.Y.x branches, milestones, release notes, forward-porting or backmerging a patch to main.
---

# operaton-mcp Release

Three actions sharing one knowledge base. Patterned on `operaton/operaton`'s `operaton-release` skill, reduced to what an npm package needs (no Docker, Helm, Maven, DB schema).

| Action | Trigger | Does | Publishes? |
|--------|---------|------|-----------|
| **PREPARE** | "prepare release X.Y.Z" | Pre-flight checks, fixes via PRs, release-notes draft, **go/no-go vote** | **NEVER** |
| **PERFORM** | "perform release X.Y.Z" | Dry run → maintainer triggers real run → verify → curated notes → patch backmerge | Yes (gated) |
| **ANNOUNCE** | "announce release X.Y.Z" | Drafts for forum/Slack, docs follow-up, housekeeping | No (drafts; posted only on confirmation) |

## The Iron Guardrails

1. **PREPARE never dispatches `release.yml`** — not even with `dry_run=true`, not even when told "if it looks fine, just get it out". "Get it out" is a PERFORM request; answer with the vote and ask for "perform".
2. **The npm OTP never passes through you.** The real run needs `-f otp=<6 digits>` (valid ~30 s). The maintainer runs the dispatch command themselves with the `!` prefix. Do not ask for the code in chat, do not put it in a command you run.
3. **Dry run is mandatory** before every real run, on the exact branch being released. Not optional, not "recommended".
4. Releasing is irreversible: an npm version can never be republished. Confirm version + branch with the maintainer before the real run.

## First step: resolve the target

Given `VER = X.Y.Z`:

| Case | Branch (`BRANCH`) | Notes |
|------|-------------------|-------|
| `Z > 0` (patch) | `release/X.Y.x` | Must exist. If not: create it from tag `vX.Y.0` (see perform-release.md → "Creating a release branch") |
| `Z == 0` (minor/major) | `main` | `release.yml` bumps `main` to the next minor `-SNAPSHOT` itself |

Sanity check: `git show origin/BRANCH:package.json | grep '"version"'` must be `VER-SNAPSHOT`. Mismatch = 🔴 blocker.

## PREPARE

Work `references/prepare-checklist.md`, one todo per section:

1. Branch & version (above)
2. Content: what changed since the last tag — **an empty release (no `src/` change, no user-facing fix) is a question to the maintainer, not a GO**
3. CI green on `BRANCH` head; open Dependabot HIGH/CRITICAL alerts
4. Milestones: `VER` milestone exists (JReleaser applies and closes it); closed issues/merged PRs without milestone
5. Documentation drift: README and `operaton/documentation` MCP pages vs `tools/list` (`node .claude/skills/operaton-mcp-release/scripts/list-tools.mjs`)
6. Release-notes draft — `references/release-notes.md`
7. Patch only: backmerge plan to `main`
8. Raise PRs for fixable gaps, then the vote

### Confidence vote (end every PREPARE with it)

- 🟢 **GO** — all blocking checks pass.
- 🟡 **CONDITIONAL** — releasable after listed items; say for each whether a PR is open.
- 🔴 **NO-GO** — CI red, version mismatch, open HIGH/CRITICAL Dependabot alert on a runtime dependency, tag `vVER` already exists, or `VER` already on npm.

Always list: blocking items, non-blocking items, PRs raised (URLs), questions for the maintainer, and the PERFORM command they will run.

## PERFORM

Follow `references/perform-release.md`. Order:

1. PREPARE ran this session with 🟢 (or 🟡 accepted by the maintainer). Otherwise run PREPARE first; refuse on 🔴.
2. Dry run: `gh workflow run release.yml --ref BRANCH -f release_type=final -f dry_run=true`, watch to green, check `VERSION`, tarball name, `npm dist-tag:` line.
3. Confirm version + branch with the maintainer, then hand them the real command (Guardrail 2).
4. Watch the run; on failure use the recovery table in perform-release.md — never blindly re-run.
5. Verify (npm, tag, GitHub release, milestone, `released` labels, SNAPSHOT bump).
6. Replace the generated release body with the curated notes (`gh release edit`).
7. Patch: open the backmerge PR `release/X.Y.x` → `main` (merge commit, `main` keeps its version).
8. Report.

## ANNOUNCE

Only after PERFORM verified the release. See `references/announce.md`. Every post is public: draft → show → post only on explicit confirmation. Branches are listed for cleanup, never deleted by you.

## Red flags — STOP

| Thought | Reality |
|---------|---------|
| "Prepare looks green, I'll kick off the dry run to save time" | Dry run = `gh workflow run` = PERFORM. Ask. |
| "Maintainer is busy, send me the OTP and I'll trigger it" | Guardrail 2. They run the `!` command. |
| "The dry run passed on a side branch, skip it on BRANCH" | Dry-run the branch you release. |
| "The release failed — just re-run the workflow" | Tag may exist / npm may be published. Use the recovery table. |
| "JReleaser wrote the release notes" | It wrote a commit list. Curate it (breaking changes, behaviour notes). |
| "Docs aren't part of the release" | README ships in the tarball; npm shows it. Check drift in PREPARE. |
| "Old merged branches — I'll delete them" | List only. The maintainer deletes. |
| "Nothing changed but they asked for a release" | Ask what they expect in it before publishing an identical version. |
