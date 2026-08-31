export interface NodeApiReferenceHostProfile {
    readonly profileType: "sda-node-api-reference-host-profile.v1";
    readonly profileId: string;
    readonly profileVersion: string;
    readonly apiId: "sda-execution-api";
    readonly operationGraphDigest: string;
    readonly openApiDocumentDigest: string;
    readonly authentication: {
        readonly realm: string;
        readonly acceptedIssuers: readonly string[];
        readonly audience: string;
    };
    readonly trustedDefaults: {
        readonly environment: string;
        readonly region: string;
        readonly purpose: string;
        readonly dataClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
    };
    readonly bindings: {
        readonly executionRequestContractDigest: string;
        readonly evidenceProjectorId: string;
        readonly evidenceProjectorDigest: string;
    };
    readonly limits: {
        readonly maximumBodyBytes: number;
        readonly maximumHeaderBytes: number;
        readonly bodyReadTimeoutMilliseconds: number;
        readonly maximumJsonDepth: number;
        readonly maximumEventPageSize: number;
    };
    readonly hostProfileDigest: string;
}
export interface VerifiedAccessToken {
    readonly tokenId: string;
    readonly issuer: string;
    readonly audiences: readonly string[];
    readonly tenantId: string;
    readonly subjectId: string;
    readonly authenticationMethod: "oidc" | "oauth2" | "workload-identity" | "operator";
    readonly workloadIdentity?: string;
    readonly homeRegion?: string;
    readonly scopes: readonly string[];
}
export interface TrustedApiRequestContext {
    readonly principal: VerifiedAccessToken;
    readonly requestId: string;
    readonly requestedAt: string;
    readonly idempotencyKey?: string;
    readonly traceparent?: string;
}
export interface ExecutionSubmission {
    readonly submissionType: "sda-execution-submission.v1";
    readonly capabilityId: string;
    readonly scenarioId: string;
    readonly release: {
        readonly bundleDigest?: string;
        readonly releaseSelector?: string;
    };
    readonly purpose?: string;
    readonly deadline?: string;
    readonly input: unknown;
}
export interface ExecutionIdentifierRequest {
    readonly executionId: string;
}
export interface ExecutionEventQuery extends ExecutionIdentifierRequest {
    readonly cursor?: string;
    readonly limit?: number;
}
export interface ExecutionResource {
    readonly resourceType: "sda-execution-resource.v1";
    readonly executionId: string;
    readonly status: "ADMITTED" | "RUNNING" | "RETRY_PENDING" | "COMPLETED" | "QUARANTINED" | "POLICY_DENIED";
    readonly capabilityId: string;
    readonly scenarioId: string;
    readonly bundleDigest: string;
    readonly duplicate: boolean;
    readonly reasonCode?: string;
    readonly links: {
        readonly self: string;
        readonly events: string;
        readonly evidence: string;
    };
}
export interface ExecutionEventCollection {
    readonly collectionType: "sda-execution-event-collection.v1";
    readonly executionId: string;
    readonly events: readonly {
        readonly eventId: string;
        readonly kind: string;
        readonly attempt: number;
        readonly occurredAt: string;
        readonly reasonCode?: string;
    }[];
    readonly nextCursor?: string;
}
export interface ExecutionEvidenceResource {
    readonly resourceType: "sda-execution-evidence-resource.v1";
    readonly executionId: string;
    readonly bundleDigest: string;
    readonly scenarioId: string;
    readonly evidenceDigest: string;
    readonly evidence: unknown;
}
export interface ApiProblem {
    readonly type: string;
    readonly title: string;
    readonly status: number;
    readonly detail?: string;
    readonly reasonCode: string;
    readonly instance: string;
    readonly traceId?: string;
}
export declare class ApiProblemError extends Error {
    readonly status: number;
    readonly reasonCode: string;
    readonly title: string;
    readonly safeDetail?: string | undefined;
    constructor(status: number, reasonCode: string, title: string, safeDetail?: string | undefined);
}
export declare function isNodeApiReferenceHostProfile(value: unknown): value is NodeApiReferenceHostProfile;
