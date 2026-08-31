import type { RealizationPolicyDecision } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
import { type RealizationPolicyDecisionProfile } from "../../model/realization-planning-adapter-profile.js";
import type { RealizationPolicyDecisionInput, RealizationPolicyDecisionPort } from "../../ports/realization-planning/realization-policy-decision.js";
export declare class ProfiledRealizationPolicyDecision implements RealizationPolicyDecisionPort {
    private readonly profile;
    constructor(profile: RealizationPolicyDecisionProfile);
    decide(input: RealizationPolicyDecisionInput): Promise<RealizationPolicyDecision>;
}
