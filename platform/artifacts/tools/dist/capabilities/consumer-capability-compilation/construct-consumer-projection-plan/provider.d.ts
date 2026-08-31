import type { ConsumerApplicationProvider } from "../../../consumer-projection/providers/consumer-application-provider.js";
import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ConstructConsumerProjectionPlanEvidence, ConstructConsumerProjectionPlanInput } from "./model.js";
export declare class ConstructConsumerProjectionPlanProvider implements ResponsibilityProvider<ConstructConsumerProjectionPlanInput, ConstructConsumerProjectionPlanEvidence> {
    private readonly repositoryRoot;
    private readonly targetProviders;
    readonly responsibilityId = "construct-complete-in-memory-consumer-file-plan";
    constructor(repositoryRoot: string, targetProviders: readonly ConsumerApplicationProvider[]);
    execute(input: ConstructConsumerProjectionPlanInput): Promise<ConstructConsumerProjectionPlanEvidence>;
}
