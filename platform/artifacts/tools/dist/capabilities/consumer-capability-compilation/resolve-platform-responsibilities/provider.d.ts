import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { PlatformCapabilityRepository } from "../../../ports/consumer-projection/platform-capability-repository.js";
import type { ResolvePlatformResponsibilitiesEvidence, ResolvePlatformResponsibilitiesInput } from "./model.js";
export declare class ResolvePlatformResponsibilitiesProvider implements ResponsibilityProvider<ResolvePlatformResponsibilitiesInput, ResolvePlatformResponsibilitiesEvidence> {
    private readonly repository;
    readonly responsibilityId = "bind-required-mechanics-to-admitted-target-providers";
    constructor(repository: PlatformCapabilityRepository);
    execute(input: ResolvePlatformResponsibilitiesInput): Promise<ResolvePlatformResponsibilitiesEvidence>;
}
