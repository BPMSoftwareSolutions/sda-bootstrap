export type RealizationProofDisposition = "SATISFIED" | "NOT_SATISFIED" | "NOT_OBSERVABLE";
export interface CausalRealizationLineage {
    readonly lineageType: "sda-causal-realization-lineage.v1";
    readonly lineageId: string;
    readonly targetRealizationId: string;
    readonly realizationId: string;
    readonly planId: string;
    readonly planDigest: string;
    readonly target: {
        readonly targetId: string;
        readonly environmentProfileDigest: string;
    };
    readonly policyDecisionDigest: string;
    readonly lineageDigest: string;
    readonly [member: string]: unknown;
}
export interface RealizationStageEvidence {
    readonly stageEvidenceType: "sda-realization-stage-evidence.v1";
    readonly stageEvidenceId: string;
    readonly realizationId: string;
    readonly targetRealizationId: string;
    readonly targetId: string;
    readonly stage: "ADMISSION" | "RESOLUTION" | "PROJECTION" | "DISPATCH" | "APPLY" | "OBSERVATION" | "PROOF" | "EVICTION";
    readonly disposition: "SUCCEEDED" | "BLOCKED" | "FAILED" | "NOT_OBSERVABLE" | "SKIPPED";
    readonly sequence: number;
    readonly startedAt: string;
    readonly completedAt: string;
    readonly previousStageEvidenceDigest: string | null;
    readonly evidenceDigest: string;
    readonly [member: string]: unknown;
}
export interface RealizationTargetProof {
    readonly targetId: string;
    readonly targetRealizationId: string;
    readonly lineageDigest: string;
    readonly lineageDisposition: "COMPLETE" | "INCOMPLETE";
    readonly obligations: readonly {
        readonly disposition: RealizationProofDisposition;
    }[];
    readonly experiences: readonly {
        readonly disposition: RealizationProofDisposition;
    }[];
    readonly disposition: RealizationProofDisposition;
    readonly [member: string]: unknown;
}
export interface RealizationProof {
    readonly proofType: "sda-realization-proof.v1";
    readonly proofId: string;
    readonly realizationId: string;
    readonly planId: string;
    readonly planDigest: string;
    readonly targetProofs: readonly RealizationTargetProof[];
    readonly crossTargetEquivalence: {
        readonly disposition: RealizationProofDisposition | "NOT_APPLICABLE";
    };
    readonly aggregateDisposition: RealizationProofDisposition;
    readonly stageEvidenceDigests: readonly string[];
    readonly proofDigest: string;
    readonly [member: string]: unknown;
}
export interface CapabilityAvailability {
    readonly availabilityType: "sda-capability-availability.v1";
    readonly capabilityRegistration: {
        readonly registrationId: string;
        readonly registrationDigest: string;
        readonly state: "REGISTERED" | "DEPRECATED" | "REVOKED";
    };
    readonly eligible: boolean;
    readonly state: "COLD" | "APPLYING" | "ACTIVE" | "PROVED" | "DEGRADED" | "UNAVAILABLE" | "REVOKED";
    readonly activeTargetRealizationIds: readonly string[];
    readonly latestProof: null | {
        readonly proofId: string;
        readonly proofDigest: string;
        readonly disposition: RealizationProofDisposition;
    };
    readonly derivationInputDigests: readonly string[];
    readonly availabilityDigest: string;
    readonly [member: string]: unknown;
}
export interface RealizationLifecycleFixture {
    readonly fixtureType: "sda-realization-lifecycle-fixture.v1";
    readonly lineage: CausalRealizationLineage;
    readonly stages: readonly RealizationStageEvidence[];
    readonly proof: RealizationProof;
    readonly availability: CapabilityAvailability;
}
export declare function digestLifecycleArtifact(value: object, digestField: string): string;
export declare function stageEvidenceChainIsCoherent(stages: readonly RealizationStageEvidence[]): boolean;
export declare function realizationProofIsCoherent(proof: RealizationProof): boolean;
export declare function capabilityAvailabilityIsCoherent(availability: CapabilityAvailability): boolean;
