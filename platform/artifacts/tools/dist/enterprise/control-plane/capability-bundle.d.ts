import type { CapabilityV2, SourceFact } from "../../model/semantic-model.js";
import { type KeyObject } from "node:crypto";
export interface ProviderBindingAuthority {
    readonly bindingType: "responsibility-provider-bindings.v1";
    readonly bindings: readonly {
        readonly responsibilityId: string;
        readonly providerId: string;
        readonly implementationRef: string;
        readonly protocol?: "responsibility-provider-v1" | "projected-consumer-runtime-v2";
        readonly requires: readonly string[];
    }[];
}
export interface ObservationBindingAuthority {
    readonly bindingType: "observation-bindings.v1";
    readonly bindings: readonly {
        readonly conditionId: string;
        readonly evaluatorId: string;
        readonly evidenceContractId: string;
        readonly configurationRef?: string;
    }[];
}
export interface CapabilityBundle {
    readonly bundleType: "sda-capability-bundle.v1";
    readonly bundleId: string;
    readonly version: string;
    readonly capability: CapabilityV2;
    readonly providerBindings: ProviderBindingAuthority;
    readonly observationBindings: ObservationBindingAuthority;
    readonly authorities: readonly {
        readonly authorityId: string;
        readonly sourceRef: string;
        readonly mediaType: string;
        readonly digest: string;
    }[];
    readonly canonicalization: {
        readonly algorithm: "RFC8785-JCS";
        readonly hashAlgorithm: "sha256";
        readonly mediaType: "application/json";
        readonly excludedFields: readonly ["bundleDigest", "signature"];
    };
    readonly provenance: {
        readonly sourceRevision: string;
        readonly projectorDigest: string;
        readonly toolchain: string;
        readonly builtAt: string;
        readonly sbomRef?: string;
    };
    readonly evidence: readonly {
        readonly gate: string;
        readonly evidenceRef: string;
        readonly digest: string;
    }[];
    readonly bundleDigest: string;
    readonly signature?: {
        readonly algorithm: "Ed25519" | "SIGSTORE-BUNDLE";
        readonly keyId: string;
        readonly value: string;
    };
}
export interface BundleAuthorityInput {
    readonly authorityId: string;
    readonly mediaType: string;
    readonly fact: SourceFact<unknown>;
}
export type UnsignedCapabilityBundle = Omit<CapabilityBundle, "bundleDigest" | "signature">;
export declare function compileCapabilityBundle(input: {
    readonly bundleId: string;
    readonly version: string;
    readonly capability: CapabilityV2;
    readonly providerBindings: ProviderBindingAuthority;
    readonly observationBindings: ObservationBindingAuthority;
    readonly authorities: readonly BundleAuthorityInput[];
    readonly provenance: CapabilityBundle["provenance"];
    readonly evidence: CapabilityBundle["evidence"];
}): CapabilityBundle;
export declare function verifyCapabilityBundle(bundle: CapabilityBundle): boolean;
export declare function signCapabilityBundle(bundle: CapabilityBundle, privateKey: KeyObject, keyId: string): CapabilityBundle;
export declare function verifyCapabilityBundleSignature(bundle: CapabilityBundle, publicKey: KeyObject): boolean;
