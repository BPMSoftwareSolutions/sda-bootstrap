import type { RealizationPolicyDecision } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
import type { RealizationPolicyDecisionInput, RealizationPolicyDecisionPort } from "../../ports/realization-planning/realization-policy-decision.js";
export declare class OnDemandRealizationPolicyDecision implements RealizationPolicyDecisionPort {
    decide(input: RealizationPolicyDecisionInput): Promise<RealizationPolicyDecision>;
}
