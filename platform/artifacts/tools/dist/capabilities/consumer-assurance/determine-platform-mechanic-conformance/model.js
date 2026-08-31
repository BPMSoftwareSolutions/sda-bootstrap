export function isDeterminePlatformMechanicConformanceInput(value) {
    const input = value;
    return !!input?.authority && !!input.catalog && Array.isArray(input.bindings) && !!input.observations && !!input.currentProofDigests &&
        !!input.kernelAdmissions && input.availableCapabilityIds instanceof Set;
}
export function isDeterminePlatformMechanicConformanceEvidence(value) {
    const evidence = value;
    return evidence?.resolutionType === "sda-language-mechanic-profile-resolution.v1" && typeof evidence.profileId === "string" && Array.isArray(evidence.languages);
}
