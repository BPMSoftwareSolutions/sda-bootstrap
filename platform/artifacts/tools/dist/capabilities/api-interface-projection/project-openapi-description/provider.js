import { sha256Digest } from "../../../enterprise/control-plane/canonical-json.js";
import { digestWithoutField } from "../derive-api-operation-graph/model.js";
const IMPLEMENTED_SCHEMA_KEYWORDS = new Set([
    "$id", "$schema", "additionalProperties", "const", "description", "enum", "items",
    "maxLength", "maximum", "minItems", "minLength", "minimum", "oneOf", "pattern",
    "properties", "required", "title", "type", "uniqueItems"
]);
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
function canonicalClone(value) {
    if (Array.isArray(value))
        return value.map(canonicalClone);
    if (!isRecord(value))
        return value;
    return Object.fromEntries(Object.keys(value).sort(compareText).map((key) => [key, canonicalClone(value[key])]));
}
function validateSchemaNode(value, allowedKeywords, contractId, pointer) {
    if (!isRecord(value))
        throw new Error(`API contract '${contractId}' contains an unsupported boolean or scalar schema at '${pointer}'.`);
    for (const keyword of Object.keys(value)) {
        if (!allowedKeywords.has(keyword)) {
            throw new Error(`API contract '${contractId}' uses unsupported schema keyword '${keyword}' at '${pointer}'.`);
        }
    }
    const properties = value["properties"];
    if (properties !== undefined) {
        if (!isRecord(properties))
            throw new Error(`API contract '${contractId}' has invalid properties at '${pointer}'.`);
        for (const [name, schema] of Object.entries(properties)) {
            validateSchemaNode(schema, allowedKeywords, contractId, `${pointer}/properties/${name.replace(/~/g, "~0").replace(/\//g, "~1")}`);
        }
    }
    const items = value["items"];
    if (items !== undefined)
        validateSchemaNode(items, allowedKeywords, contractId, `${pointer}/items`);
    const oneOf = value["oneOf"];
    if (oneOf !== undefined) {
        if (!Array.isArray(oneOf) || oneOf.length === 0)
            throw new Error(`API contract '${contractId}' has invalid oneOf at '${pointer}'.`);
        oneOf.forEach((schema, index) => validateSchemaNode(schema, allowedKeywords, contractId, `${pointer}/oneOf/${index}`));
    }
}
function validateProfile(profile) {
    if (profile.profileDigest !== digestWithoutField(profile, "profileDigest")) {
        throw new Error(`OpenAPI projection profile '${profile.profileId}' failed digest verification.`);
    }
    if (new Set(profile.allowedMethods).size !== profile.allowedMethods.length ||
        new Set(profile.allowedParameterLocations).size !== profile.allowedParameterLocations.length ||
        new Set(profile.allowedSchemaKeywords).size !== profile.allowedSchemaKeywords.length) {
        throw new Error(`OpenAPI projection profile '${profile.profileId}' contains duplicate policy entries.`);
    }
    const unsupported = profile.allowedSchemaKeywords.filter((keyword) => !IMPLEMENTED_SCHEMA_KEYWORDS.has(keyword));
    if (unsupported.length > 0) {
        throw new Error(`OpenAPI projection profile '${profile.profileId}' claims unsupported schema keywords: ${unsupported.join(", ")}.`);
    }
    if (!profile.allowedMethods.includes("GET") || !profile.allowedMethods.includes("POST") ||
        !profile.allowedParameterLocations.includes("PATH") ||
        !profile.allowedParameterLocations.includes("QUERY") ||
        !profile.allowedParameterLocations.includes("HEADER")) {
        throw new Error(`OpenAPI projection profile '${profile.profileId}' does not admit the canonical graph vocabulary.`);
    }
    return new Set(profile.allowedSchemaKeywords);
}
function componentName(contractId) {
    return contractId.split(/[-.]/u).map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`).join("");
}
function pointerToken(value) {
    return value.replace(/~/g, "~0").replace(/\//g, "~1");
}
function schemaReference(name) {
    return Object.freeze({ "$ref": `#/components/schemas/${name}` });
}
function mediaTypeFor(contractId, profile) {
    return contractId === "api-problem.v1" ? profile.problemMediaType : profile.responseMediaType;
}
function responseDescription(statusCode, disposition) {
    const label = disposition.toLowerCase().replace(/_/g, " ");
    return `${statusCode} ${label} response`;
}
function projectParameterSchema(operation, wireName, valueType, contracts) {
    const input = contracts.get(operation["x-sda-input-contract-id"]);
    const properties = input?.schema["properties"];
    const propertySchema = isRecord(properties) ? properties[wireName] : undefined;
    if (isRecord(propertySchema))
        return Object.freeze(canonicalClone(propertySchema));
    return valueType === "POSITIVE_INTEGER"
        ? Object.freeze({ type: "integer", minimum: 1 })
        : Object.freeze({ type: "string" });
}
function projectOperation(apiId, operation, contracts, componentNames, profile) {
    if (!profile.allowedMethods.includes(operation.method)) {
        throw new Error(`API operation '${operation.operationId}' uses method '${operation.method}' outside the projection profile.`);
    }
    const parameters = operation.parameters.map((parameter) => {
        if (!profile.allowedParameterLocations.includes(parameter.location)) {
            throw new Error(`API operation '${operation.operationId}' uses parameter location '${parameter.location}' outside the projection profile.`);
        }
        return Object.freeze({
            name: parameter.wireName,
            in: parameter.location.toLowerCase(),
            required: parameter.required,
            schema: projectParameterSchema(operation, parameter.wireName, parameter.valueType, contracts),
            "x-sda-parameter-id": parameter.parameterId,
            "x-sda-contract-id": operation["x-sda-input-contract-id"]
        });
    });
    const responses = Object.fromEntries(operation.responses.map((response) => {
        const name = componentNames.get(response.contract.contractId);
        if (!name)
            throw new Error(`API operation '${operation.operationId}' response contract did not resolve to a component.`);
        return [String(response.statusCode), Object.freeze({
                description: responseDescription(response.statusCode, response.disposition),
                content: Object.freeze({
                    [mediaTypeFor(response.contract.contractId, profile)]: Object.freeze({ schema: schemaReference(name) })
                }),
                "x-sda-disposition": response.disposition,
                "x-sda-contract-id": response.contract.contractId,
                "x-sda-contract-digest": response.contract.contractDigest
            })];
    }));
    const requestBody = operation.body
        ? (() => {
            const name = componentNames.get(operation.body.contractId);
            if (!name)
                throw new Error(`API operation '${operation.operationId}' body contract did not resolve to a component.`);
            return Object.freeze({
                required: true,
                content: Object.freeze({
                    [profile.requestMediaType]: Object.freeze({ schema: schemaReference(name) })
                }),
                "x-sda-contract-id": operation.body.contractId,
                "x-sda-contract-digest": operation.body.contractDigest
            });
        })()
        : undefined;
    return Object.freeze({
        tags: Object.freeze([apiId]),
        operationId: operation.operationId,
        summary: operation.summary,
        parameters: Object.freeze(parameters),
        ...(requestBody ? { requestBody } : {}),
        responses: Object.freeze(responses),
        security: Object.freeze([Object.freeze({ [profile.securitySchemeId]: Object.freeze([...operation.requiredScopes]) })]),
        deprecated: operation.deprecated,
        "x-sda-interaction": operation.interaction,
        "x-sda-idempotency": operation.idempotency,
        "x-sda-capability-id": operation["x-sda-capability-id"],
        "x-sda-capability-digest": operation["x-sda-capability-digest"],
        "x-sda-scenario-id": operation["x-sda-scenario-id"],
        "x-sda-input-contract-id": operation["x-sda-input-contract-id"],
        "x-sda-result-contract-id": operation["x-sda-result-contract-id"],
        "x-sda-obligation-id": operation["x-sda-obligation-id"],
        "x-sda-experience-id": operation["x-sda-experience-id"],
        "x-sda-interface-authority-digest": operation["x-sda-interface-authority-digest"]
    });
}
export class ProjectOpenApiDescriptionProvider {
    responsibilityId = "project-operation-graph-into-bounded-openapi-description";
    async execute(input) {
        const allowedKeywords = validateProfile(input.profile);
        if (input.operationGraph.graphDigest !== digestWithoutField(input.operationGraph, "graphDigest")) {
            throw new Error("OpenAPI projection rejected an operation graph with an invalid digest.");
        }
        const operations = input.operationGraph.apis.flatMap((api) => api.operations.map((operation) => ({ apiId: api.apiId, operation })));
        if (input.operationGraph.apis.length > input.profile.limits.maximumApis ||
            operations.length > input.profile.limits.maximumOperations ||
            input.operationGraph.contracts.length > input.profile.limits.maximumContracts) {
            throw new Error(`OpenAPI projection input exceeds profile '${input.profile.profileId}' limits.`);
        }
        const graphContracts = requireUnique(input.operationGraph.contracts, (contract) => contract.contractId, "Operation graph contract");
        requireUnique(input.operationGraph.contracts, (contract) => contract.schemaId, "Operation graph schema identity");
        requireUnique(operations, (entry) => entry.operation.operationId, "Operation graph operation");
        requireUnique(operations, (entry) => `${entry.operation.method} ${entry.operation.path}`, "Operation graph route");
        for (const { apiId, operation } of operations) {
            if (operation["x-sda-interface-authority-digest"] !== input.operationGraph.apis
                .find((api) => api.apiId === apiId)?.authorityDigest) {
                throw new Error(`API operation '${operation.operationId}' does not match its graph authority digest.`);
            }
            for (const binding of [
                ...(operation.body ? [operation.body] : []),
                ...operation.responses.map((response) => response.contract)
            ]) {
                const descriptor = graphContracts.get(binding.contractId);
                if (!descriptor || descriptor.schemaDigest !== binding.contractDigest) {
                    throw new Error(`API operation '${operation.operationId}' has an inconsistent graph contract binding '${binding.contractId}'.`);
                }
            }
            if (!graphContracts.has(operation["x-sda-input-contract-id"]) ||
                !graphContracts.has(operation["x-sda-result-contract-id"]) ||
                new Set(operation.requiredScopes).size !== operation.requiredScopes.length) {
                throw new Error(`API operation '${operation.operationId}' has incomplete graph contract or scope closure.`);
            }
        }
        const contracts = requireUnique(input.contracts, (contract) => contract.contractId, "OpenAPI source contract");
        requireUnique(input.contracts, (contract) => contract.schemaId, "OpenAPI source schema identity");
        if (contracts.size !== input.operationGraph.contracts.length) {
            throw new Error("OpenAPI source contracts do not exactly close the operation graph contract set.");
        }
        for (const graphContract of input.operationGraph.contracts) {
            const contract = contracts.get(graphContract.contractId);
            if (!contract || contract.schemaId !== graphContract.schemaId || contract.schemaDigest !== graphContract.schemaDigest ||
                sha256Digest(contract.schema) !== contract.schemaDigest) {
                throw new Error(`OpenAPI source contract '${graphContract.contractId}' does not match the admitted operation graph.`);
            }
            validateSchemaNode(contract.schema, allowedKeywords, contract.contractId, "#");
        }
        const componentNames = new Map();
        const names = new Set();
        for (const graphContract of input.operationGraph.contracts) {
            const name = componentName(graphContract.contractId);
            if (names.has(name))
                throw new Error(`OpenAPI component name '${name}' is ambiguous.`);
            names.add(name);
            componentNames.set(graphContract.contractId, name);
        }
        const paths = {};
        for (const { apiId, operation } of [...operations].sort((left, right) => compareText(`${left.operation.path}:${left.operation.method}`, `${right.operation.path}:${right.operation.method}`))) {
            const pathItem = paths[operation.path] ?? {};
            pathItem[operation.method.toLowerCase()] = projectOperation(apiId, operation, contracts, componentNames, input.profile);
            paths[operation.path] = pathItem;
        }
        const schemas = Object.fromEntries([...input.operationGraph.contracts]
            .sort((left, right) => compareText(left.contractId, right.contractId))
            .map((graphContract) => {
            const contract = contracts.get(graphContract.contractId);
            const name = componentNames.get(graphContract.contractId);
            if (!contract || !name)
                throw new Error(`OpenAPI contract '${graphContract.contractId}' could not be projected.`);
            const schema = canonicalClone(contract.schema);
            delete schema["$schema"];
            delete schema["$id"];
            return [name, Object.freeze({
                    ...schema,
                    "x-sda-contract-id": contract.contractId,
                    "x-sda-schema-id": contract.schemaId,
                    "x-sda-schema-digest": contract.schemaDigest
                })];
        }));
        const scopes = [...new Set(operations.flatMap(({ operation }) => operation.requiredScopes))].sort(compareText);
        const document = Object.freeze({
            openapi: input.profile.openapiVersion,
            info: Object.freeze({ title: input.profile.title, version: input.profile.apiVersion }),
            jsonSchemaDialect: input.profile.jsonSchemaDialect,
            tags: Object.freeze([...input.operationGraph.apis]
                .sort((left, right) => compareText(left.apiId, right.apiId))
                .map((api) => Object.freeze({ name: api.apiId, description: api.title }))),
            paths: Object.freeze(Object.fromEntries(Object.entries(paths).sort(([left], [right]) => compareText(left, right))
                .map(([route, item]) => [route, Object.freeze(item)]))),
            components: Object.freeze({
                schemas: Object.freeze(schemas),
                securitySchemes: Object.freeze({
                    [input.profile.securitySchemeId]: Object.freeze({
                        type: "oauth2",
                        flows: Object.freeze({
                            clientCredentials: Object.freeze({
                                tokenUrl: input.profile.oauthTokenUrl,
                                scopes: Object.freeze(Object.fromEntries(scopes.map((scope) => [scope, scope])))
                            })
                        })
                    })
                })
            }),
            "x-sda-document-id": input.profile.documentId,
            "x-sda-operation-graph-digest": input.operationGraph.graphDigest,
            "x-sda-projection-profile-digest": input.profile.profileDigest,
            "x-sda-source-authorities": Object.freeze([...input.operationGraph.apis]
                .sort((left, right) => compareText(left.apiId, right.apiId))
                .map((api) => Object.freeze({ apiId: api.apiId, authorityDigest: api.authorityDigest })))
        });
        const equivalence = Object.freeze({
            disposition: "EQUIVALENT",
            operationCount: operations.length,
            responseCount: operations.reduce((count, entry) => count + entry.operation.responses.length, 0),
            scopeCount: operations.reduce((count, entry) => count + entry.operation.requiredScopes.length, 0),
            contractCount: input.operationGraph.contracts.length,
            operationMappings: Object.freeze(operations
                .map(({ operation }) => Object.freeze({
                operationId: operation.operationId,
                method: operation.method.toLowerCase(),
                path: operation.path,
                documentPointer: `#/paths/${pointerToken(operation.path)}/${operation.method.toLowerCase()}`
            }))
                .sort((left, right) => compareText(left.operationId, right.operationId))),
            contractMappings: Object.freeze(input.operationGraph.contracts.map((contract) => {
                const name = componentNames.get(contract.contractId);
                if (!name)
                    throw new Error(`OpenAPI contract '${contract.contractId}' has no component mapping.`);
                return Object.freeze({
                    contractId: contract.contractId,
                    schemaDigest: contract.schemaDigest,
                    componentName: name,
                    documentPointer: `#/components/schemas/${pointerToken(name)}`
                });
            }).sort((left, right) => compareText(left.contractId, right.contractId)))
        });
        const withoutEvidenceDigest = {
            evidenceType: "sda-openapi-projection-evidence.v1",
            operationGraphDigest: input.operationGraph.graphDigest,
            projectionProfileDigest: input.profile.profileDigest,
            document,
            equivalence,
            documentDigest: sha256Digest(document)
        };
        return Object.freeze({
            ...withoutEvidenceDigest,
            evidenceDigest: sha256Digest(withoutEvidenceDigest)
        });
    }
}
