#!/usr/bin/env node
// GENERIC ADMITTED PLATFORM CAPABILITY: sda-json-query-cli.v1
//
// Evaluates one declared, IMPLEMENTED query from an inspectable-query-catalog.v1
// document against an already-admitted JSON document (e.g. a scenario's projected
// terminal outcome), using the same authority-driven transformation interpreter
// that powers sda-authority-transformation-port.v1. A query orients or selects
// already-established meaning; unlike a scenario it never mutates or extends it,
// so it is invoked directly against a materialized document rather than through
// the scenario execution graph.
//
// Usage:
//   node query-cli.mjs <query-catalog.json> <document.json> <queryId> <paramsJson>
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { platformMechanics } from "./admitted-consumer-platform.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

export function runQuery(catalog, document, queryId, params) {
  const definition = (catalog.queries || []).find((query) => query.queryId === queryId);
  if (!definition) {
    throw new Error(`UNKNOWN_QUERY: '${queryId}' is not declared in this catalog.`);
  }
  if (definition.status !== "IMPLEMENTED" || !definition.expression) {
    throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: query '${queryId}' is declared but not implemented.`);
  }
  const scope = { profile: document, params: params ?? {} };
  return platformMechanics.evaluateTransformation(definition.expression, { input: scope, root: scope });
}

async function main() {
  const [catalogPath, documentPath, queryId, paramsArgument] = process.argv.slice(2);
  if (!catalogPath || !documentPath || !queryId) {
    throw new Error("Expected arguments: <query-catalog.json> <document.json> <queryId> [paramsJson]");
  }
  const catalog = readJson(catalogPath);
  const document = readJson(documentPath);
  const params = paramsArgument ? JSON.parse(paramsArgument) : {};
  const result = runQuery(catalog, document, queryId, params);
  process.stdout.write(JSON.stringify(result) + "\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
