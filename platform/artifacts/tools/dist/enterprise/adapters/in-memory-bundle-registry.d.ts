import type { CapabilityBundle } from "../control-plane/capability-bundle.js";
import type { CapabilityBundleRegistry } from "../data-plane/ports.js";
export declare class InMemoryBundleRegistry implements CapabilityBundleRegistry {
    private readonly signatureVerifier?;
    private readonly requireSignature;
    private readonly bundles;
    constructor(signatureVerifier?: ((bundle: CapabilityBundle) => boolean) | undefined, requireSignature?: boolean);
    register(bundle: CapabilityBundle): void;
    resolve(bundleDigest: string): CapabilityBundle | null;
}
