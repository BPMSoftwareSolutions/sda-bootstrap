import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { RealizationPolicyDecisionPort } from "../../../ports/realization-planning/realization-policy-decision.js";
import type { RealizationProjectorPort } from "../../../ports/realization-planning/realization-projector.js";
import { type ConstructDeterministicRealizationPlanInput, type RealizationPlanCompilationEvidence } from "./model.js";
export declare class ConstructDeterministicRealizationPlanProvider implements ResponsibilityProvider<ConstructDeterministicRealizationPlanInput, RealizationPlanCompilationEvidence> {
    private readonly policyDecisionPort;
    private readonly projectorPort;
    readonly responsibilityId = "resolve-admitted-authority-into-target-plans";
    constructor(policyDecisionPort: RealizationPolicyDecisionPort, projectorPort: RealizationProjectorPort);
    execute(input: ConstructDeterministicRealizationPlanInput): Promise<RealizationPlanCompilationEvidence>;
}
