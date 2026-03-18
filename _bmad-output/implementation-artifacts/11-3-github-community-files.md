# Story 11.3: GitHub Community Files

Status: backlog

## Story

As a contributor or issue reporter approaching operaton-mcp on GitHub,
I want well-structured issue templates and a PR template that guide me through providing the right information,
so that maintainers can triage and respond efficiently.

## Acceptance Criteria

1. **Given** a user clicks "New Issue" on GitHub **When** they see the issue template chooser **Then** they see at least two options: "Bug Report" and "Feature Request", each with a descriptive label and description.

2. **Given** a user selects "Bug Report" **When** the issue form opens **Then** it contains structured fields: Steps to Reproduce, Expected Behavior, Actual Behavior, operaton-mcp version, Operaton version, Node.js version, and relevant config (sanitized).

3. **Given** a user selects "Feature Request" **When** the issue form opens **Then** it contains structured fields: Problem Description (why), Proposed Solution, Alternatives Considered, and Additional Context.

4. **Given** a developer opens a Pull Request **When** the PR description editor loads **Then** the PR template is pre-populated with: Summary, Type of Change (checklist), Testing Done, and Checklist (tests pass, docs updated, breaking change noted).

5. **Given** the issue templates are deployed **When** viewed on GitHub **Then** they use GitHub's form-based YAML format (`.github/ISSUE_TEMPLATE/*.yml`) with proper `labels` pre-applied.

6. **Given** the PR template is deployed **When** a PR is created **Then** the template renders with checkboxes and clear section headers.

7. **Given** `CONTRIBUTING.md` exists **When** a contributor reads it **Then** it references both the issue templates and PR template flow, and explains the commit message convention (Conventional Commits).

## Tasks / Subtasks

- [ ] Create `.github/ISSUE_TEMPLATE/bug_report.yml` (AC: 1, 2, 5)
  - [ ] `name`: "Bug Report"
  - [ ] `description`: "Report a bug or unexpected behavior"
  - [ ] `labels`: `["bug", "needs-triage"]`
  - [ ] Fields:
    - [ ] `textarea`: Steps to Reproduce (required)
    - [ ] `textarea`: Expected Behavior (required)
    - [ ] `textarea`: Actual Behavior (required)
    - [ ] `input`: operaton-mcp version (required, placeholder: e.g. `1.2.3`)
    - [ ] `input`: Operaton version (optional, placeholder: e.g. `7.22`)
    - [ ] `input`: Node.js version (optional, placeholder: e.g. `20.x`)
    - [ ] `textarea`: Relevant configuration (optional, description: "Remove any credentials before pasting")
    - [ ] `textarea`: Additional context / logs (optional)
- [ ] Create `.github/ISSUE_TEMPLATE/feature_request.yml` (AC: 1, 3, 5)
  - [ ] `name`: "Feature Request"
  - [ ] `description`: "Suggest a new feature or enhancement"
  - [ ] `labels`: `["enhancement"]`
  - [ ] Fields:
    - [ ] `textarea`: Problem Description — what problem does this solve? (required)
    - [ ] `textarea`: Proposed Solution (required)
    - [ ] `textarea`: Alternatives Considered (optional)
    - [ ] `textarea`: Additional Context (optional)
- [ ] Create `.github/ISSUE_TEMPLATE/config.yml` (AC: 1)
  - [ ] `blank_issues_enabled`: false
  - [ ] Contact links: none required (can add docs link if useful)
- [ ] Create `.github/pull_request_template.md` (AC: 4, 6)
  - [ ] Section: "## Summary" — brief description of what changed and why
  - [ ] Section: "## Type of Change" — checkboxes: Bug fix, New feature, Breaking change, Documentation, Refactor, CI/tooling
  - [ ] Section: "## Testing" — what was tested, how
  - [ ] Section: "## Checklist" — checkboxes:
    - [ ] All tests pass (`npm test`)
    - [ ] Documentation updated if needed
    - [ ] No credentials or secrets in the diff
    - [ ] Breaking change documented in PR description
    - [ ] Linked issue (if applicable): `Closes #`
- [ ] Update `CONTRIBUTING.md` to reference issue templates and PR template (AC: 7)
  - [ ] Add section: "Reporting Issues" — mention form templates auto-guide the reporter
  - [ ] Add section: "Pull Request Process" — reference PR template checklist
  - [ ] Verify Conventional Commits guidance is present (add if missing)

## Dev Notes

### Issue Template YAML Format (GitHub Form Schema)

```yaml
# .github/ISSUE_TEMPLATE/bug_report.yml
name: Bug Report
description: Report a bug or unexpected behavior
labels: ["bug", "needs-triage"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to report a bug. Please fill in as much detail as possible.
  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      placeholder: |
        1. Configure MCP server with...
        2. Call tool...
        3. Observe...
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
    validations:
      required: true
  - type: input
    id: mcp-version
    attributes:
      label: operaton-mcp version
      placeholder: "e.g. 1.2.3"
    validations:
      required: true
  # ... additional optional fields
```

### PR Template Structure

```markdown
## Summary

<!-- What does this PR do? Why? Link to the issue if applicable. -->

Closes #

## Type of Change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Documentation
- [ ] Refactor / code quality
- [ ] CI / tooling

## Testing

<!-- How was this change tested? What scenarios were covered? -->

## Checklist

- [ ] All tests pass (`npm test`)
- [ ] Documentation updated (if behavior changed)
- [ ] No credentials, secrets, or `.env` files in this diff
- [ ] Breaking changes documented above
```

### Reference Projects for Issue Template Quality

- `microsoft/vscode` — comprehensive bug report template
- `facebook/react` — clean feature request template
- `sindresorhus/got` — minimalist but effective

### Key File Locations

- `.github/ISSUE_TEMPLATE/bug_report.yml` — new
- `.github/ISSUE_TEMPLATE/feature_request.yml` — new
- `.github/ISSUE_TEMPLATE/config.yml` — new
- `.github/pull_request_template.md` — new
- `CONTRIBUTING.md` — update existing file

### References

- GitHub Docs: Form-based issue templates — https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema
- Existing `CONTRIBUTING.md`: `_bmad-output/implementation-artifacts/9-2-contributing-md.md`
