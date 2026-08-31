import type { PlatformCapabilityRepository } from "../../ports/consumer-projection/platform-capability-repository.js";
import type { MechanicRequirement, PlatformResponsibilityResolution } from "../model/platform-responsibility-resolution.js";
import type { ConsumerInterfaceAuthority, ConsumerProjectionTarget, MandatoryMechanicProfile, PlatformCapabilityCatalog } from "../model/consumer-workspace-facts.js";
export declare function deriveMechanicRequirements(interfaceAuthority: ConsumerInterfaceAuthority, mandatoryProfile: MandatoryMechanicProfile, projectionTarget: ConsumerProjectionTarget): readonly MechanicRequirement[];
export declare class PlatformResponsibilityResolver {
    private readonly repository;
    constructor(repository: PlatformCapabilityRepository);
    resolve(options: {
        readonly requirements: readonly MechanicRequirement[];
        readonly projectionTarget: ConsumerProjectionTarget;
        readonly platformCapabilityCatalog: PlatformCapabilityCatalog;
    }): PlatformResponsibilityResolution;
}
export declare function resolvePlatformMechanics(options: {
    readonly requirements: readonly MechanicRequirement[];
    readonly projectionTarget: ConsumerProjectionTarget;
    readonly platformCapabilityCatalog: PlatformCapabilityCatalog;
    readonly repository: PlatformCapabilityRepository;
}): PlatformResponsibilityResolution;
