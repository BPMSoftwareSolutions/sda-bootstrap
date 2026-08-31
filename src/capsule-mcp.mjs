#!/usr/bin/env node

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import {
  assertCollapsedRepository,
  inspectCapsule,
  invokeCapability,
  listCapsules,
  loadEstate,
  proveDirectExecution,
  resolveEstate,
  verifyEstate
} from "./capsule-manager.mjs";

const deliveryCapabilityId = "deliver-capsule-estate-mcp";

async function delivery(input) {
  const result = await invokeCapability(deliveryCapabilityId, {
    contractId: "capsule-estate-mcp-delivery-request.v1",
    payload: input
  });
  if (result.disposition !== "terminated" || result.outcome?.contractId !== "capsule-estate-mcp-delivery-result.v1") {
    throw new Error("CAPSULE_ESTATE_MCP_DELIVERY_NOT_ADMITTED");
  }
  return result.outcome;
}

const operations = {
  verify: async () => {
    const estate = loadEstate();
    return {
      ...verifyEstate(estate),
      dependencies: resolveEstate(estate),
      durableLayout: assertCollapsedRepository()
    };
  },
  list: async ({ query }) => listCapsules(loadEstate(), query),
  inspect: async ({ capabilityId }) => inspectCapsule(capabilityId),
  test: async ({ capabilityIds }) => proveDirectExecution(loadEstate(), capabilityIds ? new Set(capabilityIds) : null),
  invoke: async ({ capabilityId, input }) => invokeCapability(capabilityId, input)
};

async function representToolResult(toolResult) {
  const authorized = (await delivery({ toolResult })).mcpResult;
  return {
    content: [{ type: "text", text: authorized.content }],
    structuredContent: { result: authorized.structuredResult },
    isError: authorized.isError
  };
}

async function createServer() {
  const admitted = await delivery({});
  const { mcp } = admitted;
  if (mcp.transport !== "stdio" || !Array.isArray(mcp.tools) || mcp.tools.length === 0) {
    throw new Error("CAPSULE_ESTATE_MCP_CATALOG_NOT_ADMITTED");
  }
  const server = new McpServer(mcp.serverIdentity, {
    supportedProtocolVersions: [mcp.protocolVersion],
    capabilities: { tools: {} }
  });
  for (const tool of mcp.tools) {
    const operation = operations[tool.operation];
    if (!operation) throw new Error(`CAPSULE_ESTATE_MCP_OPERATION_NOT_RESOLVED: '${tool.operation}'.`);
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: fromJsonSchema(tool.inputSchema),
      annotations: tool.annotations
    }, async (input) => {
      try {
        const value = await operation(input);
        return await representToolResult({
          isError: false,
          content: JSON.stringify(value),
          structuredResult: value
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return await representToolResult({
          isError: true,
          content: message,
          structuredResult: { code: message.match(/^[A-Z0-9_]+/)?.[0] ?? "CAPSULE_ESTATE_MCP_FAILURE" }
        });
      }
    });
  }
  return server;
}

async function main() {
  const server = await createServer();
  await server.connect(new StdioServerTransport());
}

export { createServer };

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
