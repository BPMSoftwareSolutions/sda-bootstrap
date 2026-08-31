import { type TrustedApiRequestContext } from "./model.js";
import { type CapabilityAvailabilityResource, type CapabilityRegistrationIdentifierRequest, type CapabilityRegistrationResource, type NodeRealizationApiReferenceHostProfile, type RealizationPlanIdentifierRequest, type RealizationPlanResource, type RealizationPlanSubmission } from "./realization-api-model.js";
import type { CapabilityAvailabilityReadPort, CapabilityRegistrationAuthorityRegistry, RealizationAuthoritySelectionPort, RealizationPlanIdentityPort, RealizationPlanRepository, RegisteredRealizationPlannerPort, RegistryBackedRealizationRequestAdmissionPort } from "./realization-api-ports.js";
export declare class RealizationApiApplication {
    private readonly planner;
    private readonly registrations;
    private readonly selections;
    private readonly availabilityReader;
    private readonly plans;
    private readonly identities;
    private readonly requestAdmission;
    private readonly profile;
    constructor(planner: RegisteredRealizationPlannerPort, registrations: CapabilityRegistrationAuthorityRegistry, selections: RealizationAuthoritySelectionPort, availabilityReader: CapabilityAvailabilityReadPort, plans: RealizationPlanRepository, identities: RealizationPlanIdentityPort, requestAdmission: RegistryBackedRealizationRequestAdmissionPort, profile: NodeRealizationApiReferenceHostProfile);
    submit(input: RealizationPlanSubmission, context: TrustedApiRequestContext): Promise<RealizationPlanResource>;
    inspect(input: RealizationPlanIdentifierRequest, context: TrustedApiRequestContext): Promise<RealizationPlanResource>;
    registration(input: CapabilityRegistrationIdentifierRequest, context: TrustedApiRequestContext): Promise<CapabilityRegistrationResource>;
    availability(input: CapabilityRegistrationIdentifierRequest, context: TrustedApiRequestContext): Promise<CapabilityAvailabilityResource>;
    private resolveRegistration;
}
