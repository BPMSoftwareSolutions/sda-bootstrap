import type { ConsumerProjectionArtifactStore } from "../../ports/consumer-projection/consumer-projection-artifact-store.js";
import type { ConsumerProjectionPlan, ConsumerPublicationEvidence } from "../../consumer-projection/model/consumer-projection-plan.js";
export declare class NodeConsumerProjectionArtifactStore implements ConsumerProjectionArtifactStore {
    private readonly repositoryRoot;
    constructor(repositoryRoot: string);
    publish(plan: ConsumerProjectionPlan, options?: {
        readonly failureInjection?: "before-publish";
    }): ConsumerPublicationEvidence;
}
