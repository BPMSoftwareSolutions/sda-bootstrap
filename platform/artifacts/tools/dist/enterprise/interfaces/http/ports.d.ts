import type { ExecutionRecord, ExecutionRequest } from "../../data-plane/model.js";
import type { ExecutionSubmission, TrustedApiRequestContext, VerifiedAccessToken } from "./model.js";
export interface AccessTokenVerificationPort {
    verify(accessToken: string): Promise<VerifiedAccessToken | null>;
}
export interface ExecutionReleaseResolutionPort {
    resolve(release: ExecutionSubmission["release"], capabilityId: string): Promise<string | null>;
}
export interface ExecutionIdentityPort {
    nextExecutionId(): string;
    nextRequestId(): string;
}
export interface ExecutionEvidenceProjectionPort {
    readonly projectorId: string;
    readonly projectorDigest: string;
    project(evidence: unknown, record: ExecutionRecord, context: TrustedApiRequestContext): Promise<unknown>;
}
export interface ExecutionRequestAdmissionPort {
    readonly contractDigest: string;
    admit(request: ExecutionRequest): Promise<void>;
}
