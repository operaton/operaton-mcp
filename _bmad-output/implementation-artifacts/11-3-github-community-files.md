# Story 11.3: GitHub Community Files

Status: review

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

- [x] Create `.github/ISSUE_TEMPLATE/bug_report.yml` (AC: 1, 2, 5)
  - [x] `name`: "Bug Report"
  - [x] `description`: "Report a bug or unexpected behavior"
  - [x] `labels`: `["bug", "needs-triage"]`
  - [x] Fields:
    - [x] `textarea`: Steps to Reproduce (required)
    - [x] `textarea`: Expected Behavior (required)
    - [x] `textarea`: Actual Behavior (required)
    - [x] `input`: operaton-mcp version (required, placeholder: e.g. `1.2.3`)
    - [x] `input`: Operaton version (optional, placeholder: e.g. `7.22`)
    - [x] `input`: Node.js version (optional, placeholder: e.g. `20.x`)
    - [x] `textarea`: Relevant configuration (optional, description: "Remove any credentials before pasting")
    - [x] `textarea`: Additional context / logs (optional)
- [x] Create `.github/ISSUE_TEMPLATE/feature_request.yml` (AC: 1, 3, 5)
  - [x] `name`: "Feature Request"
  - [x] `description`: "Suggest a new feature or enhancement"
  - [x] `labels`: `["enhancement"]`
  - [x] Fields:
    - [x] `textarea`: Problem Description — what problem does this solve? (required)
    - [x] `textarea`: Proposed Solution (required)
    - [x] `textarea`: Alternatives Considered (optional)
    - [x] `textarea`: Additional Context (optional)
- [x] Create `.github/ISSUE_TEMPLATE/config.yml` (AC: 1)
  - [x] `blank_issues_enabled`: false
  - [x] Contact links: none required (can add docs link if useful)
- [x] Create `.github/pull_request_template.md` (AC: 4, 6)
  - [x] Section: "## Summary" — brief description of what changed and why
  - [x] Section: "## Type of Change" — checkboxes: Bug fix, New feature, Breaking change, Documentation, Refactor, CI/tooling
  - [x] Section: "## Testing" — what was tested, how
  - [x] Section: "## Checklist" — checkboxes:
    - [x] All tests pass (`npm test`)
    - [x] Documentation updated if needed
    - [x] No credentials or secrets in the diff
    - [x] Breaking change documented in PR description
    - [x] Linked issue (if applicable): `Closes #`
- [x] Update `CONTRIBUTING.md` to reference issue templates and PR template (AC: 7)
  - [x] Add section: "Reporting Issues" — mention form templates auto-guide the reporter
  - [x] Add section: "Pull Request Process" — reference PR template checklist
  - [x] Verify Conventional Commits guidance is present (add if missing)

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

## Dev Agent Record

### Completion Notes

- `.github/ISSUE_TEMPLATE/bug_report.yml` verified: all required fields present, labels set to ["bug", "needs-triage"], required fields marked correctly.
- `.github/ISSUE_TEMPLATE/feature_request.yml` verified: all required fields, label ["enhancement"].
- `.github/ISSUE_TEMPLATE/config.yml` verified: blank_issues_enabled=false, documentation link present.
- `.github/pull_request_template.md` verified: Summary, Type of Change, Testing, Checklist sections all present with correct checkboxes.
- `CONTRIBUTING.md` verified: "Reporting Issues" and "Submitting a PR" sections reference templates; Conventional Commits documented with types and scopes.

## File List

- `.github/ISSUE_TEMPLATE/bug_report.yml` — complete
- `.github/ISSUE_TEMPLATE/feature_request.yml` — complete
- `.github/ISSUE_TEMPLATE/config.yml` — complete
- `.github/pull_request_template.md` — complete
- `CONTRIBUTING.md` — updated with issue template and PR template references

## Change Log

- 2026-03-18: Story 11.3 verified complete — all GitHub community files confirmed present and correct
