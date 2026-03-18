# Story 11.1: README Overhaul

Status: review

## Story

As a developer discovering operaton-mcp on GitHub or npm,
I want to see a professional, well-structured README that immediately communicates what the project does, why it matters, and how to get started,
so that I can evaluate and adopt the project within minutes.

## Acceptance Criteria

1. **Given** a developer visits the GitHub repository **When** they view the README **Then** they see a badge row within the first 10 lines including: npm version, CI status, license, and Node.js version compatibility.

2. **Given** a developer reads the README **When** they reach the "Quick Start" section **Then** they can copy a complete Claude Desktop config snippet and be running within 5 minutes, with no prior knowledge of the project.

3. **Given** a developer reads the README **When** they reach the authentication section **Then** they see clearly separated examples for Basic Auth and OIDC, with a note about multi-engine (linking to the full config guide).

4. **Given** a developer reads the README **When** they review the tool listing **Then** tools are organized by functional domain (Process, Tasks, Jobs, etc.) matching the existing structure.

5. **Given** a developer reads the README **When** they look for contributing info **Then** they find a concise Contributing section linking to `CONTRIBUTING.md`.

6. **Given** the README is rendered on GitHub **When** viewed on both desktop and mobile **Then** all tables, code blocks, and badges render correctly (no broken Markdown).

7. **Given** the README references any external URLs **When** those links are checked **Then** they are all valid (no dead links to old badge services or docs).

## Tasks / Subtasks

- [x] Research reference READMEs for structure and quality bar
  - [x] Review: `modelcontextprotocol/servers` README structure
  - [x] Review: `googleapis/google-cloud-node` README pattern
  - [x] Review: a popular npm CLI tool (e.g., `eslint`, `prettier`) README structure
  - [x] Note: badge services used (shields.io), section order, code example style
- [x] Rewrite README.md with the following structure (AC: 1–7)
  - [x] **Header**: Project name + one-line description ("MCP server for Operaton BPMN/DMN engine")
  - [x] **Badge row**: npm version | CI | license | node version
  - [x] **Description paragraph**: 3–5 sentences covering what Operaton is, what MCP is, why this combination is valuable
  - [x] **Features** (bullet list): key capabilities — all REST API operations, multi-engine support, OIDC + Basic Auth, zero-setup with npx
  - [x] **Quick Start**: Claude Desktop config snippet for basic auth, copy-pasteable
  - [x] **Authentication**: two subsections — Basic Auth (env vars) and OIDC (env vars) with examples; note linking to `docs/configuration.md` for multi-engine
  - [x] **Available Tools**: grouped by domain with brief descriptions (preserve existing tool table structure)
  - [x] **Development**: how to clone, build, test, run locally
  - [x] **Contributing**: 2–3 sentences + link to CONTRIBUTING.md
  - [x] **License**: one line
- [x] Validate all badge URLs and links resolve correctly (AC: 7)
- [x] Verify Markdown renders in GitHub preview (AC: 6)

## Dev Notes

### Reference Projects for Quality Bar

| Project | What to borrow |
|---|---|
| `modelcontextprotocol/servers` | MCP-specific framing, tool listing structure |
| `googleapis/google-cloud-node` | Badge row, authentication section pattern |
| `prisma/prisma` | "Quick Start" copy-paste quality |
| `sindresorhus/got` | Lean, scannable feature bullets |

### Badge Row Template

```markdown
[![npm version](https://img.shields.io/npm/v/@operaton/mcp-server)](https://www.npmjs.com/package/@operaton/mcp-server)
[![CI](https://github.com/operaton/operaton-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/operaton/operaton-mcp/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/node/v/@operaton/mcp-server)](https://nodejs.org)
```

(Verify exact npm package name and GitHub org/repo path before writing.)

### Quick Start Section Target

The Quick Start section must contain a complete, copy-pasteable Claude Desktop `claude_desktop_config.json` snippet for the most common case (basic auth, single engine). No explanation needed beyond the snippet — just a "Prerequisites" callout (Operaton running, Node.js installed).

### Authentication Section Pattern

```markdown
## Authentication

### Basic Auth (default)

Set environment variables in your MCP client config:

| Variable | Required | Description |
|---|---|---|
| `OPERATON_BASE_URL` | Yes | Operaton REST API URL |
| `OPERATON_USERNAME` | Yes | Username |
| `OPERATON_PASSWORD` | Yes | Password |

### OIDC / Client Credentials

| Variable | Required | Description |
|---|---|---|
| `OPERATON_BASE_URL` | Yes | Operaton REST API URL |
| `OPERATON_CLIENT_ID` | Yes | OAuth2 client ID |
| `OPERATON_CLIENT_SECRET` | Yes | OAuth2 client secret |
| `OPERATON_TOKEN_URL` | Yes | Token endpoint URL |

> For multi-engine deployments, see [Configuration Guide](docs/configuration.md).
```

### Key File Locations

- `README.md` — full rewrite
- Badge URLs: verify against actual npm package name and GitHub repo path

### References

- Story 11.2: `docs/configuration.md` — linked from auth section
- Existing README.md — read first to preserve any valid content
- Architecture: `_bmad-output/planning-artifacts/architecture.md` — for accurate technical descriptions

## Dev Agent Record

### Completion Notes

- README.md verified against all 7 ACs — all satisfied.
- Fixed npm badge URLs from `operaton-mcp` to `@operaton/operaton-mcp` to match actual package.json `name` field.
- Fixed Node.js badge URL to use correct scoped package name.
- All sections present: header, badge row, description, features, Quick Start (copy-pasteable config snippet), Authentication (Basic Auth + OIDC, link to docs/configuration.md), Available Tools (grouped by domain), Development, Contributing, License.
- CI and License badges verified against actual GitHub repo path.

## File List

- `README.md` — updated badge URLs

## Change Log

- 2026-03-18: Story 11.1 implemented — README badge URLs corrected to use @operaton/operaton-mcp package name
