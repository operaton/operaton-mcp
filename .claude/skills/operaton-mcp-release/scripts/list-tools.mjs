// Copyright Operaton contributors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Prints the tools the built server advertises in tools/list (default guard, no engine needed).
// Usage: npm run build && node .claude/skills/operaton-mcp-release/scripts/list-tools.mjs [--json]
import { spawn } from "node:child_process";

const server = spawn("node", ["dist/index.js"], {
  env: {
    ...process.env,
    OPERATON_BASE_URL: "http://localhost:1/engine-rest",
    OPERATON_USERNAME: "x",
    OPERATON_PASSWORD: "x",
    OPERATON_SKIP_HEALTH_CHECK: "true",
  },
  stdio: ["pipe", "pipe", "ignore"],
});

const timeout = setTimeout(() => {
  console.error("tools/list timed out — is dist/ built?");
  server.kill();
  process.exit(1);
}, 15000);

let buffer = "";
server.stdout.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    if (message.id !== 2) continue;
    const tools = message.result.tools;
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(tools, null, 2));
    } else {
      console.log(`tools: ${tools.length}`);
      for (const tool of tools) console.log(tool.name);
    }
    clearTimeout(timeout);
    server.kill();
  }
});

const send = (message) => server.stdin.write(JSON.stringify(message) + "\n");
send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "list-tools", version: "1" } },
});
send({ jsonrpc: "2.0", method: "notifications/initialized" });
send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
