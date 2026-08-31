import type { JsonRecord } from "../../consumer-projection/model/consumer-workspace-facts.js";
import type { UiEmbodimentTarget } from "../model/ui-parity.js";
export interface UiFeatureRequirement {
    readonly featureId: string;
    readonly authorityPaths: readonly string[];
}
export interface UiFeatureProfile {
    readonly profileId: string;
    readonly extends?: string;
    readonly featureIds: readonly string[];
}
export interface UiFeatureProviderProfile {
    readonly capabilityId: string;
    readonly embodimentTarget: UiEmbodimentTarget;
    readonly featureProfileId: string;
    readonly evidenceRefs: readonly string[];
    readonly adaptedFeatures?: readonly {
        readonly featureId: string;
        readonly adaptationId: string;
        readonly evidenceRefs: readonly string[];
    }[];
}
export interface UiEmbodimentFeatureCatalog {
    readonly catalogType: "sda-ui-embodiment-feature-catalog.v1";
    readonly protocol: {
        readonly authorityType: "consumer-ui-authority.v1";
        readonly schemaRef: string;
        readonly schemaDigest: `sha256:${string}`;
    };
    readonly profiles: readonly UiFeatureProfile[];
    readonly providers: readonly UiFeatureProviderProfile[];
}
export interface UiFeatureResolution {
    readonly featureId: string;
    readonly authorityPaths: readonly string[];
    readonly disposition: "SUPPORTED" | "ADAPTED" | "NOT_SUPPORTED";
    readonly adaptationId: string | null;
    readonly evidenceRefs: readonly string[];
}
export interface UiFeatureAdmissionEvidence {
    readonly evidenceType: "sda-ui-feature-admission-evidence.v1";
    readonly authorityType: "consumer-ui-authority.v1";
    readonly capabilityId: string;
    readonly embodimentTarget: UiEmbodimentTarget;
    readonly featureProfileId: string;
    readonly requiredFeatureCount: number;
    readonly resolutions: readonly UiFeatureResolution[];
    readonly disposition: "SUPPORTED" | "NOT_SUPPORTED";
}
export declare function collectUiFeatureRequirements(authority: JsonRecord): readonly UiFeatureRequirement[];
export declare function resolveUiFeatureCapabilities(authority: JsonRecord, catalog: UiEmbodimentFeatureCatalog, target: UiEmbodimentTarget, capabilityId?: string): UiFeatureAdmissionEvidence;
