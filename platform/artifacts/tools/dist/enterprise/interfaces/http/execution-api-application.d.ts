import type { DurableExecutionOrchestrator } from "../../data-plane/durable-execution-orchestrator.js";
import type { ExecutionRepository } from "../../data-plane/ports.js";
import { type ExecutionEventCollection, type ExecutionEventQuery, type ExecutionEvidenceResource, type ExecutionIdentifierRequest, type ExecutionResource, type ExecutionSubmission, type NodeApiReferenceHostProfile, type TrustedApiRequestContext } from "./model.js";
import type { ExecutionEvidenceProjectionPort, ExecutionIdentityPort, ExecutionRequestAdmissionPort, ExecutionReleaseResolutionPort } from "./ports.js";
export declare class ExecutionApiApplication {
    private readonly orchestrator;
    private readonly executions;
    private readonly releases;
    private readonly evidenceProjection;
    private readonly identities;
    private readonly requestAdmission;
    private readonly profile;
    constructor(orchestrator: DurableExecutionOrchestrator, executions: ExecutionRepository, releases: ExecutionReleaseResolutionPort, evidenceProjection: ExecutionEvidenceProjectionPort, identities: ExecutionIdentityPort, requestAdmission: ExecutionRequestAdmissionPort, profile: NodeApiReferenceHostProfile);
    submit(input: ExecutionSubmission, context: TrustedApiRequestContext): Promise<ExecutionResource>;
    inspect(input: ExecutionIdentifierRequest, context: TrustedApiRequestContext): Promise<ExecutionResource>;
    events(input: ExecutionEventQuery, context: TrustedApiRequestContext): Promise<ExecutionEventCollection>;
    evidence(input: ExecutionIdentifierRequest, context: TrustedApiRequestContext): Promise<ExecutionEvidenceResource>;
    private authorizedRecord;
}
