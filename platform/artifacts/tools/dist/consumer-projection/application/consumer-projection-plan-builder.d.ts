import type { CanonicalScenarioGraphEvidence } from "../model/canonical-consumer-capability.js";
import type { ConsumerProjectionPlanEvidence } from "../model/consumer-projection-plan.js";
import type { PlatformResponsibilityResolutionEvidence } from "../model/platform-responsibility-resolution.js";
import type { ConsumerCrossApplyProofProfile, ConsumerProjectionTarget, ConsumerWorkspaceFacts } from "../model/consumer-workspace-facts.js";
import type { ConsumerApplicationProvider } from "../providers/consumer-application-provider.js";
export declare class ConsumerProjectionPlanBuilder {
    private readonly providers;
    constructor(providers: readonly ConsumerApplicationProvider[]);
    build(options: {
        readonly repositoryRoot: string;
        readonly facts: ConsumerWorkspaceFacts;
        readonly graph: CanonicalScenarioGraphEvidence;
        readonly responsibilityEvidence: PlatformResponsibilityResolutionEvidence;
        readonly targets: readonly ConsumerProjectionTarget[];
        readonly preserveUntargeted: boolean;
        readonly proofProfile?: ConsumerCrossApplyProofProfile;
    }): ConsumerProjectionPlanEvidence;
}
