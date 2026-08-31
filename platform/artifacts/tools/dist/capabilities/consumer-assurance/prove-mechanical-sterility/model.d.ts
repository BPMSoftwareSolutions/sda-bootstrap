import type { ConsumerProjectionPlan } from "../../../consumer-projection/model/consumer-projection-plan.js";
import type { MechanicalSterilityEvidence } from "../../../consumer-projection/proof/mechanical-sterility-evaluator.js";
export interface ProveMechanicalSterilityInput {
    readonly plan: ConsumerProjectionPlan;
}
export type ProveMechanicalSterilityEvidence = MechanicalSterilityEvidence;
export declare function isProveMechanicalSterilityInput(value: unknown): value is ProveMechanicalSterilityInput;
export declare function isProveMechanicalSterilityEvidence(value: unknown): value is ProveMechanicalSterilityEvidence;
