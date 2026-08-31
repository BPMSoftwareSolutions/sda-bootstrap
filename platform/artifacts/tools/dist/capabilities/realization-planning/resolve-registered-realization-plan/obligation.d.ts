import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { RegistryBackedRealizationPlanEvidence } from "./model.js";
export declare class ResolveRegisteredRealizationPlanObligation implements ObligationEvaluator<RegistryBackedRealizationPlanEvidence> {
    readonly obligationId = "every-selector-resolves-to-pinned-authority-before-planning";
    evaluate(evidence: RegistryBackedRealizationPlanEvidence): ObligationDisposition;
}
