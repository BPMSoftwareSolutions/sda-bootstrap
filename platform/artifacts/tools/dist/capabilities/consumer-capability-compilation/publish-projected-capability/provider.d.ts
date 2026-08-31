import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ConsumerProjectionArtifactStore } from "../../../ports/consumer-projection/consumer-projection-artifact-store.js";
import type { PublishProjectedCapabilityEvidence, PublishProjectedCapabilityInput } from "./model.js";
export declare class PublishProjectedCapabilityProvider implements ResponsibilityProvider<PublishProjectedCapabilityInput, PublishProjectedCapabilityEvidence> {
    private readonly store;
    readonly responsibilityId = "atomically-publish-proven-consumer-projection";
    constructor(store: ConsumerProjectionArtifactStore);
    execute(input: PublishProjectedCapabilityInput): Promise<PublishProjectedCapabilityEvidence>;
}
