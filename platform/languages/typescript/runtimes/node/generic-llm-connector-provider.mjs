import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bindValueAt, valueAt } from "./native-mechanic-primitives.mjs";

function normalizeProviderAuthorities(loaded) {
  if (Array.isArray(loaded)) return loaded;
  if (loaded && typeof loaded === "object" && Array.isArray(loaded.providerAuthorities)) {
    return loaded.providerAuthorities;
  }
  return [loaded];
}

const genericConnectorModules = new Map();

export function resolveGenericConnectorRoot(providerAuthorityUrl, loadedProviderAuthority) {
  const schemaRef = loadedProviderAuthority?.$schema;
  if (typeof schemaRef !== "string" || schemaRef.length === 0) {
    throw new Error("GENERIC_LLM_CONNECTOR_SCHEMA_AUTHORITY_MISSING");
  }
  const schemaUrl = new URL(schemaRef, providerAuthorityUrl);
  if (schemaUrl.protocol !== "file:") throw new Error("GENERIC_LLM_CONNECTOR_SCHEMA_AUTHORITY_MUST_BE_LOCAL");
  return path.dirname(path.dirname(fileURLToPath(schemaUrl)));
}

async function loadGenericConnector(providerAuthorityUrl, loadedProviderAuthority) {
  const connectorRoot = resolveGenericConnectorRoot(providerAuthorityUrl, loadedProviderAuthority);
  const cached = genericConnectorModules.get(connectorRoot);
  if (cached) return cached;
  const tsxApiUrl = pathToFileURL(path.join(connectorRoot, "node_modules", "tsx", "dist", "esm", "api", "index.mjs"));
  const { tsImport } = await import(tsxApiUrl.href);
  const connector = await tsImport(pathToFileURL(path.join(connectorRoot, "src", "index.ts")).href, {
    parentURL: pathToFileURL(path.join(connectorRoot, "sda-platform-provider.mjs")).href
  });
  genericConnectorModules.set(connectorRoot, connector);
  return connector;
}

export async function obtainGenericModelResponse(request, providerAuthorityUrl) {
  const loadedProviderAuthority = JSON.parse(fs.readFileSync(providerAuthorityUrl, "utf8"));
  const connector = await loadGenericConnector(providerAuthorityUrl, loadedProviderAuthority);
  const providerAuthorities = normalizeProviderAuthorities(loadedProviderAuthority);
  return connector.obtainsModelResponse(request, {
    providerAuthorities,
    providerAdapters: [connector.createsGeminiAdapter({
      http: connector.fetchHttpPort,
      credentials: connector.environmentCredentials,
      clock: connector.systemClock
    })],
    clock: connector.systemClock,
    hashes: connector.sha256Hashes,
    identity: connector.uuidIdentity
  });
}

export async function invokeGenericLlmConnector(configuration, input, context, bindingUrl, obtainResponse = obtainGenericModelResponse) {
  const required = ["connectorAuthorityRef", "requestPath", "lineageMode", "credentialsMode"];
  const missing = required.filter((property) => typeof configuration[property] !== "string" || configuration[property].length === 0);
  if (missing.length > 0) throw new Error(`GENERIC_LLM_CONNECTOR_CONFIGURATION_MISSING: '${missing.join(",")}'`);
  if (configuration.lineageMode !== "retain-external-execution") {
    throw new Error(`GENERIC_LLM_CONNECTOR_LINEAGE_MODE_UNSUPPORTED: '${configuration.lineageMode}'`);
  }
  if (configuration.credentialsMode !== "external-reference-only") {
    throw new Error(`GENERIC_LLM_CONNECTOR_CREDENTIALS_MODE_UNSUPPORTED: '${configuration.credentialsMode}'`);
  }
  const request = valueAt(input, configuration.requestPath);
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("GENERIC_LLM_CONNECTOR_REQUEST_MISSING");
  const providerAuthorityUrl = new URL(configuration.connectorAuthorityRef, bindingUrl);
  if (providerAuthorityUrl.protocol !== "file:") throw new Error("GENERIC_LLM_CONNECTOR_AUTHORITY_MUST_BE_LOCAL");
  const response = await obtainResponse(request, providerAuthorityUrl, context);
  const evidence = {
    carrierType: "governed-model-response-evidence.v1",
    requestId: response.requestId,
    disposition: response.disposition,
    resolvedProvider: response.resolvedAuthority?.providerKind ?? null,
    resolvedModel: response.resolvedAuthority?.resolvedModel ?? null,
    attemptCount: response.proof.attemptCount,
    timing: {
      startedAt: response.proof.startedAt,
      completedAt: response.proof.completedAt,
      durationMilliseconds: response.proof.durationMilliseconds
    },
    requestHash: response.proof.requestHash ?? input.requestHash,
    responseHash: response.proof.responseHash ?? null,
    normalizedResponse: response.result ?? null,
    acceptanceClaimed: false,
    effectLineage: [
      ...(Array.isArray(input.requestLineage) ? input.requestLineage : []),
      context.rootExecutionId,
      ...(typeof response.invocationId === "string" ? [response.invocationId] : [])
    ]
  };
  if (configuration.resultPath !== undefined) {
    if (typeof configuration.resultPath !== "string" || configuration.resultPath.length === 0) {
      throw new Error("GENERIC_LLM_CONNECTOR_RESULT_PATH_INVALID");
    }
    return bindValueAt(input, configuration.resultPath, evidence);
  }
  return evidence;
}
