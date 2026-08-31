import { type ClaimedExecution, type ExecutionRecord, type ExecutionRequest, type OrchestrationEvent, type OrchestrationEventInput, type SubmissionResult } from "../data-plane/model.js";
import type { ExecutionRepository } from "../data-plane/ports.js";
export declare class InMemoryExecutionRepository implements ExecutionRepository {
    private readonly records;
    private readonly idempotency;
    private readonly pending;
    private readonly testimony;
    private readonly claims;
    private readonly requestAuthorities;
    private readonly idempotencyAuthorities;
    private fencingSequence;
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
    private appendEvents;
    private materializeEvents;
    private assertEventLineage;
    private idempotencyAuthority;
}
