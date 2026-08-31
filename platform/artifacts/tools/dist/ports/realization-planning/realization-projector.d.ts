import type { RealizationPlanProviderBinding, RealizationProjectionPlan } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
export interface RealizationProjectionPlanningInput {
    readonly planId: string;
    readonly targetId: string;
    readonly capabilityId: string;
    readonly capabilityBundleDigest: string;
    readonly interfaceAuthorityDigest: string;
    readonly contractDigests: readonly string[];
    readonly environmentProfileId: string;
    readonly environmentProfileDigest: string;
    readonly policyDecisionDigest: string;
    readonly projectorDigest: string;
    readonly providerBindings: readonly RealizationPlanProviderBinding[];
}
/** Pure planning boundary: describes expected artifacts without materializing them. */
export interface RealizationProjectorPort {
    planProjection(input: RealizationProjectionPlanningInput): Promise<RealizationProjectionPlan>;
}
