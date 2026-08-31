import type { PlatformCapabilityRepository } from "../../ports/consumer-projection/platform-capability-repository.js";
import type { MechanicRequirement } from "../../consumer-projection/model/platform-responsibility-resolution.js";
import type { ConsumerCrossApplyProofProfile, ConsumerProjectionTarget, PlatformCapability, PlatformCapabilityCatalog } from "../../consumer-projection/model/consumer-workspace-facts.js";
export declare class NodePlatformCapabilityRepository implements PlatformCapabilityRepository {
    private readonly repositoryRoot;
    private readonly proofProfile?;
    constructor(repositoryRoot: string, proofProfile?: ConsumerCrossApplyProofProfile | undefined);
    resolve(requirement: MechanicRequirement, target: ConsumerProjectionTarget, catalog: PlatformCapabilityCatalog): PlatformCapability | "IMPLEMENTATION_EVIDENCE_MISSING" | null;
}
