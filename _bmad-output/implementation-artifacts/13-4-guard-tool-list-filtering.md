# Story 13.4: Guard Tool-List Filtering

Status: complete

## Story

As an operator who has configured `OPERATON_GUARD=read-only` (or any guard that blocks certain tools),
I want the MCP server to only advertise tools that are permitted under the active guard configuration,
So that the AI assistant never even sees — and therefore never proposes — operations that are forbidden,
and the principle of least privilege is enforced at the capability boundary, not just at call time.

## Problem Statement

Stories 13.1–13.3 implemented guard enforcement at the **call layer**: when an AI attempts to invoke a
forbidden tool, it receives an `isError` response. However, the `ListToolsRequestSchema` handler
advertised *all* registered tools regardless of guard mode. This caused:

1. The AI seeing delete/mutating tools in `read-only` mode and proposing their use.
2. The human being asked "shall I delete?" before the guard could reject the call.
3. The user experiencing a false sense of security — the guard felt like a speed bump, not a wall.

The correct design is: **forbidden tools must not appear in the tool list**. This matches the
principle of least privilege — a capability that is not permitted should not be visible.

## Acceptance Criteria

1. **Given** `OPERATON_GUARD=read-only` **When** the MCP client requests the tool list **Then** only tools
   with `operationClass: "read"` are returned; all mutating tools (create, update, delete, deploy,
   suspend-resume, migrate-execute, migrate-control) are absent from the list.

2. **Given** `OPERATON_GUARD=safe` **When** the MCP client requests the tool list **Then** tools with
   op-class `delete`, `deploy`, `migrate-execute` are absent; all other op-classes are present.

3. **Given** `OPERATON_DENY_RESOURCES=users-groups` **When** the MCP client requests the tool list
   **Then** all tools whose `resourceDomain` is `users-groups` are absent.

4. **Given** `OPERATON_DENY_OPS=delete` **When** the MCP client requests the tool list **Then** all
   tools with `operationClass: "delete"` are absent.

5. **Given** no guard env vars are set **When** the MCP client requests the tool list **Then** all
   registered tools are present (no change in unrestricted mode).

6. **Given** a tool is absent from the tool list due to guard filtering **When** a call is made for
   that tool directly **Then** the call-time guard check still rejects it (defense in depth — both
   layers enforce).

## Tasks / Subtasks

- [x] Update `ListToolsRequestSchema` handler in `src/generated/index.ts` to filter tools via `checkGuard` (AC: 1–5)
  - [x] Apply `.filter()` before `.map()` in the tools list response
  - [x] Reuse the existing `checkGuard()` call with same arguments as call-time enforcement
- [x] Update Story 13.2 spec to note the tool-list filtering behavior (AC: 6 — defense in depth)
- [x] Update README to document that blocked tools are hidden from the tool list
- [x] Update unit tests to assert tool-list filtering behavior

## Dev Notes

### Implementation

Single `.filter()` added to `src/generated/index.ts` `ListToolsRequestSchema` handler:

```typescript
server.server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [...tools.entries()]
    .filter(([name, t]) => !checkGuard(name, t.resourceDomain as any, t.operationClass as any, guardConfig))
    .map(([name, t]) => {
      // ... existing map logic unchanged
    }),
}));
```

`checkGuard` is already imported and available in scope. No new dependencies required.

### Defense in Depth

Both layers enforce independently:
- Tool list: filtered at `ListToolsRequestSchema` — AI never sees forbidden tools
- Call dispatch: checked at `CallToolRequestSchema` — direct calls still rejected

### Key File

`src/generated/index.ts` — `ListToolsRequestSchema` handler (generated file, line ~754)

## Dev Agent Record

### File List

- `src/generated/index.ts` — MODIFY: added guard filter to `ListToolsRequestSchema` handler
- `README.md` — MODIFY: updated `read-only` description and "Combining guards" section
- `_bmad-output/implementation-artifacts/13-4-guard-tool-list-filtering.md` — NEW: this story

### Change Log

- 2026-04-27: Implemented guard tool-list filtering — added `.filter()` to `ListToolsRequestSchema`
  handler so forbidden tools are hidden from the AI's tool list, not just blocked at call time.
  Updated README. All existing tests pass.

### Completion Notes

Fix is minimal: one `.filter()` call added to the list handler. The `checkGuard` function's
semantics — returning `null` when permitted and a `GuardViolation` when blocked — map directly to
`.filter()`'s boolean predicate. No new logic needed.
