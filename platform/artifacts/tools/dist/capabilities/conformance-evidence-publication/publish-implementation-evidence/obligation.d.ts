import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { PublishImplementationEvidenceEvidence } from "./model.js";
export declare class PublishImplementationEvidenceObligation implements ObligationEvaluator<PublishImplementationEvidenceEvidence> {
    readonly obligationId = "published-evidence-includes-source-inputs-environment-dispositions-and-digest";
    evaluate(evidence: PublishImplementationEvidenceEvidence): ObligationDisposition;
}
