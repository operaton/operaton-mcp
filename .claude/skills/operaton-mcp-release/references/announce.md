# ANNOUNCE

Only after PERFORM verified the release (npm `dist-tags` show `VER`, GitHub release exists). Every channel is public: draft → show the maintainer → post only on explicit confirmation. You have no forum credentials; for Slack only if a connector to the Operaton workspace is authenticated. Default: hand the maintainer final text to post.

## 1. Channels

There is no established channel for MCP releases yet. Ask once which to use and remember the answer for later releases (offer to record it in this file via PR):
- **Forum** `forum.operaton.org` — new topic in "Announcements" ("Operaton MCP server X.Y.Z released"), or a reply in the existing topic "Operaton MCP server" (`/t/413`)
- **Slack** Operaton workspace `#general` — short post, no `@channel` for a patch

Patch release: one line + link is enough. Minor/major: 2–4 highlights.

## 2. Drafts

Slack:
```
🚀 Operaton MCP server VER is out (npm: @operaton/mcp)

• <highlight / fix 1>
• <highlight / fix 2>

Release notes: https://github.com/operaton/operaton-mcp/releases/tag/vVER
Upgrade: npx -y @operaton/mcp@VER
```

Forum: same content in markdown, each highlight 2–3 sentences, plus the MCP client config snippet from the README and a link to https://docs.operaton.org/docs/documentation/user-guide/mcp-server/. Mention breaking parameter changes explicitly.

## 3. Documentation follow-up

- Drift PRs from PREPARE (README, `operaton/documentation` MCP pages) merged? List open ones.
- New tools or env vars in this release → PR on `operaton/documentation` (`docs/documentation/user-guide/mcp-server/`), ask before opening.

## 4. Housekeeping

- Milestone `VER` closed (JReleaser does it; close by hand if not: `gh api -X PATCH repos/operaton/operaton-mcp/milestones/N -f state=closed`)
- Next milestone exists (`X.(Y+1).0` after a minor)
- Patch: backmerge PR merged with a merge commit
- Merged branches for cleanup — **list only, never delete**:
  ```bash
  git fetch --prune origin
  for b in $(git branch -r --merged origin/main | grep -vE 'origin/(HEAD|main|release/)'); do echo "https://github.com/operaton/operaton-mcp/tree/${b#origin/}"; done
  ```
  Also check against the release branch for branches merged only there.

## Output
Drafts (or post links once confirmed), open docs PRs, housekeeping state, branch list for the maintainer.
