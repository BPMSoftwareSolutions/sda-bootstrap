import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parseCarrierSource } from "./parse-carrier.js";
import { canonicalJson, sha256 } from "./stable.js";
const schemaPath = fileURLToPath(new URL("../schemas/semantic-carrier.schema.json", import.meta.url));
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile(schema);
const canonicalBlueprintSchema = JSON.parse(readFileSync(fileURLToPath(new URL("../schemas/canonical-circuit-blueprint.schema.json", import.meta.url)), "utf8"));
const canonicalBlueprintSchemaAuthority = JSON.parse(readFileSync(fileURLToPath(new URL("../schemas/canonical-circuit-blueprint.schema.authority.json", import.meta.url)), "utf8"));
const vendoredBlueprintSchemaSemanticDigest = `sha256:${sha256(canonicalJson(canonicalBlueprintSchema))}`;
if (vendoredBlueprintSchemaSemanticDigest !==
    canonicalBlueprintSchemaAuthority.canonicalSemanticDigest) {
    throw new Error("VENDORED_CANONICAL_BLUEPRINT_SCHEMA_DIVERGED");
}
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
function duplicateFindings(values, basePath, kind) {
    const seen = new Map();
    const findings = [];
    values.forEach((value, index) => {
        const first = seen.get(value.id);
        if (first === undefined) {
            seen.set(value.id, index);
        }
        else {
            findings.push({
                code: "DUPLICATE_SEMANTIC_IDENTITY",
                path: `${basePath}/${index}/id`,
                message: `${kind} identity '${value.id}' duplicates ${basePath}/${first}/id.`,
            });
        }
    });
    return findings;
}
function validateScenarioReferences(scenario, index, contractIds, scenarioIds) {
    const base = `/scenarios/${index}`;
    const findings = [];
    const execution = scenario.event.execution;
    if (!contractIds.has(scenario.input.contractRef)) {
        findings.push({
            code: "UNRESOLVED_CONTRACT_REFERENCE",
            path: `${base}/input/contractRef`,
            message: `Input contract '${scenario.input.contractRef}' does not resolve.`,
        });
    }
    if (!contractIds.has(scenario.outcome.product.contractRef)) {
        findings.push({
            code: "UNRESOLVED_CONTRACT_REFERENCE",
            path: `${base}/outcome/product/contractRef`,
            message: `Product contract '${scenario.outcome.product.contractRef}' does not resolve.`,
        });
    }
    findings.push(...duplicateFindings(execution.operations, `${base}/event/execution/operations`, "Operation"), ...duplicateFindings(execution.mechanics, `${base}/event/execution/mechanics`, "Mechanic"), ...duplicateFindings(execution.providerBoundaries, `${base}/event/execution/providerBoundaries`, "Provider boundary"), ...duplicateFindings(execution.effects, `${base}/event/execution/effects`, "Effect"), ...duplicateFindings(scenario.routes, `${base}/routes`, "Route"));
    const operations = new Set(execution.operations.map(({ id }) => id));
    const mechanics = new Set(execution.mechanics.map(({ id }) => id));
    const providers = new Set(execution.providerBoundaries.map(({ id }) => id));
    const effects = new Set(execution.effects.map(({ id }) => id));
    execution.operations.forEach((operation, operationIndex) => {
        const operationBase = `${base}/event/execution/operations/${operationIndex}`;
        for (const [kind, refs, identities] of [
            ["OPERATION_PREDECESSOR", operation.predecessorRefs, operations],
            ["MECHANIC", operation.mechanicRefs, mechanics],
            ["PROVIDER_BOUNDARY", operation.providerBoundaryRefs, providers],
            ["EFFECT", operation.effectRefs, effects],
        ]) {
            refs.forEach((ref, refIndex) => {
                if (!identities.has(ref)) {
                    findings.push({
                        code: `UNRESOLVED_${kind}_REFERENCE`,
                        path: `${operationBase}/${kind === "OPERATION_PREDECESSOR"
                            ? "predecessorRefs"
                            : kind === "MECHANIC"
                                ? "mechanicRefs"
                                : kind === "PROVIDER_BOUNDARY"
                                    ? "providerBoundaryRefs"
                                    : "effectRefs"}/${refIndex}`,
                        message: `${kind.toLowerCase().replaceAll("_", " ")} '${ref}' does not resolve in this event.`,
                    });
                }
            });
        }
    });
    const predecessorsByOperation = new Map(execution.operations.map(({ id, predecessorRefs }) => [id, predecessorRefs]));
    const activeOperations = new Set();
    const closedOperations = new Set();
    const visitOperation = (operationId) => {
        if (closedOperations.has(operationId))
            return;
        if (activeOperations.has(operationId)) {
            findings.push({
                code: "OPERATION_PRECEDENCE_CYCLE",
                path: `${base}/event/execution/operations`,
                message: `Operation precedence contains a cycle through '${operationId}'.`,
            });
            return;
        }
        activeOperations.add(operationId);
        for (const predecessor of predecessorsByOperation.get(operationId) ?? []) {
            if (predecessorsByOperation.has(predecessor))
                visitOperation(predecessor);
        }
        activeOperations.delete(operationId);
        closedOperations.add(operationId);
    };
    for (const operation of execution.operations)
        visitOperation(operation.id);
    if (execution.operations.length > 0) {
        const operationRoots = execution.operations.filter(({ predecessorRefs }) => predecessorRefs.length === 0);
        const predecessorUse = new Map(execution.operations.map(({ id }) => [id, 0]));
        for (const operation of execution.operations) {
            for (const predecessor of operation.predecessorRefs) {
                if (predecessorUse.has(predecessor)) {
                    predecessorUse.set(predecessor, predecessorUse.get(predecessor) + 1);
                }
            }
        }
        const operationLeaves = [...predecessorUse].filter(([, count]) => count === 0).map(([id]) => id);
        if (operationRoots.length !== 1) {
            findings.push({
                code: "OPERATION_ROOT_CARDINALITY_INVALID",
                path: `${base}/event/execution/operations`,
                message: `Exactly one operation precedence root is required; observed ${operationRoots.length}.`,
            });
        }
        if (operationLeaves.length !== 1) {
            findings.push({
                code: "OPERATION_LEAF_CARDINALITY_INVALID",
                path: `${base}/event/execution/operations`,
                message: `Exactly one operation precedence leaf is required; observed ${operationLeaves.length}.`,
            });
        }
    }
    execution.effects.forEach((effect, effectIndex) => {
        if (!providers.has(effect.providerBoundaryRef)) {
            findings.push({
                code: "UNRESOLVED_PROVIDER_BOUNDARY_REFERENCE",
                path: `${base}/event/execution/effects/${effectIndex}/providerBoundaryRef`,
                message: `Effect provider boundary '${effect.providerBoundaryRef}' does not resolve in this event.`,
            });
        }
    });
    const invokedMechanics = new Set(execution.operations.flatMap(({ mechanicRefs }) => mechanicRefs));
    const invokedProviders = new Set(execution.operations.flatMap(({ providerBoundaryRefs }) => providerBoundaryRefs));
    const invokedEffects = new Set(execution.operations.flatMap(({ effectRefs }) => effectRefs));
    for (const [kind, declarations, invoked, collection] of [
        ["MECHANIC", execution.mechanics, invokedMechanics, "mechanics"],
        ["PROVIDER_BOUNDARY", execution.providerBoundaries, invokedProviders, "providerBoundaries"],
        ["EFFECT", execution.effects, invokedEffects, "effects"],
    ]) {
        declarations.forEach(({ id }, declarationIndex) => {
            if (!invoked.has(id)) {
                findings.push({
                    code: `UNINVOKED_${kind}`,
                    path: `${base}/event/execution/${collection}/${declarationIndex}/id`,
                    message: `${kind.toLowerCase().replaceAll("_", " ")} '${id}' is declared but no operation invokes it.`,
                });
            }
        });
    }
    if (scenario.outcome.terminal && scenario.routes.length > 0) {
        findings.push({
            code: "TERMINAL_OUTCOME_HAS_ROUTE",
            path: `${base}/routes`,
            message: "A terminal outcome cannot declare a downstream route.",
        });
    }
    if (scenario.outcome.terminal && scenario.outcome.terminalDisposition === null) {
        findings.push({
            code: "TERMINAL_DISPOSITION_MISSING",
            path: `${base}/outcome/terminalDisposition`,
            message: "A terminal outcome must establish one declared terminal disposition.",
        });
    }
    if (!scenario.outcome.terminal && scenario.outcome.terminalDisposition !== null) {
        findings.push({
            code: "NONTERMINAL_DISPOSITION_NOT_ADMITTED",
            path: `${base}/outcome/terminalDisposition`,
            message: "A nonterminal outcome cannot establish a terminal disposition.",
        });
    }
    if (!scenario.outcome.terminal && scenario.routes.length === 0) {
        findings.push({
            code: "NONTERMINAL_OUTCOME_ROUTE_MISSING",
            path: `${base}/routes`,
            message: "A nonterminal outcome must declare at least one downstream route.",
        });
    }
    scenario.routes.forEach((route, routeIndex) => {
        if (!scenarioIds.has(route.toScenarioRef)) {
            findings.push({
                code: "UNRESOLVED_SCENARIO_REFERENCE",
                path: `${base}/routes/${routeIndex}/toScenarioRef`,
                message: `Target scenario '${route.toScenarioRef}' does not resolve.`,
            });
        }
        if (route.when.kind === "variant" && !route.when.selector) {
            findings.push({
                code: "VARIANT_SELECTOR_MISSING",
                path: `${base}/routes/${routeIndex}/when/selector`,
                message: "A variant route requires an explicit selector.",
            });
        }
        if (route.when.kind !== "variant" && route.when.selector !== null) {
            findings.push({
                code: "ROUTE_SELECTOR_NOT_ADMITTED",
                path: `${base}/routes/${routeIndex}/when/selector`,
                message: "Only a variant route may carry a selector.",
            });
        }
    });
    const routeKinds = new Set(scenario.routes.map(({ when }) => when.kind));
    if (routeKinds.has("always") && routeKinds.size > 1) {
        findings.push({
            code: "UNCONDITIONAL_AND_CONDITIONAL_ROUTES_MIXED",
            path: `${base}/routes`,
            message: "An unconditional route cannot be mixed with conditional routes.",
        });
    }
    if (!routeKinds.has("always") && scenario.routes.length === 1) {
        findings.push({
            code: "CONDITIONAL_ROUTE_FAMILY_INCOMPLETE",
            path: `${base}/routes`,
            message: "A conditional outcome must declare at least two mutually exclusive routes.",
        });
    }
    for (const kind of ["success", "failure", "cancel"]) {
        if (scenario.routes.filter(({ when }) => when.kind === kind).length > 1) {
            findings.push({
                code: "ROUTE_CONDITION_DUPLICATED",
                path: `${base}/routes`,
                message: `Route condition '${kind}' may appear at most once in a route family.`,
            });
        }
    }
    const conditionKeys = scenario.routes.map(({ when }) => `${when.kind}:${when.selector ?? ""}`);
    if (new Set(conditionKeys).size !== conditionKeys.length) {
        findings.push({
            code: "ROUTE_CONDITION_DUPLICATED",
            path: `${base}/routes`,
            message: "Every route in one conditional family must have a unique condition.",
        });
    }
    return findings;
}
function sorted(findings) {
    return findings.sort((left, right) => `${left.path}|${left.code}|${left.message}`.localeCompare(`${right.path}|${right.code}|${right.message}`));
}
export function validateCarrierSource(source, sourceId) {
    const parsed = parseCarrierSource(source, sourceId);
    if (parsed.value === null || parsed.findings.length > 0) {
        return { carrier: null, findings: sorted(parsed.findings) };
    }
    if (!validateSchema(parsed.value)) {
        return {
            carrier: null,
            findings: sorted((validateSchema.errors ?? []).map(schemaFinding)),
        };
    }
    const carrier = parsed.value;
    const findings = [];
    findings.push(...duplicateFindings(carrier.contracts, "/contracts", "Contract"), ...duplicateFindings(carrier.scenarios, "/scenarios", "Scenario"));
    const contractIds = new Set(carrier.contracts.map(({ id }) => id));
    const scenarioIds = new Set(carrier.scenarios.map(({ id }) => id));
    carrier.scenarios.forEach((scenario, index) => {
        findings.push(...validateScenarioReferences(scenario, index, contractIds, scenarioIds));
    });
    const incomingRouteCounts = new Map(carrier.scenarios.map(({ id }) => [id, 0]));
    for (const scenario of carrier.scenarios) {
        for (const route of scenario.routes) {
            if (incomingRouteCounts.has(route.toScenarioRef)) {
                incomingRouteCounts.set(route.toScenarioRef, incomingRouteCounts.get(route.toScenarioRef) + 1);
            }
        }
    }
    const roots = [...incomingRouteCounts].filter(([, count]) => count === 0).map(([id]) => id);
    if (roots.length !== 1) {
        findings.push({
            code: "SCENARIO_ROOT_CARDINALITY_INVALID",
            path: "/scenarios",
            message: `Exactly one scenario route root is required; observed ${roots.length}.`,
        });
    }
    else {
        const routesByScenario = new Map(carrier.scenarios.map(({ id, routes }) => [id, routes]));
        const reachable = new Set();
        const visit = (scenarioId) => {
            if (reachable.has(scenarioId))
                return;
            reachable.add(scenarioId);
            for (const route of routesByScenario.get(scenarioId) ?? [])
                visit(route.toScenarioRef);
        };
        visit(roots[0]);
        carrier.scenarios.forEach(({ id }, index) => {
            if (!reachable.has(id)) {
                findings.push({
                    code: "SCENARIO_UNREACHABLE",
                    path: `/scenarios/${index}/id`,
                    message: `Scenario '${id}' is not reachable from route root '${roots[0]}'.`,
                });
            }
        });
    }
    const realizedTerminalDispositions = carrier.scenarios
        .filter(({ outcome }) => outcome.terminal)
        .map(({ outcome }) => outcome.terminalDisposition)
        .filter((value) => value !== null);
    const declaredTerminalDispositions = [...carrier.capability.terminalDispositions];
    const realizedCounts = new Map();
    for (const disposition of realizedTerminalDispositions) {
        realizedCounts.set(disposition, (realizedCounts.get(disposition) ?? 0) + 1);
        if (!declaredTerminalDispositions.includes(disposition)) {
            findings.push({
                code: "UNDECLARED_TERMINAL_DISPOSITION",
                path: "/scenarios",
                message: `Terminal disposition '${disposition}' is not declared by the capability.`,
            });
        }
    }
    for (const disposition of declaredTerminalDispositions) {
        const count = realizedCounts.get(disposition) ?? 0;
        if (count !== 1) {
            findings.push({
                code: count === 0 ? "TERMINAL_DISPOSITION_UNREALIZED" : "TERMINAL_DISPOSITION_AMBIGUOUS",
                path: "/capability/terminalDispositions",
                message: `Terminal disposition '${disposition}' must be realized by exactly one terminal scenario; observed ${count}.`,
            });
        }
    }
    return findings.length === 0
        ? { carrier, findings: [] }
        : { carrier: null, findings: sorted(findings) };
}
