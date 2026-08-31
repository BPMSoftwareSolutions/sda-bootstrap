import type { ImmutableAuthorityRegistry } from "../../../ports/realization-planning/immutable-authority-registry.js";
import type { CapabilityGraphEntry, CapabilityRegistration, EnvironmentProfile, IntentAuthority, ProviderCatalogSnapshot, RealizationPlan, RealizationPlanFinding, RealizationPolicy } from "../construct-deterministic-realization-plan/model.js";
export interface RegistryAuthoritySelector {
    readonly selector: string;
    readonly expectedDigest?: string;
}
export interface RegistryBackedRealizationPlanRequest {
    readonly requestType: "sda-registry-backed-realization-plan-request.v1";
    readonly requestId: string;
    readonly planId: string;
    readonly intent: RegistryAuthoritySelector & {
        readonly intentId: string;
    };
    readonly capabilityRegistration: RegistryAuthoritySelector & {
        readonly registrationId: string;
    };
    readonly capabilityRelease: {
        readonly selector: string;
        readonly expectedBundleDigest?: string;
    };
    readonly realizationPolicy: RegistryAuthoritySelector & {
        readonly policyId: string;
    };
    readonly targets: readonly {
        readonly targetId: string;
        readonly environmentProfile: RegistryAuthoritySelector & {
            readonly profileId: string;
        };
    }[];
    readonly planningSnapshot: RegistryAuthoritySelector & {
        readonly snapshotId: string;
    };
}
export interface CapabilityGraphAuthority {
    readonly graphType: "sda-realization-capability-graph.v1";
    readonly capabilityId: string;
    readonly entries: readonly CapabilityGraphEntry[];
    readonly graphDigest: string;
}
export interface RealizationPlanningSnapshot {
    readonly planningSnapshotType: "sda-realization-planning-snapshot.v1";
    readonly snapshotId: string;
    readonly capabilityId: string;
    readonly capabilityGraphDigest: string;
    readonly providerCatalogId: string;
    readonly providerCatalogDigest: string;
    readonly interfaceAuthorityDigest: string;
    readonly contractDigests: readonly string[];
    readonly policySnapshotDigest: string;
    readonly projectorDigest: string;
    readonly snapshotDigest: string;
}
export interface RealizationPlanningRegistries {
    readonly intents: ImmutableAuthorityRegistry<IntentAuthority>;
    readonly registrations: ImmutableAuthorityRegistry<CapabilityRegistration>;
    readonly policies: ImmutableAuthorityRegistry<RealizationPolicy>;
    readonly environmentProfiles: ImmutableAuthorityRegistry<EnvironmentProfile>;
    readonly capabilityGraphs: ImmutableAuthorityRegistry<CapabilityGraphAuthority>;
    readonly providerCatalogs: ImmutableAuthorityRegistry<ProviderCatalogSnapshot>;
    readonly planningSnapshots: ImmutableAuthorityRegistry<RealizationPlanningSnapshot>;
}
export type RegistryResolutionAuthorityKind = "INTENT" | "CAPABILITY_REGISTRATION" | "CAPABILITY_RELEASE" | "REALIZATION_POLICY" | "ENVIRONMENT_PROFILE" | "PLANNING_SNAPSHOT" | "CAPABILITY_GRAPH" | "PROVIDER_CATALOG";
export interface RegistryResolutionDecision {
    readonly authorityKind: RegistryResolutionAuthorityKind;
    readonly authorityId: string;
    readonly selector: string;
    readonly resolvedDigest: string;
    readonly resolvedBy: "DIGEST" | "ALIAS";
    readonly targetId?: string;
}
export type RegistryBackedRealizationPlanEvidence = {
    readonly evidenceType: "sda-registry-backed-realization-plan-evidence.v1";
    readonly disposition: "PLANNED";
    readonly resolutionDecisions: readonly RegistryResolutionDecision[];
    readonly findings: readonly [];
    readonly plan: RealizationPlan;
} | {
    readonly evidenceType: "sda-registry-backed-realization-plan-evidence.v1";
    readonly disposition: "BLOCKED";
    readonly resolutionDecisions: readonly RegistryResolutionDecision[];
    readonly findings: readonly RealizationPlanFinding[];
};
export declare function isRegistryBackedRealizationPlanRequest(value: unknown): value is RegistryBackedRealizationPlanRequest;
export declare function isRegistryBackedRealizationPlanEvidence(value: unknown): value is RegistryBackedRealizationPlanEvidence;
