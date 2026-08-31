import { ExecutionIdempotencyConflictError } from "../data-plane/model.js";
import { canonicalizeJson } from "../control-plane/canonical-json.js";
function immutableSnapshot(value) {
    const snapshot = structuredClone(value);
    const freeze = (candidate) => {
        if (!candidate || typeof candidate !== "object" || Object.isFrozen(candidate))
            return;
        for (const child of Object.values(candidate))
            freeze(child);
        Object.freeze(candidate);
    };
    freeze(snapshot);
    return snapshot;
}
export class InMemoryExecutionRepository {
    records = new Map();
    idempotency = new Map();
    pending = [];
    testimony = new Map();
    claims = new Map();
    requestAuthorities = new Map();
    idempotencyAuthorities = new Map();
    fencingSequence = 0;
    admit(request, admittedEvent) {
        const idempotencyScope = `${request.tenant.tenantId}:${request.capabilityId}:${request.idempotencyKey}`;
        const existingId = this.idempotency.get(idempotencyScope);
        if (existingId) {
            const existing = this.records.get(existingId);
            if (!existing)
                throw new Error(`Idempotency index refers to missing execution '${existingId}'.`);
            if (this.idempotencyAuthorities.get(idempotencyScope) !== this.idempotencyAuthority(request)) {
                throw new ExecutionIdempotencyConflictError(existingId);
            }
            return { record: existing, duplicate: true };
        }
        if (this.records.has(request.executionId))
            throw new Error(`Execution '${request.executionId}' already exists.`);
        const admittedRequest = immutableSnapshot(request);
        this.assertEventLineage(admittedRequest, admittedEvent);
        const record = Object.freeze({
            request: admittedRequest,
            version: 1,
            status: "ADMITTED",
            attempt: 0
        });
        this.records.set(request.executionId, record);
        this.requestAuthorities.set(request.executionId, canonicalizeJson(admittedRequest));
        this.idempotency.set(idempotencyScope, request.executionId);
        this.idempotencyAuthorities.set(idempotencyScope, this.idempotencyAuthority(admittedRequest));
        this.pending.push(request.executionId);
        this.appendEvents(request.executionId, [admittedEvent]);
        return { record, duplicate: false };
    }
    deny(request, deniedEvent, reasonCode) {
        if (this.records.has(request.executionId))
            throw new Error(`Execution '${request.executionId}' already exists.`);
        const deniedRequest = immutableSnapshot(request);
        this.assertEventLineage(deniedRequest, deniedEvent);
        const record = Object.freeze({
            request: deniedRequest,
            version: 1,
            status: "POLICY_DENIED",
            attempt: 0,
            reasonCode
        });
        this.records.set(request.executionId, record);
        this.requestAuthorities.set(request.executionId, canonicalizeJson(deniedRequest));
        this.appendEvents(request.executionId, [deniedEvent]);
        return record;
    }
    appendTestimony(executionId, event) {
        const record = this.records.get(executionId);
        if (!record)
            throw new Error(`Execution '${executionId}' does not exist.`);
        this.assertEventLineage(record.request, event);
        this.appendEvents(executionId, [event]);
    }
    claimNext(options) {
        const rotations = this.pending.length;
        for (let index = 0; index < rotations; index += 1) {
            const executionId = this.pending.shift();
            if (!executionId)
                return null;
            const record = this.records.get(executionId);
            if (!record)
                throw new Error(`Pending execution '${executionId}' has no state.`);
            if (record.status !== "ADMITTED" && record.status !== "RETRY_PENDING" && record.status !== "RUNNING")
                continue;
            if (record.nextAttemptAt && record.nextAttemptAt > options.claimedAt) {
                this.pending.push(executionId);
                continue;
            }
            const currentClaim = this.claims.get(executionId);
            if (currentClaim && currentClaim.leaseExpiresAt > options.claimedAt) {
                this.pending.push(executionId);
                continue;
            }
            const claim = {
                fencingToken: `${executionId}.fence-${++this.fencingSequence}`,
                leaseExpiresAt: options.leaseExpiresAt
            };
            this.claims.set(executionId, claim);
            this.pending.push(executionId);
            return { record, ...claim };
        }
        return null;
    }
    renewClaim(options) {
        const claim = this.claims.get(options.executionId);
        if (!claim || claim.fencingToken !== options.fencingToken) {
            throw new Error(`Execution '${options.executionId}' has a stale or missing fencing token.`);
        }
        const renewedAt = Date.parse(options.renewedAt);
        const currentExpiry = Date.parse(claim.leaseExpiresAt);
        const nextExpiry = Date.parse(options.leaseExpiresAt);
        if (!Number.isFinite(renewedAt) || !Number.isFinite(nextExpiry)) {
            throw new Error("Claim renewal timestamps must be valid ISO timestamps.");
        }
        if (currentExpiry <= renewedAt)
            throw new Error(`Execution '${options.executionId}' claim lease has expired.`);
        if (nextExpiry <= currentExpiry)
            throw new Error("A claim renewal must extend the current lease.");
        const renewed = { fencingToken: claim.fencingToken, leaseExpiresAt: options.leaseExpiresAt };
        this.claims.set(options.executionId, renewed);
        return { leaseExpiresAt: renewed.leaseExpiresAt };
    }
    commit(options) {
        const current = this.records.get(options.executionId);
        if (!current)
            throw new Error(`Execution '${options.executionId}' does not exist.`);
        if (current.version !== options.expectedVersion) {
            throw new Error(`Execution '${options.executionId}' version conflict: expected ${options.expectedVersion}, found ${current.version}.`);
        }
        const requestAuthority = this.requestAuthorities.get(options.executionId);
        if (!requestAuthority ||
            canonicalizeJson(current.request) !== requestAuthority ||
            canonicalizeJson(options.next.request) !== requestAuthority) {
            throw new Error("A repository transition cannot change its immutable execution request.");
        }
        for (const event of options.events)
            this.assertEventLineage(current.request, event);
        const claim = this.claims.get(options.executionId);
        if (!claim || claim.fencingToken !== options.fencingToken) {
            throw new Error(`Execution '${options.executionId}' has a stale or missing fencing token.`);
        }
        if (claim.leaseExpiresAt <= options.committedAt) {
            throw new Error(`Execution '${options.executionId}' claim lease has expired.`);
        }
        const next = Object.freeze({ ...options.next, version: current.version + 1 });
        const nextEvents = this.materializeEvents(options.executionId, options.events);
        this.records.set(options.executionId, next);
        this.testimony.set(options.executionId, Object.freeze([
            ...(this.testimony.get(options.executionId) ?? []),
            ...nextEvents
        ]));
        if (next.status === "RETRY_PENDING" && !this.pending.includes(options.executionId)) {
            this.pending.push(options.executionId);
        }
        if (next.status === "RUNNING" && !this.pending.includes(options.executionId)) {
            this.pending.push(options.executionId);
        }
        if (options.releaseClaim)
            this.claims.delete(options.executionId);
        return next;
    }
    get(executionId) {
        return this.records.get(executionId) ?? null;
    }
    events(executionId) {
        return this.testimony.get(executionId) ?? [];
    }
    appendEvents(executionId, events) {
        this.testimony.set(executionId, Object.freeze([
            ...(this.testimony.get(executionId) ?? []),
            ...this.materializeEvents(executionId, events)
        ]));
    }
    materializeEvents(executionId, events) {
        const firstOrdinal = (this.testimony.get(executionId) ?? []).length + 1;
        return events.map((event, index) => Object.freeze({
            ...event,
            eventId: `${executionId}.event-${firstOrdinal + index}`
        }));
    }
    assertEventLineage(request, event) {
        const expected = {
            executionId: request.executionId,
            rootExecutionId: request.executionId,
            tenantId: request.tenant.tenantId,
            bundleDigest: request.bundleDigest,
            scenarioId: request.scenarioId
        };
        for (const [field, value] of Object.entries(expected)) {
            if (event[field] !== value) {
                throw new Error(`Orchestration event ${field} does not match immutable execution lineage.`);
            }
        }
    }
    idempotencyAuthority(request) {
        return canonicalizeJson({
            bundleDigest: request.bundleDigest,
            capabilityId: request.capabilityId,
            scenarioId: request.scenarioId,
            tenant: request.tenant,
            subject: request.subject,
            environment: request.environment,
            region: request.region,
            purpose: request.purpose,
            ...(request.dataClassification ? { dataClassification: request.dataClassification } : {}),
            ...(request.deadline ? { deadline: request.deadline } : {}),
            input: request.input
        });
    }
}
