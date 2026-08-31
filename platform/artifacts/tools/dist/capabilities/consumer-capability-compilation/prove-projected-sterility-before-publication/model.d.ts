import type { ConsumerProjectionPlan } from "../../../consumer-projection/model/consumer-projection-plan.js";
import type { MechanicalSterilityEvidence } from "../../../consumer-projection/proof/mechanical-sterility-evaluator.js";
export interface ProveProjectedSterilityBeforePublicationInput {
    readonly plan: ConsumerProjectionPlan;
}
export type ProveProjectedSterilityBeforePublicationEvidence = MechanicalSterilityEvidence;
export declare function isProveProjectedSterilityBeforePublicationInput(value: unknown): value is ProveProjectedSterilityBeforePublicationInput;
export declare function isProveProjectedSterilityBeforePublicationEvidence(value: unknown): value is ProveProjectedSterilityBeforePublicationEvidence;
