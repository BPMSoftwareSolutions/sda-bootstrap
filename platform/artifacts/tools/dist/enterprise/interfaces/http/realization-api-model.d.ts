import type { RealizationPlan } from "../../../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
export interface NodeRealizationApiReferenceHostProfile {
    readonly profileType: "sda-node-realization-api-reference-host-profile.v1";
    readonly profileId: string;
    readonly profileVersion: string;
    readonly apiId: "sda-realization-api";
    readonly operationGraphDigest: string;
    readonly openApiDocumentDigest: string;
    readonly authentication: {
        readonly realm: string;
        readonly acceptedIssuers: readonly string[];
        readonly audience: string;
    };
    readonly bindings: {
        readonly registryBackedRequestContractDigest: string;
        readonly plannerId: string;
        readonly plannerDigest: string;
        readonly selectorResolverId: string;
        readonly selectorResolverDigest: string;
        readonly availabilityReaderId: string;
        readonly availabilityReaderDigest: string;
    };
    readonly limits: {
        readonly maximumBodyBytes: number;
        readonly maximumHeaderBytes: number;
        readonly bodyReadTimeoutMilliseconds: number;
        readonly maximumJsonDepth: number;
    };
    readonly hostProfileDigest: string;
}
export interface RealizationPlanSubmission {
    readonly submissionType: "sda-realization-plan-submission.v1";
    readonly intent: {
        readonly intentId: string;
        readonly selector: string;
    };
    readonly registration: {
        readonly registrationId: string;
        readonly selector: string;
    };
    readonly realizationPolicy: {
        readonly policyId: string;
        readonly selector: string;
    };
    readonly targets: readonly {
        readonly targetId: string;
        readonly environmentProfileId: string;
        readonly selector: string;
    }[];
}
export interface RealizationPlanIdentifierRequest {
    readonly planId: string;
}
export interface CapabilityRegistrationIdentifierRequest {
    readonly registrationId: string;
}
export interface RealizationPlanResource {
    readonly resourceType: "sda-realization-plan-resource.v1";
    readonly planId: string;
    readonly planDigest: string;
    readonly disposition: "PLANNED" | "BLOCKED";
    readonly intentId: string;
    readonly registrationId: string;
    readonly targets: readonly string[];
    readonly links: {
        readonly self: string;
        readonly registration: string;
    };
}
export interface CapabilityRegistrationResource {
    readonly resourceType: "sda-capability-registration-resource.v1";
    readonly registrationId: string;
    readonly registrationDigest: string;
    readonly capabilityId: string;
    readonly releaseId: string;
    readonly bundleDigest: string;
    readonly state: "ACTIVE" | "DEPRECATED" | "REVOKED";
    readonly links: {
        readonly self: string;
        readonly availability: string;
    };
}
export interface CapabilityAvailabilityResource {
    readonly resourceType: "sda-capability-availability-resource.v1";
    readonly registrationId: string;
    readonly registrationDigest: string;
    readonly state: "ACTIVE" | "COLD" | "UNAVAILABLE";
    readonly activeRealizationIds: readonly string[];
    readonly eligibleForRehydration: boolean;
    readonly historicalProofDigest?: string;
}
export interface StoredRealizationPlan {
    readonly planId: string;
    readonly tenantId: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly plan: RealizationPlan;
    readonly resource: RealizationPlanResource;
}
export declare class RealizationPlanIdempotencyConflictError extends Error {
    readonly tenantId: string;
    readonly idempotencyKey: string;
    constructor(tenantId: string, idempotencyKey: string);
}
export declare class RegistryBackedRealizationRequestRejectedError extends Error {
    readonly findings: readonly unknown[];
    constructor(findings?: readonly unknown[]);
}
export declare function isNodeRealizationApiReferenceHostProfile(value: unknown): value is NodeRealizationApiReferenceHostProfile;
