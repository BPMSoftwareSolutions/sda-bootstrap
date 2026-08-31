import { type StoredRealizationPlan } from "../interfaces/http/realization-api-model.js";
import type { RealizationPlanRepository } from "../interfaces/http/realization-api-ports.js";
export declare class InMemoryRealizationPlanRepository implements RealizationPlanRepository {
    private readonly plans;
    private readonly planIdByIdempotency;
    findByIdempotency(tenantId: string, idempotencyKey: string): StoredRealizationPlan | null;
    putIfAbsent(record: StoredRealizationPlan): {
        readonly record: StoredRealizationPlan;
        readonly duplicate: boolean;
    };
    get(planId: string): StoredRealizationPlan | null;
}
