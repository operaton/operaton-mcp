# Release notes

JReleaser writes the GitHub release body from conventional commits (`preset: conventional-commits`). That is a commit list, not release notes. Draft curated notes in PREPARE; publish them in PERFORM with `gh release edit vVER --notes-file FILE`.

## Sources
1. Milestone `VER` items: `gh issue list --state closed --milestone VER` and `gh pr list --state merged --search "milestone:VER"`
2. `git log --oneline PREV..origin/BRANCH` — `feat:`/`fix:` commits, `!` breaking markers
3. Tool surface diff: `list-tools.mjs --json` on `PREV` vs `BRANCH` — added/removed/renamed tools or parameters are user-visible API changes for MCP clients
4. `git diff PREV origin/BRANCH -- package.json` — runtime dependency bumps (`dependencies`, not `devDependencies`, unless notable)

## Structure

```markdown
## operaton-mcp VER

One sentence: what this release is about.

### Bug fixes            (issue refs; what the user saw, what happens now)
### Features             (minor/major only)
### ⚠️ Changed: <tool>   (only for renamed/removed tools or parameters — before/after table)
### Behaviour notes      (stricter validation, larger tools/list, defaults changed)
### Build & release      (workflow, dependency versions)
### Upgrade
    npx @operaton/mcp@VER
**Full Changelog**: https://github.com/operaton/operaton-mcp/compare/PREV...vVER
```

Rules:
- Every tool/parameter rename gets a before/after table — MCP clients with hard-coded calls break silently otherwise.
- Leave out sections with nothing in them. A patch with one fix is three short sections.
- Forward-ports/backmerges of a patch into `main` are not new features of the next minor; say "includes the fixes from X.Y.Z".
- No contributor list for bots (dependabot, github-actions).
