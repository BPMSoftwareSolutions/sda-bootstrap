export class MechanicConformanceObserver {
    observe(input) {
        const languages = input.bindings.map((binding) => {
            if (!input.authority.appliesToBindingStatuses.includes(binding.status)) {
                return {
                    language: binding.language, bindingStatus: binding.status, kernelAdmission: "NOT_APPLICABLE",
                    consumerProofDigest: null, required: 0, resolved: 0, missing: [], resolutions: [], disposition: "NOT_APPLICABLE"
                };
            }
            const observation = input.observations[binding.language];
            const proofCurrent = observation?.conforming === true && observation.proofInputDigest === input.currentProofDigests[binding.language];
            const capabilities = input.catalog.capabilities.filter((capability) => capability.projectionTarget === binding.language && capability.status === "ADMITTED" && proofCurrent &&
                input.availableCapabilityIds.has(capability.capabilityId));
            const resolutions = input.authority.requiredMechanics.map((mechanicId) => {
                const providers = [...new Set(capabilities.filter((capability) => capability.providesMechanics.includes(mechanicId))
                        .map((capability) => capability.provider).sort())];
                return { mechanicId, status: providers.length ? "AVAILABLE" : "MISSING", providers };
            });
            const missing = resolutions.filter((resolution) => resolution.status === "MISSING").map((resolution) => resolution.mechanicId);
            return {
                language: binding.language,
                bindingStatus: binding.status,
                kernelAdmission: input.kernelAdmissions[binding.language] ?? "NOT_ADMITTED",
                consumerProofDigest: proofCurrent ? observation?.proofInputDigest : input.currentProofDigests[binding.language],
                required: resolutions.length,
                resolved: resolutions.length - missing.length,
                missing,
                resolutions,
                disposition: observation?.disposition === "NOT_OBSERVABLE" ? "NOT_OBSERVABLE" : missing.length ? "INCOMPLETE" : "COMPLETE"
            };
        });
        return Object.freeze({
            resolutionType: "sda-language-mechanic-profile-resolution.v1",
            profileId: input.authority.profileId,
            languages
        });
    }
}
