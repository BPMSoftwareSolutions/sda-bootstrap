import type { CanonicalScenarioGraphEvidence } from "../../../consumer-projection/model/canonical-consumer-capability.js";
import type { ConsumerProjectionPlanEvidence } from "../../../consumer-projection/model/consumer-projection-plan.js";
import type { PlatformResponsibilityResolutionEvidence } from "../../../consumer-projection/model/platform-responsibility-resolution.js";
import type { ConsumerCrossApplyProofProfile, ConsumerProjectionTarget, ConsumerSourceAdmissionEvidence } from "../../../consumer-projection/model/consumer-workspace-facts.js";
export interface ConstructConsumerProjectionPlanInput {
    readonly sourceAdmission: ConsumerSourceAdmissionEvidence;
    readonly graph: CanonicalScenarioGraphEvidence;
    readonly responsibilityEvidence: PlatformResponsibilityResolutionEvidence;
    readonly targets: readonly ConsumerProjectionTarget[];
    readonly preserveUntargeted: boolean;
    readonly proofProfile?: ConsumerCrossApplyProofProfile;
}
export type ConstructConsumerProjectionPlanEvidence = ConsumerProjectionPlanEvidence;
export declare function isConstructConsumerProjectionPlanInput(value: unknown): value is ConstructConsumerProjectionPlanInput;
export declare function isConstructConsumerProjectionPlanEvidence(value: unknown): value is ConstructConsumerProjectionPlanEvidence;
