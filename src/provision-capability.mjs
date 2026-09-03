import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { generateMessages } from "@cucumber/gherkin";
import { IdGenerator, SourceMediaType } from "@cucumber/messages";

const runtimeModuleRef = "languages/typescript/runtimes/node/admitted-consumer-platform.mjs";
const sha256 = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const provisionedProviderDefinitions = new Map([
  ["sda-bootstrap.provision-capability-token.v1", {
    requestType: "capability-token-provisioning-request.v1",
    operation: "PROVISION_CAPABILITY_TOKEN",
  }],
  ["sda-bootstrap.deliver-capability-token-provisioning-cli.v1", {
    requestType: "capability-token-provisioning-cli-request.v1",
    operation: "DELIVER_CAPABILITY_TOKEN_PROVISIONING_CLI",
  }],
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(canonicalize(value), null, 2)}\n`, "utf8");
}

function slug(value) {
  return String(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function tagValue(tags, prefix) {
  return tags.map((tag) => tag.name).find((name) => name.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function pathIsWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function scenariosFromChildren(children) {
  return children.flatMap((child) => {
    if (child.scenario) return [child.scenario];
    if (child.rule) return scenariosFromChildren(child.rule.children ?? []);
    return [];
  });
}

function parseFeature(featureBytes, featureRef) {
  const source = featureBytes.toString("utf8");
  const envelopes = generateMessages(
    source,
    featureRef,
    SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN,
    {
      includeSource: false,
      includeGherkinDocument: true,
      includePickles: false,
      newId: IdGenerator.incrementing(),
    },
  );
  const parseErrors = envelopes.flatMap((envelope) => envelope.parseError ? [envelope.parseError] : []);
  if (parseErrors.length > 0) {
    throw new Error(`PROVISIONING_FEATURE_INVALID: ${parseErrors.map((item) => item.message).join(" | ")}`);
  }
  const document = envelopes.find((envelope) => envelope.gherkinDocument)?.gherkinDocument;
  const feature = document?.feature;
  if (!feature) throw new Error("PROVISIONING_FEATURE_REQUIRED");
  const featureTags = feature.tags ?? [];
  const requestedId = tagValue(featureTags, "@capability:");
  const capabilityId = requestedId ?? slug(feature.name);
  const requestedProviderCapabilityId = tagValue(featureTags, "@provisioned-provider:");
  const providerDefinition = requestedProviderCapabilityId
    ? provisionedProviderDefinitions.get(requestedProviderCapabilityId) ?? null
    : null;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(capabilityId)) {
    throw new Error(`PROVISIONING_CAPABILITY_ID_INVALID: '${capabilityId}'.`);
  }
  const scenarios = scenariosFromChildren(feature.children ?? []);
  if (scenarios.length === 0) throw new Error(`PROVISIONING_SCENARIO_REQUIRED: '${capabilityId}'.`);
  const scenarioIds = new Set();
  const topology = scenarios.map((scenario, index) => {
    const combinedTags = [...featureTags, ...(scenario.tags ?? [])];
    const scenarioId = tagValue(combinedTags, "@scenario:") ?? slug(scenario.name) ?? `${capabilityId}-${index + 1}`;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(scenarioId)) {
      throw new Error(`PROVISIONING_SCENARIO_ID_INVALID: '${scenarioId}'.`);
    }
    if (scenarioIds.has(scenarioId)) throw new Error(`PROVISIONING_SCENARIO_ID_DUPLICATED: '${scenarioId}'.`);
    scenarioIds.add(scenarioId);
    const steps = (scenario.steps ?? []).map((step) => ({
      keywordType: step.keywordType,
      text: step.text,
    }));
    const byType = (type) => steps.filter((step) => step.keywordType === type).map((step) => step.text);
    const input = byType("Context");
    const event = byType("Action");
    const outcome = byType("Outcome");
    if (input.length === 0 || event.length === 0 || outcome.length === 0) {
      throw new Error(`PROVISIONING_SCENARIO_GEOMETRY_INVALID: '${scenarioId}' must declare Input, Event, and Outcome steps.`);
    }
    return {
      scenarioId,
      name: scenario.name,
      inputContractId: tagValue(combinedTags, "@input-contract:"),
      eventAuthorityId: tagValue(combinedTags, "@event-authority:"),
      outcomeContractId: tagValue(combinedTags, "@outcome-contract:"),
      input,
      event,
      outcome,
      orderedSteps: steps,
    };
  });
  return {
    capabilityId,
    featureName: feature.name,
    description: feature.description?.trim() ?? "",
    scenarioTopology: topology,
    providerBinding: providerDefinition ? {
      bindingType: "provisioned-platform-provider-binding.v1",
      providerCapabilityId: requestedProviderCapabilityId,
      implementationRef: `package:sda-bootstrap#${requestedProviderCapabilityId}`,
      status: "AVAILABLE",
      requestType: providerDefinition.requestType,
      operation: providerDefinition.operation,
    } : null,
    openSlots: providerDefinition ? [] : topology.map((scenario) => ({
      slotId: `event-mechanic:${scenario.scenarioId}`,
      slotType: "EVENT_MECHANIC",
      requiredByScenarioId: scenario.scenarioId,
      requestedProviderCapabilityId,
      disposition: "OPEN",
    })),
  };
}

function jsonSchemaDigest(schema) {
  return sha256(Buffer.from(JSON.stringify(canonicalize(schema)), "utf8")).slice("sha256:".length);
}

function capsuleEntry(entryId, entryRef, bytes) {
  return {
    entryId,
    entryRef,
    entryDigest: sha256(bytes),
    entryBytesBase64: bytes.toString("base64"),
  };
}

function buildProvisionedCapsule(featureBytes, featureRef) {
  const parsed = parseFeature(featureBytes, featureRef);
  const { capabilityId, featureName, description, scenarioTopology, providerBinding, openSlots } = parsed;
  const featureDigest = sha256(featureBytes);
  const provisioningDisposition = openSlots.length > 0
    ? "PROVISIONED_EXECUTABLE_WITH_OPEN_SLOTS"
    : "PROVISIONED_EXECUTABLE";
  const authority = {
    authorityType: "provisioned-capability-token-authority.v1",
    lifecycleDisposition: "PROVISIONAL",
    capabilityId,
    capabilityVersion: "0.0.0-provisioned",
    name: featureName,
    description,
    sourceFeature: {
      entryRef: `features/${capabilityId}.feature`,
      digest: featureDigest,
    },
    scenarioTopology,
    openSlots,
    providerBindings: providerBinding ? [providerBinding] : [],
    provisioningDisposition,
    managedAdmission: {
      disposition: "NOT_REQUESTED",
      requiredForExecution: false,
    },
  };
  const authorityBytes = canonicalJsonBytes(authority);
  const authorityDigest = sha256(authorityBytes);
  const inputContractId = `${capabilityId}-provisioned-token-request.v1`;
  const outcomeContractId = `${capabilityId}-provisioned-token-outcome.v1`;
  const inputSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://schemas.sidefx.local/provisioning/${inputContractId}.schema.json`,
    type: "object",
    additionalProperties: false,
    required: ["requestType"],
    properties: {
      requestType: { const: "describe-provisioned-capability.v1" },
      payload: { type: "object" },
    },
  };
  const outcome = {
    outcomeType: "provisioned-capability-token-outcome.v1",
    provisioningDisposition,
    capabilityId,
    capabilityVersion: "0.0.0-provisioned",
    featureDigest,
    authorityDigest,
    scenarioTopology,
    openSlots,
    executionMode: "PROVISIONED_TOKEN",
    managedAdmission: "NOT_REQUIRED",
  };
  const outcomeSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://schemas.sidefx.local/provisioning/${outcomeContractId}.schema.json`,
    type: "object",
    additionalProperties: false,
    required: Object.keys(outcome),
    properties: Object.fromEntries(Object.entries(outcome).map(([key, value]) => [key, { const: value }])),
  };
  const executionPlan = {
    executionEmbodimentPlanType: "consumer-execution-embodiment-plan.v1",
    target: "node",
    capabilityId,
    source: {
      queryType: "provisioned-token-execution-query.v1",
      queryId: "execute-provisioned-token",
      queryDigest: featureDigest,
      capabilityAuthorityDigest: authorityDigest,
      mechanicResolutionDigest: sha256(Buffer.from("sda-bootstrap:provision-capability-token.v1", "utf8")),
    },
    rootNodeId: capabilityId,
    nodes: [
      {
        nodeId: capabilityId,
        scenario: {
          scenarioId: capabilityId,
          input: { inputId: "provisioned-token-request", contract: { contractId: inputContractId } },
          event: { eventId: "describe-provisioned-capability", executionAuthorityId: "describe-provisioned-capability.v1" },
          outcome: { outcomeId: "provisioned-token-outcome", contract: { contractId: outcomeContractId }, terminal: true },
        },
        operations: [{ operationId: `${capabilityId}.operation.1`, mechanicBindingId: "port:describe-provisioned-capability" }],
        transition: null,
      },
    ],
    mechanicBindings: [
      {
        bindingId: "contract-admission",
        mechanicType: "contract-admission",
        providerCapabilityId: "sda-schema-contract-admission.v1",
        provider: "ScenarioKernel.NodePlatform.Schema.JsonSchemaContractAdmission",
        implementationRef: runtimeModuleRef,
        configuration: {
          contractAuthorities: {
            authorityType: "consumer-contract-authorities.v1",
            contracts: {
              [inputContractId]: {
                schemaRef: "input.schema.json",
                schemaId: inputSchema.$id,
                schemaDigest: jsonSchemaDigest(inputSchema),
                schema: inputSchema,
              },
              [outcomeContractId]: {
                schemaRef: "outcome.schema.json",
                schemaId: outcomeSchema.$id,
                schemaDigest: jsonSchemaDigest(outcomeSchema),
                schema: outcomeSchema,
              },
            },
          },
        },
      },
      {
        bindingId: "port:describe-provisioned-capability",
        mechanicType: "event-port",
        providerCapabilityId: "sda-authority-transformation-port.v1",
        provider: "ScenarioKernel.NodePlatform.Execution.AuthorityTransformation",
        implementationRef: runtimeModuleRef,
        configuration: { expression: { op: "literal", value: outcome } },
      },
    ],
    conformance: {
      queryId: "execute-provisioned-token",
      platformMechanics: {
        disposition: "RESOLVED",
        resolutions: [
          { capabilityId: "sda-schema-contract-admission.v1", status: "AVAILABLE" },
          { capabilityId: "sda-authority-transformation-port.v1", status: "AVAILABLE" },
        ],
      },
      executableOrigin: { disposition: "PROJECTED_ONLY", unauthorizedFiles: [] },
      closures: [
        { closureId: "feature-to-provisioned-token", evaluation: "compiled", disposition: "PASS", findings: [] },
        { closureId: "token-to-direct-execution", evaluation: "compiled", disposition: "PASS", findings: [] },
      ],
    },
    requiredProviderCapabilityIds: [
      "sda-authority-transformation-port.v1",
      "sda-schema-contract-admission.v1",
    ],
  };
  const planBytes = canonicalJsonBytes(executionPlan);
  const fixtures = {
    fixtureType: "consumer-capability-fixtures.v1",
    fixtures: [
      {
        fixtureId: "provisioned-token-describes-its-executable-topology",
        input: { requestType: "describe-provisioned-capability.v1", payload: {} },
        expected: {
          disposition: "terminated",
          terminalScenarioId: capabilityId,
          scenarioSequence: [capabilityId],
          outcomeAssertions: [
            { conditionId: "exact-provisioning-disposition", path: "provisioningDisposition", operator: "equals", value: provisioningDisposition },
            { conditionId: "exact-capability-identity", path: "capabilityId", operator: "equals", value: capabilityId },
            { conditionId: "managed-admission-is-not-in-loop", path: "managedAdmission", operator: "equals", value: "NOT_REQUIRED" },
          ],
        },
      },
    ],
  };
  const sterility = {
    conformanceType: "projected-artifact-mechanical-sterility.v1",
    sourceOrigin: "PROJECTED",
    forbiddenExecutableMechanics: {
      branch: 0,
      iteration: 0,
      "exception-handling": 0,
      throw: 0,
      "object-construction": 0,
      serialization: 0,
      normalization: 0,
      validation: 0,
      fallback: 0,
      retry: 0,
      "state-mutation": 0,
      "meaning-hidden-in-text": 0,
    },
    violations: [],
    disposition: "PURE_PROJECTION_CONFORMS",
  };
  const binding = {
    bindingType: "projected-consumer-application-binding.v2",
    executionPlan: "execution-plans/consumer-execution-plan.node.json",
    executionPlanDigest: sha256(planBytes),
    fixtures: "fixtures/fixtures.json",
    mechanicalSterility: "projection-conformance.json",
  };
  const bindingRef = `capsule-runtime/${capabilityId}/application-binding.node.json`;
  const planRef = `capsule-runtime/${capabilityId}/execution-plan.node.json`;
  const fixturesRef = `capsule-runtime/${capabilityId}/fixtures.json`;
  const sterilityRef = `capsule-runtime/${capabilityId}/projection-conformance.json`;
  const entries = [
    capsuleEntry("capability.authority.json", `capabilities/${capabilityId}/capability.authority.json`, authorityBytes),
    capsuleEntry("scenario-topology.authority.json", `capabilities/${capabilityId}/scenario-topology.authority.json`, canonicalJsonBytes({
      authorityType: "provisioned-scenario-topology.v1",
      capabilityId,
      scenarios: scenarioTopology,
      openSlots,
    })),
    capsuleEntry("features/{id}.feature", `features/${capabilityId}.feature`, featureBytes),
    capsuleEntry("runtime.application-binding.node.json", bindingRef, canonicalJsonBytes(binding)),
    capsuleEntry("runtime.execution-plan.node.v1.json", planRef, planBytes),
    capsuleEntry("runtime.fixtures.json", fixturesRef, canonicalJsonBytes(fixtures)),
    capsuleEntry("runtime.projection-conformance.json", sterilityRef, canonicalJsonBytes(sterility)),
  ];
  const capsule = {
    capsuleFormat: "sidefx-capsule-pack.v1",
    capsuleFormatVersion: "1.0.0",
    capabilityId,
    capabilityVersion: "0.0.0-provisioned",
    lineage: `features/${capabilityId}.feature`,
    packing: "canonical-json",
    lifecycleDisposition: "PROVISIONAL",
    declaredDependencies: [],
    externalToolRoots: [],
    ...(providerBinding ? {
      provisionedExecution: {
        executionType: "provisioned-platform-provider-execution.v1",
        providerBinding,
      },
    } : {}),
    runtimeBindings: [
      {
        runtimeBindingType: "capsule-runtime-binding.v1",
        target: "node",
        bindingEntryRef: bindingRef,
        planEntryRef: planRef,
        fixturesEntryRef: fixturesRef,
        sterilityEntryRef: sterilityRef,
        directExecutionEligibility: "provisioned-token",
      },
    ],
    entries,
  };
  return { capsule, authorityDigest, featureDigest, provisioningDisposition, providerBinding };
}

function verifyProvisionedCapsule(capsule) {
  if (capsule.capsuleFormat !== "sidefx-capsule-pack.v1" || capsule.lifecycleDisposition !== "PROVISIONAL") {
    throw new Error("PROVISIONED_CAPSULE_FORMAT_INVALID");
  }
  const refs = new Set();
  for (const entry of capsule.entries ?? []) {
    if (refs.has(entry.entryRef)) throw new Error(`PROVISIONED_CAPSULE_ENTRY_DUPLICATED: '${entry.entryRef}'.`);
    refs.add(entry.entryRef);
    const bytes = Buffer.from(entry.entryBytesBase64, "base64");
    if (bytes.toString("base64") !== entry.entryBytesBase64 || sha256(bytes) !== entry.entryDigest) {
      throw new Error(`PROVISIONED_CAPSULE_ENTRY_INVALID: '${entry.entryRef}'.`);
    }
  }
  const runtime = capsule.runtimeBindings?.[0];
  if (!runtime || capsule.runtimeBindings.length !== 1) throw new Error("PROVISIONED_CAPSULE_RUNTIME_REQUIRED");
  for (const reference of [runtime.bindingEntryRef, runtime.planEntryRef, runtime.fixturesEntryRef, runtime.sterilityEntryRef]) {
    if (!refs.has(reference)) throw new Error(`PROVISIONED_CAPSULE_RUNTIME_ENTRY_MISSING: '${reference}'.`);
  }
  const entries = new Map(capsule.entries.map((entry) => [entry.entryRef, entry]));
  const binding = JSON.parse(Buffer.from(entries.get(runtime.bindingEntryRef).entryBytesBase64, "base64").toString("utf8"));
  if (binding.executionPlanDigest !== entries.get(runtime.planEntryRef).entryDigest) {
    throw new Error("PROVISIONED_CAPSULE_PLAN_DIGEST_DIVERGED");
  }
  if (capsule.provisionedExecution) {
    const execution = capsule.provisionedExecution;
    const provider = execution.providerBinding;
    const definition = provisionedProviderDefinitions.get(provider?.providerCapabilityId);
    const authorityRef = `capabilities/${capsule.capabilityId}/capability.authority.json`;
    const authorityEntry = entries.get(authorityRef);
    const authority = authorityEntry
      ? JSON.parse(Buffer.from(authorityEntry.entryBytesBase64, "base64").toString("utf8"))
      : null;
    if (execution.executionType !== "provisioned-platform-provider-execution.v1"
      || !definition
      || provider.bindingType !== "provisioned-platform-provider-binding.v1"
      || provider.status !== "AVAILABLE"
      || provider.requestType !== definition.requestType
      || provider.operation !== definition.operation
      || provider.implementationRef !== `package:sda-bootstrap#${provider.providerCapabilityId}`) {
      throw new Error("PROVISIONED_CAPSULE_PROVIDER_BINDING_INVALID");
    }
    if (!authority
      || authority.capabilityId !== capsule.capabilityId
      || authority.provisioningDisposition !== "PROVISIONED_EXECUTABLE"
      || authority.openSlots?.length !== 0
      || JSON.stringify(canonicalize(authority.providerBindings)) !== JSON.stringify(canonicalize([provider]))) {
      throw new Error("PROVISIONED_CAPSULE_PROVIDER_AUTHORITY_DIVERGED");
    }
  }
  return { entryCount: capsule.entries.length, runtimeBindingCount: capsule.runtimeBindings.length };
}

function materializeProvisionedRuntime(capsule, targetRoot) {
  const entries = new Map(capsule.entries.map((entry) => [entry.entryRef, entry]));
  const runtime = capsule.runtimeBindings[0];
  const bytesFor = (reference) => Buffer.from(entries.get(reference).entryBytesBase64, "base64");
  const binding = JSON.parse(bytesFor(runtime.bindingEntryRef).toString("utf8"));
  const projectedRoot = path.join(targetRoot, "capabilities", capsule.capabilityId, "projected");
  const destinations = [
    [path.join(projectedRoot, "application-binding.node.json"), bytesFor(runtime.bindingEntryRef)],
    [path.resolve(projectedRoot, binding.executionPlan), bytesFor(runtime.planEntryRef)],
    [path.resolve(projectedRoot, binding.fixtures), bytesFor(runtime.fixturesEntryRef)],
    [path.resolve(projectedRoot, binding.mechanicalSterility), bytesFor(runtime.sterilityEntryRef)],
  ];
  for (const [destination, bytes] of destinations) {
    if (!(destination + path.sep).startsWith(projectedRoot + path.sep)) {
      throw new Error(`PROVISIONED_CAPSULE_RUNTIME_ESCAPES_ROOT: '${capsule.capabilityId}'.`);
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
  }
  return path.join(projectedRoot, "application-binding.node.json");
}

function terminatedProviderExecution(capsule, providerCapabilityId, outcome) {
  return {
    disposition: "terminated",
    outcome,
    executions: [{
      executionId: `provisioned-provider:${providerCapabilityId}`,
      scenarioId: capsule.capabilityId,
      disposition: "terminated",
      outcome,
    }],
    observations: [],
  };
}

async function executeBoundProvisionedProvider(capsule, repositoryRoot, platformRoot, input) {
  const provider = capsule.provisionedExecution.providerBinding;
  const definition = provisionedProviderDefinitions.get(provider.providerCapabilityId);
  if (!definition) throw new Error(`PROVISIONED_PROVIDER_NOT_AVAILABLE: '${provider.providerCapabilityId}'.`);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("PROVISIONED_CAPABILITY_INPUT_INVALID: expected one JSON object.");
  }
  if (input.requestType === "prove-provisioned-provider-availability.v1") {
    return terminatedProviderExecution(capsule, provider.providerCapabilityId, {
      outcomeType: "provisioned-provider-availability.v1",
      capabilityId: capsule.capabilityId,
      providerCapabilityId: provider.providerCapabilityId,
      providerDisposition: "AVAILABLE",
    });
  }
  if (input.requestType !== definition.requestType) {
    throw new Error(`PROVISIONED_CAPABILITY_REQUEST_TYPE_INVALID: expected '${definition.requestType}'.`);
  }
  if (!repositoryRoot) throw new Error("PROVISIONED_CAPABILITY_REPOSITORY_ROOT_REQUIRED");
  if (typeof input.featurePath !== "string" || input.featurePath.trim() === "") {
    throw new Error("PROVISIONING_FEATURE_REQUIRED");
  }
  if (provider.providerCapabilityId === "sda-bootstrap.deliver-capability-token-provisioning-cli.v1"
    && input.command !== "provision") {
    throw new Error("PROVISIONING_CLI_COMMAND_INVALID: expected 'provision'.");
  }
  const outcome = await provisionCapability({
    repositoryRoot,
    platformRoot,
    featurePath: input.featurePath,
    input: input.executionInput ?? null,
  });
  return terminatedProviderExecution(capsule, provider.providerCapabilityId, outcome);
}

async function executeProvisionedCapsule(capsule, platformRoot, input, { repositoryRoot = null } = {}) {
  verifyProvisionedCapsule(capsule);
  if (capsule.provisionedExecution) {
    return executeBoundProvisionedProvider(capsule, repositoryRoot, platformRoot, input);
  }
  const executionRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sda-provisioned-token-"));
  try {
    const bindingPath = materializeProvisionedRuntime(capsule, executionRoot);
    const runtimeUrl = pathToFileURL(path.resolve(platformRoot, runtimeModuleRef)).href;
    const runtime = await import(runtimeUrl);
    const execute = runtime.default(pathToFileURL(bindingPath).href, "./application-binding.node.json");
    return await execute(input);
  } finally {
    fs.rmSync(executionRoot, { recursive: true, force: true });
  }
}

export async function provisionCapability({ repositoryRoot, platformRoot, featurePath, input = null }) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const resolvedFeaturePath = path.resolve(resolvedRepositoryRoot, featurePath);
  if (!pathIsWithin(resolvedRepositoryRoot, resolvedFeaturePath)) {
    throw new Error(`PROVISIONING_FEATURE_ESCAPES_REPOSITORY: '${resolvedFeaturePath}'.`);
  }
  if (!fs.existsSync(resolvedFeaturePath) || !fs.statSync(resolvedFeaturePath).isFile()) {
    throw new Error(`PROVISIONING_FEATURE_NOT_FOUND: '${resolvedFeaturePath}'.`);
  }
  const featureBytes = fs.readFileSync(resolvedFeaturePath);
  const featureRef = path.relative(resolvedRepositoryRoot, resolvedFeaturePath).replaceAll("\\", "/");
  const built = buildProvisionedCapsule(featureBytes, featureRef);
  const structuralProof = verifyProvisionedCapsule(built.capsule);
  const request = input ?? (built.providerBinding
    ? { requestType: "prove-provisioned-provider-availability.v1" }
    : { requestType: "describe-provisioned-capability.v1", payload: {} });
  const execution = await executeProvisionedCapsule(
    built.capsule,
    platformRoot,
    request,
    { repositoryRoot: resolvedRepositoryRoot },
  );
  const exactOutcomeProved = built.providerBinding
    ? execution.outcome?.providerDisposition === "AVAILABLE"
      && execution.outcome?.providerCapabilityId === built.providerBinding.providerCapabilityId
    : execution.outcome?.provisioningDisposition === built.provisioningDisposition;
  if (execution.disposition !== "terminated" || !exactOutcomeProved) {
    throw new Error(`PROVISIONED_CAPSULE_EXECUTION_FAILED: '${built.capsule.capabilityId}'.`);
  }
  const capsuleBytes = canonicalJsonBytes(built.capsule);
  const capsuleDigest = sha256(capsuleBytes);
  const digestToken = capsuleDigest.slice("sha256:".length, "sha256:".length + 16);
  const provisioningRoot = path.join(resolvedRepositoryRoot, "provisioning");
  fs.mkdirSync(provisioningRoot, { recursive: true });
  const capsuleFile = `${built.capsule.capabilityId}-${digestToken}.sfxcap`;
  const capsulePath = path.join(provisioningRoot, capsuleFile);
  fs.writeFileSync(capsulePath, capsuleBytes);
  const executionOutcomeDigest = sha256(canonicalJsonBytes(execution.outcome));
  const executionSummary = {
    disposition: execution.disposition,
    scenarioSequence: execution.executions.map((item) => item.scenarioId),
    outcome: execution.outcome,
  };
  const receipt = {
    receiptType: "provisioned-capability-placement-receipt.v1",
    operation: "TOKEN_PROVISIONING",
    capabilityId: built.capsule.capabilityId,
    capabilityVersion: built.capsule.capabilityVersion,
    sourceFeature: { ref: featureRef, digest: built.featureDigest },
    capabilityAuthorityDigest: built.authorityDigest,
    capsule: { file: capsuleFile, digest: capsuleDigest },
    proof: {
      structuralDisposition: "PASS",
      scenarioGeometryDisposition: "PASS",
      entryCount: structuralProof.entryCount,
      exactTokenExecutionDisposition: execution.disposition,
      outcomeDigest: executionOutcomeDigest,
      provisioningDisposition: built.provisioningDisposition,
    },
    managedAdmission: "NOT_PERFORMED",
    externalProvisioningRepositoryParticipated: false,
  };
  const receiptFile = `${built.capsule.capabilityId}-${digestToken}.placement.receipt.json`;
  fs.writeFileSync(path.join(provisioningRoot, receiptFile), canonicalJsonBytes(receipt));
  return {
    operation: "TOKEN_PROVISIONING",
    capabilityId: built.capsule.capabilityId,
    provisioningDisposition: built.provisioningDisposition,
    featureDigest: built.featureDigest,
    capsuleDigest,
    capsulePath: `provisioning/${capsuleFile}`,
    placementReceiptPath: `provisioning/${receiptFile}`,
    proof: receipt.proof,
    execution: executionSummary,
  };
}

export async function invokeProvisionedCapability({ repositoryRoot, platformRoot, capsulePath, input }) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const provisioningRoot = path.resolve(resolvedRepositoryRoot, "provisioning");
  const resolvedCapsulePath = path.resolve(resolvedRepositoryRoot, capsulePath);
  if (!pathIsWithin(provisioningRoot, resolvedCapsulePath) || path.extname(resolvedCapsulePath) !== ".sfxcap") {
    throw new Error(`PROVISIONED_CAPSULE_PATH_INVALID: '${resolvedCapsulePath}'.`);
  }
  if (!fs.existsSync(resolvedCapsulePath) || !fs.statSync(resolvedCapsulePath).isFile()) {
    throw new Error(`PROVISIONED_CAPSULE_NOT_FOUND: '${resolvedCapsulePath}'.`);
  }
  const capsuleBytes = fs.readFileSync(resolvedCapsulePath);
  const capsuleDigest = sha256(capsuleBytes);
  const capsule = JSON.parse(capsuleBytes.toString("utf8"));
  verifyProvisionedCapsule(capsule);
  const expectedFile = `${capsule.capabilityId}-${capsuleDigest.slice("sha256:".length, "sha256:".length + 16)}.sfxcap`;
  if (path.basename(resolvedCapsulePath) !== expectedFile) {
    throw new Error(`PROVISIONED_CAPSULE_CONTENT_ADDRESS_DIVERGED: expected '${expectedFile}'.`);
  }
  if (!capsule.provisionedExecution) {
    throw new Error(`PROVISIONED_CAPSULE_PROVIDER_REQUIRED: '${capsule.capabilityId}'.`);
  }
  const execution = await executeProvisionedCapsule(
    capsule,
    platformRoot,
    input,
    { repositoryRoot: resolvedRepositoryRoot },
  );
  return {
    operation: "PROVISIONED_CAPABILITY_INVOCATION",
    capabilityId: capsule.capabilityId,
    capsuleDigest,
    capsulePath: path.relative(resolvedRepositoryRoot, resolvedCapsulePath).replaceAll("\\", "/"),
    providerCapabilityId: capsule.provisionedExecution.providerBinding.providerCapabilityId,
    execution,
  };
}

export { buildProvisionedCapsule, executeProvisionedCapsule, verifyProvisionedCapsule };
