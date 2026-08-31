import type { CapabilityRegistration } from "../../../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
import type { RegistryAuthoritySelector, RegistryBackedRealizationPlanEvidence, RegistryBackedRealizationPlanRequest } from "../../../capabilities/realization-planning/resolve-registered-realization-plan/model.js";
import type { CapabilityAvailability } from "../../../model/realization-lifecycle.js";
import type { ImmutableAuthorityRegistry } from "../../../ports/realization-planning/immutable-authority-registry.js";
import type { TrustedApiRequestContext } from "./model.js";
import type { RealizationPlanSubmission, StoredRealizationPlan } from "./realization-api-model.js";
export interface RegisteredRealizationPlannerPort {
    readonly plannerId: string;
    readonly plannerDigest: string;
    plan(request: RegistryBackedRealizationPlanRequest): Promise<RegistryBackedRealizationPlanEvidence>;
}
export interface RealizationAuthoritySelectionPort {
    readonly resolverId: string;
    readonly resolverDigest: string;
    selectSubmission(submission: RealizationPlanSubmission, context: TrustedApiRequestContext): Promise<{
        readonly capabilityRelease: {
            readonly selector: string;
            readonly expectedBundleDigest?: string;
        };
        readonly planningSnapshot: RegistryAuthoritySelector & {
            readonly snapshotId: string;
        };
    } | null>;
    selectRegistrationRead(registrationId: string, context: TrustedApiRequestContext): Promise<{
        readonly registrationSelector: string;
        readonly releaseSelector: string;
    } | null>;
}
export interface CapabilityAvailabilityReadPort {
    readonly readerId: string;
    readonly readerDigest: string;
    read(registrationId: string, registrationDigest: string, context: TrustedApiRequestContext): Promise<CapabilityAvailability | null>;
}
export interface RealizationPlanIdentityPort {
    nextPlanId(): string;
    nextRequestId(): string;
}
export interface RegistryBackedRealizationRequestAdmissionPort {
    readonly contractDigest: string;
    admit(request: RegistryBackedRealizationPlanRequest): Promise<void>;
}
export interface RealizationPlanRepository {
    findByIdempotency(tenantId: string, idempotencyKey: string): StoredRealizationPlan | null;
    putIfAbsent(record: StoredRealizationPlan): {
        readonly record: StoredRealizationPlan;
        readonly duplicate: boolean;
    };
    get(planId: string): StoredRealizationPlan | null;
}
export type CapabilityRegistrationAuthorityRegistry = ImmutableAuthorityRegistry<CapabilityRegistration>;
