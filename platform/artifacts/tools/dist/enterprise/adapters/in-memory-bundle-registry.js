import { verifyCapabilityBundle } from "../control-plane/capability-bundle.js";
export class InMemoryBundleRegistry {
    signatureVerifier;
    requireSignature;
    bundles = new Map();
    constructor(signatureVerifier, requireSignature = false) {
        this.signatureVerifier = signatureVerifier;
        this.requireSignature = requireSignature;
    }
    register(bundle) {
        if (!verifyCapabilityBundle(bundle))
            throw new Error(`Bundle '${bundle.bundleId}' failed digest verification.`);
        if (this.requireSignature && !bundle.signature)
            throw new Error(`Bundle '${bundle.bundleId}' is unsigned.`);
        if (bundle.signature && (!this.signatureVerifier || !this.signatureVerifier(bundle))) {
            throw new Error(`Bundle '${bundle.bundleId}' failed signature verification.`);
        }
        const existing = this.bundles.get(bundle.bundleDigest);
        if (existing && existing !== bundle)
            throw new Error(`Bundle digest collision for '${bundle.bundleDigest}'.`);
        this.bundles.set(bundle.bundleDigest, bundle);
    }
    resolve(bundleDigest) {
        return this.bundles.get(bundleDigest) ?? null;
    }
}
