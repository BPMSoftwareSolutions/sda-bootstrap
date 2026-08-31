import type { MechanicRequirement } from "../../consumer-projection/model/platform-responsibility-resolution.js";
import type { ConsumerProjectionTarget, PlatformCapability, PlatformCapabilityCatalog } from "../../consumer-projection/model/consumer-workspace-facts.js";
export interface PlatformCapabilityRepository {
    resolve(requirement: MechanicRequirement, target: ConsumerProjectionTarget, catalog: PlatformCapabilityCatalog): PlatformCapability | "IMPLEMENTATION_EVIDENCE_MISSING" | null;
}
