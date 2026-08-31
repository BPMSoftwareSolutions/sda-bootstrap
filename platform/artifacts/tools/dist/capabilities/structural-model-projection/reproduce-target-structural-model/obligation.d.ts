import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ReproduceStructuralModelEvidence } from "./model.js";
export declare class ReproduceTargetStructuralModelObligation implements ObligationEvaluator<ReproduceStructuralModelEvidence> {
    readonly obligationId = "every-canonical-type-has-a-target-embodiment-and-deterministic-plan-bytes";
    evaluate(evidence: ReproduceStructuralModelEvidence): ObligationDisposition;
}
