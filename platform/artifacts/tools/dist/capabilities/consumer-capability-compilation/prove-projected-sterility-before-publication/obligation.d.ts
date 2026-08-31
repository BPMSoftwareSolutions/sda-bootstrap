import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ProveProjectedSterilityBeforePublicationEvidence } from "./model.js";
export declare class ProveProjectedSterilityBeforePublicationObligation implements ObligationEvaluator<ProveProjectedSterilityBeforePublicationEvidence> {
    readonly obligationId = "every-planned-executable-file-has-an-explicit-sterility-disposition";
    evaluate(evidence: ProveProjectedSterilityBeforePublicationEvidence): ObligationDisposition;
}
