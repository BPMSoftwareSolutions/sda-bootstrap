import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bindValueAt, canonicalDigest, canonicalizeValue, createGovernedEffectContext, valueAt } from "./native-mechanic-primitives.mjs";
import { evaluateExpression } from "./semantic-transformation-evaluator.mjs";
import { createSchemaAdmission, createSynchronousSchemaAdmission, matchesSchema } from "./schema-contract-admission-provider.mjs";
import { observeExternalRepresentation } from "./external-observation-provider.mjs";
import { nestedExecutionTestimony, invokeGovernedSerialExecution } from "./governed-serial-execution-provider.mjs";
import { parseCanonicalCapabilityFeature, resolveCanonicalCapabilityFeature } from "./canonical-capability-feature-resolution-provider.mjs";
import { transactGovernedToolingBinding } from "./governed-tooling-binding-transaction-provider.mjs";
import { invokeGovernedToolingMigrationOperation } from "./governed-tooling-migration-operation-provider.mjs";
import { invokeGovernedFileSystemShaping } from "./governed-file-system-shaping-provider.mjs";
import { invokeGenericLlmConnector } from "./generic-llm-connector-provider.mjs";
import { bindExternalCredentialReference } from "./external-credential-reference-binding-provider.mjs";
import { observeGovernedHttpExchange } from "./governed-http-exchange-provider.mjs";
import { observeGovernedRepository } from "./governed-repository-observation-provider.mjs";
import { observeGovernedTargetExecution } from "./governed-target-execution-observation-provider.mjs";

const authorityRef = "../../../../kernel/semantic-authority/consumer/node-mechanic-registry.authority.v1.json";
const authorityUrl = new URL(authorityRef, import.meta.url);
const repositoryRootUrl = new URL("../../../../", import.meta.url);

const authority = JSON.parse(fs.readFileSync(authorityUrl, "utf8"));

function sourceDigest(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function withoutAuthorityDigest(document) {
  return Object.fromEntries(Object.entries(document).filter(([key]) => key !== "authorityDigest"));
}

function admitRegistrationAuthority(entry) {
  if (typeof entry.registrationAuthorityRef !== "string" || typeof entry.registrationAuthorityDigest !== "string") {
    throw new Error(`NODE_MECHANIC_REGISTRATION_AUTHORITY_MISSING: '${entry.platformCapabilityId}'`);
  }
  const registrationUrl = new URL(entry.registrationAuthorityRef, repositoryRootUrl);
  const registrationBytes = fs.readFileSync(registrationUrl);
  if (sourceDigest(registrationBytes) !== entry.registrationAuthorityDigest) {
    throw new Error(`NODE_MECHANIC_REGISTRATION_SOURCE_DIGEST_MISMATCH: '${entry.platformCapabilityId}'`);
  }
  const registration = JSON.parse(registrationBytes.toString("utf8"));
  if (canonicalDigest(withoutAuthorityDigest(registration)) !== registration.authorityDigest) {
    throw new Error(`NODE_MECHANIC_REGISTRATION_AUTHORITY_DIGEST_MISMATCH: '${entry.platformCapabilityId}'`);
  }
  for (const property of ["platformCapabilityId", "kind", "providerModule", "providerExport", "invocation"]) {
    if (registration[property] !== entry[property]) {
      throw new Error(`NODE_MECHANIC_REGISTRATION_MAPPING_MISMATCH: '${entry.platformCapabilityId}.${property}'`);
    }
  }
  return registration;
}

const registrationAuthorityRequiredCapabilities = new Set([
  "sda-json-authority-ingestion-port.v1",
  "sda-proof-binding-evaluation-port.v1",
  "sda-scenario-semantic-carrier-validation-port.v1",
  "sda-scenario-semantic-carrier-extraction-port.v1",
  "sda-scenario-semantic-carrier-evaluation-port.v1",
  "sda-semantic-vector-index.v1"
]);

const loadedModules = new Map();
const loadModule = (moduleName) => {
  if (!loadedModules.has(moduleName)) loadedModules.set(moduleName, import(new URL(`./${moduleName}`, import.meta.url).href));
  return loadedModules.get(moduleName);
};

function providerLocal(capabilityId) {
  return `provider_${capabilityId.replaceAll("-", "_").replaceAll(".", "_")}`;
}

function externalApplicationRoot(reference, bindingUrl) {
  if (typeof reference !== "string" || reference.length === 0) throw new Error("EXTERNAL_APPLICATION_ROOT_REQUIRED");
  const url = new URL(reference, bindingUrl);
  if (url.protocol !== "file:") throw new Error("EXTERNAL_APPLICATION_ROOT_MUST_BE_LOCAL");
  const root = path.resolve(fileURLToPath(url));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error("EXTERNAL_APPLICATION_ROOT_UNAVAILABLE");
  if (fs.lstatSync(root).isSymbolicLink()) throw new Error("EXTERNAL_APPLICATION_ROOT_SYMBOLIC_LINK_REJECTED");
  return root;
}

function externalApplicationBinding(root, reference) {
  if (typeof reference !== "string" || reference.length === 0 || reference.includes("\0") ||
      path.posix.isAbsolute(reference) || path.win32.isAbsolute(reference)) {
    throw new Error("EXTERNAL_APPLICATION_BINDING_REFERENCE_REJECTED");
  }
  const segments = reference.replaceAll("\\", "/").split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("EXTERNAL_APPLICATION_BINDING_REFERENCE_REJECTED");
  }
  let cursor = root;
  for (const segment of segments) {
    cursor = path.join(cursor, segment);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
      throw new Error("EXTERNAL_APPLICATION_BINDING_SYMBOLIC_LINK_REJECTED");
    }
  }
  const resolved = path.resolve(root, ...segments);
  const relative = path.relative(root, resolved);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("EXTERNAL_APPLICATION_BINDING_REFERENCE_REJECTED");
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error("EXTERNAL_APPLICATION_BINDING_UNAVAILABLE");
  return pathToFileURL(resolved).href;
}

function applicationAuthorityDigest(plan) {
  return plan.executionEmbodimentPlanType === "consumer-execution-embodiment-plan.v3"
    ? plan.canonicalGraph.authority.authorityDigest
    : plan.source.capabilityAuthorityDigest;
}

function fixtureExecutionFindings(application, fixture, result, conformance) {
  const findings = [];
  if (result.disposition !== fixture.expected.disposition) findings.push("FIXTURE_DISPOSITION_DIVERGED");
  const observedScenarios = result.executions.map((item) => item.scenarioId);
  if (application.plan.executionEmbodimentPlanType === "consumer-execution-embodiment-plan.v3" && fixture.expected.scenarioSequence.length === 1) {
    if (observedScenarios[0] !== fixture.expected.scenarioSequence[0]) findings.push("FIXTURE_SCENARIO_SEQUENCE_DIVERGED");
    if (!result.graphExecution?.edgeTestimony?.some((item) => item.groupId)) findings.push("FIXTURE_GROUPED_TOPOLOGY_UNOBSERVED");
  } else if (canonicalDigest(observedScenarios) !== canonicalDigest(fixture.expected.scenarioSequence)) {
    findings.push("FIXTURE_SCENARIO_SEQUENCE_DIVERGED");
  }
  for (const expectation of fixture.expected.outcomeAssertions ?? []) {
    const actual = valueAt(result.outcome, expectation.path);
    const matches = expectation.operator === "equals"
      ? canonicalDigest(actual) === canonicalDigest(expectation.value)
      : expectation.operator === "contains"
        ? actual?.includes?.(expectation.value) === true
        : expectation.operator === "not-contains"
          ? actual?.includes?.(expectation.value) === false
          : false;
    if (!matches) findings.push(`FIXTURE_OUTCOME_ASSERTION_DIVERGED:${expectation.conditionId}`);
  }
  if (conformance.admissionDisposition !== "ADMITTED") findings.push("FIXTURE_CONFORMANCE_REJECTED");
  if (conformance.platformMechanics?.disposition !== "RESOLVED" ||
      !conformance.platformMechanics?.resolutions?.every((item) => item.status === "AVAILABLE")) {
    findings.push("FIXTURE_PLATFORM_MECHANICS_UNRESOLVED");
  }
  return findings;
}

const directProviderPromises = new Map();
for (const list of [authority.contractAdmissions, authority.eventPorts, authority.stateProjections]) {
  for (const entry of list) {
    if (entry.kind === "direct") {
      if (registrationAuthorityRequiredCapabilities.has(entry.platformCapabilityId)) admitRegistrationAuthority(entry);
      directProviderPromises.set(providerLocal(entry.platformCapabilityId), loadModule(entry.providerModule).then((module) => module[entry.providerExport]));
    }
    if (entry.defaultResponseProvider) {
      directProviderPromises.set(`default_${entry.platformCapabilityId.replaceAll("-", "_").replaceAll(".", "_")}`,
        loadModule(entry.defaultResponseProvider.providerModule).then((module) => module[entry.defaultResponseProvider.providerExport]));
    }
  }
}
const evidenceEvaluatorPromises = new Map();
for (const entry of authority.evidenceEvaluators) {
  evidenceEvaluatorPromises.set(entry.evaluatorId, loadModule(entry.providerModule).then((module) => module[entry.providerExport]));
}
await Promise.all([...directProviderPromises.values(), ...evidenceEvaluatorPromises.values()]);

const directProviders = new Map();
for (const [key, promise] of directProviderPromises) directProviders.set(key, await promise);
const resolvedEvidenceEvaluators = new Map();
for (const [key, promise] of evidenceEvaluatorPromises) resolvedEvidenceEvaluators.set(key, await promise);

export function createNodeMechanicRegistry({ bindingUrl, invokeBinding, genericModelConnector, testArtifactContext, nativeEffectContext }) {
  const effectContext = nativeEffectContext ?? createGovernedEffectContext();
  const contractAdmissions = new Map();
  for (const entry of authority.contractAdmissions) {
    if (entry.kind === "composed" && entry.composition === "identity-admit") {
      contractAdmissions.set(entry.platformCapabilityId, () => ({ admit: async (_contract, value) => value }));
      continue;
    }
    const provider = directProviders.get(providerLocal(entry.platformCapabilityId));
    contractAdmissions.set(entry.platformCapabilityId, (binding) => provider(binding.configuration.contractAuthorities));
  }
  const eventPorts = new Map();
  for (const entry of authority.eventPorts) {
    const id = entry.platformCapabilityId;
    if (entry.kind === "composed") {
      if (entry.composition === "declarative-value") {
        eventPorts.set(id, async (binding) => structuredClone(binding.configuration.outcome));
        continue;
      }
      if (entry.composition === "external-observation") {
        eventPorts.set(id, async (binding, input, context) => {
          const reference = valueAt(input, binding.configuration.referencePath);
          if (!reference || typeof reference.url !== "string" || reference.url.length === 0) throw new Error("EXTERNAL_REFERENCE_MISSING");
          const observed = await directProviders.get(providerLocal(id))(reference.url, {
            method: binding.configuration.method,
            allowedHosts: binding.configuration.allowedHosts
          });
          const result = structuredClone(input);
          const target = valueAt(result, binding.configuration.targetPath);
          if (!target || typeof target !== "object") throw new Error("EXTERNAL_REPRESENTATION_TARGET_MISSING");
          Object.assign(target, observed, { rootExecutionId: context.rootExecutionId });
          return result;
        });
        continue;
      }
      if (entry.composition === "invoke-external-application-batch-v1") {
        eventPorts.set(id, async (binding, carrier, context) => {
          const configuration = binding.configuration;
          if (configuration.invocationCondition !== undefined) {
            const condition = configuration.invocationCondition;
            if (condition === null || typeof condition !== "object" || Array.isArray(condition) ||
                typeof condition.path !== "string" || condition.path.length === 0 ||
                !Object.hasOwn(condition, "equals") || condition.whenFalse !== "preserve-carrier") {
              throw new Error("EXTERNAL_APPLICATION_EXECUTION_INVOCATION_CONDITION_INVALID");
            }
            if (valueAt(carrier, condition.path) !== condition.equals) return structuredClone(carrier);
          }
          if (configuration.lineageMode !== "retain-nested-execution" ||
              typeof configuration.rootPath !== "string" ||
              typeof configuration.operationsPath !== "string" ||
              typeof configuration.resultPath !== "string") {
            throw new Error("EXTERNAL_APPLICATION_EXECUTION_CONFIGURATION_INVALID");
          }
          const root = externalApplicationRoot(valueAt(carrier, configuration.rootPath), bindingUrl);
          const operations = valueAt(carrier, configuration.operationsPath);
          if (!Array.isArray(operations) || operations.length === 0) throw new Error("EXTERNAL_APPLICATION_EXECUTION_OPERATIONS_REQUIRED");
          const operationIds = operations.map((operation) => operation?.operationId);
          if (operationIds.some((operationId) => typeof operationId !== "string" || operationId.length === 0) ||
              new Set(operationIds).size !== operationIds.length) {
            throw new Error("EXTERNAL_APPLICATION_EXECUTION_UNIQUE_OPERATION_ID_REQUIRED");
          }
          const observations = [];
          for (const operation of operations) {
            if (!["invoke", "prove-fixtures"].includes(operation.kind)) throw new Error("EXTERNAL_APPLICATION_EXECUTION_KIND_UNSUPPORTED");
            const bindingReference = externalApplicationBinding(root, operation.bindingRef);
            const nestedRootExecutionId = `${context.rootExecutionId}.${operation.operationId}`;
            const invocation = await invokeBinding(bindingReference, operation.request ?? {}, { rootExecutionId: nestedRootExecutionId }, true);
            const observedBindingDigest = canonicalDigest(invocation.application.binding);
            const observedAuthorityDigest = applicationAuthorityDigest(invocation.application.plan);
            if (observedBindingDigest !== operation.bindingDigest || observedAuthorityDigest !== operation.capabilityAuthorityDigest) {
              throw new Error("EXTERNAL_APPLICATION_EXECUTION_LINEAGE_MISMATCH");
            }
            if (operation.kind === "invoke") {
              const result = await invocation.execute();
              observations.push({
                operationId: operation.operationId,
                kind: operation.kind,
                capabilityId: invocation.application.plan.capabilityId,
                bindingDigest: observedBindingDigest,
                capabilityAuthorityDigest: observedAuthorityDigest,
                disposition: result.disposition,
                outcome: result.outcome,
                findingCodes: result.disposition === "terminated" ? [] : [result.errorCode ?? "PROJECTED_APPLICATION_EXECUTION_FAILED"]
              });
              continue;
            }
            const declaredFixtureIds = invocation.application.fixtures.fixtures.map((fixture) => fixture.fixtureId);
            const fixtureIds = operation.fixtureIds ?? declaredFixtureIds;
            if (!Array.isArray(fixtureIds) || fixtureIds.some((fixtureId) => !declaredFixtureIds.includes(fixtureId)) || new Set(fixtureIds).size !== fixtureIds.length) {
              throw new Error("EXTERNAL_APPLICATION_FIXTURE_SCOPE_REJECTED");
            }
            const applicationGatePassed = observedBindingDigest === operation.bindingDigest &&
              observedAuthorityDigest === operation.capabilityAuthorityDigest;
            const fixtureObservations = [];
            for (const fixtureId of fixtureIds) {
              const fixtureExecution = await invocation.executeFixture(fixtureId);
              const findings = fixtureExecutionFindings(
                invocation.application,
                fixtureExecution.fixture,
                fixtureExecution.result,
                fixtureExecution.conformance
              );
              fixtureObservations.push({
                fixtureId,
                disposition: findings.length === 0 ? "PASSED" : "FAILED",
                outcomeDigest: fixtureExecution.result.outcome === null ? null : canonicalDigest(fixtureExecution.result.outcome),
                findingCodes: findings
              });
            }
            const passed = fixtureObservations.filter((observation) => observation.disposition === "PASSED").length;
            observations.push({
              operationId: operation.operationId,
              kind: operation.kind,
              capabilityId: invocation.application.plan.capabilityId,
              bindingDigest: observedBindingDigest,
              capabilityAuthorityDigest: observedAuthorityDigest,
              declaredFixtureCount: declaredFixtureIds.length,
              selectedFixtureCount: fixtureIds.length,
              tests: fixtureIds.length + 1,
              passed: passed + (applicationGatePassed ? 1 : 0),
              failed: fixtureIds.length - passed + (applicationGatePassed ? 0 : 1),
              fixtureObservations,
              disposition: passed === fixtureIds.length && applicationGatePassed ? "PROVED" : "HELD"
            });
          }
          const outcome = {
            carrierType: "governed-external-application-execution-observation.v1",
            bounded: true,
            observations,
            effectLineage: [...(carrier.effectLineage ?? []), context.rootExecutionId]
          };
          return bindValueAt(carrier, configuration.resultPath, outcome);
        });
        continue;
      }
      if (entry.composition === "invoke-binding-v1") {
        eventPorts.set(id, async (binding, input, context) => {
          const bindingRef = binding.configuration.bindingRef;
          if (typeof bindingRef !== "string" || bindingRef.length === 0) throw new Error("PROJECTED_CAPABILITY_BINDING_MISSING");
          const { result } = await invokeBinding(bindingRef, input, { rootExecutionId: `${context.rootExecutionId}.${binding.bindingId}` });
          if (!['terminated', 'completed'].includes(result.disposition)) {
            throw new Error(`PROJECTED_CAPABILITY_INVOCATION_FAILED: ${result.errorCode ?? result.disposition}`);
          }
          return result.outcome;
        });
        continue;
      }
      if (entry.composition === "invoke-binding-v2") {
        eventPorts.set(id, async (binding, carrier, context) => {
          const configuration = binding.configuration;
          const required = ["bindingRef", "bindingDigest", "capabilityAuthorityDigest", "requestPath", "lineageMode"];
          if (configuration.resultMode !== "replace-carrier") required.push("resultPath");
          const missing = required.filter((property) => typeof configuration[property] !== "string" || configuration[property].length === 0);
          if (missing.length > 0) throw new Error(`PROJECTED_CAPABILITY_V2_CONFIGURATION_MISSING: '${missing.join(",")}'`);
          if (configuration.lineageMode !== "retain-nested-execution") {
            throw new Error(`PROJECTED_CAPABILITY_LINEAGE_MODE_UNSUPPORTED: '${configuration.lineageMode}'`);
          }
          if (carrier === null || typeof carrier !== "object" || Array.isArray(carrier)) throw new Error("PROJECTED_CAPABILITY_PARENT_CARRIER_REQUIRED");
          if (configuration.invocationCondition !== undefined) {
            const condition = configuration.invocationCondition;
            if (condition === null || typeof condition !== "object" || Array.isArray(condition) ||
                typeof condition.path !== "string" || condition.path.length === 0 ||
                !Object.hasOwn(condition, "equals") || condition.whenFalse !== "preserve-carrier") {
              throw new Error("PROJECTED_CAPABILITY_INVOCATION_CONDITION_INVALID");
            }
            if (valueAt(carrier, condition.path) !== condition.equals) return structuredClone(carrier);
          }
          const request = valueAt(carrier, configuration.requestPath);
          if (request === undefined) throw new Error(`PROJECTED_CAPABILITY_REQUEST_PATH_MISSING: '${configuration.requestPath}'`);
          const invocation = await invokeBinding(
            configuration.bindingRef,
            request,
            { rootExecutionId: `${context.rootExecutionId}.${binding.bindingId}` },
            true
          );
          const observedBindingDigest = canonicalDigest(invocation.application.binding);
          if (observedBindingDigest !== configuration.bindingDigest) {
            throw new Error(`PROJECTED_CAPABILITY_BINDING_DIGEST_MISMATCH: expected '${configuration.bindingDigest}' observed '${observedBindingDigest}'`);
          }
          const observedAuthorityDigest = invocation.application.plan.executionEmbodimentPlanType === "consumer-execution-embodiment-plan.v3"
            ? invocation.application.plan.canonicalGraph.authority.authorityDigest
            : invocation.application.plan.source.capabilityAuthorityDigest;
          if (observedAuthorityDigest !== configuration.capabilityAuthorityDigest) {
            throw new Error(`PROJECTED_CAPABILITY_AUTHORITY_DIGEST_MISMATCH: expected '${configuration.capabilityAuthorityDigest}' observed '${observedAuthorityDigest}'`);
          }
          const result = await invocation.execute();
          context.nestedExecutions.push(nestedExecutionTestimony(binding, invocation.application, result));
          if (!["terminated", "completed"].includes(result.disposition)) {
            throw new Error(`PROJECTED_CAPABILITY_INVOCATION_FAILED: ${result.errorCode ?? result.disposition}`);
          }
          if (configuration.resultMode === "replace-carrier") return result.outcome;
          if (configuration.resultMode !== undefined && configuration.resultMode !== "bind-outcome") {
            throw new Error(`PROJECTED_CAPABILITY_RESULT_MODE_UNSUPPORTED: '${configuration.resultMode}'`);
          }
          return bindValueAt(carrier, configuration.resultPath, result.outcome);
        });
        continue;
      }
      throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: unknown registry composition '${entry.composition}'.`);
    }
    const provider = directProviders.get(providerLocal(id));
    if (entry.invocation === "transformation") {
      eventPorts.set(id, async (binding, input, context) => provider(binding.configuration.expression, {
        input, root: context.rootInput
      }));
      continue;
    }
    if (entry.invocation === "llm") {
      const defaultResponse = directProviders.get(`default_${id.replaceAll("-", "_").replaceAll(".", "_")}`);
      eventPorts.set(id, async (binding, input, context) =>
        provider(binding.configuration, input, context, bindingUrl, genericModelConnector ?? defaultResponse));
      continue;
    }
    if (entry.invocation === "url-context") {
      eventPorts.set(id, async (binding, input, context) =>
        provider(binding.configuration, input, bindingUrl));
      continue;
    }
    if (entry.invocation === "serial") {
      eventPorts.set(id, async (binding, input, context) =>
        provider(binding.configuration, input, context, bindingUrl, invokeBinding));
      continue;
    }
    if (entry.invocation === "effects") {
      eventPorts.set(id, async (binding, input, context) => {
        const configuration = binding.configuration;
        if (configuration.invocationCondition !== undefined) {
          const condition = configuration.invocationCondition;
          if (!condition || typeof condition.path !== "string" ||
              !Object.hasOwn(condition, "equals") || condition.whenFalse !== "preserve-carrier") {
            throw new Error("DIRECT_PROVIDER_INVOCATION_CONDITION_INVALID");
          }
          if (valueAt(input, condition.path) !== condition.equals) return structuredClone(input);
        }
        if (configuration.requestPath === undefined && configuration.resultPath === undefined) {
          return provider(configuration, input, context, effectContext);
        }
        if (typeof configuration.requestPath !== "string" || typeof configuration.resultPath !== "string") {
          throw new Error("DIRECT_PROVIDER_CARRIER_BINDING_INVALID");
        }
        const request = valueAt(input, configuration.requestPath);
        if (request === undefined) throw new Error(`DIRECT_PROVIDER_REQUEST_PATH_MISSING: '${configuration.requestPath}'`);
        const outcome = await provider(configuration, request, context, effectContext);
        return bindValueAt(input, configuration.resultPath, outcome);
      });
      continue;
    }
    eventPorts.set(id, async (binding, input, context) => {
      const configuration = binding.configuration;
      if (configuration.invocationCondition !== undefined) {
        const condition = configuration.invocationCondition;
        if (!condition || typeof condition.path !== "string" ||
            !Object.hasOwn(condition, "equals") || condition.whenFalse !== "preserve-carrier") {
          throw new Error("DIRECT_PROVIDER_INVOCATION_CONDITION_INVALID");
        }
        if (valueAt(input, condition.path) !== condition.equals) return structuredClone(input);
      }
      if (configuration.requestPath === undefined && configuration.resultPath === undefined) {
        return provider(configuration, input, context, bindingUrl);
      }
      if (typeof configuration.requestPath !== "string" || typeof configuration.resultPath !== "string") {
        throw new Error("DIRECT_PROVIDER_CARRIER_BINDING_INVALID");
      }
      const request = valueAt(input, configuration.requestPath);
      if (request === undefined) throw new Error(`DIRECT_PROVIDER_REQUEST_PATH_MISSING: '${configuration.requestPath}'`);
      const outcome = await provider(configuration, request, context, bindingUrl);
      return bindValueAt(input, configuration.resultPath, outcome);
    });
  }
  const stateProjections = new Map();
  for (const entry of authority.stateProjections) {
    if (entry.kind === "composed" && entry.composition === "declarative-output") {
      stateProjections.set(entry.platformCapabilityId, async (binding) => structuredClone(binding.configuration.output));
      continue;
    }
    const provider = directProviders.get(providerLocal(entry.platformCapabilityId));
    if (entry.invocation === "transformation") {
      stateProjections.set(entry.platformCapabilityId, async (binding, input, context) => provider(binding.configuration.expression, {
        input, root: context.rootInput
      }));
      continue;
    }
    stateProjections.set(entry.platformCapabilityId, async (binding, input, context) =>
      provider(binding.configuration, input, context, bindingUrl));
  }
  const evidenceEvaluators = new Map();
  for (const entry of authority.evidenceEvaluators) {
    evidenceEvaluators.set(entry.evaluatorId, resolvedEvidenceEvaluators.get(entry.evaluatorId));
  }
  return Object.freeze({ contractAdmissions, eventPorts, stateProjections, evidenceEvaluators });
}

export { valueAt, canonicalizeValue, canonicalDigest, createGovernedEffectContext, matchesSchema, observeExternalRepresentation, evaluateExpression, createSchemaAdmission, createSynchronousSchemaAdmission, parseCanonicalCapabilityFeature, resolveCanonicalCapabilityFeature, transactGovernedToolingBinding, invokeGovernedToolingMigrationOperation, invokeGovernedFileSystemShaping, invokeGenericLlmConnector, bindExternalCredentialReference, observeGovernedHttpExchange, observeGovernedRepository, observeGovernedTargetExecution, invokeGovernedSerialExecution };
