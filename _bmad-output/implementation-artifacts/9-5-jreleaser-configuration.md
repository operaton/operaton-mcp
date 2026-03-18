# Story 9.5: JReleaser Configuration

Status: draft

## Story

As a maintainer of operaton-mcp,
I want a JReleaser configuration that defines how the NPM package and GitHub Release are produced,
so that the release process is declarative, repeatable, and generates changelogs automatically from conventional commits.

## Acceptance Criteria

1. **Given** `jreleaser.yml` exists at the project root **When** `jreleaser full-release --dry-run` is executed against a tagged commit **Then** JReleaser reports it would publish an NPM distribution and create a GitHub Release with a changelog derived from conventional commits since the previous tag — with no external mutations.

2. **Given** `jreleaser.yml` is reviewed **When** checking the changelog configuration **Then** it is configured to use conventional commits as the changelog format, grouping entries by type (feat, fix, chore, docs, etc.).

3. **Given** `jreleaser.yml` is reviewed **When** checking the distribution section **Then** it defines an NPM distribution pointing to the correct package name (`operaton-mcp`) and the `dist/` artifact.

4. **Given** `jreleaser.yml` is reviewed **When** checking the release section **Then** it defines a GitHub release with `overwrite: false` for final releases (tag already created before release is triggered).

5. **Given** `package.json` is reviewed **When** checking the `engines` field **Then** it declares the minimum supported Node.js version consistent with `.nvmrc` (e.g., `"node": ">=22.0.0"`).

6. **Given** `jreleaser.yml` is reviewed **When** checking credential references **Then** all credentials (NPM token, GitHub token) are referenced via environment variable placeholders (e.g., `{{NPM_TOKEN}}`, `{{GITHUB_TOKEN}}`), never hardcoded.

## Tasks / Subtasks

- [ ] Add JReleaser to the project — document installation method (JReleaser CLI via `jreleaser` binary or via `npx @jreleaser/jreleaser` wrapper) in dev notes (AC: 1)
- [ ] Create `jreleaser.yml` at project root with:
  - [ ] `project` block: name, version, description (AC: 3)
  - [ ] `release.github` block: owner, name, `overwrite: false`, changelog from conventional commits (AC: 2, 4)
  - [ ] `distributions.npm` block: NPM distribution with package name and artifact path (AC: 3)
  - [ ] Credential references via env var placeholders (AC: 6)
- [ ] Add `engines` field to `package.json`: `"node": ">=22.0.0"` (consistent with `.nvmrc`) (AC: 5)
- [ ] Verify `jreleaser full-release --dry-run` runs without error on a test tag (AC: 1)

## Dev Notes

### jreleaser.yml Template

```yaml
project:
  name: operaton-mcp
  description: MCP server exposing the complete Operaton REST API as AI-callable tools
  links:
    homepage: https://github.com/operaton/operaton-mcp

release:
  github:
    owner: operaton
    name: operaton-mcp
    overwrite: false
    changelog:
      formatted: ALWAYS
      preset: conventional-commits
      contributors:
        format: '- {{contributorName}} ({{contributorUsernameAsLink}})'

distributions:
  operaton-mcp:
    type: FLAT_BINARY
    artifacts:
      - path: '{{projectName}}-{{projectVersion}}.tgz'
    npm:
      packageName: operaton-mcp
      access: PUBLIC
```

### Credential Environment Variables

JReleaser reads credentials from environment variables. For CI:
- `JRELEASER_GITHUB_TOKEN` — GitHub token with `contents: write` permission
- `JRELEASER_NPM_TOKEN` — npm publish token

These are set as GitHub Actions secrets and referenced in the release workflow (Story 9.6).

### package.json engines field

```json
{
  "engines": {
    "node": ">=22.0.0"
  }
}
```

Version must match `.nvmrc` content (Story 9.4).

### JReleaser Installation

JReleaser is invoked in GitHub Actions via the official `jreleaser/release-action` GitHub Action — no local installation required. For local dry-run testing, use the JReleaser CLI:
```bash
curl -sL https://raw.githubusercontent.com/jreleaser/jreleaser/main/get-jreleaser.sh | bash
./jreleaser full-release --dry-run
```

### Artifact Preparation

Before JReleaser runs, `npm pack` produces the `.tgz` artifact that JReleaser uploads to the GitHub Release. The release workflow (Story 9.6) orchestrates this sequence.

### Key File Locations

- `jreleaser.yml` — project root
- `package.json` — updated with `engines` field

### Dependencies

- Story 9.4 (CI Enhancements) provides `.nvmrc` — `engines` version must match
- Story 9.6 (Release Workflow) uses this config to drive the actual release

### References

- PRD: FR-40
- Epics: `_bmad-output/planning-artifacts/epics.md#Story 9.5`
- JReleaser docs: https://jreleaser.org/guide/latest/

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
