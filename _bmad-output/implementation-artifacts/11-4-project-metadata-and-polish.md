# Story 11.4: GitHub Project Metadata & Repository Polish

Status: backlog

## Story

As a developer discovering operaton-mcp via GitHub search or a shared link,
I want to see a polished repository with a clear description, relevant topics, and professional presentation,
so that the project's quality and scope are immediately apparent before reading any documentation.

## Acceptance Criteria

1. **Given** a developer visits the GitHub repository **When** they view the repository header **Then** they see a concise, accurate one-line description (not blank, not auto-generated).

2. **Given** a developer views the repository **When** they check the repository topics (labels) **Then** they see relevant topics that would surface this repo in GitHub search: at minimum `mcp`, `operaton`, `bpmn`, `workflow-automation`, `model-context-protocol`, `typescript`, `nodejs`.

3. **Given** a developer views the npm package page **When** they read the package description **Then** it matches (or is consistent with) the GitHub repository description.

4. **Given** a developer views the repository **When** they look at the `package.json` **Then** the `description`, `keywords`, `homepage`, `bugs`, and `repository` fields are all populated correctly.

5. **Given** the project has a `LICENSE` file **When** GitHub scans it **Then** GitHub correctly identifies it as Apache 2.0 and shows the license badge automatically.

6. **Given** a developer views the repository **When** they look for how to install **Then** the "About" sidebar shows the npm package link (via `homepage` or GitHub releases).

## Tasks / Subtasks

- [ ] Update GitHub repository settings (manual step — document as instructions) (AC: 1, 2, 6)
  - [ ] Set repository description: "MCP server exposing the full Operaton BPMN/DMN REST API to AI assistants"
  - [ ] Add topics: `mcp`, `model-context-protocol`, `operaton`, `bpmn`, `dmn`, `workflow-automation`, `typescript`, `nodejs`, `camunda`
  - [ ] Set website URL to npm package page
  - [ ] Ensure "Packages" section visible in sidebar
- [ ] Update `package.json` fields (AC: 3, 4)
  - [ ] `description`: "MCP server exposing the full Operaton BPMN/DMN REST API to AI assistants"
  - [ ] `keywords`: `["mcp", "model-context-protocol", "operaton", "bpmn", "dmn", "workflow", "camunda", "ai", "llm"]`
  - [ ] `homepage`: GitHub repository URL
  - [ ] `bugs`: `{ "url": "https://github.com/{org}/{repo}/issues" }`
  - [ ] `repository`: `{ "type": "git", "url": "https://github.com/{org}/{repo}.git" }`
  - [ ] Verify `license`: `"Apache-2.0"` is present
- [ ] Verify `LICENSE` file is present at repository root and is Apache 2.0 text (AC: 5)
- [ ] Create `CODE_OF_CONDUCT.md` using Contributor Covenant 2.1 (standard OSS practice)
  - [ ] Copy standard Contributor Covenant 2.1 template
  - [ ] Set enforcement contact email
- [ ] Review and update `.npmignore` or `package.json#files` to exclude non-essential files from npm publish
  - [ ] Exclude: `_bmad/`, `_bmad-output/`, `.github/`, `test/`, `*.md` files except README
  - [ ] Include: `dist/`, `src/` (if needed), `LICENSE`, `README.md`

## Dev Notes

### Package.json Fields Reference

```json
{
  "description": "MCP server exposing the full Operaton BPMN/DMN REST API to AI assistants",
  "keywords": [
    "mcp",
    "model-context-protocol",
    "operaton",
    "bpmn",
    "dmn",
    "workflow",
    "workflow-automation",
    "camunda",
    "ai",
    "llm",
    "typescript"
  ],
  "homepage": "https://github.com/{org}/operaton-mcp#readme",
  "bugs": {
    "url": "https://github.com/{org}/operaton-mcp/issues"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/{org}/operaton-mcp.git"
  },
  "license": "Apache-2.0"
}
```

Replace `{org}` with actual GitHub organization name.

### GitHub Repository Settings (Manual Steps)

These cannot be automated and must be done by a repo admin in the GitHub web UI:

1. **Settings > General > Description**: Set one-line description
2. **Settings > General > Topics**: Add all topics listed in ACs
3. **Settings > General > Website**: Set to npm package URL or GitHub Pages if applicable
4. **Code and Automation > Social Preview**: Upload or generate a social preview image

### .npmignore or package.json#files

Prefer `package.json#files` (allowlist) over `.npmignore` (blocklist) — cleaner and harder to accidentally expose files:

```json
{
  "files": [
    "dist/",
    "LICENSE",
    "README.md"
  ]
}
```

Verify current publish output with `npm pack --dry-run` before finalizing.

### Code of Conduct

Use Contributor Covenant 2.1 — the standard for open source projects. Enforcement email should be set to the project maintainer's contact email or a dedicated `conduct@` address.

Template: https://www.contributor-covenant.org/version/2/1/code_of_conduct/

### Key File Locations

- `package.json` — update metadata fields
- `CODE_OF_CONDUCT.md` — new file at repository root
- `LICENSE` — verify exists with correct Apache 2.0 text
- `.npmignore` or `package.json#files` — update publish exclusions

### References

- npm package documentation: https://docs.npmjs.com/cli/v10/configuring-npm/package-json
- Contributor Covenant: https://www.contributor-covenant.org/
- Story 11.1: README (badge URLs must match package.json name)
- Story 11.3: Community files (issue templates, PR template)
