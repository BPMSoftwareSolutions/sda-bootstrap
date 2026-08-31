import { digestWithoutField } from "./model.js";
export class DeriveApiOperationGraphObligation {
    obligationId = "every-operation-is-unambiguous-resolved-and-source-attributable";
    evaluate(evidence) {
        const operations = evidence.apis.flatMap((api) => api.operations);
        const complete = evidence.apis.length > 0 && evidence.contracts.length > 0 && operations.length > 0 &&
            operations.every((operation) => operation["x-sda-capability-id"].length > 0 &&
                operation["x-sda-capability-digest"].length > 0 &&
                operation["x-sda-scenario-id"].length > 0 &&
                operation["x-sda-input-contract-id"].length > 0 &&
                operation["x-sda-result-contract-id"].length > 0 &&
                operation["x-sda-obligation-id"].length > 0 &&
                operation["x-sda-experience-id"].length > 0) &&
            evidence.graphDigest === digestWithoutField(evidence, "graphDigest");
        return complete
            ? {
                kind: "SATISFIED",
                conditionEvidence: [{
                        conditionId: "api-operation-graph-is-complete-target-neutral-and-content-addressed",
                        disposition: "SATISFIED"
                    }]
            }
            : {
                kind: "NOT_OBSERVABLE",
                reasons: [{
                        conditionId: "api-operation-graph-is-complete-target-neutral-and-content-addressed",
                        reason: "the API operation graph is empty, lacks source lineage, or failed digest verification"
                    }]
            };
    }
}
