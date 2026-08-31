export function isPublishProjectedCapabilityInput(value) {
    const input = value;
    return input?.plan?.planType === "consumer-projection-plan.v1" && input.sterility?.conformanceType === "projected-artifact-mechanical-sterility.v1";
}
export function isPublishProjectedCapabilityEvidence(value) {
    const evidence = value;
    return evidence?.evidenceType === "consumer-capability-publication-evidence.v1" && evidence.disposition === "PUBLISHED" &&
        typeof evidence.outputDirectory === "string" && Array.isArray(evidence.publishedFiles);
}
