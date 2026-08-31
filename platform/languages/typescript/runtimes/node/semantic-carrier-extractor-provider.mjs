import crypto from "node:crypto";
import fs from "node:fs";

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SOURCE_ID_PATTERN = /^(?!\/)(?![A-Za-z]:[\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$)).+\.ts$/u;

function compareCodePoints(left, right) {
  const leftPoints = [...left].map((value) => value.codePointAt(0));
  const rightPoints = [...right].map((value) => value.codePointAt(0));
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
  }
  return leftPoints.length - rightPoints.length;
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError("Canonical JSON number is not admitted.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort(compareCodePoints).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new TypeError("Value is not representable as canonical JSON.");
}

export function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

export function canonicalJsonDigest(value) {
  return sha256(Buffer.from(canonicalJson(value), "utf8"));
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort(compareCodePoints).map((key) => [key, sortJsonValue(value[key])]));
  }
  return value;
}

export function canonicalGraphBytes(graph) {
  return `${JSON.stringify(sortJsonValue(graph), null, 2)}\n`;
}

function finding(code, path, message) {
  return { code, path, message };
}

function nodeId(kind, ...scope) {
  return `${kind}/${scope.join("/")}`;
}

export function buildCanonicalCarrierGraph(carrier) {
  const nodes = [];
  const edges = [];
  const addNode = (kind, identity, scope, attributes) => {
    const id = nodeId(kind, ...scope, identity);
    nodes.push({ nodeId: id, kind, identity, attributes });
    return id;
  };
  const addEdge = (from, type, to) => edges.push({ from, type, to });

  const capabilityId = addNode("capability", carrier.capability.id, [], {
    name: carrier.capability.name,
    version: carrier.capability.version,
    rootExperience: carrier.capability.rootExperience,
    terminalDispositions: carrier.capability.terminalDispositions,
  });
  const featureId = addNode("feature", carrier.feature.id, [], { name: carrier.feature.name });
  addEdge(capabilityId, "contains", featureId);

  const contractNodeIds = new Map();
  for (const contract of carrier.contracts) {
    const contractId = addNode("contract", contract.id, [], {
      name: contract.name,
      kind: contract.kind,
      shape: contract.shape,
    });
    contractNodeIds.set(contract.id, contractId);
    addEdge(capabilityId, "contains", contractId);
  }

  const scenarioNodeIds = new Map();
  for (const scenario of carrier.scenarios) {
    const scenarioId = addNode("scenario", scenario.id, [], { name: scenario.name });
    scenarioNodeIds.set(scenario.id, scenarioId);
    addEdge(featureId, "contains", scenarioId);
  }

  for (const scenario of carrier.scenarios) {
    const scenarioId = scenarioNodeIds.get(scenario.id);
    const scope = [scenario.id];
    const inputId = addNode("input", scenario.input.id, scope, { name: scenario.input.name, gherkin: scenario.input.gherkin });
    const eventId = addNode("event", scenario.event.id, scope, {
      name: scenario.event.name,
      responsibility: scenario.event.responsibility,
      gherkin: scenario.event.gherkin,
    });
    const outcomeId = addNode("outcome", scenario.outcome.id, scope, {
      name: scenario.outcome.name,
      experience: scenario.outcome.experience,
      terminal: scenario.outcome.terminal,
      terminalDisposition: scenario.outcome.terminalDisposition,
      gherkin: scenario.outcome.gherkin,
    });
    const productId = addNode("product", scenario.outcome.product.id, scope, { name: scenario.outcome.product.name });

    addEdge(scenarioId, "contains", inputId);
    addEdge(scenarioId, "contains", eventId);
    addEdge(scenarioId, "contains", outcomeId);
    addEdge(eventId, "consumes", inputId);
    addEdge(eventId, "establishes", outcomeId);
    addEdge(outcomeId, "emits", productId);
    addEdge(inputId, "supplied-by", contractNodeIds.get(scenario.input.contractRef));
    addEdge(productId, "supplied-by", contractNodeIds.get(scenario.outcome.product.contractRef));

    const execution = scenario.event.execution;
    const mechanicNodeIds = new Map();
    const providerNodeIds = new Map();
    const effectNodeIds = new Map();
    const operationNodeIds = new Map();
    for (const mechanic of execution.mechanics) {
      const id = addNode("mechanic", mechanic.id, scope, { name: mechanic.name, kind: mechanic.kind, config: mechanic.config });
      mechanicNodeIds.set(mechanic.id, id);
      addEdge(eventId, "contains", id);
      addEdge(eventId, "invokes", id);
    }
    for (const provider of execution.providerBoundaries) {
      const id = addNode("provider", provider.id, scope, { name: provider.name, provider: provider.provider });
      providerNodeIds.set(provider.id, id);
      addEdge(eventId, "contains", id);
      addEdge(eventId, "invokes", id);
    }
    for (const effect of execution.effects) {
      const id = addNode("effect", effect.id, scope, { name: effect.name, kind: effect.kind, observable: effect.observable });
      effectNodeIds.set(effect.id, id);
      addEdge(eventId, "contains", id);
      addEdge(eventId, "invokes", id);
      addEdge(id, "supplied-by", providerNodeIds.get(effect.providerBoundaryRef));
    }
    for (const operation of execution.operations) {
      const id = addNode("operation", operation.id, scope, { name: operation.name });
      operationNodeIds.set(operation.id, id);
      addEdge(eventId, "contains", id);
      addEdge(eventId, "invokes", id);
      operation.mechanicRefs.forEach((ref) => addEdge(id, "invokes", mechanicNodeIds.get(ref)));
      operation.providerBoundaryRefs.forEach((ref) => addEdge(id, "invokes", providerNodeIds.get(ref)));
      operation.effectRefs.forEach((ref) => addEdge(id, "invokes", effectNodeIds.get(ref)));
    }
    for (const operation of execution.operations) {
      operation.predecessorRefs.forEach((ref) => addEdge(operationNodeIds.get(ref), "precedes", operationNodeIds.get(operation.id)));
    }
    for (const route of scenario.routes) {
      const routeId = addNode("junction", route.id, scope, { when: route.when });
      addEdge(scenarioId, "contains", routeId);
      addEdge(outcomeId, "routes-to", routeId);
      addEdge(routeId, "routes-to", scenarioNodeIds.get(route.toScenarioRef));
    }
  }

  nodes.sort((left, right) => compareCodePoints(left.nodeId, right.nodeId));
  edges.sort((left, right) => compareCodePoints(`${left.from}|${left.type}|${left.to}`, `${right.from}|${right.type}|${right.to}`));
  return {
    schemaVersion: "canonical-carrier-graph.v1",
    carrierSchemaVersion: "scenario-semantic-carrier.v2",
    root: { capabilityNodeId: capabilityId, featureNodeId: featureId },
    nodes,
    edges,
  };
}

function buildCanonicalManagedCarrierGraph(carrier, sourceId, sourceDigest) {
  const baseCarrier = {
    schemaVersion: "scenario-semantic-carrier.v2",
    capability: carrier.capability,
    feature: carrier.feature,
    contracts: carrier.contracts,
    scenarios: carrier.scenarios,
  };
  return {
    schemaVersion: "canonical-managed-carrier-graph.v1",
    carrierSchemaVersion: "scenario-semantic-carrier.v3",
    source: { sourceId: sourceId.replaceAll("\\", "/"), sourceDigest },
    semanticGraph: buildCanonicalCarrierGraph(baseCarrier),
    management: carrier.management,
  };
}

function held(input, findings) {
  const record = {
    contractId: "semantic-carrier-extraction-result.v1",
    sourceId: input?.payload?.sourceId ?? null,
    sourceDigest: typeof input?.payload?.source === "string" ? sha256(Buffer.from(input.payload.source, "utf8")) : null,
    validatorReceiptDigest: input?.payload?.validatorReceipt?.receiptDigest ?? null,
    disposition: "EXTRACTION_HELD",
    graph: null,
    graphDigest: null,
    carrierBlackout: true,
    findings: [...findings].sort((left, right) => compareCodePoints(`${left.path}|${left.code}|${left.message}`, `${right.path}|${right.code}|${right.message}`)),
  };
  return { ...record, receiptDigest: canonicalJsonDigest(record) };
}

export function evaluateScenarioSemanticCarrierExtraction(input) {
  const findings = [];
  if (input?.contractId !== "semantic-carrier-extraction-request.v1" ||
      typeof input?.payload?.source !== "string" || input.payload.source.length === 0 ||
      typeof input?.payload?.sourceId !== "string" || !SOURCE_ID_PATTERN.test(input.payload.sourceId) ||
      input?.payload?.validatorReceipt === null || typeof input?.payload?.validatorReceipt !== "object" || Array.isArray(input.payload.validatorReceipt)) {
    return held(input, [finding("EXTRACTION_REQUEST_NOT_ADMITTED", "/", "Exact carrier bytes, a safe source identity, and one validator receipt are required.")]);
  }

  const { source, sourceId, validatorReceipt } = input.payload;
  const sourceDigest = sha256(Buffer.from(source, "utf8"));
  if (validatorReceipt.contractId !== "semantic-carrier-validation-result.v1" || validatorReceipt.disposition !== "CONFORMANT") {
    findings.push(finding("VALIDATOR_PASS_RECEIPT_REQUIRED", "/payload/validatorReceipt/disposition", "Extraction requires one conformant validator receipt."));
  }
  const receiptMaterial = Object.fromEntries(Object.entries(validatorReceipt).filter(([key]) => key !== "receiptDigest"));
  if (!DIGEST_PATTERN.test(validatorReceipt.receiptDigest ?? "") || canonicalJsonDigest(receiptMaterial) !== validatorReceipt.receiptDigest) {
    findings.push(finding("VALIDATOR_RECEIPT_DIGEST_MISMATCH", "/payload/validatorReceipt/receiptDigest", "The validator receipt does not match its canonical content digest."));
  }
  if (validatorReceipt.sourceId !== sourceId || validatorReceipt.sourceDigest !== sourceDigest) {
    findings.push(finding("VALIDATOR_CARRIER_BINDING_DIVERGED", "/payload", "The carrier bytes and source identity do not match the validator receipt."));
  }
  if (!["scenario-semantic-carrier.v2", "scenario-semantic-carrier.v3"].includes(validatorReceipt.grammarVersion) ||
      validatorReceipt.carrier === null || typeof validatorReceipt.carrier !== "object" || Array.isArray(validatorReceipt.carrier)) {
    findings.push(finding("VALIDATOR_CARRIER_NOT_ADMITTED", "/payload/validatorReceipt/carrier", "The validator receipt does not contain one admitted Scenario Semantic Carrier v2 or v3 value."));
  }
  if (findings.length > 0) return held(input, findings);

  try {
    const graph = validatorReceipt.grammarVersion === "scenario-semantic-carrier.v3"
      ? buildCanonicalManagedCarrierGraph(validatorReceipt.carrier, sourceId, sourceDigest)
      : buildCanonicalCarrierGraph(validatorReceipt.carrier);
    const graphDigest = sha256(Buffer.from(canonicalGraphBytes(graph), "utf8"));
    const record = {
      contractId: "semantic-carrier-extraction-result.v1",
      sourceId,
      sourceDigest,
      validatorReceiptDigest: validatorReceipt.receiptDigest,
      disposition: "EXTRACTED",
      graph,
      graphDigest,
      carrierBlackout: true,
      findings: [],
    };
    return { ...record, receiptDigest: canonicalJsonDigest(record) };
  } catch (error) {
    return held(input, [finding("CANONICAL_GRAPH_EXTRACTION_FAILED", "/payload/validatorReceipt/carrier", error instanceof Error ? error.message : String(error))]);
  }
}

function readBoundAuthority(reference, digest, bindingUrl) {
  if (typeof reference !== "string" || !DIGEST_PATTERN.test(digest ?? "")) throw new Error("SEMANTIC_CARRIER_EXTRACTOR_PROVIDER_AUTHORITY_BINDING_INCOMPLETE");
  const url = new URL(reference, bindingUrl);
  if (url.protocol !== "file:") throw new Error("SEMANTIC_CARRIER_EXTRACTOR_PROVIDER_AUTHORITY_LOCAL_FILE_REQUIRED");
  const bytes = fs.readFileSync(url);
  if (sha256(bytes) !== digest) throw new Error("SEMANTIC_CARRIER_EXTRACTOR_PROVIDER_AUTHORITY_DIGEST_MISMATCH");
  const authority = JSON.parse(bytes.toString("utf8"));
  if (authority.lifecycle !== "ADMITTED" || authority.platformCapabilityId !== "sda-scenario-semantic-carrier-extraction-port.v1") {
    throw new Error("SEMANTIC_CARRIER_EXTRACTOR_PROVIDER_AUTHORITY_NOT_ADMITTED");
  }
}

export function invokeScenarioSemanticCarrierExtraction(configuration, input, bindingUrl) {
  readBoundAuthority(configuration?.providerAuthorityRef, configuration?.providerAuthorityDigest, bindingUrl);
  return evaluateScenarioSemanticCarrierExtraction(input);
}
