function requirement(mechanicId, capabilityKind, requiredBy, requestedCapabilityId) {
    return {
        mechanicId,
        capabilityKind,
        requiredBy,
        ...(requestedCapabilityId ? { requestedCapabilityId } : {})
    };
}
function appliesToTarget(bindingTargets, target) {
    return !bindingTargets || bindingTargets.includes(target);
}
function uiMechanics(binding) {
    if (binding.kind !== "ui")
        return [];
    const mechanics = new Set([
        "wpf-application-hosting",
        "declarative-view-materialization",
        "observable-view-state",
        "authority-binding-projection",
        "generic-command-dispatch",
        "experience-authority-projection",
        "interaction-authority-projection",
        "semantic-layout-projection",
        "accessibility-intent-projection"
    ]);
    const authority = binding.configuration?.authority;
    const interaction = authority?.interactionAuthority;
    const operations = Array.isArray(interaction?.operations)
        ? interaction.operations
        : [];
    for (const operation of operations) {
        if (operation.kind === "load-fixture")
            mechanics.add("fixture-input-delivery");
        if (operation.kind === "execute-capability")
            mechanics.add("scenario-command-dispatch");
        if (operation.kind === "execute-query")
            mechanics.add("query-command-dispatch");
        if (operation.kind === "cancel")
            mechanics.add("cancellation-command-dispatch");
    }
    const validation = Array.isArray(interaction?.validation) ? interaction.validation : [];
    if (validation.length > 0)
        mechanics.add("validation-semantic-enforcement");
    const navigation = Array.isArray(interaction?.navigation) ? interaction.navigation : [];
    if (navigation.length > 0)
        mechanics.add("navigation-semantic-projection");
    return Object.freeze([...mechanics]);
}
export function deriveMechanicRequirements(interfaceAuthority, mandatoryProfile, projectionTarget) {
    const requirements = [
        ...mandatoryProfile.requiredMechanics.map((mechanicId) => requirement(mechanicId, "consumer-runtime", `mandatory-profile:${mandatoryProfile.profileId}`)),
        requirement("contract-validation", "contract-validator", "scenario-contract-admission", interfaceAuthority.contractValidatorCapabilityId)
    ];
    for (const binding of interfaceAuthority.interfaces.filter((item) => appliesToTarget(item.projectionTargets, projectionTarget))) {
        requirements.push(requirement(`${binding.kind}-delivery`, "interface-delivery", `interface:${binding.interfaceId}`, binding.platformCapabilityId));
        for (const mechanicId of uiMechanics(binding)) {
            requirements.push(requirement(mechanicId, "interface-delivery", `interface:${binding.interfaceId}`, binding.platformCapabilityId));
        }
        if (binding.kind === "cli") {
            requirements.push(requirement("json-reading", "interface-delivery", `interface:${binding.interfaceId}`, binding.platformCapabilityId));
            requirements.push(requirement("json-serialization", "interface-delivery", `interface:${binding.interfaceId}`, binding.platformCapabilityId));
        }
    }
    for (const binding of interfaceAuthority.portBindings) {
        requirements.push(requirement("event-port-invocation", "event-port", `port:${binding.portId}`, binding.platformCapabilityId));
    }
    for (const binding of interfaceAuthority.projectionBindings) {
        requirements.push(requirement("state-projection", "state-projection", `projection:${binding.projectionId}`, binding.platformCapabilityId));
    }
    return Object.freeze(requirements);
}
function missing(requirementValue, reason) {
    return { ...requirementValue, status: "MISSING", reason };
}
export class PlatformResponsibilityResolver {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    resolve(options) {
        const resolutions = options.requirements.map((item) => {
            const found = this.repository.resolve(item, options.projectionTarget, options.platformCapabilityCatalog);
            if (!found)
                return missing(item, "CAPABILITY_NOT_FOUND");
            if (found === "IMPLEMENTATION_EVIDENCE_MISSING")
                return missing(item, found);
            if (found.projectionTarget !== options.projectionTarget)
                return missing(item, "TARGET_MISMATCH");
            if (found.kind !== item.capabilityKind && item.requestedCapabilityId)
                return missing(item, "KIND_MISMATCH");
            if (!found.providesMechanics.includes(item.mechanicId))
                return missing(item, "MECHANIC_NOT_PROVIDED");
            if (found.status !== "ADMITTED")
                return missing(item, "CAPABILITY_NOT_ADMITTED");
            return {
                ...item,
                status: "AVAILABLE",
                capabilityId: found.capabilityId,
                provider: found.provider,
                implementationRef: found.implementationRef,
                conformanceRef: found.conformanceRef
            };
        });
        return Object.freeze({
            resolutionType: "consumer-platform-mechanic-resolution.v1",
            projectionTarget: options.projectionTarget,
            requirements: options.requirements,
            resolutions: Object.freeze(resolutions),
            disposition: resolutions.every((resolution) => resolution.status === "AVAILABLE") ? "RESOLVED" : "MISSING"
        });
    }
}
export function resolvePlatformMechanics(options) {
    return new PlatformResponsibilityResolver(options.repository).resolve(options);
}
