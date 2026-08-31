import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { OpenApiProjectionEvidence } from "./model.js";
export declare class ProjectOpenApiDescriptionObligation implements ObligationEvaluator<OpenApiProjectionEvidence> {
    readonly obligationId = "every-graph-operation-contract-scope-response-and-lineage-field-survives-projection";
    evaluate(evidence: OpenApiProjectionEvidence): ObligationDisposition;
}
