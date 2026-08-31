import type { RealizationLifecycleFixture } from "../../../model/realization-lifecycle.js";
export type LifecycleContractFindingCode = "AVAILABILITY_INCOHERENT" | "AVAILABILITY_PROOF_HISTORY_MISSING" | "EVICTION_COLD_AVAILABILITY_MISSING" | "LINEAGE_DIGEST_INVALID" | "LINEAGE_PROOF_MISMATCH" | "PROOF_INCOHERENT" | "PROOF_STAGE_EVIDENCE_MISSING" | "STAGE_EVIDENCE_CHAIN_INVALID";
export interface LifecycleContractFinding {
    readonly code: LifecycleContractFindingCode;
    readonly detail: string;
}
export interface RealizationLifecycleContractEvidence {
    readonly evidenceType: "sda-realization-lifecycle-contract-evidence.v1";
    readonly disposition: "COHERENT" | "BLOCKED";
    readonly artifactDigests: {
        readonly lineageDigest: string;
        readonly stageEvidenceDigests: readonly string[];
        readonly proofDigest: string;
        readonly availabilityDigest: string;
    };
    readonly findings: readonly LifecycleContractFinding[];
}
export declare function isRealizationLifecycleFixture(value: unknown): value is RealizationLifecycleFixture;
export declare function isRealizationLifecycleContractEvidence(value: unknown): value is RealizationLifecycleContractEvidence;
