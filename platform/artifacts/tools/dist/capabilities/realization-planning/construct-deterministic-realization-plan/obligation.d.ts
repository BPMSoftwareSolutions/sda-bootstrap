import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { RealizationPlanCompilationEvidence } from "./model.js";
export declare class ConstructDeterministicRealizationPlanObligation implements ObligationEvaluator<RealizationPlanCompilationEvidence> {
    readonly obligationId = "planning-produces-one-content-addressed-plan-or-explicit-governed-findings";
    evaluate(evidence: RealizationPlanCompilationEvidence): ObligationDisposition;
}
