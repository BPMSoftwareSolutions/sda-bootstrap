import { type DeclaredSemanticElement } from "./declared-ui-presentation-resolver.js";
type Digest = `sha256:${string}`;
type EvidenceCapability = "ACCESSIBILITY" | "ADAPTATION" | "OBSERVATION";
type RequirementCategory = "COMPOSITION" | "CONTENT" | "INTERACTION" | "ADAPTATION" | "ACCESSIBILITY" | "PROFILE" | "TOKEN";
interface PresentationIrV3 {
    readonly presentationIrType: "sda-ui-presentation-ir.v3";
    readonly protocolIdentity: Readonly<{
        semanticPresentationDigest: Digest;
        compilerAuthorityDigest: Digest;
    }>;
    readonly rootNodeIds: readonly string[];
    readonly presentationProfileRefs: readonly string[];
    readonly nodes: readonly Readonly<{
        nodeId: string;
        configuration: Readonly<{
            kind: string;
            [key: string]: unknown;
        }>;
        childNodeIds: readonly string[];
        semanticElementRefs: readonly string[];
    }>[];
    readonly eventBindings: readonly Readonly<{
        bindingId: string;
        semanticElementRef: string;
        semanticEventRef: string;
        trigger: string;
    }>[];
    readonly adaptationRules: readonly Readonly<{
        ruleId: string;
        semanticAdaptationRef: string;
        contextRef: string;
        operations: readonly Readonly<{
            kind: string;
            nodeRefs: readonly string[];
        }>[];
        invariantRefs: readonly string[];
    }>[];
    readonly accessibilityObligations: readonly Readonly<{
        obligationRef: string;
        semanticElementRef: string;
        kind: string;
    }>[];
    readonly tokenReferences: readonly Readonly<{
        tokenRef: string;
        semanticPurpose: string;
        profileRef: string;
    }>[];
    readonly canonicalDigest: Digest;
}
interface SemanticPresentationForPlan {
    readonly presentationType: "sda-ui-semantic-presentation.v1";
    readonly presentationId: string;
    readonly elements: readonly DeclaredSemanticElement[];
    readonly presentationProfileRefs: readonly string[];
    readonly canonicalDigest: Digest;
}
export interface UiCapabilityRequirement {
    readonly capabilityId: string;
    readonly category: RequirementCategory;
    readonly sourceRefs: readonly string[];
    readonly evidenceRequirements: readonly EvidenceCapability[];
}
export interface UiCapabilityVector {
    readonly vectorType: "ui-capability-vector.v1";
    readonly sourcePresentationIrType: "sda-ui-presentation-ir.v3";
    readonly sourcePresentationIrDigest: Digest;
    readonly requirements: readonly UiCapabilityRequirement[];
    readonly canonicalDigest: Digest;
}
export interface UiTargetProfile {
    readonly profileType: "ui-target-profile.v1";
    readonly targetId: string;
    readonly targetKind: string;
    readonly requestedProviderId: string | null;
    readonly requiredEvidenceCapabilities: readonly EvidenceCapability[];
    readonly canonicalDigest: Digest;
}
export interface ProviderFeature {
    readonly capabilityId: string;
    readonly mechanicId: string;
    readonly versionRange: "1.x";
}
export interface UiEmbodimentProvider {
    readonly providerId: string;
    readonly providerVersion: string;
    readonly providerDigest: Digest;
    readonly admissionStatus: "PLANNING_ONLY" | "PROVIDER_ADMITTED" | "NATIVE_PROOF_ADMITTED";
    readonly targetKinds: readonly string[];
    readonly priority: number;
    readonly features: readonly ProviderFeature[];
    readonly evidenceCapabilities: readonly EvidenceCapability[];
    readonly observationCapability: "PLAN_ONLY" | "STRUCTURAL" | "NATIVE";
    readonly knownConstraints: readonly string[];
    readonly implementationRef: string;
}
export interface UiEmbodimentProviderRegistryV2 {
    readonly registryType: "ui-embodiment-provider-registry.v2";
    readonly protocolType: "sda-ui-presentation-ir.v3";
    readonly protocolSchemaDigest: Digest;
    readonly providers: readonly UiEmbodimentProvider[];
    readonly catalogDigest: Digest;
}
export declare function capabilityVectorDigest(value: object): Digest;
export declare function targetProfileDigest(value: object): Digest;
export declare function providerCatalogDigest(value: object): Digest;
export declare function providerDigest(value: object): Digest;
export declare function embodimentPlanDigest(value: object): Digest;
export declare function resolveUiEmbodimentRequirements(ir: PresentationIrV3): UiCapabilityVector;
type ResolutionFindingCode = "CAPABILITY_VECTOR_DIGEST_MISMATCH" | "TARGET_PROFILE_DIGEST_MISMATCH" | "PROVIDER_CATALOG_DIGEST_MISMATCH" | "PROVIDER_DIGEST_MISMATCH" | "REQUESTED_PROVIDER_NOT_FOUND" | "NO_COMPATIBLE_PROVIDER" | "AMBIGUOUS_PROVIDER";
export declare function resolveUiEmbodimentProvider(vector: UiCapabilityVector, profile: UiTargetProfile, registry: UiEmbodimentProviderRegistryV2): Readonly<{
    resolutionType: "provider-resolution.v1";
    capabilityVectorDigest: `sha256:${string}`;
    targetProfileDigest: `sha256:${string}`;
    providerCatalogDigest: `sha256:${string}`;
    selectedProviderId: string | null;
    selectedProviderDigest: `sha256:${string}` | null;
    findings: Readonly<{
        code: ResolutionFindingCode;
        subjectRef: string;
    }>[];
    disposition: "REJECTED" | "SELECTED";
}>;
export declare function planUiEmbodiment(presentation: SemanticPresentationForPlan, ir: PresentationIrV3, vector: UiCapabilityVector, profile: UiTargetProfile, registry: UiEmbodimentProviderRegistryV2): Readonly<{
    resolution: Readonly<{
        resolutionType: "provider-resolution.v1";
        capabilityVectorDigest: `sha256:${string}`;
        targetProfileDigest: `sha256:${string}`;
        providerCatalogDigest: `sha256:${string}`;
        selectedProviderId: string | null;
        selectedProviderDigest: `sha256:${string}` | null;
        findings: Readonly<{
            code: ResolutionFindingCode;
            subjectRef: string;
        }>[];
        disposition: "REJECTED" | "SELECTED";
    }>;
}>;
export {};
