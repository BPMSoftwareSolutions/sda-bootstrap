import type { ConsumerProjectionPlan, ConsumerPublicationEvidence } from "../../consumer-projection/model/consumer-projection-plan.js";
export interface ConsumerProjectionArtifactStore {
    publish(plan: ConsumerProjectionPlan, options?: {
        readonly failureInjection?: "before-publish";
    }): ConsumerPublicationEvidence;
}
