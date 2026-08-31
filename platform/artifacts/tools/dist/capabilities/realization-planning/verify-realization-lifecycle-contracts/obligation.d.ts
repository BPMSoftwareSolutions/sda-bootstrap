import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { RealizationLifecycleContractEvidence } from "./model.js";
export declare class VerifyRealizationLifecycleContractsObligation implements ObligationEvaluator<RealizationLifecycleContractEvidence> {
    readonly obligationId = "lifecycle-artifacts-preserve-causal-and-independent-lifetimes";
    evaluate(evidence: RealizationLifecycleContractEvidence): ObligationDisposition;
}
