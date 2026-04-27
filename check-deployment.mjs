#!/usr/bin/env node
import { loadConfig } from "./dist/src/config.js";
import { createOperatonClient } from "./dist/src/http/client.js";
import { getDeployments } from "./dist/src/generated/deployment/getDeployments.js";
import { getProcessDefinitions } from "./dist/src/generated/processDefinition/getProcessDefinitions.js";
import { getDecisionDefinitions } from "./dist/src/generated/decision/getDecisionDefinitions.js";

try {
  const config = loadConfig();
  const client = createOperatonClient(config);

  console.log("\n=== OPERATON DEPLOYMENT STATUS ===\n");
  console.log(`Engine URL: ${config.engines[config.defaultEngine].url}\n`);

  // Get deployments
  console.log("--- DEPLOYMENTS ---");
  const deploymentResult = await getDeployments({}, client);
  const deployments = JSON.parse(deploymentResult.content[0].text);
  console.log(`Total deployments: ${deployments.length || 0}\n`);
  if (deployments.length > 0) {
    deployments.forEach((d, i) => {
      console.log(`${i + 1}. ${d.name} (ID: ${d.id})`);
      console.log(`   Deployed: ${new Date(d.deploymentTime).toLocaleString()}`);
    });
  }

  // Get process definitions
  console.log("\n--- PROCESS DEFINITIONS ---");
  const pdResult = await getProcessDefinitions({}, client);
  const definitions = JSON.parse(pdResult.content[0].text);
  console.log(`Total process definitions: ${definitions.length || 0}\n`);
  if (definitions.length > 0) {
    definitions.forEach((d, i) => {
      console.log(`${i + 1}. ${d.key} (v${d.version})`);
      console.log(`   ID: ${d.id}`);
      console.log(`   Deployment: ${d.deploymentId}`);
    });
  }

  // Get decision definitions
  console.log("\n--- DECISION DEFINITIONS (DMN) ---");
  const ddResult = await getDecisionDefinitions({}, client);
  const decisions = JSON.parse(ddResult.content[0].text);
  console.log(`Total decision definitions: ${decisions.length || 0}\n`);
  if (decisions.length > 0) {
    decisions.forEach((d, i) => {
      console.log(`${i + 1}. ${d.key} (v${d.version})`);
      console.log(`   ID: ${d.id}`);
    });
  }

  console.log("\n=== END ===\n");
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
