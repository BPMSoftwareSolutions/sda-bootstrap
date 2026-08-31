export function isProveCrossApplyUiParityInput(value) {
    const input = value;
    return input?.identity?.identityType === "consumer-ui-authority-identity.v1" &&
        input.objectModel?.objectModelType === "consumer-ui-object-model.v1" &&
        input.vectors?.vectorCorpusType === "consumer-ui-vector-corpus.v1" &&
        input.coverage?.coverageType === "consumer-ui-experience-coverage.v1" && Array.isArray(input.claimants) && input.claimants.length >= 2 &&
        input.claimants.every((claimant) => claimant.target === claimant.testimony?.embodimentTarget &&
            claimant.target === claimant.presentation?.embodimentTarget && claimant.target === claimant.wiring?.embodimentTarget &&
            claimant.target === claimant.structure?.embodimentTarget && claimant.testimony?.testimonyType === "consumer-ui-testimony.v1" &&
            claimant.presentation?.presentationTestimonyType === "consumer-ui-presentation-testimony.v1" &&
            claimant.wiring?.wiringConformanceType === "consumer-ui-wiring-conformance.v1" &&
            claimant.structure?.structuralTestimonyType === "consumer-ui-structural-testimony.v1");
}
export function isProveCrossApplyUiParityEvidence(value) {
    const evidence = value;
    return evidence?.parityEvidenceType === "consumer-ui-parity-evidence.v1" && evidence.gates !== undefined && evidence.targetGates !== undefined;
}
