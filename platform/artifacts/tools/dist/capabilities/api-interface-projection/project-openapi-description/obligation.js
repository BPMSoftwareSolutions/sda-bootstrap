import { sha256Digest } from "../../../enterprise/control-plane/canonical-json.js";
import { digestWithoutField } from "../derive-api-operation-graph/model.js";
export class ProjectOpenApiDescriptionObligation {
    obligationId = "every-graph-operation-contract-scope-response-and-lineage-field-survives-projection";
    evaluate(evidence) {
        const projectedOperations = Object.values(evidence.document.paths)
            .flatMap((pathItem) => Object.values(pathItem));
        const projectedResponses = projectedOperations.reduce((count, operation) => count + Object.keys(operation.responses).length, 0);
        const projectedScopes = projectedOperations.reduce((count, operation) => count + Object.values(operation.security[0] ?? {}).flat().length, 0);
        const mappedOperationIds = new Set(evidence.equivalence.operationMappings.map((mapping) => mapping.operationId));
        const mappedContractIds = new Set(evidence.equivalence.contractMappings.map((mapping) => mapping.contractId));
        const complete = evidence.equivalence.disposition === "EQUIVALENT" &&
            evidence.operationGraphDigest === evidence.document["x-sda-operation-graph-digest"] &&
            evidence.projectionProfileDigest === evidence.document["x-sda-projection-profile-digest"] &&
            evidence.equivalence.operationCount === projectedOperations.length &&
            evidence.equivalence.responseCount === projectedResponses &&
            evidence.equivalence.scopeCount === projectedScopes &&
            evidence.equivalence.contractCount === Object.keys(evidence.document.components.schemas).length &&
            evidence.equivalence.operationMappings.length === projectedOperations.length &&
            evidence.equivalence.contractMappings.length === Object.keys(evidence.document.components.schemas).length &&
            mappedOperationIds.size === evidence.equivalence.operationMappings.length &&
            mappedContractIds.size === evidence.equivalence.contractMappings.length &&
            evidence.equivalence.operationMappings.every((mapping) => evidence.document.paths[mapping.path]?.[mapping.method]?.operationId === mapping.operationId) &&
            evidence.equivalence.contractMappings.every((mapping) => {
                const schema = evidence.document.components.schemas[mapping.componentName];
                return schema?.["x-sda-contract-id"] === mapping.contractId &&
                    schema["x-sda-schema-digest"] === mapping.schemaDigest;
            }) &&
            projectedOperations.every((operation) => operation["x-sda-capability-id"].length > 0 &&
                operation["x-sda-capability-digest"].length > 0 &&
                operation["x-sda-scenario-id"].length > 0 &&
                operation["x-sda-input-contract-id"].length > 0 &&
                operation["x-sda-result-contract-id"].length > 0 &&
                operation["x-sda-obligation-id"].length > 0 &&
                operation["x-sda-experience-id"].length > 0 &&
                operation["x-sda-interface-authority-digest"].length > 0) &&
            evidence.documentDigest === sha256Digest(evidence.document) &&
            evidence.evidenceDigest === digestWithoutField(evidence, "evidenceDigest");
        return complete
            ? {
                kind: "SATISFIED",
                conditionEvidence: [{
                        conditionId: "openapi-description-is-deterministic-source-attributable-and-graph-equivalent",
                        disposition: "SATISFIED"
                    }]
            }
            : {
                kind: "NOT_OBSERVABLE",
                reasons: [{
                        conditionId: "openapi-description-is-deterministic-source-attributable-and-graph-equivalent",
                        reason: "the OpenAPI description is incomplete, lost graph lineage, or failed content-address/equivalence verification"
                    }]
            };
    }
}
