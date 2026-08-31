import type { ScenarioClosure } from "../../model/semantic-model.js";
export declare class ExecutionIdempotencyConflictError extends Error {
    readonly existingExecutionId: string;
    readonly code = "EXECUTION_IDEMPOTENCY_CONFLICT";
    constructor(existingExecutionId: string);
}
export interface ExecutionRequest {
    readonly requestType: "sda-execution-request.v1";
    readonly executionId: string;
    readonly bundleDigest: string;
    readonly capabilityId: string;
    readonly scenarioId: string;
    readonly idempotencyKey: string;
    readonly tenant: {
        readonly tenantId: string;
        readonly homeRegion?: string;
    };
    readonly subject: {
        readonly subjectId: string;
        readonly issuer: string;
        readonly authenticationMethod: "oidc" | "oauth2" | "workload-identity" | "operator";
        readonly workloadIdentity?: string;
    };
    readonly environment: string;
    readonly region: string;
    readonly purpose: string;
    readonly dataClassification?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
    readonly requestedAt: string;
    readonly deadline?: string;
    readonly traceparent?: string;
    readonly input: unknown;
}
export type OrchestrationEventKind = "REQUEST_ADMITTED" | "DUPLICATE_SUPPRESSED" | "POLICY_DENIED" | "DISPATCHED" | "ATTEMPT_STARTED" | "ATTEMPT_COMPLETED" | "ATTEMPT_FAILED" | "RETRY_SCHEDULED" | "QUARANTINED";
export interface OrchestrationEvent {
    readonly eventType: "sda-orchestration-event.v1";
    readonly eventId: string;
    readonly executionId: string;
    readonly rootExecutionId: string;
    readonly tenantId: string;
    readonly bundleDigest: string;
    readonly scenarioId: string;
    readonly providerId?: string;
    readonly evaluatorIds?: readonly string[];
    readonly attempt: number;
    readonly kind: OrchestrationEventKind;
    readonly occurredAt: string;
    readonly reasonCode?: string;
    readonly detail?: string;
}
export interface PhysicalExecutionPolicy {
    readonly maximumAttempts: number;
    readonly claimLeaseMilliseconds?: number;
    readonly claimHeartbeatMilliseconds?: number;
    readonly retryDelayMilliseconds?: number;
}
export interface ExecutionRecord {
    readonly request: ExecutionRequest;
    readonly version: number;
    readonly status: "ADMITTED" | "RUNNING" | "RETRY_PENDING" | "COMPLETED" | "QUARANTINED" | "POLICY_DENIED";
    readonly attempt: number;
    readonly providerId?: string;
    readonly evaluatorIds?: readonly string[];
    readonly nextAttemptAt?: string;
    readonly closure?: ScenarioClosure<unknown>;
    readonly reasonCode?: string;
}
export type OrchestrationEventInput = Omit<OrchestrationEvent, "eventId">;
export interface ClaimedExecution {
    readonly record: ExecutionRecord;
    readonly fencingToken: string;
    readonly leaseExpiresAt: string;
}
export interface SubmissionResult {
    readonly record: ExecutionRecord;
    readonly duplicate: boolean;
}
