import { capabilityAvailabilityIsCoherent, digestLifecycleArtifact, realizationProofIsCoherent, stageEvidenceChainIsCoherent } from "../../../model/realization-lifecycle.js";
function compareText(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
function sortFinding(left, right) {
    return compareText(`${left.code}\u0000${left.detail}`, `${right.code}\u0000${right.detail}`);
}
export class VerifyRealizationLifecycleContractsProvider {
    responsibilityId = "verify-content-addressed-realization-lifecycle-contracts";
    async execute(fixture) {
        const findings = [];
        const { lineage, stages, proof, availability } = fixture;
        if (lineage.lineageDigest !== digestLifecycleArtifact(lineage, "lineageDigest")) {
            findings.push({ code: "LINEAGE_DIGEST_INVALID", detail: `lineage '${lineage.lineageId}' failed content-address verification` });
        }
        if (!stageEvidenceChainIsCoherent(stages)) {
            findings.push({ code: "STAGE_EVIDENCE_CHAIN_INVALID", detail: "stage evidence is not an ordered, content-addressed chain" });
        }
        if (!realizationProofIsCoherent(proof)) {
            findings.push({ code: "PROOF_INCOHERENT", detail: `proof '${proof.proofId}' is not coherent with its aggregate disposition` });
        }
        if (!capabilityAvailabilityIsCoherent(availability)) {
            findings.push({ code: "AVAILABILITY_INCOHERENT", detail: "derived availability violates registration or active-realization lifetime rules" });
        }
        const targetProof = proof.targetProofs.find((target) => target.targetId === lineage.target.targetId);
        if (proof.realizationId !== lineage.realizationId || proof.planId !== lineage.planId ||
            proof.planDigest !== lineage.planDigest || !targetProof ||
            targetProof.targetRealizationId !== lineage.targetRealizationId ||
            targetProof.lineageDigest !== lineage.lineageDigest ||
            targetProof.environmentProfileDigest !== lineage.target.environmentProfileDigest) {
            findings.push({ code: "LINEAGE_PROOF_MISMATCH", detail: "proof does not preserve the selected workload-to-intent lineage" });
        }
        const stageDigests = new Set(stages.map((stage) => stage.evidenceDigest));
        if (proof.stageEvidenceDigests.some((digest) => !stageDigests.has(digest))) {
            findings.push({ code: "PROOF_STAGE_EVIDENCE_MISSING", detail: "proof references stage evidence outside the supplied immutable chain" });
        }
        if (!availability.latestProof || availability.latestProof.proofId !== proof.proofId ||
            availability.latestProof.proofDigest !== proof.proofDigest ||
            availability.latestProof.disposition !== proof.aggregateDisposition) {
            findings.push({ code: "AVAILABILITY_PROOF_HISTORY_MISSING", detail: "availability does not preserve the latest immutable proof" });
        }
        const eviction = stages.find((stage) => stage.stage === "EVICTION" && stage.disposition === "SUCCEEDED");
        if (eviction && (availability.state !== "COLD" || availability.capabilityRegistration.state !== "REGISTERED" ||
            availability.activeTargetRealizationIds.length !== 0 ||
            !availability.derivationInputDigests.includes(eviction.evidenceDigest) ||
            !availability.derivationInputDigests.includes(proof.proofDigest) ||
            !availability.derivationInputDigests.includes(availability.capabilityRegistration.registrationDigest))) {
            findings.push({
                code: "EVICTION_COLD_AVAILABILITY_MISSING",
                detail: "successful eviction must derive cold availability while retaining registration and proof history"
            });
        }
        const artifactDigests = {
            lineageDigest: lineage.lineageDigest,
            stageEvidenceDigests: stages.map((stage) => stage.evidenceDigest),
            proofDigest: proof.proofDigest,
            availabilityDigest: availability.availabilityDigest
        };
        return findings.length === 0
            ? {
                evidenceType: "sda-realization-lifecycle-contract-evidence.v1",
                disposition: "COHERENT",
                artifactDigests,
                findings: []
            }
            : {
                evidenceType: "sda-realization-lifecycle-contract-evidence.v1",
                disposition: "BLOCKED",
                artifactDigests,
                findings: findings.sort(sortFinding)
            };
    }
}
