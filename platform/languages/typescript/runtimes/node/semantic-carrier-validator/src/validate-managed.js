import { readFileSync } from "node:fs";

import { Ajv2020 } from "ajv/dist/2020.js";

import { parseCarrierSource } from "./parse-carrier.js";
import { canonicalJson, normalizeSourceId } from "./stable.js";
import { validateCarrierSource } from "./validate.js";

const digestPattern = "^sha256:[0-9a-f]{64}$";
const identityPattern = "^[a-z0-9]+(-[a-z0-9]+)*(\\.v[0-9]+)?$";
const authorityRefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["authorityId", "digest"],
  properties: {
    authorityId: { type: "string", pattern: identityPattern },
    digest: { type: "string", pattern: digestPattern },
  },
};

const baseSchema = JSON.parse(readFileSync(new URL("../schemas/semantic-carrier.schema.json", import.meta.url), "utf8"));
const managedSchema = structuredClone(baseSchema);
managedSchema.$id = "https://semantic-carrier.local/schemas/scenario-semantic-carrier.v3.schema.json";
managedSchema.required.push("management");
managedSchema.properties.schemaVersion.const = "scenario-semantic-carrier.v3";
managedSchema.properties.management = {
  type: "object",
  additionalProperties: false,
  required: [
    "profile", "workspaceProfile", "featureDescription", "userStory", "experience",
    "projectionTargets", "interface", "requiredPlatformObligations", "contractSchemas",
    "transformations", "eventBindings", "routeBindings", "routeGroups", "fixtures",
    "precedents", "realizations", "authorities",
  ],
  properties: {
    profile: { const: "sidefx-managed-capability.v1" },
    workspaceProfile: { const: "agentic-harness-local.v1" },
    featureDescription: { type: "string", minLength: 1 },
    userStory: {
      type: "object",
      additionalProperties: false,
      required: ["actor", "intent", "outcome"],
      properties: {
        actor: { type: "string", minLength: 1 },
        intent: { type: "string", minLength: 1 },
        outcome: { type: "string", minLength: 1 },
      },
    },
    experience: {
      type: "object",
      additionalProperties: false,
      required: ["experienceId", "actor", "promise", "observableConditions"],
      properties: {
        experienceId: { type: "string", pattern: identityPattern },
        actor: { type: "string", minLength: 1 },
        promise: { type: "string", minLength: 1 },
        observableConditions: {
          type: "array",
          minItems: 1,
          uniqueItems: true,
          items: { type: "string", pattern: identityPattern },
        },
      },
    },
    projectionTargets: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: { type: "string", enum: ["node", "csharp", "python"] },
    },
    interface: {
      type: "object",
      additionalProperties: false,
      required: ["interfaceId", "kind", "platformCapabilityId"],
      properties: {
        interfaceId: { type: "string", pattern: identityPattern },
        kind: { const: "cli" },
        platformCapabilityId: { type: "string", pattern: identityPattern },
      },
    },
    requiredPlatformObligations: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: { type: "string", pattern: identityPattern },
    },
    contractSchemas: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["contractRef", "fileName", "schema"],
        properties: {
          contractRef: { type: "string", pattern: identityPattern },
          fileName: { type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*\\.schema\\.json$" },
          schema: { type: "object", minProperties: 1, additionalProperties: true },
        },
      },
    },
    transformations: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "expression"],
        properties: {
          id: { type: "string", pattern: identityPattern },
          expression: { type: "object", minProperties: 1, additionalProperties: true },
        },
      },
    },
    eventBindings: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["eventRef", "authorityId", "portId", "platformCapabilityId", "transformationRef"],
        properties: {
          eventRef: { type: "string", pattern: identityPattern },
          authorityId: { type: "string", pattern: identityPattern },
          portId: { type: "string", pattern: identityPattern },
          platformCapabilityId: { type: "string", pattern: identityPattern },
          transformationRef: { type: "string", pattern: identityPattern },
        },
      },
    },
    routeBindings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["routeRef", "bindingAuthorityId", "semanticProgress"],
        properties: {
          routeRef: { type: "string", pattern: identityPattern },
          bindingAuthorityId: { type: "string", pattern: identityPattern },
          semanticProgress: { enum: ["preserving", "narrowing", "expanding", "converging", "terminating"] },
        },
      },
    },
    routeGroups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["scenarioRef", "groupId", "policy", "exhaustive", "exclusive", "defaultRouteRef"],
        properties: {
          scenarioRef: { type: "string", pattern: identityPattern },
          groupId: { type: "string", pattern: identityPattern },
          policy: { enum: ["exactly-one", "first-admitted", "first-match", "priority"] },
          exhaustive: { type: "boolean" },
          exclusive: { type: "boolean" },
          defaultRouteRef: { anyOf: [{ type: "string", pattern: identityPattern }, { type: "null" }] },
        },
      },
    },
    fixtures: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fixtureId", "input", "expected"],
        properties: {
          fixtureId: { type: "string", pattern: identityPattern },
          input: { type: "object", additionalProperties: true },
          expected: {
            type: "object",
            additionalProperties: false,
            required: ["disposition", "terminalScenarioId", "scenarioSequence", "outcomeAssertions"],
            properties: {
              disposition: { const: "terminated" },
              terminalScenarioId: { type: "string", pattern: identityPattern },
              scenarioSequence: {
                type: "array",
                minItems: 1,
                items: { type: "string", pattern: identityPattern },
              },
              outcomeAssertions: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["conditionId", "path", "operator", "value"],
                  properties: {
                    conditionId: { type: "string", pattern: identityPattern },
                    path: { type: "string", minLength: 1 },
                    operator: { const: "equals" },
                    value: {},
                  },
                },
              },
            },
          },
        },
      },
    },
    precedents: { type: "array", minItems: 1, items: authorityRefSchema },
    realizations: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "obligationId", "finalPath", "semantics", "source", "authority", "sourcePath",
          "derivation", "targetSupport", "effectEvidence", "falsification",
        ],
        properties: {
          obligationId: { type: "string", pattern: identityPattern },
          finalPath: { type: "string", minLength: 1 },
          semantics: {
            type: "object",
            additionalProperties: false,
            required: ["type", "optionality", "cardinality", "encoding", "unit"],
            properties: Object.fromEntries(
              ["type", "optionality", "cardinality", "encoding", "unit"].map((key) => [key, { type: "string", minLength: 1 }]),
            ),
          },
          source: { enum: ["INPUT", "PROVIDER", "DEPENDENCY", "CONSTANT", "DERIVATION"] },
          authority: authorityRefSchema,
          sourcePath: { type: "string", minLength: 1 },
          derivation: { type: "array", items: { type: "string", minLength: 1 } },
          targetSupport: { type: "array", minItems: 1, items: authorityRefSchema },
          effectEvidence: { type: "string", minLength: 1 },
          falsification: { type: "array", minItems: 1, items: {} },
        },
      },
    },
    authorities: {
      type: "object",
      additionalProperties: false,
      required: [
        "architecture", "blueprintBinding", "observability", "structuralMapping",
        "serviceLevel", "crossApply", "asciiProjection", "mermaidProjection",
      ],
      properties: Object.fromEntries(
        [
          "architecture", "blueprintBinding", "observability", "structuralMapping",
          "serviceLevel", "crossApply", "asciiProjection", "mermaidProjection",
        ].map((key) => [key, authorityRefSchema]),
      ),
    },
  },
};

export const managedGrammarSchema = managedSchema;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateManagedSchema = ajv.compile(managedSchema);

function schemaFinding(error) {
  const missing = error.keyword === "required" && typeof error.params.missingProperty === "string"
    ? `/${error.params.missingProperty}`
    : "";
  return {
    code: `SCHEMA_${error.keyword.toUpperCase()}`,
    path: `${error.instancePath}${missing}` || "/",
    message: error.message ?? "Schema validation failed.",
  };
}

function baseCarrier(carrier) {
  return {
    schemaVersion: "scenario-semantic-carrier.v2",
    capability: carrier.capability,
    feature: carrier.feature,
    contracts: carrier.contracts,
    scenarios: carrier.scenarios,
  };
}

function duplicate(values, code, path) {
  return values.length === new Set(values).size ? [] : [{ code, path, message: "Every managed identity must be unique." }];
}

function localFolderDependencyFindings(value, path = "/management") {
  if (typeof value === "string") {
    const localReference = /(?:^|[\s"'=])(?:[A-Za-z]:[\\/]|file:\/\/|\\\\|\/(?:Users|home|tmp|var\/tmp|mnt|opt)\/)/u;
    return localReference.test(value)
      ? [{
          code: "LOCAL_FOLDER_DEPENDENCY_NOT_ADMITTED",
          path,
          message: "Managed capability authority may not depend on an absolute local folder or file URI.",
        }]
      : [];
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => localFolderDependencyFindings(item, `${path}/${index}`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      localFolderDependencyFindings(item, `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`));
  }
  return [];
}

function validateManagement(carrier) {
  const findings = [];
  const management = carrier.management;
  const contractIds = new Set(carrier.contracts.map(({ id }) => id));
  const eventIds = new Set(carrier.scenarios.map(({ event }) => event.id));
  const scenarioIds = new Set(carrier.scenarios.map(({ id }) => id));
  const routes = carrier.scenarios.flatMap(({ routes: scenarioRoutes }) => scenarioRoutes);
  const routeIds = new Set(routes.map(({ id }) => id));
  const terminalScenarioIds = new Set(carrier.scenarios.filter(({ outcome }) => outcome.terminal).map(({ id }) => id));
  const transformationIds = new Set(management.transformations.map(({ id }) => id));

  findings.push(
    ...localFolderDependencyFindings(management),
    ...duplicate(management.contractSchemas.map(({ contractRef }) => contractRef), "DUPLICATE_MANAGED_CONTRACT_SCHEMA", "/management/contractSchemas"),
    ...duplicate(management.contractSchemas.map(({ fileName }) => fileName), "DUPLICATE_MANAGED_CONTRACT_FILE", "/management/contractSchemas"),
    ...duplicate(management.transformations.map(({ id }) => id), "DUPLICATE_MANAGED_TRANSFORMATION", "/management/transformations"),
    ...duplicate(management.eventBindings.map(({ eventRef }) => eventRef), "DUPLICATE_MANAGED_EVENT_BINDING", "/management/eventBindings"),
    ...duplicate(management.routeBindings.map(({ routeRef }) => routeRef), "DUPLICATE_MANAGED_ROUTE_BINDING", "/management/routeBindings"),
    ...duplicate(management.routeGroups.map(({ scenarioRef }) => scenarioRef), "DUPLICATE_MANAGED_ROUTE_GROUP", "/management/routeGroups"),
    ...duplicate(management.routeGroups.map(({ groupId }) => groupId), "DUPLICATE_MANAGED_ROUTE_GROUP_ID", "/management/routeGroups"),
    ...duplicate(management.fixtures.map(({ fixtureId }) => fixtureId), "DUPLICATE_MANAGED_FIXTURE", "/management/fixtures"),
    ...duplicate(management.realizations.map(({ obligationId }) => obligationId), "DUPLICATE_MANAGED_REALIZATION", "/management/realizations"),
    ...duplicate(management.realizations.map(({ finalPath }) => finalPath), "DUPLICATE_MANAGED_FINAL_PATH", "/management/realizations"),
  );
  const schemaIds = new Set(management.contractSchemas.map(({ contractRef }) => contractRef));
  for (const id of contractIds) if (!schemaIds.has(id)) findings.push({ code: "MANAGED_CONTRACT_SCHEMA_MISSING", path: "/management/contractSchemas", message: `Contract '${id}' has no exact target schema.` });
  for (const id of schemaIds) if (!contractIds.has(id)) findings.push({ code: "MANAGED_CONTRACT_SCHEMA_UNDECLARED", path: "/management/contractSchemas", message: `Managed schema '${id}' has no carrier contract.` });
  const boundEvents = new Set(management.eventBindings.map(({ eventRef }) => eventRef));
  for (const id of eventIds) if (!boundEvents.has(id)) findings.push({ code: "MANAGED_EVENT_BINDING_MISSING", path: "/management/eventBindings", message: `Event '${id}' has no deterministic realization binding.` });
  for (const binding of management.eventBindings) {
    if (!eventIds.has(binding.eventRef)) findings.push({ code: "MANAGED_EVENT_REFERENCE_UNRESOLVED", path: "/management/eventBindings", message: `Event '${binding.eventRef}' does not resolve.` });
    if (!transformationIds.has(binding.transformationRef)) findings.push({ code: "MANAGED_TRANSFORMATION_REFERENCE_UNRESOLVED", path: "/management/eventBindings", message: `Transformation '${binding.transformationRef}' does not resolve.` });
  }
  const boundRoutes = new Set(management.routeBindings.map(({ routeRef }) => routeRef));
  for (const routeId of routeIds) if (!boundRoutes.has(routeId)) findings.push({ code: "MANAGED_ROUTE_BINDING_MISSING", path: "/management/routeBindings", message: `Route '${routeId}' has no semantic-progress and binding authority.` });
  for (const routeId of boundRoutes) if (!routeIds.has(routeId)) findings.push({ code: "MANAGED_ROUTE_REFERENCE_UNRESOLVED", path: "/management/routeBindings", message: `Route '${routeId}' does not resolve.` });
  const groupsByScenario = new Map(management.routeGroups.map((group) => [group.scenarioRef, group]));
  for (const scenario of carrier.scenarios) {
    const conditional = scenario.routes.length > 0 && scenario.routes.every(({ when }) => when.kind !== "always");
    const group = groupsByScenario.get(scenario.id);
    if (conditional && !group) findings.push({ code: "MANAGED_ROUTE_GROUP_MISSING", path: "/management/routeGroups", message: `Conditional route family '${scenario.id}' has no exact selection policy.` });
    if (!conditional && group) findings.push({ code: "MANAGED_ROUTE_GROUP_NOT_ADMITTED", path: "/management/routeGroups", message: `Scenario '${scenario.id}' does not declare a conditional route family.` });
    if (group && group.defaultRouteRef !== null && !scenario.routes.some(({ id }) => id === group.defaultRouteRef)) findings.push({ code: "MANAGED_ROUTE_GROUP_DEFAULT_UNRESOLVED", path: "/management/routeGroups", message: `Default route '${group.defaultRouteRef}' is outside scenario '${scenario.id}'.` });
  }
  for (const group of management.routeGroups) if (!scenarioIds.has(group.scenarioRef)) findings.push({ code: "MANAGED_ROUTE_GROUP_SCENARIO_UNRESOLVED", path: "/management/routeGroups", message: `Route group scenario '${group.scenarioRef}' does not resolve.` });
  for (const fixture of management.fixtures) {
    if (!terminalScenarioIds.has(fixture.expected.terminalScenarioId)) findings.push({ code: "MANAGED_FIXTURE_TERMINAL_UNRESOLVED", path: "/management/fixtures", message: `Terminal scenario '${fixture.expected.terminalScenarioId}' does not resolve.` });
    for (const scenarioId of fixture.expected.scenarioSequence) if (!scenarioIds.has(scenarioId)) findings.push({ code: "MANAGED_FIXTURE_SCENARIO_UNRESOLVED", path: "/management/fixtures", message: `Fixture scenario '${scenarioId}' does not resolve.` });
  }
  const obligations = [...management.experience.observableConditions].sort();
  const realized = management.realizations.map(({ obligationId }) => obligationId).sort();
  if (canonicalJson(obligations) !== canonicalJson(realized)) {
    findings.push({ code: "MANAGED_REALIZATION_COVERAGE_DIVERGED", path: "/management/realizations", message: "Every promised observable condition must have exactly one realization row." });
  }
  return findings;
}

export function validateManagedCarrierSource(source, sourceId) {
  const normalizedManagedSource = source
    .replace(
      /^import \{ defineManagedCapability \} from "\.\.\/src\/managed-carrier\.js";$/m,
      'import { defineCapability } from "../src/index.js";',
    )
    .replace(/^export default defineManagedCapability\(/m, "export default defineCapability(");
  const normalizedSourceId = normalizeSourceId(sourceId);
  const parsed = parseCarrierSource(normalizedManagedSource, normalizedSourceId);
  if (parsed.value === null || parsed.findings.length > 0) return { carrier: null, findings: parsed.findings };
  if (!validateManagedSchema(parsed.value)) {
    return { carrier: null, findings: (validateManagedSchema.errors ?? []).map(schemaFinding) };
  }
  const carrier = parsed.value;
  const baseSource = `import { defineCapability } from "../src/index.js";\n\nexport default defineCapability(${canonicalJson(baseCarrier(carrier))});\n`;
  const baseValidation = validateCarrierSource(baseSource, normalizedSourceId);
  const findings = [...baseValidation.findings, ...validateManagement(carrier)]
    .sort((left, right) => `${left.path}|${left.code}`.localeCompare(`${right.path}|${right.code}`));
  return findings.length === 0 ? { carrier, findings: [] } : { carrier: null, findings };
}
