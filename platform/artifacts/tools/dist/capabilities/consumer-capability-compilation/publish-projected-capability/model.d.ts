import type { ConsumerProjectionPlan, ConsumerPublicationEvidence } from "../../../consumer-projection/model/consumer-projection-plan.js";
import type { MechanicalSterilityEvidence } from "../../../consumer-projection/proof/mechanical-sterility-evaluator.js";
export interface PublishProjectedCapabilityInput {
    readonly plan: ConsumerProjectionPlan;
    readonly sterility: MechanicalSterilityEvidence;
    readonly failureInjection?: "before-publish";
}
export type PublishProjectedCapabilityEvidence = ConsumerPublicationEvidence;
export declare function isPublishProjectedCapabilityInput(value: unknown): value is PublishProjectedCapabilityInput;
export declare function isPublishProjectedCapabilityEvidence(value: unknown): value is PublishProjectedCapabilityEvidence;
