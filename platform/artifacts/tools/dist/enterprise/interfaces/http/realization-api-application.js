import { digestWithoutField } from "../../../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
import { capabilityAvailabilityIsCoherent } from "../../../model/realization-lifecycle.js";
import { sha256Digest } from "../../control-plane/canonical-json.js";
import { ApiProblemError } from "./model.js";
import { RealizationPlanIdempotencyConflictError, RegistryBackedRealizationRequestRejectedError } from "./realization-api-model.js";
function planResource(plan) {
    const self = `/v1/realization-plans/${encodeURIComponent(plan.planId)}`;
    const registrationId = plan.capabilityRegistration.registrationId;
    return Object.freeze({
        resourceType: "sda-realization-plan-resource.v1",
        planId: plan.planId,
        planDigest: plan.planDigest,
        disposition: "PLANNED",
        intentId: plan.intent.intentId,
        registrationId,
        targets: Object.freeze(plan.targetResolutions.map((target) => target.targetId)),
        links: Object.freeze({
            self,
            registration: `/v1/capability-registrations/${encodeURIComponent(registrationId)}`
        })
    });
}
function registrationState(state) {
    return state === "REGISTERED" ? "ACTIVE" : state;
}
export class RealizationApiApplication {
    planner;
    registrations;
    selections;
    availabilityReader;
    plans;
    identities;
    requestAdmission;
    profile;
    constructor(planner, registrations, selections, availabilityReader, plans, identities, requestAdmission, profile) {
        this.planner = planner;
        this.registrations = registrations;
        this.selections = selections;
        this.availabilityReader = availabilityReader;
        this.plans = plans;
        this.identities = identities;
        this.requestAdmission = requestAdmission;
        this.profile = profile;
        if (requestAdmission.contractDigest !== profile.bindings.registryBackedRequestContractDigest) {
            throw new Error("Registry-backed realization request admission does not match the reference host profile.");
        }
        if (planner.plannerId !== profile.bindings.plannerId || planner.plannerDigest !== profile.bindings.plannerDigest) {
            throw new Error("Registered realization planner binding does not match the reference host profile.");
        }
        if (selections.resolverId !== profile.bindings.selectorResolverId ||
            selections.resolverDigest !== profile.bindings.selectorResolverDigest) {
            throw new Error("Realization authority selector binding does not match the reference host profile.");
        }
        if (availabilityReader.readerId !== profile.bindings.availabilityReaderId ||
            availabilityReader.readerDigest !== profile.bindings.availabilityReaderDigest) {
            throw new Error("Capability availability reader binding does not match the reference host profile.");
        }
    }
    async submit(input, context) {
        if (!context.idempotencyKey) {
            throw new ApiProblemError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency key required");
        }
        const requestFingerprint = sha256Digest({ tenantId: context.principal.tenantId, submission: input });
        const existing = this.plans.findByIdempotency(context.principal.tenantId, context.idempotencyKey);
        if (existing) {
            if (existing.requestFingerprint !== requestFingerprint) {
                throw new ApiProblemError(409, "IDEMPOTENCY_CONFLICT", "Idempotency conflict");
            }
            return existing.resource;
        }
        const trustedSelection = await this.selections.selectSubmission(input, context);
        if (!trustedSelection) {
            throw new ApiProblemError(400, "REALIZATION_SELECTION_NOT_ADMITTED", "Realization selection is not admitted");
        }
        const planId = this.identities.nextPlanId();
        const request = Object.freeze({
            requestType: "sda-registry-backed-realization-plan-request.v1",
            requestId: context.requestId,
            planId,
            intent: Object.freeze({ intentId: input.intent.intentId, selector: input.intent.selector }),
            capabilityRegistration: Object.freeze({
                registrationId: input.registration.registrationId,
                selector: input.registration.selector
            }),
            capabilityRelease: Object.freeze({ ...trustedSelection.capabilityRelease }),
            realizationPolicy: Object.freeze({
                policyId: input.realizationPolicy.policyId,
                selector: input.realizationPolicy.selector
            }),
            targets: Object.freeze(input.targets.map((target) => Object.freeze({
                targetId: target.targetId,
                environmentProfile: Object.freeze({
                    profileId: target.environmentProfileId,
                    selector: target.selector
                })
            }))),
            planningSnapshot: Object.freeze({ ...trustedSelection.planningSnapshot })
        });
        try {
            await this.requestAdmission.admit(request);
        }
        catch (error) {
            if (error instanceof RegistryBackedRealizationRequestRejectedError) {
                throw new ApiProblemError(400, "REALIZATION_REQUEST_NOT_ADMITTED", "Realization request is not admitted");
            }
            throw error;
        }
        const evidence = await this.planner.plan(request);
        if (evidence.disposition === "BLOCKED") {
            throw new ApiProblemError(400, "REALIZATION_PLAN_BLOCKED", "Realization plan is blocked", "The submitted selectors did not resolve to an admitted realization plan.");
        }
        const plan = evidence.plan;
        if (plan.planId !== planId || plan.intent.intentId !== input.intent.intentId ||
            plan.capabilityRegistration.registrationId !== input.registration.registrationId ||
            plan.planDigest !== digestWithoutField(plan, "planDigest") ||
            plan.targetResolutions.length !== input.targets.length ||
            new Set(plan.targetResolutions.map((target) => target.targetId)).size !== input.targets.length ||
            !input.targets.every((target) => plan.targetResolutions.some((candidate) => candidate.targetId === target.targetId))) {
            throw new Error("Registered realization planner returned evidence outside the admitted request boundary.");
        }
        const resource = planResource(plan);
        const record = Object.freeze({
            planId,
            tenantId: context.principal.tenantId,
            idempotencyKey: context.idempotencyKey,
            requestFingerprint,
            plan,
            resource
        });
        try {
            return this.plans.putIfAbsent(record).record.resource;
        }
        catch (error) {
            if (error instanceof RealizationPlanIdempotencyConflictError) {
                throw new ApiProblemError(409, "IDEMPOTENCY_CONFLICT", "Idempotency conflict");
            }
            throw error;
        }
    }
    async inspect(input, context) {
        const record = this.plans.get(input.planId);
        if (!record || record.tenantId !== context.principal.tenantId) {
            throw new ApiProblemError(404, "REALIZATION_PLAN_NOT_FOUND", "Realization plan was not found");
        }
        return record.resource;
    }
    async registration(input, context) {
        const { registration, release } = await this.resolveRegistration(input.registrationId, context);
        const self = `/v1/capability-registrations/${encodeURIComponent(registration.registrationId)}`;
        return Object.freeze({
            resourceType: "sda-capability-registration-resource.v1",
            registrationId: registration.registrationId,
            registrationDigest: registration.registrationDigest,
            capabilityId: registration.capabilityId,
            releaseId: release.releaseId,
            bundleDigest: release.bundleDigest,
            state: registrationState(registration.state),
            links: Object.freeze({ self, availability: `${self}/availability` })
        });
    }
    async availability(input, context) {
        const { registration } = await this.resolveRegistration(input.registrationId, context);
        const availability = await this.availabilityReader.read(registration.registrationId, registration.registrationDigest, context);
        if (!availability) {
            throw new ApiProblemError(404, "CAPABILITY_AVAILABILITY_NOT_FOUND", "Capability availability was not found");
        }
        if (availability.capabilityRegistration.registrationDigest !== registration.registrationDigest ||
            availability.capabilityRegistration.registrationId !== registration.registrationId ||
            !capabilityAvailabilityIsCoherent(availability)) {
            throw new Error("Capability availability evidence failed registration or content-address verification.");
        }
        const state = availability.state === "COLD"
            ? "COLD"
            : ["APPLYING", "ACTIVE", "PROVED", "DEGRADED"].includes(availability.state)
                ? "ACTIVE"
                : "UNAVAILABLE";
        return Object.freeze({
            resourceType: "sda-capability-availability-resource.v1",
            registrationId: registration.registrationId,
            registrationDigest: registration.registrationDigest,
            state,
            activeRealizationIds: Object.freeze([...availability.activeTargetRealizationIds]),
            eligibleForRehydration: availability.eligible && state === "COLD",
            ...(availability.latestProof ? { historicalProofDigest: availability.latestProof.proofDigest } : {})
        });
    }
    async resolveRegistration(registrationId, context) {
        const selection = await this.selections.selectRegistrationRead(registrationId, context);
        if (!selection) {
            throw new ApiProblemError(404, "CAPABILITY_REGISTRATION_NOT_FOUND", "Capability registration was not found");
        }
        const resolved = this.registrations.resolve(registrationId, selection.registrationSelector);
        if (!resolved) {
            throw new ApiProblemError(404, "CAPABILITY_REGISTRATION_NOT_FOUND", "Capability registration was not found");
        }
        if (resolved.value.registrationId !== registrationId ||
            resolved.value.registrationDigest !== resolved.digest ||
            digestWithoutField(resolved.value, "registrationDigest") !== resolved.digest) {
            throw new Error("Capability registration authority failed content-address verification.");
        }
        const releases = resolved.value.releases.filter((release) => release.releaseId === selection.releaseSelector ||
            release.bundleDigest === selection.releaseSelector ||
            release.aliases.includes(selection.releaseSelector));
        if (releases.length !== 1 || !releases[0]) {
            throw new Error("Trusted capability release selection did not resolve uniquely.");
        }
        return Object.freeze({ registration: resolved.value, release: releases[0] });
    }
}
