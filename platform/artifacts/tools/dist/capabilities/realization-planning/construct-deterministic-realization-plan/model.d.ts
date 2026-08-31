export type RegistrationState = "REGISTERED" | "DEPRECATED" | "REVOKED";
export interface IntentAuthority {
    readonly authorityType: "sda-intent-authority.v1";
    readonly intentId: string;
    readonly version: string;
    readonly statement: string;
    readonly capabilityId: string;
    readonly requiredScenarioIds: readonly string[];
    readonly requiredObligationIds: readonly string[];
    readonly requiredExperienceIds: readonly string[];
    readonly admissionEvidenceDigest: string;
    readonly authorityDigest: string;
}
export interface CapabilityRelease {
    readonly releaseId: string;
    readonly aliases: readonly string[];
    readonly bundleDigest: string;
}
export interface CapabilityRegistration {
    readonly registrationType: "sda-capability-registration.v1";
    readonly registrationId: string;
    readonly capabilityId: string;
    readonly state: RegistrationState;
    readonly releases: readonly CapabilityRelease[];
    readonly defaultRealizationPolicyId: string;
    readonly allowedRealizationPolicyIds: readonly string[];
    readonly allowedEnvironmentProfileIds: readonly string[];
    readonly ownerId: string;
    readonly admissionEvidenceDigest: string;
    readonly registrationDigest: string;
}
export interface RealizationPolicy {
    readonly realizationPolicyType: "sda-realization-policy.v1";
    readonly policyId: string;
    readonly version: string;
    readonly activation: {
        readonly mode: "ALWAYS_WARM" | "ON_DEMAND" | "EVENT_DRIVEN" | "SCHEDULED";
    };
    readonly retention: {
        readonly warmFor: string;
        readonly idleDisposition: "RETAIN" | "EVICT" | "HIBERNATE";
    };
    readonly capacity: {
        readonly minimumWarmInstances: number;
        readonly scaleToZero: boolean;
    };
    readonly rehydration: {
        readonly mode: "AUTOMATIC" | "APPROVAL_REQUIRED" | "MANUAL";
    };
    readonly placement: {
        readonly mode: "PROFILE_RESOLVED" | "REMOTE_ONLY";
    };
    readonly admissionEvidenceDigest: string;
    readonly policyDigest: string;
}
export interface EnvironmentProfile {
    readonly environmentProfileType: "sda-environment-profile.v1";
    readonly profileId: string;
    readonly version: string;
    readonly environmentClass: "SIMULATION" | "INTEGRATION" | "STAGING" | "PRODUCTION" | "DISASTER_RECOVERY" | "EDGE";
    readonly supportedMechanics: readonly string[];
    readonly permittedProviderClasses: readonly string[];
    readonly admissionEvidenceDigest: string;
    readonly profileDigest: string;
}
export interface ProviderDeclaration {
    readonly providerId: string;
    readonly providerClass: string;
    readonly implementationDigest: string;
    readonly responsibilityIds: readonly string[];
    readonly environmentProfileIds: readonly string[];
    readonly mechanics: readonly string[];
}
export interface ProviderCatalogSnapshot {
    readonly catalogType: "sda-provider-catalog-snapshot.v1";
    readonly catalogId: string;
    readonly providers: readonly ProviderDeclaration[];
    readonly catalogDigest: string;
}
export interface CapabilityGraphEntry {
    readonly scenarioId: string;
    readonly responsibilityId: string;
    readonly obligationId: string;
    readonly experienceId: string;
    readonly requiredMechanics: readonly string[];
}
export interface RealizationPlanRequest {
    readonly requestType: "sda-realization-plan-request.v1";
    readonly requestId: string;
    readonly planId: string;
    readonly intentId: string;
    readonly registrationId: string;
    readonly releaseId: string;
    readonly realizationPolicyId: string;
    readonly targets: readonly {
        readonly targetId: string;
        readonly environmentProfileId: string;
    }[];
}
export interface ConstructDeterministicRealizationPlanInput {
    readonly inputType: "construct-deterministic-realization-plan-input.v1";
    readonly request: RealizationPlanRequest;
    readonly intentAuthority: IntentAuthority;
    readonly capabilityRegistration: CapabilityRegistration;
    readonly realizationPolicy: RealizationPolicy;
    readonly environmentProfiles: readonly EnvironmentProfile[];
    readonly capabilityGraph: readonly CapabilityGraphEntry[];
    readonly capabilityGraphDigest: string;
    readonly providerCatalog: ProviderCatalogSnapshot;
    readonly interfaceAuthorityDigest: string;
    readonly contractDigests: readonly string[];
    readonly policySnapshotDigest: string;
    readonly projectorDigest: string;
}
export interface RealizationPlanProviderBinding {
    readonly scenarioId: string;
    readonly responsibilityId: string;
    readonly obligationId: string;
    readonly experienceId: string;
    readonly requiredMechanics: readonly string[];
    readonly providerId: string;
    readonly providerClass: string;
    readonly implementationDigest: string;
}
export type RealizationPolicyDecisionReasonCode = "ACTIVATION_MODE_UNSUPPORTED" | "IDLE_DISPOSITION_UNSUPPORTED" | "ENVIRONMENT_CLASS_UNSUPPORTED" | "MINIMUM_WARM_CAPACITY_UNSUPPORTED" | "PLACEMENT_MODE_UNSUPPORTED" | "REHYDRATION_MODE_UNSUPPORTED";
export interface RealizationPolicyDecision {
    readonly decisionType: "sda-realization-policy-decision.v1";
    readonly decisionId: string;
    readonly targetId: string;
    readonly registrationDigest: string;
    readonly realizationPolicyId: string;
    readonly realizationPolicyDigest: string;
    readonly environmentProfileId: string;
    readonly environmentProfileDigest: string;
    readonly policySnapshotDigest: string;
    readonly disposition: "PERMITTED" | "DENIED";
    readonly activationMode: RealizationPolicy["activation"]["mode"];
    readonly placementMode: RealizationPolicy["placement"]["mode"];
    readonly idleDisposition: RealizationPolicy["retention"]["idleDisposition"];
    readonly reasonCodes: readonly RealizationPolicyDecisionReasonCode[];
    readonly evaluatorId: string;
    readonly evaluatorDigest: string;
    readonly decisionDigest: string;
}
export interface RealizationProjectionAction {
    readonly actionType: "PROJECT_PROVIDER_ARTIFACT";
    readonly actionId: string;
    readonly scenarioId: string;
    readonly responsibilityId: string;
    readonly providerId: string;
    readonly implementationDigest: string;
    readonly inputDigests: readonly string[];
    readonly artifact: {
        readonly artifactId: string;
        readonly mediaType: "application/vnd.scenario-driven.realization-provider+json";
        readonly expectedDigest: string;
    };
}
export interface RealizationProjectionPlan {
    readonly projectionType: "sda-realization-projection-plan.v1";
    readonly projectionId: string;
    readonly targetId: string;
    readonly environmentProfileId: string;
    readonly environmentProfileDigest: string;
    readonly projectorId: string;
    readonly projectorDigest: string;
    readonly projectorProfileDigest: string;
    readonly actions: readonly RealizationProjectionAction[];
    readonly projectionDigest: string;
}
export interface RealizationTargetResolution {
    readonly targetResolutionType: "sda-realization-target-resolution.v1";
    readonly targetId: string;
    readonly environmentProfileId: string;
    readonly environmentProfileDigest: string;
    readonly providerBindings: readonly RealizationPlanProviderBinding[];
    readonly policyDecision: RealizationPolicyDecision;
    readonly projection: RealizationProjectionPlan;
}
export interface RealizationPlan {
    readonly planType: "sda-realization-plan.v1";
    readonly planId: string;
    readonly intent: {
        readonly intentId: string;
        readonly version: string;
        readonly authorityDigest: string;
    };
    readonly capabilityRegistration: {
        readonly registrationId: string;
        readonly registrationDigest: string;
    };
    readonly capabilityRelease: {
        readonly capabilityId: string;
        readonly releaseId: string;
        readonly bundleDigest: string;
    };
    readonly realizationPolicy: {
        readonly policyId: string;
        readonly version: string;
        readonly policyDigest: string;
    };
    readonly interfaceAuthorityDigest: string;
    readonly contractDigests: readonly string[];
    readonly capabilityGraphDigest: string;
    readonly policySnapshotDigest: string;
    readonly providerCatalogId: string;
    readonly providerCatalogDigest: string;
    readonly projectorDigest: string;
    readonly targetResolutions: readonly RealizationTargetResolution[];
    readonly provenance: {
        readonly compilerId: "typescript-deterministic-realization-plan-provider.v1";
        readonly canonicalization: "RFC8785";
        readonly digestAlgorithm: "sha256";
    };
    readonly planDigest: string;
}
export type RealizationPlanFindingCode = "AUTHORITY_DIGEST_MISMATCH" | "CAPABILITY_GRAPH_DIGEST_MISMATCH" | "CAPABILITY_GRAPH_MISMATCH" | "DUPLICATE_ENVIRONMENT_PROFILE" | "DUPLICATE_GRAPH_ENTRY" | "DUPLICATE_PROVIDER" | "DUPLICATE_RELEASE" | "DUPLICATE_TARGET" | "ENVIRONMENT_PROFILE_NOT_FOUND" | "ENVIRONMENT_PROFILE_NOT_PERMITTED" | "ENVIRONMENT_PROFILE_SELECTOR_CONFLICT" | "EXTERNAL_DIGEST_INVALID" | "INTENT_MISMATCH" | "POLICY_MISMATCH" | "POLICY_NOT_PERMITTED" | "POLICY_DECISION_DENIED" | "POLICY_DECISION_FAILED" | "POLICY_DECISION_INVALID" | "PROFILE_MECHANIC_UNSUPPORTED" | "PROJECTOR_FAILED" | "PROJECTOR_OUTPUT_INVALID" | "PROVIDER_AMBIGUOUS" | "PROVIDER_NOT_FOUND" | "CAPABILITY_GRAPH_SELECTOR_NOT_FOUND" | "ENVIRONMENT_PROFILE_SELECTOR_NOT_FOUND" | "INTENT_SELECTOR_NOT_FOUND" | "PLANNING_SNAPSHOT_SELECTOR_NOT_FOUND" | "POLICY_SELECTOR_NOT_FOUND" | "PROVIDER_CATALOG_SELECTOR_NOT_FOUND" | "REGISTRATION_SELECTOR_NOT_FOUND" | "RELEASE_SELECTOR_AMBIGUOUS" | "RELEASE_SELECTOR_NOT_FOUND" | "SELECTOR_DIGEST_STALE" | "SNAPSHOT_CAPABILITY_MISMATCH" | "REGISTRATION_MISMATCH" | "REGISTRATION_NOT_ELIGIBLE" | "RELEASE_NOT_FOUND";
export interface RealizationPlanFinding {
    readonly code: RealizationPlanFindingCode;
    readonly detail: string;
    readonly targetId?: string;
    readonly responsibilityId?: string;
}
export type RealizationPlanCompilationEvidence = {
    readonly evidenceType: "sda-realization-plan-compilation-evidence.v1";
    readonly disposition: "PLANNED";
    readonly findings: readonly [];
    readonly plan: RealizationPlan;
} | {
    readonly evidenceType: "sda-realization-plan-compilation-evidence.v1";
    readonly disposition: "BLOCKED";
    readonly findings: readonly RealizationPlanFinding[];
};
export declare function digestWithoutField(value: object, digestField: string): string;
export declare function digestCapabilityGraph(entries: readonly CapabilityGraphEntry[]): string;
export declare function isConstructDeterministicRealizationPlanInput(value: unknown): value is ConstructDeterministicRealizationPlanInput;
export declare function isRealizationPlanCompilationEvidence(value: unknown): value is RealizationPlanCompilationEvidence;
