import { sha256Digest } from "../enterprise/control-plane/canonical-json.js";
export function digestLifecycleArtifact(value, digestField) {
    const digestable = { ...value };
    delete digestable[digestField];
    return sha256Digest(digestable);
}
export function stageEvidenceChainIsCoherent(stages) {
    if (stages.length === 0)
        return false;
    const ordered = [...stages].sort((left, right) => left.sequence - right.sequence);
    if (new Set(ordered.map((stage) => stage.sequence)).size !== ordered.length)
        return false;
    for (const [index, stage] of ordered.entries()) {
        if (stage.evidenceDigest !== digestLifecycleArtifact(stage, "evidenceDigest") ||
            stage.startedAt > stage.completedAt)
            return false;
        const previous = ordered[index - 1];
        if (index === 0 ? stage.previousStageEvidenceDigest !== null :
            stage.previousStageEvidenceDigest !== previous?.evidenceDigest)
            return false;
        if (previous && (stage.realizationId !== previous.realizationId ||
            stage.targetRealizationId !== previous.targetRealizationId))
            return false;
    }
    return true;
}
export function realizationProofIsCoherent(proof) {
    if (proof.proofDigest !== digestLifecycleArtifact(proof, "proofDigest") || proof.targetProofs.length === 0)
        return false;
    const targetSatisfied = proof.targetProofs.every((target) => target.disposition === "SATISFIED" &&
        target.lineageDisposition === "COMPLETE" &&
        target.obligations.length > 0 && target.obligations.every((item) => item.disposition === "SATISFIED") &&
        target.experiences.length > 0 && target.experiences.every((item) => item.disposition === "SATISFIED"));
    if (proof.aggregateDisposition === "SATISFIED") {
        const equivalenceSatisfied = proof.targetProofs.length === 1
            ? proof.crossTargetEquivalence.disposition === "NOT_APPLICABLE"
            : proof.crossTargetEquivalence.disposition === "SATISFIED";
        return targetSatisfied && equivalenceSatisfied;
    }
    return !targetSatisfied || proof.crossTargetEquivalence.disposition === "NOT_SATISFIED" ||
        proof.crossTargetEquivalence.disposition === "NOT_OBSERVABLE";
}
export function capabilityAvailabilityIsCoherent(availability) {
    if (availability.availabilityDigest !== digestLifecycleArtifact(availability, "availabilityDigest"))
        return false;
    if (availability.state === "COLD") {
        return availability.capabilityRegistration.state === "REGISTERED" && availability.eligible &&
            availability.activeTargetRealizationIds.length === 0;
    }
    if (availability.state === "REVOKED") {
        return availability.capabilityRegistration.state === "REVOKED" && !availability.eligible &&
            availability.activeTargetRealizationIds.length === 0;
    }
    if (["APPLYING", "ACTIVE", "PROVED", "DEGRADED"].includes(availability.state)) {
        return availability.activeTargetRealizationIds.length > 0;
    }
    return true;
}
