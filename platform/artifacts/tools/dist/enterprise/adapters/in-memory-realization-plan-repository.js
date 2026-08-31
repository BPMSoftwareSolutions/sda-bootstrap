import { RealizationPlanIdempotencyConflictError } from "../interfaces/http/realization-api-model.js";
function freezeDeep(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value))
        return value;
    for (const member of Object.values(value))
        freezeDeep(member);
    return Object.freeze(value);
}
function idempotencyIndex(tenantId, idempotencyKey) {
    return `${tenantId}\u0000${idempotencyKey}`;
}
export class InMemoryRealizationPlanRepository {
    plans = new Map();
    planIdByIdempotency = new Map();
    findByIdempotency(tenantId, idempotencyKey) {
        const planId = this.planIdByIdempotency.get(idempotencyIndex(tenantId, idempotencyKey));
        return planId ? this.plans.get(planId) ?? null : null;
    }
    putIfAbsent(record) {
        const index = idempotencyIndex(record.tenantId, record.idempotencyKey);
        const existingPlanId = this.planIdByIdempotency.get(index);
        if (existingPlanId) {
            const existing = this.plans.get(existingPlanId);
            if (!existing)
                throw new Error("Realization idempotency index references a missing plan.");
            if (existing.requestFingerprint !== record.requestFingerprint) {
                throw new RealizationPlanIdempotencyConflictError(record.tenantId, record.idempotencyKey);
            }
            return Object.freeze({ record: existing, duplicate: true });
        }
        if (this.plans.has(record.planId)) {
            throw new Error(`Realization plan identity '${record.planId}' is already present.`);
        }
        const stored = freezeDeep(structuredClone(record));
        this.plans.set(stored.planId, stored);
        this.planIdByIdempotency.set(index, stored.planId);
        return Object.freeze({ record: stored, duplicate: false });
    }
    get(planId) {
        return this.plans.get(planId) ?? null;
    }
}
