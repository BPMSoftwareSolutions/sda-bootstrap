import { digestCapabilityGraph, digestWithoutField } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
import { digestAdapterProfile } from "../../model/realization-planning-adapter-profile.js";
import { FileSystemImmutableAuthorityRegistry } from "./file-system-immutable-authority-registry.js";
export function loadFileSystemRealizationPlanningAuthority(options) {
    const create = (authorityKind, verifyAuthority) => new FileSystemImmutableAuthorityRegistry({
        ...options,
        authorityKind,
        verifyAuthority
    });
    const intents = create("INTENT", (value, digest, authorityId) => value.intentId === authorityId && value.authorityDigest === digest && digestWithoutField(value, "authorityDigest") === digest);
    const registrations = create("CAPABILITY_REGISTRATION", (value, digest, authorityId) => value.registrationId === authorityId && value.registrationDigest === digest && digestWithoutField(value, "registrationDigest") === digest);
    const policies = create("REALIZATION_POLICY", (value, digest, authorityId) => value.policyId === authorityId && value.policyDigest === digest && digestWithoutField(value, "policyDigest") === digest);
    const environmentProfiles = create("ENVIRONMENT_PROFILE", (value, digest, authorityId) => value.profileId === authorityId && value.profileDigest === digest && digestWithoutField(value, "profileDigest") === digest);
    const capabilityGraphs = create("CAPABILITY_GRAPH", (value, digest, authorityId) => value.capabilityId === authorityId && value.graphDigest === digest && digestCapabilityGraph(value.entries) === digest);
    const providerCatalogs = create("PROVIDER_CATALOG", (value, digest, authorityId) => value.catalogId === authorityId && value.catalogDigest === digest && digestWithoutField(value, "catalogDigest") === digest);
    const planningSnapshots = create("PLANNING_SNAPSHOT", (value, digest, authorityId) => value.snapshotId === authorityId && value.snapshotDigest === digest && digestWithoutField(value, "snapshotDigest") === digest);
    const policyDecisionProfiles = create("POLICY_DECISION_PROFILE", (value, digest, authorityId) => value.profileId === authorityId && value.profileDigest === digest && digestAdapterProfile(value) === digest);
    const projectorProfiles = create("PROJECTOR_PROFILE", (value, digest, authorityId) => value.profileId === authorityId && value.profileDigest === digest && digestAdapterProfile(value) === digest);
    const all = [
        intents,
        registrations,
        policies,
        environmentProfiles,
        capabilityGraphs,
        providerCatalogs,
        planningSnapshots,
        policyDecisionProfiles,
        projectorProfiles
    ];
    if (!all.every((registry) => registry.manifestDigest === intents.manifestDigest)) {
        throw new Error("Filesystem authority registries did not load one coherent manifest snapshot.");
    }
    return {
        registries: {
            intents,
            registrations,
            policies,
            environmentProfiles,
            capabilityGraphs,
            providerCatalogs,
            planningSnapshots
        },
        policyDecisionProfiles,
        projectorProfiles,
        manifestDigest: intents.manifestDigest
    };
}
