export function isSha256Digest(value) {
    return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}
export function evidenceIsCurrent(expectedProofInputDigest, artifact) {
    return isSha256Digest(expectedProofInputDigest) &&
        isSha256Digest(artifact?.proofInputDigest) &&
        artifact.proofInputDigest === expectedProofInputDigest;
}
