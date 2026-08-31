import { sign, verify } from "node:crypto";
import { sha256Digest } from "./canonical-json.js";
export function compileCapabilityBundle(input) {
    const unsigned = {
        bundleType: "sda-capability-bundle.v1",
        bundleId: input.bundleId,
        version: input.version,
        capability: input.capability,
        providerBindings: input.providerBindings,
        observationBindings: input.observationBindings,
        authorities: input.authorities
            .map(({ authorityId, mediaType, fact }) => ({
            authorityId,
            sourceRef: fact.sourceRef,
            mediaType,
            digest: fact.digest
        }))
            .sort((left, right) => left.authorityId.localeCompare(right.authorityId)),
        canonicalization: {
            algorithm: "RFC8785-JCS",
            hashAlgorithm: "sha256",
            mediaType: "application/json",
            excludedFields: ["bundleDigest", "signature"]
        },
        provenance: input.provenance,
        evidence: [...input.evidence].sort((left, right) => left.gate.localeCompare(right.gate))
    };
    return Object.freeze({ ...unsigned, bundleDigest: sha256Digest(unsigned) });
}
export function verifyCapabilityBundle(bundle) {
    const { bundleDigest, signature: _signature, ...unsigned } = bundle;
    return sha256Digest(unsigned) === bundleDigest;
}
export function signCapabilityBundle(bundle, privateKey, keyId) {
    if (!verifyCapabilityBundle(bundle))
        throw new Error("Cannot sign a bundle with an invalid content digest.");
    const value = sign(null, Buffer.from(bundle.bundleDigest, "utf8"), privateKey).toString("base64");
    return Object.freeze({
        ...bundle,
        signature: { algorithm: "Ed25519", keyId, value }
    });
}
export function verifyCapabilityBundleSignature(bundle, publicKey) {
    if (!bundle.signature || bundle.signature.algorithm !== "Ed25519" || !verifyCapabilityBundle(bundle))
        return false;
    return verify(null, Buffer.from(bundle.bundleDigest, "utf8"), publicKey, Buffer.from(bundle.signature.value, "base64"));
}
