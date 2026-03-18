# Story 11.2: Configuration Guide

Status: backlog

## Story

As a developer configuring operaton-mcp for a real deployment,
I want a dedicated configuration reference that covers all scenarios from simple to multi-engine with OIDC,
so that I can configure the server correctly without reading source code or guessing at env var names.

## Acceptance Criteria

1. **Given** a developer reads the configuration guide **When** they follow the "Basic Auth (env vars)" example **Then** they can connect to a single Operaton instance with copy-paste env var configuration.

2. **Given** a developer reads the configuration guide **When** they follow the "OIDC (env vars)" example **Then** they can connect with client credentials using only environment variables.

3. **Given** a developer reads the configuration guide **When** they reach the "Multi-Engine Config File" section **Then** they see a complete annotated JSON example with two named engines (one basic, one OIDC) and understand how to mark a default.

4. **Given** a developer reads the configuration guide **When** they look for security guidance **Then** they find a dedicated callout recommending environment variables or secrets managers over hardcoded credentials, with a specific note about never committing `operaton-config.json` to version control.

5. **Given** a developer reads the configuration guide **When** they look for all environment variables **Then** they find a complete reference table covering every supported variable with type, required/optional status, default value, and description.

6. **Given** a developer reads the configuration guide **When** they see the multi-engine section **Then** they understand how the default engine is selected (only engine, or `"default": true`) and what happens if config is ambiguous (startup error with clear message).

7. **Given** the config guide is linked from the README **When** a developer follows the link **Then** the file exists at `docs/configuration.md`.

## Tasks / Subtasks

- [ ] Create `docs/` directory if it does not exist
- [ ] Create `docs/configuration.md` with the following sections (AC: 1–7)
  - [ ] **Overview**: 2-3 sentences — how config works (env vars for simple cases, JSON file for multi-engine)
  - [ ] **Quick Reference Table**: all environment variables (AC: 5)
  - [ ] **Example 1 — Basic Auth (env vars)**: Claude Desktop snippet + variable table
  - [ ] **Example 2 — OIDC (env vars)**: Claude Desktop snippet + variable table
  - [ ] **Example 3 — Multi-Engine Config File**: full annotated JSON + how to reference via `OPERATON_CONFIG`
  - [ ] **Default Engine Selection**: explain logic — one engine auto-default, multiple require `"default": true`, ambiguity = startup error
  - [ ] **Security Best Practices**: callout box with: no hardcoded secrets, use env vars or secret manager, gitignore pattern for config files, `OPERATON_SKIP_HEALTH_CHECK` usage
  - [ ] **Troubleshooting**: common errors and their meaning (missing required var, config file not found, no default engine)
- [ ] Add `.gitignore` entry for `operaton-config.json` and `*.operaton-config.json` (AC: 4)
- [ ] Verify all code examples are syntactically valid JSON (AC: 3)

## Dev Notes

### Document Structure

```markdown
# Configuration Guide

## Overview
...

## Environment Variable Reference

| Variable | Type | Required | Default | Description |
|---|---|---|---|---|
| `OPERATON_CONFIG` | string | No | — | Path to JSON config file |
| `OPERATON_BASE_URL` | string | Conditional | — | ... |
...

## Examples

### Basic Auth (env vars)
...

### OIDC Authentication (env vars)
...

### Multi-Engine with Config File
...

## Default Engine Selection
...

## Security Best Practices

> ⚠️ Never commit credentials or config files containing secrets to version control.
...

## Troubleshooting
...
```

### Complete Environment Variable Reference Table

| Variable | Type | Required | Default | Description |
|---|---|---|---|---|
| `OPERATON_CONFIG` | string (path) | No | — | Path to JSON config file. When set, all other `OPERATON_*` vars except `OPERATON_SKIP_HEALTH_CHECK` are ignored. |
| `OPERATON_BASE_URL` | string (URL) | Yes\* | — | Base URL of Operaton REST API, e.g. `http://localhost:8080/engine-rest` |
| `OPERATON_USERNAME` | string | Yes\* | — | Basic Auth username |
| `OPERATON_PASSWORD` | string | Yes\* | — | Basic Auth password |
| `OPERATON_CLIENT_ID` | string | Yes\*\* | — | OIDC client ID (OAuth2 client credentials) |
| `OPERATON_CLIENT_SECRET` | string | Yes\*\* | — | OIDC client secret |
| `OPERATON_TOKEN_URL` | string (URL) | Yes\*\* | — | OIDC token endpoint URL |
| `OPERATON_ENGINE` | string | No | `"default"` | Operaton engine name (env var mode only) |
| `OPERATON_SKIP_HEALTH_CHECK` | boolean | No | `false` | Set `"true"` to skip startup connectivity check |

\* Required when not using config file and authenticating with Basic Auth
\*\* Required when not using config file and authenticating with OIDC

### Multi-Engine JSON Example (annotated)

```json
{
  "engines": {
    "dev": {
      "url": "http://localhost:8080/engine-rest",
      "authentication": {
        "type": "basic",
        "username": "demo",
        "password": "demo"
      }
    },
    "quality-stage": {
      "url": "https://operaton.example.com/engine-rest",
      "default": true,
      "authentication": {
        "type": "oidc",
        "clientId": "mcp-client",
        "clientSecret": "${KEYCLOAK_CLIENT_SECRET}",
        "tokenUrl": "https://keycloak.example.com/realms/myapp/protocol/openid-connect/token"
      }
    }
  }
}
```

Note: consider documenting that secrets in JSON can reference env vars if the implementation supports token expansion (discuss with Dev whether to support `${VAR}` syntax — if not, document that raw values only and use file permissions to protect the config file).

### Troubleshooting Entries

| Error Message | Cause | Fix |
|---|---|---|
| `Missing required env var: OPERATON_BASE_URL` | No config file and no base URL set | Set `OPERATON_BASE_URL` or `OPERATON_CONFIG` |
| `Config file not found: /path/to/config.json` | `OPERATON_CONFIG` points to nonexistent file | Check path and file existence |
| `Multiple engines configured but none marked as default` | Multi-engine config with no `"default": true` | Add `"default": true` to one engine |
| `OIDC token fetch failed: HTTP 401` | Wrong client ID/secret | Verify OIDC credentials |

### .gitignore Additions

```
# operaton-mcp config files (may contain credentials)
operaton-config.json
*.operaton-config.json
```

### Key File Locations

- `docs/configuration.md` — new file to create
- `README.md` — add link to this guide in auth section (Story 11.1)
- `.gitignore` — add config file patterns

### References

- Story 10.1: complete env var list and config file format
- Story 11.1: README links to this guide
