import type { CapabilityRegistration, EnvironmentProfile, RealizationPolicyDecision, RealizationPolicy } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
export interface RealizationPolicyDecisionInput {
    readonly planId: string;
    readonly targetId: string;
    readonly capabilityRegistration: CapabilityRegistration;
    readonly realizationPolicy: RealizationPolicy;
    readonly environmentProfile: EnvironmentProfile;
    readonly policySnapshotDigest: string;
}
/** Pure planning boundary: evaluates pinned authority and never changes a target. */
export interface RealizationPolicyDecisionPort {
    decide(input: RealizationPolicyDecisionInput): Promise<RealizationPolicyDecision>;
}
