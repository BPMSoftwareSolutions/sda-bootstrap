import { deriveMechanicRequirements, PlatformResponsibilityResolver } from "../../../consumer-projection/authority/platform-responsibility-resolver.js";
export class ResolvePlatformResponsibilitiesProvider {
    repository;
    responsibilityId = "bind-required-mechanics-to-admitted-target-providers";
    constructor(repository) {
        this.repository = repository;
    }
    async execute(input) {
        const facts = input.sourceAdmission.facts;
        const resolver = new PlatformResponsibilityResolver(this.repository);
        const resolutions = {};
        for (const target of input.targets) {
            const requirements = deriveMechanicRequirements(facts.resolvedInterfaceAuthority, facts.mandatoryMechanicProfile.value, target);
            resolutions[target] = resolver.resolve({ requirements, projectionTarget: target, platformCapabilityCatalog: facts.platformCapabilityCatalog.value });
        }
        const values = input.targets.map((target) => resolutions[target]);
        return Object.freeze({
            evidenceType: "platform-responsibility-resolution-evidence.v1",
            resolutions,
            admittedPlatformCapabilities: Object.freeze(facts.platformCapabilityCatalog.value.capabilities.filter((capability) => input.targets.includes(capability.projectionTarget))),
            disposition: values.every((resolution) => resolution?.disposition === "RESOLVED") ? "RESOLVED" : "MISSING"
        });
    }
}
