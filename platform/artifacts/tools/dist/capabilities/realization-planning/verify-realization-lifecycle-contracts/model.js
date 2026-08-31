export function isRealizationLifecycleFixture(value) {
    if (!value || typeof value !== "object")
        return false;
    const fixture = value;
    return fixture.fixtureType === "sda-realization-lifecycle-fixture.v1" &&
        !!fixture.lineage && Array.isArray(fixture.stages) && fixture.stages.length > 0 &&
        !!fixture.proof && !!fixture.availability;
}
export function isRealizationLifecycleContractEvidence(value) {
    if (!value || typeof value !== "object")
        return false;
    const evidence = value;
    return evidence.evidenceType === "sda-realization-lifecycle-contract-evidence.v1" &&
        (evidence.disposition === "COHERENT" || evidence.disposition === "BLOCKED") &&
        !!evidence.artifactDigests && Array.isArray(evidence.findings) &&
        (evidence.disposition === "COHERENT" ? evidence.findings.length === 0 : evidence.findings.length > 0);
}
