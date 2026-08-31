import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { AdmitConsumerSourceFactsEvidence } from "./model.js";
export declare class AdmitConsumerSourceFactsObligation implements ObligationEvaluator<AdmitConsumerSourceFactsEvidence> {
    readonly obligationId = "every-required-consumer-source-is-admitted-with-provenance";
    evaluate(evidence: AdmitConsumerSourceFactsEvidence): ObligationDisposition;
}
