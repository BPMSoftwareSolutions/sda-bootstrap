import { sha256Digest } from "../../../enterprise/control-plane/canonical-json.js";
import { digestWithoutField } from "./model.js";
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const CONTRACT_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.v[1-9][0-9]*$/;
function compareText(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function requireUnique(values, key, label) {
    const result = new Map();
    for (const value of values) {
        const identity = key(value);
        if (result.has(identity))
            throw new Error(`${label} '${identity}' is declared more than once.`);
        result.set(identity, value);
    }
    return result;
}
function collectReferences(value, references) {
    if (Array.isArray(value)) {
        for (const member of value)
            collectReferences(member, references);
        return;
    }
    if (!isRecord(value))
        return;
    for (const [key, member] of Object.entries(value)) {
        if (key === "$ref" && typeof member === "string")
            references.push(member);
        else
            collectReferences(member, references);
    }
}
function resolveLocalReference(schema, reference) {
    if (reference === "#")
        return;
    if (!reference.startsWith("#/"))
        throw new Error(`Schema reference '${reference}' is not a local JSON Pointer.`);
    let current = schema;
    for (const encodedToken of reference.slice(2).split("/")) {
        if (/~(?:[^01]|$)/.test(encodedToken))
            throw new Error(`Schema reference '${reference}' has an invalid JSON Pointer escape.`);
        const token = encodedToken.replace(/~1/g, "/").replace(/~0/g, "~");
        if (!isRecord(current) || !Object.hasOwn(current, token)) {
            throw new Error(`Schema reference '${reference}' does not resolve.`);
        }
        current = current[token];
    }
}
function validateContract(contract) {
    if (!CONTRACT_ID_PATTERN.test(contract.contractId) || !DIGEST_PATTERN.test(contract.schemaDigest)) {
        throw new Error(`API contract '${contract.contractId}' has an invalid identity or digest.`);
    }
    if (!contract.schemaId.endsWith(`/${contract.contractId}.schema.json`) ||
        !/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9][A-Za-z0-9._/-]*\.schema\.json$/.test(contract.schemaRef)) {
        throw new Error(`API contract '${contract.contractId}' has an invalid schema identity or reference.`);
    }
    if (contract.schema["$schema"] !== "https://json-schema.org/draft/2020-12/schema" ||
        contract.schema["$id"] !== contract.schemaId ||
        contract.schema["type"] !== "object" ||
        contract.schema["additionalProperties"] !== false ||
        !Array.isArray(contract.schema["required"]) || contract.schema["required"].length === 0 ||
        !isRecord(contract.schema["properties"])) {
        throw new Error(`API contract '${contract.contractId}' is not a closed JSON Schema 2020-12 object contract.`);
    }
    if (sha256Digest(contract.schema) !== contract.schemaDigest) {
        throw new Error(`API contract '${contract.contractId}' failed schema digest verification.`);
    }
    const references = [];
    collectReferences(contract.schema, references);
    for (const reference of references) {
        if (!reference.startsWith("#"))
            throw new Error(`API contract '${contract.contractId}' contains a non-local schema reference.`);
        resolveLocalReference(contract.schema, reference);
    }
}
function resolveContract(binding, contracts, operationId) {
    const contract = contracts.get(binding.contractId);
    if (!contract)
        throw new Error(`API operation '${operationId}' references unknown contract '${binding.contractId}'.`);
    if (binding.contractDigest !== contract.schemaDigest) {
        throw new Error(`API operation '${operationId}' has a stale digest for contract '${binding.contractId}'.`);
    }
    return contract;
}
function validateSource(operation, capabilities) {
    const capability = capabilities.get(operation.source.capabilityId);
    if (!capability)
        throw new Error(`API operation '${operation.operationId}' references unknown capability '${operation.source.capabilityId}'.`);
    const scenario = capability.scenarios.find((candidate) => candidate.scenarioId === operation.source.scenarioId);
    if (!scenario)
        throw new Error(`API operation '${operation.operationId}' references unknown scenario '${operation.source.scenarioId}'.`);
    const mismatches = [
        scenario.input.contract.contractId === operation.source.inputContractId,
        scenario.outcome.evidence.contract.contractId === operation.source.resultContractId,
        scenario.outcome.obligation.obligationId === operation.source.obligationId,
        scenario.outcome.experience.experienceId === operation.source.experienceId
    ];
    if (mismatches.some((matches) => !matches)) {
        throw new Error(`API operation '${operation.operationId}' does not match its source scenario lineage.`);
    }
    return scenario;
}
function pathParameterNames(routePath) {
    return [...routePath.matchAll(/\{([a-z][A-Za-z0-9]*)\}/g)].map((match) => match[1]).sort(compareText);
}
function validateOperation(operation, contracts, capabilities) {
    validateSource(operation, capabilities);
    const parameterMap = requireUnique(operation.parameters, (parameter) => `${parameter.location}:${parameter.wireName}`, `API operation '${operation.operationId}' parameter`);
    requireUnique(operation.parameters, (parameter) => parameter.parameterId, `API operation '${operation.operationId}' parameter identity`);
    const declaredPathParameters = operation.parameters
        .filter((parameter) => parameter.location === "PATH")
        .map((parameter) => {
        if (!parameter.required)
            throw new Error(`API operation '${operation.operationId}' has an optional path parameter.`);
        return parameter.wireName;
    })
        .sort(compareText);
    if (JSON.stringify(declaredPathParameters) !== JSON.stringify(pathParameterNames(operation.path))) {
        throw new Error(`API operation '${operation.operationId}' path parameters do not match its route template.`);
    }
    if (operation.method === "GET" && operation.body)
        throw new Error(`GET operation '${operation.operationId}' cannot declare a request body.`);
    if (operation.method === "POST" && !operation.body)
        throw new Error(`POST operation '${operation.operationId}' must declare a request body.`);
    if (operation.body) {
        resolveContract(operation.body, contracts, operation.operationId);
        if (operation.body.contractId !== operation.source.inputContractId) {
            throw new Error(`API operation '${operation.operationId}' body does not match its source input contract.`);
        }
    }
    else {
        const inputContract = contracts.get(operation.source.inputContractId);
        if (!inputContract)
            throw new Error(`API operation '${operation.operationId}' source input contract did not resolve.`);
        const properties = inputContract.schema["properties"];
        const required = inputContract.schema["required"];
        if (!isRecord(properties) || !Array.isArray(required)) {
            throw new Error(`API operation '${operation.operationId}' source input contract is not parameter-addressable.`);
        }
        const parameterNames = operation.parameters.map((parameter) => parameter.wireName).sort(compareText);
        const propertyNames = Object.keys(properties).sort(compareText);
        const requiredParameterNames = operation.parameters
            .filter((parameter) => parameter.required)
            .map((parameter) => parameter.wireName)
            .sort(compareText);
        const requiredPropertyNames = required.filter((member) => typeof member === "string").sort(compareText);
        if (JSON.stringify(parameterNames) !== JSON.stringify(propertyNames) ||
            JSON.stringify(requiredParameterNames) !== JSON.stringify(requiredPropertyNames)) {
            throw new Error(`API operation '${operation.operationId}' parameters do not match its source input contract.`);
        }
    }
    const idempotencyHeader = parameterMap.get("HEADER:Idempotency-Key");
    if (operation.idempotency === "REQUIRED" && (!idempotencyHeader || !idempotencyHeader.required)) {
        throw new Error(`API operation '${operation.operationId}' requires an Idempotency-Key header binding.`);
    }
    if (operation.idempotency === "NOT_APPLICABLE" && idempotencyHeader) {
        throw new Error(`API operation '${operation.operationId}' cannot bind idempotency when it is not applicable.`);
    }
    requireUnique(operation.responses, (response) => String(response.statusCode), `API operation '${operation.operationId}' response`);
    let hasSuccess = false;
    let hasFailure = false;
    for (const response of operation.responses) {
        resolveContract(response.contract, contracts, operation.operationId);
        const successfulStatus = response.statusCode >= 200 && response.statusCode < 300;
        if (successfulStatus !== (response.disposition === "SUCCESS")) {
            throw new Error(`API operation '${operation.operationId}' response '${response.statusCode}' has an invalid disposition.`);
        }
        hasSuccess ||= successfulStatus;
        hasFailure ||= response.statusCode >= 400;
    }
    if (!hasSuccess || !hasFailure)
        throw new Error(`API operation '${operation.operationId}' must declare success and failure responses.`);
    if (!operation.responses.some((response) => response.disposition === "SUCCESS" && response.contract.contractId === operation.source.resultContractId)) {
        throw new Error(`API operation '${operation.operationId}' has no success response for its source result contract.`);
    }
    if (new Set(operation.requiredScopes).size !== operation.requiredScopes.length) {
        throw new Error(`API operation '${operation.operationId}' declares duplicate authorization scopes.`);
    }
}
function graphOperation(operation, authorityDigest, capabilityDigest) {
    return Object.freeze({
        operationId: operation.operationId,
        summary: operation.summary,
        method: operation.method,
        path: operation.path,
        interaction: operation.interaction,
        ...(operation.body ? { body: Object.freeze({ ...operation.body }) } : {}),
        parameters: Object.freeze([...operation.parameters]
            .map((parameter) => Object.freeze({ ...parameter }))
            .sort((left, right) => compareText(`${left.location}:${left.wireName}`, `${right.location}:${right.wireName}`))),
        responses: Object.freeze([...operation.responses]
            .map((response) => Object.freeze({ ...response, contract: Object.freeze({ ...response.contract }) }))
            .sort((left, right) => left.statusCode - right.statusCode)),
        requiredScopes: Object.freeze([...operation.requiredScopes].sort(compareText)),
        idempotency: operation.idempotency,
        deprecated: operation.deprecated,
        "x-sda-capability-id": operation.source.capabilityId,
        "x-sda-capability-digest": capabilityDigest,
        "x-sda-scenario-id": operation.source.scenarioId,
        "x-sda-input-contract-id": operation.source.inputContractId,
        "x-sda-result-contract-id": operation.source.resultContractId,
        "x-sda-obligation-id": operation.source.obligationId,
        "x-sda-experience-id": operation.source.experienceId,
        "x-sda-interface-authority-digest": authorityDigest
    });
}
export class DeriveApiOperationGraphProvider {
    responsibilityId = "resolve-interface-authority-into-target-neutral-operation-graph";
    async execute(input) {
        const contracts = requireUnique(input.contracts, (contract) => contract.contractId, "API contract");
        requireUnique(input.contracts, (contract) => contract.schemaId, "API schema identity");
        for (const contract of input.contracts)
            validateContract(contract);
        const capabilities = requireUnique(input.capabilities, (capability) => capability.capabilityId, "API source capability");
        for (const capability of capabilities.values()) {
            requireUnique(capability.scenarios, (scenario) => scenario.scenarioId, `API source capability '${capability.capabilityId}' scenario`);
        }
        const authorities = requireUnique(input.interfaceAuthorities, (authority) => authority.apiId, "API interface authority");
        const operationIds = new Set();
        const routes = new Set();
        for (const authority of authorities.values()) {
            if (authority.authorityDigest !== digestWithoutField(authority, "authorityDigest")) {
                throw new Error(`API interface authority '${authority.apiId}' failed digest verification.`);
            }
            for (const operation of authority.operations) {
                if (operationIds.has(operation.operationId))
                    throw new Error(`API operation '${operation.operationId}' is declared more than once.`);
                operationIds.add(operation.operationId);
                const route = `${operation.method} ${operation.path}`;
                if (routes.has(route))
                    throw new Error(`API route '${route}' is ambiguous.`);
                routes.add(route);
                validateOperation(operation, contracts, capabilities);
            }
        }
        const apis = [...authorities.values()]
            .sort((left, right) => compareText(left.apiId, right.apiId))
            .map((authority) => Object.freeze({
            apiId: authority.apiId,
            apiVersion: authority.apiVersion,
            title: authority.title,
            authorityDigest: authority.authorityDigest,
            operations: Object.freeze([...authority.operations]
                .sort((left, right) => compareText(left.operationId, right.operationId))
                .map((operation) => {
                const capability = capabilities.get(operation.source.capabilityId);
                if (!capability)
                    throw new Error(`API operation '${operation.operationId}' source capability did not resolve.`);
                return graphOperation(operation, authority.authorityDigest, sha256Digest(capability));
            }))
        }));
        const referencedContractIds = new Set();
        for (const authority of authorities.values()) {
            for (const operation of authority.operations) {
                referencedContractIds.add(operation.source.inputContractId);
                referencedContractIds.add(operation.source.resultContractId);
                if (operation.body)
                    referencedContractIds.add(operation.body.contractId);
                for (const response of operation.responses)
                    referencedContractIds.add(response.contract.contractId);
            }
        }
        const graphWithoutDigest = {
            graphType: "sda-api-operation-graph.v1",
            apis: Object.freeze(apis),
            contracts: Object.freeze([...referencedContractIds]
                .sort(compareText)
                .map((contractId) => {
                const contract = contracts.get(contractId);
                if (!contract)
                    throw new Error(`Referenced API contract '${contractId}' did not resolve.`);
                return Object.freeze({ contractId, schemaId: contract.schemaId, schemaDigest: contract.schemaDigest });
            })),
            provenance: Object.freeze({
                compilerId: "typescript-api-operation-graph-provider.v1",
                canonicalization: "RFC8785",
                digestAlgorithm: "sha256"
            })
        };
        return Object.freeze({
            ...graphWithoutDigest,
            graphDigest: sha256Digest(graphWithoutDigest)
        });
    }
}
