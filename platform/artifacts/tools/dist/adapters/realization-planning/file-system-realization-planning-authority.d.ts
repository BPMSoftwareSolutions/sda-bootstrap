import type { SchemaAdmissionPort } from "../../ports/conformance/schema-admission.js";
import type { RealizationPlanningRegistries } from "../../capabilities/realization-planning/resolve-registered-realization-plan/model.js";
import { type RealizationPolicyDecisionProfile, type RealizationProjectorProfile } from "../../model/realization-planning-adapter-profile.js";
import type { ImmutableAuthorityRegistry } from "../../ports/realization-planning/immutable-authority-registry.js";
export interface FileSystemRealizationPlanningAuthority {
    readonly registries: RealizationPlanningRegistries;
    readonly policyDecisionProfiles: ImmutableAuthorityRegistry<RealizationPolicyDecisionProfile>;
    readonly projectorProfiles: ImmutableAuthorityRegistry<RealizationProjectorProfile>;
    readonly manifestDigest: string;
}
export declare function loadFileSystemRealizationPlanningAuthority(options: {
    readonly registryRoot: string;
    readonly manifestRef: string;
    readonly schemaAdmission: SchemaAdmissionPort;
}): FileSystemRealizationPlanningAuthority;
