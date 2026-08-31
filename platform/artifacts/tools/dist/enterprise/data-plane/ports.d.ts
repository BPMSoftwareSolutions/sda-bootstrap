import type { CapabilityBundle } from "../control-plane/capability-bundle.js";
import type { ConditionEvidence } from "../../model/semantic-model.js";
import type { ClaimedExecution, ExecutionRecord, ExecutionRequest, OrchestrationEvent, OrchestrationEventInput, SubmissionResult } from "./model.js";
export interface CapabilityBundleRegistry {
    resolve(bundleDigest: string): CapabilityBundle | null;
}
export interface InvocationPolicyPort {
    decide(request: ExecutionRequest, bundle: CapabilityBundle): Promise<{
        readonly disposition: "ALLOW" | "DENY";
        readonly decisionId: string;
        readonly reasonCodes: readonly string[];
    }>;
}
export interface ExecutionRepository {
    /**
     * Returns the original record for identical tenant/capability/idempotency authority and throws
     * ExecutionIdempotencyConflictError when the same scope is reused for different admitted intent.
     */
    admit(request: ExecutionRequest, admittedEvent: OrchestrationEventInput): SubmissionResult;
    deny(request: ExecutionRequest, deniedEvent: OrchestrationEventInput, reasonCode: string): ExecutionRecord;
    appendTestimony(executionId: string, event: OrchestrationEventInput): void;
    claimNext(options: {
        readonly claimedAt: string;
        readonly leaseExpiresAt: string;
    }): ClaimedExecution | null;
    renewClaim(options: {
        readonly executionId: string;
        readonly fencingToken: string;
        readonly renewedAt: string;
        readonly leaseExpiresAt: string;
    }): {
        readonly leaseExpiresAt: string;
    };
    commit(options: {
        readonly executionId: string;
        readonly expectedVersion: number;
        readonly committedAt: string;
        readonly fencingToken: string;
        readonly next: Omit<ExecutionRecord, "version">;
        readonly events: readonly OrchestrationEventInput[];
        readonly releaseClaim?: boolean;
    }): ExecutionRecord;
    get(executionId: string): ExecutionRecord | null;
    events(executionId: string): readonly OrchestrationEvent[];
}
export interface EnterpriseExecutionContext {
    readonly executionId: string;
    readonly rootExecutionId: string;
    readonly attempt: number;
    readonly idempotencyKey: string;
    readonly bundleDigest: string;
    readonly fencingToken: string;
    readonly signal?: AbortSignal;
}
export interface EnterpriseResponsibilityProvider {
    readonly providerId: string;
    readonly responsibilityId: string;
    readonly implementationRef: string;
    readonly requires: readonly string[];
    execute(input: unknown, context: EnterpriseExecutionContext): Promise<unknown>;
}
export interface EnterpriseObservationEvaluator {
    readonly evaluatorId: string;
    readonly evidenceContractId: string;
    readonly conditionIds: readonly string[];
    evaluateCondition(conditionId: string, evidence: unknown, configurationRef?: string): ConditionEvidence;
}
export interface EnterpriseProviderRegistry {
    resolveProvider(providerId: string): EnterpriseResponsibilityProvider | null;
    resolveEvaluator(evaluatorId: string): EnterpriseObservationEvaluator | null;
}
