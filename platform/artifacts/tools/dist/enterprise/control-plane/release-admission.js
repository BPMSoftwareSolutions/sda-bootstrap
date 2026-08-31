export function evaluateReleaseAdmission(options) {
    if (options.requiredGates.length === 0) {
        throw new Error("A release policy must require at least one gate.");
    }
    if (new Set(options.requiredGates).size !== options.requiredGates.length) {
        throw new Error("Required release gates must be unique.");
    }
    if (!Number.isSafeInteger(options.maximumEvidenceAgeMilliseconds) || options.maximumEvidenceAgeMilliseconds < 0) {
        throw new Error("maximumEvidenceAgeMilliseconds must be a non-negative safe integer.");
    }
    const gateIdentities = options.gateEvidence.map((evidence) => evidence.gate);
    if (new Set(gateIdentities).size !== gateIdentities.length) {
        throw new Error("Release evidence contains duplicate gate identities.");
    }
    const decidedAt = options.clock.now();
    const decidedAtMilliseconds = Date.parse(decidedAt);
    const evidenceByGate = new Map(options.gateEvidence.map((evidence) => [evidence.gate, evidence]));
    const admitted = options.requiredGates.every((gate) => {
        const evidence = evidenceByGate.get(gate);
        if (!evidence || evidence.disposition !== "SATISFIED" || evidence.subjectDigest !== options.bundleDigest) {
            return false;
        }
        const observedAtMilliseconds = Date.parse(evidence.observedAt);
        const fresh = Number.isFinite(observedAtMilliseconds) &&
            observedAtMilliseconds <= decidedAtMilliseconds &&
            decidedAtMilliseconds - observedAtMilliseconds <= options.maximumEvidenceAgeMilliseconds;
        if (!fresh)
            return false;
        try {
            return options.evidenceTrustPolicy.verify(evidence, {
                environment: options.environment,
                bundleDigest: options.bundleDigest,
                decidedAt
            });
        }
        catch {
            return false;
        }
    });
    return {
        admissionType: "sda-release-admission.v1",
        environment: options.environment,
        bundleDigest: options.bundleDigest,
        requiredGates: [...options.requiredGates],
        evidenceFreshnessMilliseconds: options.maximumEvidenceAgeMilliseconds,
        gateEvidence: [...options.gateEvidence],
        disposition: admitted ? "RELEASE_ADMITTED" : "RELEASE_BLOCKED",
        decidedAt
    };
}
