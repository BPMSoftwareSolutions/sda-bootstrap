export interface ProofDigestArtifact {
    readonly proofInputDigest?: string;
}
export declare function isSha256Digest(value: unknown): value is string;
export declare function evidenceIsCurrent(expectedProofInputDigest: string, artifact: ProofDigestArtifact | null | undefined): boolean;
