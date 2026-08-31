import { sha256Digest } from "../../control-plane/canonical-json.js";
import { ExecutionIdempotencyConflictError } from "../../data-plane/model.js";
import { ApiProblemError } from "./model.js";
function executionResource(record, duplicate) {
    const root = `/v1/executions/${encodeURIComponent(record.request.executionId)}`;
    return Object.freeze({
        resourceType: "sda-execution-resource.v1",
        executionId: record.request.executionId,
        status: record.status,
        capabilityId: record.request.capabilityId,
        scenarioId: record.request.scenarioId,
        bundleDigest: record.request.bundleDigest,
        duplicate,
        ...(record.reasonCode ? { reasonCode: record.reasonCode } : {}),
        links: Object.freeze({ self: root, events: `${root}/events`, evidence: `${root}/evidence` })
    });
}
export class ExecutionApiApplication {
    orchestrator;
    executions;
    releases;
    evidenceProjection;
    identities;
    requestAdmission;
    profile;
    constructor(orchestrator, executions, releases, evidenceProjection, identities, requestAdmission, profile) {
        this.orchestrator = orchestrator;
        this.executions = executions;
        this.releases = releases;
        this.evidenceProjection = evidenceProjection;
        this.identities = identities;
        this.requestAdmission = requestAdmission;
        this.profile = profile;
        if (requestAdmission.contractDigest !== profile.bindings.executionRequestContractDigest) {
            throw new Error("Execution request admission binding does not match the reference host profile.");
        }
        if (evidenceProjection.projectorId !== profile.bindings.evidenceProjectorId ||
            evidenceProjection.projectorDigest !== profile.bindings.evidenceProjectorDigest) {
            throw new Error("Execution evidence projector binding does not match the reference host profile.");
        }
    }
    async submit(input, context) {
        if (!context.idempotencyKey) {
            throw new ApiProblemError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency key required");
        }
        const bundleDigest = await this.releases.resolve(input.release, input.capabilityId);
        if (!bundleDigest) {
            throw new ApiProblemError(400, "RELEASE_NOT_ADMITTED", "Release is not admitted");
        }
        const requestedAt = context.requestedAt;
        if (input.deadline && Date.parse(input.deadline) <= Date.parse(requestedAt)) {
            throw new ApiProblemError(400, "INVALID_DEADLINE", "Deadline is invalid", "The deadline must be later than request admission time.");
        }
        const request = Object.freeze({
            requestType: "sda-execution-request.v1",
            executionId: this.identities.nextExecutionId(),
            bundleDigest,
            capabilityId: input.capabilityId,
            scenarioId: input.scenarioId,
            idempotencyKey: context.idempotencyKey,
            tenant: Object.freeze({
                tenantId: context.principal.tenantId,
                ...(context.principal.homeRegion ? { homeRegion: context.principal.homeRegion } : {})
            }),
            subject: Object.freeze({
                subjectId: context.principal.subjectId,
                issuer: context.principal.issuer,
                authenticationMethod: context.principal.authenticationMethod,
                ...(context.principal.workloadIdentity ? { workloadIdentity: context.principal.workloadIdentity } : {})
            }),
            environment: this.profile.trustedDefaults.environment,
            region: this.profile.trustedDefaults.region,
            purpose: input.purpose ?? this.profile.trustedDefaults.purpose,
            dataClassification: this.profile.trustedDefaults.dataClassification,
            requestedAt,
            ...(input.deadline ? { deadline: input.deadline } : {}),
            ...(context.traceparent ? { traceparent: context.traceparent } : {}),
            input: input.input
        });
        await this.requestAdmission.admit(request);
        try {
            const result = await this.orchestrator.submit(request);
            if (result.record.status === "POLICY_DENIED") {
                throw new ApiProblemError(403, "EXECUTION_POLICY_DENIED", "Execution policy denied");
            }
            return executionResource(result.record, result.duplicate);
        }
        catch (error) {
            if (error instanceof ApiProblemError)
                throw error;
            if (error instanceof ExecutionIdempotencyConflictError) {
                throw new ApiProblemError(409, "IDEMPOTENCY_CONFLICT", "Idempotency conflict");
            }
            const message = error instanceof Error ? error.message : String(error);
            if (/Bundle .* is not admitted|does not match pinned bundle|is not present in the pinned bundle/.test(message)) {
                throw new ApiProblemError(400, "EXECUTION_TARGET_INVALID", "Execution target is invalid");
            }
            throw error;
        }
    }
    async inspect(input, context) {
        return executionResource(this.authorizedRecord(input.executionId, context), false);
    }
    async events(input, context) {
        const record = this.authorizedRecord(input.executionId, context);
        const cursor = input.cursor === undefined ? 0 : Number(input.cursor);
        if (!Number.isSafeInteger(cursor) || cursor < 0) {
            throw new ApiProblemError(400, "INVALID_EVENT_CURSOR", "Event cursor is invalid");
        }
        const requestedLimit = input.limit ?? Math.min(50, this.profile.limits.maximumEventPageSize);
        if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 ||
            requestedLimit > this.profile.limits.maximumEventPageSize) {
            throw new ApiProblemError(400, "INVALID_EVENT_LIMIT", "Event page limit is invalid");
        }
        const all = this.executions.events(record.request.executionId);
        const page = all.slice(cursor, cursor + requestedLimit).map((event) => Object.freeze({
            eventId: event.eventId,
            kind: event.kind,
            attempt: event.attempt,
            occurredAt: event.occurredAt,
            ...(event.reasonCode ? { reasonCode: event.reasonCode } : {})
        }));
        const next = cursor + page.length;
        return Object.freeze({
            collectionType: "sda-execution-event-collection.v1",
            executionId: record.request.executionId,
            events: Object.freeze(page),
            ...(next < all.length ? { nextCursor: String(next) } : {})
        });
    }
    async evidence(input, context) {
        const record = this.authorizedRecord(input.executionId, context);
        if (!record.closure || record.closure.evidence === null) {
            throw new ApiProblemError(404, "EXECUTION_EVIDENCE_NOT_FOUND", "Execution evidence was not found");
        }
        const evidence = await this.evidenceProjection.project(record.closure.evidence, record, context);
        return Object.freeze({
            resourceType: "sda-execution-evidence-resource.v1",
            executionId: record.request.executionId,
            bundleDigest: record.request.bundleDigest,
            scenarioId: record.request.scenarioId,
            evidenceDigest: sha256Digest(evidence),
            evidence
        });
    }
    authorizedRecord(executionId, context) {
        const record = this.executions.get(executionId);
        if (!record || record.request.tenant.tenantId !== context.principal.tenantId) {
            throw new ApiProblemError(404, "EXECUTION_NOT_FOUND", "Execution was not found");
        }
        return record;
    }
}
