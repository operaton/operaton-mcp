# Configuration Guide

operaton-mcp supports three configuration modes: Basic Auth via environment variables, OIDC via environment variables, and a JSON config file for multi-engine deployments. For simple single-engine setups, environment variables are sufficient. Use a config file when you need to connect to multiple Operaton instances or prefer file-based configuration.

## Environment Variable Reference

| Variable | Type | Required | Default | Description |
|---|---|---|---|---|
| `OPERATON_CONFIG` | string (path) | No | — | Path to JSON config file. When set, all other `OPERATON_*` vars except `OPERATON_SKIP_HEALTH_CHECK` are ignored. |
| `OPERATON_BASE_URL` | string (URL) | Yes\* | — | Base URL of Operaton REST API, e.g. `http://localhost:8080/engine-rest` |
| `OPERATON_USERNAME` | string | Yes\* | — | Basic Auth username |
| `OPERATON_PASSWORD` | string | Yes\* | — | Basic Auth password |
| `OPERATON_CLIENT_ID` | string | Yes\*\* | — | OIDC client ID (OAuth2 client credentials) |
| `OPERATON_CLIENT_SECRET` | string | Yes\*\* | — | OIDC client secret |
| `OPERATON_TOKEN_URL` | string (URL) | Yes\*\* | — | OIDC token endpoint URL |
| `OPERATON_ENGINE` | string | No | `"default"` | Operaton engine name used in API path templates (env var mode only) |
| `OPERATON_SKIP_HEALTH_CHECK` | boolean | No | `false` | Set `"true"` to skip the startup connectivity check |

\* Required when not using a config file and authenticating with Basic Auth
\*\* Required when not using a config file and authenticating with OIDC

## Examples

### Example 1 — Basic Auth (env vars)

The simplest setup for a local or internal Operaton instance.

Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "operaton": {
      "command": "npx",
      "args": ["-y", "operaton-mcp"],
      "env": {
        "OPERATON_BASE_URL": "http://localhost:8080/engine-rest",
        "OPERATON_USERNAME": "demo",
        "OPERATON_PASSWORD": "demo"
      }
    }
  }
}
```

### Example 2 — OIDC Authentication (env vars)

For Operaton instances secured with an OIDC/OAuth2 identity provider (e.g., Keycloak).

```json
{
  "mcpServers": {
    "operaton": {
      "command": "npx",
      "args": ["-y", "operaton-mcp"],
      "env": {
        "OPERATON_BASE_URL": "https://operaton.example.com/engine-rest",
        "OPERATON_CLIENT_ID": "mcp-client",
        "OPERATON_CLIENT_SECRET": "your-client-secret",
        "OPERATON_TOKEN_URL": "https://keycloak.example.com/realms/myapp/protocol/openid-connect/token"
      }
    }
  }
}
```

Tokens are fetched automatically using the OAuth2 client credentials grant and cached until near expiry (refreshed 30 seconds before expiration).

### Example 3 — Multi-Engine Config File

For connecting to multiple Operaton instances simultaneously, create a JSON config file:

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
      "url": "https://operaton-qa.example.com/engine-rest",
      "default": true,
      "authentication": {
        "type": "oidc",
        "clientId": "mcp-client",
        "clientSecret": "your-secret",
        "tokenUrl": "https://keycloak.example.com/realms/qa/protocol/openid-connect/token"
      }
    }
  }
}
```

Save this file (e.g., `~/operaton-config.json`) and reference it via `OPERATON_CONFIG`:

```json
{
  "mcpServers": {
    "operaton": {
      "command": "npx",
      "args": ["-y", "operaton-mcp"],
      "env": {
        "OPERATON_CONFIG": "/Users/yourname/operaton-config.json"
      }
    }
  }
}
```

## Default Engine Selection

When using a config file with multiple engines, operaton-mcp needs to know which engine to use by default:

- **Single engine**: automatically selected as default — no `"default"` field needed
- **Multiple engines**: exactly one engine must have `"default": true`
- **No default marked**: server exits with an error — `Multiple engines configured but none marked as default. Set "default": true on exactly one engine.`
- **Multiple defaults**: server exits with an error — `Multiple engines marked as default. Exactly one engine must have "default": true.`

## Security Best Practices

> **Never commit credentials or config files containing secrets to version control.**

- Use environment variables or a secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager) rather than hardcoding secrets in config files
- If you use a JSON config file with credentials, add it to `.gitignore`:
  ```
  operaton-config.json
  *.operaton-config.json
  ```
- Set file permissions to restrict access: `chmod 600 ~/operaton-config.json`
- For OIDC, use dedicated service accounts with the minimum required permissions
- Set `OPERATON_SKIP_HEALTH_CHECK=true` only in development/test environments — in production, leave the startup check enabled to detect connectivity issues early

## Troubleshooting

| Error Message | Cause | Fix |
|---|---|---|
| `No configuration found. Provide one of: ...` | No `OPERATON_CONFIG`, `OPERATON_USERNAME`, or `OPERATON_CLIENT_ID` set | Set the required environment variables for your auth mode |
| `Missing required environment variables: OPERATON_BASE_URL` | `OPERATON_USERNAME` is set but `OPERATON_BASE_URL` is missing | Set `OPERATON_BASE_URL` |
| `Ambiguous authentication config: both OPERATON_USERNAME (basic) and OPERATON_CLIENT_ID (oidc) are set` | Both basic and OIDC env vars are set | Use only one auth mode, or use `OPERATON_CONFIG` for multi-engine setups |
| `Config file not found: /path/to/config.json` | `OPERATON_CONFIG` points to a nonexistent file | Check the path and file existence |
| `Failed to parse config file: ...` | Config file contains invalid JSON | Validate JSON syntax |
| `Multiple engines configured but none marked as default` | Multi-engine config with no `"default": true` | Add `"default": true` to exactly one engine |
| `Multiple engines marked as default` | More than one engine has `"default": true` | Remove `"default"` from all but one engine |
| `OIDC token fetch failed: HTTP 401 from ...` | Wrong client ID or secret | Verify OIDC credentials with your identity provider |
| `Cannot reach Operaton at ...` | Startup connectivity check failed | Verify `OPERATON_BASE_URL` is correct and the instance is reachable |
