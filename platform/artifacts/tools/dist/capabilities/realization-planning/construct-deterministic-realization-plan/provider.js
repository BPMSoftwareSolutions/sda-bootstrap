import { sha256Digest } from "../../../enterprise/control-plane/canonical-json.js";
import { digestWithoutField, digestCapabilityGraph } from "./model.js";
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
function compareText(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
function sorted(values) {
    return [...values].sort(compareText);
}
function hasExactMembers(value, expected) {
    const actual = Object.keys(value).sort(compareText);
    const normalizedExpected = [...expected].sort(compareText);
    return actual.length === normalizedExpected.length &&
        actual.every((member, index) => member === normalizedExpected[index]);
}
function isSortedUnique(values) {
    const normalized = [...new Set(values)].sort(compareText);
    return normalized.length === values.length && values.every((value, index) => value === normalized[index]);
}
function includesEvery(available, required) {
    const availableValues = new Set(available);
    return required.every((value) => availableValues.has(value));
}
function findingSort(left, right) {
    return compareText(`${left.code}\u0000${left.targetId ?? ""}\u0000${left.responsibilityId ?? ""}\u0000${left.detail}`, `${right.code}\u0000${right.targetId ?? ""}\u0000${right.responsibilityId ?? ""}\u0000${right.detail}`);
}
function bindingSort(left, right) {
    return compareText(`${left.scenarioId}\u0000${left.responsibilityId}\u0000${left.providerId}`, `${right.scenarioId}\u0000${right.responsibilityId}\u0000${right.providerId}`);
}
function matchingProviders(providers, profile, graphEntry) {
    return providers.filter((provider) => provider.responsibilityIds.includes(graphEntry.responsibilityId) &&
        provider.environmentProfileIds.includes(profile.profileId) &&
        profile.permittedProviderClasses.includes(provider.providerClass) &&
        includesEvery(provider.mechanics, graphEntry.requiredMechanics)).sort((left, right) => compareText(left.providerId, right.providerId));
}
function validateIntegrity(input) {
    const findings = [];
    const authorities = [
        ["intent authority", input.intentAuthority, "authorityDigest", input.intentAuthority.authorityDigest],
        ["capability registration", input.capabilityRegistration, "registrationDigest", input.capabilityRegistration.registrationDigest],
        ["realization policy", input.realizationPolicy, "policyDigest", input.realizationPolicy.policyDigest],
        ["provider catalog", input.providerCatalog, "catalogDigest", input.providerCatalog.catalogDigest],
        ...input.environmentProfiles.map((profile) => [`environment profile '${profile.profileId}'`, profile, "profileDigest", profile.profileDigest])
    ];
    for (const [label, authority, digestField, actualDigest] of authorities) {
        const expectedDigest = digestWithoutField(authority, digestField);
        if (actualDigest !== expectedDigest) {
            findings.push({
                code: "AUTHORITY_DIGEST_MISMATCH",
                detail: `${label} digest '${actualDigest}' does not match canonical content digest '${expectedDigest}'`
            });
        }
    }
    const expectedGraphDigest = digestCapabilityGraph(input.capabilityGraph);
    if (input.capabilityGraphDigest !== expectedGraphDigest) {
        findings.push({
            code: "CAPABILITY_GRAPH_DIGEST_MISMATCH",
            detail: `capability graph digest '${input.capabilityGraphDigest}' does not match canonical graph digest '${expectedGraphDigest}'`
        });
    }
    for (const [label, digest] of [
        ["intent admission evidence", input.intentAuthority.admissionEvidenceDigest],
        ["registration admission evidence", input.capabilityRegistration.admissionEvidenceDigest],
        ["realization policy admission evidence", input.realizationPolicy.admissionEvidenceDigest],
        ["interface authority", input.interfaceAuthorityDigest],
        ["capability graph", input.capabilityGraphDigest],
        ["policy snapshot", input.policySnapshotDigest],
        ["projector", input.projectorDigest],
        ...input.capabilityRegistration.releases.map((release) => [`release '${release.releaseId}' bundle`, release.bundleDigest]),
        ...input.environmentProfiles.map((profile) => [`environment profile '${profile.profileId}' admission evidence`, profile.admissionEvidenceDigest]),
        ...input.contractDigests.map((digest, index) => [`contract[${index}]`, digest]),
        ...input.providerCatalog.providers.map((provider) => [`provider '${provider.providerId}' implementation`, provider.implementationDigest])
    ]) {
        if (!DIGEST_PATTERN.test(digest)) {
            findings.push({ code: "EXTERNAL_DIGEST_INVALID", detail: `${label} digest '${digest}' is not a sha256 digest` });
        }
    }
    return findings;
}
function validateAuthorityRelationships(input) {
    const findings = [];
    const { request, intentAuthority: intent, capabilityRegistration: registration, realizationPolicy: policy } = input;
    if (request.intentId !== intent.intentId) {
        findings.push({ code: "INTENT_MISMATCH", detail: `request intent '${request.intentId}' does not match authority '${intent.intentId}'` });
    }
    if (request.registrationId !== registration.registrationId || intent.capabilityId !== registration.capabilityId) {
        findings.push({
            code: "REGISTRATION_MISMATCH",
            detail: `registration '${registration.registrationId}' does not bind request '${request.registrationId}' and capability '${intent.capabilityId}'`
        });
    }
    if (registration.state !== "REGISTERED") {
        findings.push({ code: "REGISTRATION_NOT_ELIGIBLE", detail: `registration state '${registration.state}' does not permit a new plan` });
    }
    if (!registration.releases.some((release) => release.releaseId === request.releaseId)) {
        findings.push({ code: "RELEASE_NOT_FOUND", detail: `release '${request.releaseId}' is not admitted by registration '${registration.registrationId}'` });
    }
    if (request.realizationPolicyId !== policy.policyId) {
        findings.push({ code: "POLICY_MISMATCH", detail: `request policy '${request.realizationPolicyId}' does not match authority '${policy.policyId}'` });
    }
    if (!registration.allowedRealizationPolicyIds.includes(request.realizationPolicyId)) {
        findings.push({ code: "POLICY_NOT_PERMITTED", detail: `policy '${request.realizationPolicyId}' is not permitted by registration '${registration.registrationId}'` });
    }
    const duplicateValues = (values) => {
        const seen = new Set();
        const duplicates = new Set();
        for (const value of values) {
            if (seen.has(value))
                duplicates.add(value);
            seen.add(value);
        }
        return [...duplicates].sort(compareText);
    };
    for (const releaseId of duplicateValues(registration.releases.map((release) => release.releaseId))) {
        findings.push({ code: "DUPLICATE_RELEASE", detail: `release '${releaseId}' is declared more than once` });
    }
    for (const profileId of duplicateValues(input.environmentProfiles.map((profile) => profile.profileId))) {
        findings.push({ code: "DUPLICATE_ENVIRONMENT_PROFILE", detail: `environment profile '${profileId}' is declared more than once` });
    }
    for (const providerId of duplicateValues(input.providerCatalog.providers.map((provider) => provider.providerId))) {
        findings.push({ code: "DUPLICATE_PROVIDER", detail: `provider '${providerId}' is declared more than once` });
    }
    for (const entryId of duplicateValues(input.capabilityGraph.map((entry) => `${entry.scenarioId}/${entry.responsibilityId}`))) {
        findings.push({ code: "DUPLICATE_GRAPH_ENTRY", detail: `capability graph entry '${entryId}' is declared more than once` });
    }
    const requiredScenarios = new Set(intent.requiredScenarioIds);
    const requiredObligations = new Set(intent.requiredObligationIds);
    const requiredExperiences = new Set(intent.requiredExperienceIds);
    for (const entry of input.capabilityGraph) {
        if (!requiredScenarios.has(entry.scenarioId) ||
            !requiredObligations.has(entry.obligationId) ||
            !requiredExperiences.has(entry.experienceId)) {
            findings.push({
                code: "CAPABILITY_GRAPH_MISMATCH",
                responsibilityId: entry.responsibilityId,
                detail: `graph entry '${entry.scenarioId}' is not fully required by intent '${intent.intentId}'`
            });
        }
    }
    for (const scenarioId of [...requiredScenarios].sort(compareText)) {
        if (!input.capabilityGraph.some((entry) => entry.scenarioId === scenarioId)) {
            findings.push({ code: "CAPABILITY_GRAPH_MISMATCH", detail: `required scenario '${scenarioId}' is absent from the capability graph` });
        }
    }
    for (const obligationId of [...requiredObligations].sort(compareText)) {
        if (!input.capabilityGraph.some((entry) => entry.obligationId === obligationId)) {
            findings.push({ code: "CAPABILITY_GRAPH_MISMATCH", detail: `required obligation '${obligationId}' is absent from the capability graph` });
        }
    }
    for (const experienceId of [...requiredExperiences].sort(compareText)) {
        if (!input.capabilityGraph.some((entry) => entry.experienceId === experienceId)) {
            findings.push({ code: "CAPABILITY_GRAPH_MISMATCH", detail: `required experience '${experienceId}' is absent from the capability graph` });
        }
    }
    return findings;
}
function policyDecisionIsValid(input, targetId, profile, candidate) {
    if (!candidate || typeof candidate !== "object")
        return false;
    const decision = candidate;
    if (!Array.isArray(decision.reasonCodes) || typeof decision.decisionDigest !== "string")
        return false;
    const validReasonCodes = new Set([
        "ACTIVATION_MODE_UNSUPPORTED",
        "ENVIRONMENT_CLASS_UNSUPPORTED",
        "IDLE_DISPOSITION_UNSUPPORTED",
        "MINIMUM_WARM_CAPACITY_UNSUPPORTED",
        "PLACEMENT_MODE_UNSUPPORTED",
        "REHYDRATION_MODE_UNSUPPORTED"
    ]);
    return hasExactMembers(decision, [
        "decisionType",
        "decisionId",
        "targetId",
        "registrationDigest",
        "realizationPolicyId",
        "realizationPolicyDigest",
        "environmentProfileId",
        "environmentProfileDigest",
        "policySnapshotDigest",
        "disposition",
        "activationMode",
        "placementMode",
        "idleDisposition",
        "reasonCodes",
        "evaluatorId",
        "evaluatorDigest",
        "decisionDigest"
    ]) &&
        decision.decisionType === "sda-realization-policy-decision.v1" &&
        decision.decisionId === `${input.request.planId}-${targetId}-policy-decision` &&
        typeof decision.evaluatorId === "string" && /^[a-z][a-z0-9-]*(?:\.v[1-9][0-9]*)?$/.test(decision.evaluatorId) &&
        typeof decision.evaluatorDigest === "string" && DIGEST_PATTERN.test(decision.evaluatorDigest) &&
        (decision.disposition === "PERMITTED" || decision.disposition === "DENIED") &&
        isSortedUnique(decision.reasonCodes) && decision.reasonCodes.every((reason) => validReasonCodes.has(reason)) &&
        decision.decisionDigest === digestWithoutField(decision, "decisionDigest") &&
        decision.targetId === targetId &&
        decision.registrationDigest === input.capabilityRegistration.registrationDigest &&
        decision.realizationPolicyId === input.realizationPolicy.policyId &&
        decision.realizationPolicyDigest === input.realizationPolicy.policyDigest &&
        decision.environmentProfileId === profile.profileId &&
        decision.environmentProfileDigest === profile.profileDigest &&
        decision.policySnapshotDigest === input.policySnapshotDigest &&
        decision.activationMode === input.realizationPolicy.activation.mode &&
        decision.placementMode === input.realizationPolicy.placement.mode &&
        decision.idleDisposition === input.realizationPolicy.retention.idleDisposition &&
        DIGEST_PATTERN.test(decision.decisionDigest) &&
        (decision.disposition === "PERMITTED" ? decision.reasonCodes.length === 0 : decision.reasonCodes.length > 0);
}
function projectionIsValid(input, targetId, profile, policyDecision, bindings, candidate) {
    if (!candidate || typeof candidate !== "object")
        return false;
    const projection = candidate;
    if (!Array.isArray(projection.actions) || typeof projection.projectionDigest !== "string")
        return false;
    if (!hasExactMembers(projection, [
        "projectionType",
        "projectionId",
        "targetId",
        "environmentProfileId",
        "environmentProfileDigest",
        "projectorId",
        "projectorDigest",
        "projectorProfileDigest",
        "actions",
        "projectionDigest"
    ]) ||
        projection.projectionType !== "sda-realization-projection-plan.v1" ||
        projection.projectionId !== `${input.request.planId}-${targetId}-projection` ||
        typeof projection.projectorId !== "string" ||
        !/^[a-z][a-z0-9-]*(?:\.v[1-9][0-9]*)?$/.test(projection.projectorId) ||
        projection.projectionDigest !== digestWithoutField(projection, "projectionDigest") ||
        projection.targetId !== targetId ||
        projection.environmentProfileId !== profile.profileId ||
        projection.environmentProfileDigest !== profile.profileDigest ||
        projection.projectorDigest !== input.projectorDigest ||
        typeof projection.projectorProfileDigest !== "string" ||
        !DIGEST_PATTERN.test(projection.projectorProfileDigest) ||
        !DIGEST_PATTERN.test(projection.projectionDigest) ||
        projection.actions.length !== bindings.length)
        return false;
    const bindingByResponsibility = new Map(bindings.map((binding) => [binding.responsibilityId, binding]));
    const seenResponsibilities = new Set();
    const requiredSharedDigests = [
        input.capabilityRegistration.releases.find((release) => release.releaseId === input.request.releaseId)?.bundleDigest,
        input.interfaceAuthorityDigest,
        ...input.contractDigests,
        profile.profileDigest,
        policyDecision.decisionDigest
    ].filter((digest) => typeof digest === "string");
    const actionOrder = projection.actions.map((action) => `${action?.scenarioId ?? ""}\u0000${action?.responsibilityId ?? ""}\u0000${action?.providerId ?? ""}`);
    if (!isSortedUnique(actionOrder))
        return false;
    for (const action of projection.actions) {
        if (!action || typeof action !== "object" || !Array.isArray(action.inputDigests) ||
            !action.artifact || typeof action.artifact !== "object")
            return false;
        const binding = bindingByResponsibility.get(action.responsibilityId);
        if (!hasExactMembers(action, [
            "actionType",
            "actionId",
            "scenarioId",
            "responsibilityId",
            "providerId",
            "implementationDigest",
            "inputDigests",
            "artifact"
        ]) ||
            !hasExactMembers(action.artifact, ["artifactId", "mediaType", "expectedDigest"]) ||
            !binding || seenResponsibilities.has(action.responsibilityId) ||
            action.actionType !== "PROJECT_PROVIDER_ARTIFACT" ||
            action.actionId !== `${targetId}-${action.responsibilityId}-projection` ||
            action.scenarioId !== binding.scenarioId ||
            action.providerId !== binding.providerId ||
            action.implementationDigest !== binding.implementationDigest ||
            action.artifact.artifactId !== `${targetId}-${action.responsibilityId}-artifact` ||
            action.artifact.mediaType !== "application/vnd.scenario-driven.realization-provider+json" ||
            !DIGEST_PATTERN.test(action.artifact.expectedDigest) ||
            !isSortedUnique(action.inputDigests) ||
            !action.inputDigests.includes(binding.implementationDigest) ||
            !includesEvery(action.inputDigests, requiredSharedDigests) ||
            !action.inputDigests.every((digest) => typeof digest === "string" && DIGEST_PATTERN.test(digest)))
            return false;
        seenResponsibilities.add(action.responsibilityId);
    }
    return true;
}
async function resolveTargets(input, findings, policyDecisionPort, projectorPort, hasGlobalFindings) {
    const profileById = new Map(input.environmentProfiles.map((profile) => [profile.profileId, profile]));
    const seenTargets = new Set();
    const resolutions = [];
    for (const target of [...input.request.targets].sort((left, right) => compareText(left.targetId, right.targetId))) {
        const targetFindingStart = findings.length;
        if (seenTargets.has(target.targetId)) {
            findings.push({ code: "DUPLICATE_TARGET", targetId: target.targetId, detail: `target '${target.targetId}' occurs more than once` });
            continue;
        }
        seenTargets.add(target.targetId);
        const profile = profileById.get(target.environmentProfileId);
        if (!profile) {
            findings.push({
                code: "ENVIRONMENT_PROFILE_NOT_FOUND",
                targetId: target.targetId,
                detail: `environment profile '${target.environmentProfileId}' is not present in the admitted input`
            });
            continue;
        }
        if (!input.capabilityRegistration.allowedEnvironmentProfileIds.includes(profile.profileId)) {
            findings.push({
                code: "ENVIRONMENT_PROFILE_NOT_PERMITTED",
                targetId: target.targetId,
                detail: `environment profile '${profile.profileId}' is not permitted by registration '${input.capabilityRegistration.registrationId}'`
            });
            continue;
        }
        const bindings = [];
        for (const entry of input.capabilityGraph) {
            if (!includesEvery(profile.supportedMechanics, entry.requiredMechanics)) {
                findings.push({
                    code: "PROFILE_MECHANIC_UNSUPPORTED",
                    targetId: target.targetId,
                    responsibilityId: entry.responsibilityId,
                    detail: `profile '${profile.profileId}' does not support mechanics: ${sorted(entry.requiredMechanics).join(", ")}`
                });
                continue;
            }
            const candidates = matchingProviders(input.providerCatalog.providers, profile, entry);
            if (candidates.length === 0) {
                findings.push({
                    code: "PROVIDER_NOT_FOUND",
                    targetId: target.targetId,
                    responsibilityId: entry.responsibilityId,
                    detail: `no admitted provider satisfies profile '${profile.profileId}' and required mechanics`
                });
                continue;
            }
            if (candidates.length > 1) {
                findings.push({
                    code: "PROVIDER_AMBIGUOUS",
                    targetId: target.targetId,
                    responsibilityId: entry.responsibilityId,
                    detail: `multiple admitted providers satisfy the requirement: ${candidates.map((candidate) => candidate.providerId).join(", ")}`
                });
                continue;
            }
            const provider = candidates[0];
            if (!provider)
                continue;
            bindings.push({
                scenarioId: entry.scenarioId,
                responsibilityId: entry.responsibilityId,
                obligationId: entry.obligationId,
                experienceId: entry.experienceId,
                requiredMechanics: sorted(entry.requiredMechanics),
                providerId: provider.providerId,
                providerClass: provider.providerClass,
                implementationDigest: provider.implementationDigest
            });
        }
        if (hasGlobalFindings || findings.length > targetFindingStart)
            continue;
        let policyDecision;
        try {
            policyDecision = await policyDecisionPort.decide({
                planId: input.request.planId,
                targetId: target.targetId,
                capabilityRegistration: input.capabilityRegistration,
                realizationPolicy: input.realizationPolicy,
                environmentProfile: profile,
                policySnapshotDigest: input.policySnapshotDigest
            });
        }
        catch {
            findings.push({
                code: "POLICY_DECISION_FAILED",
                targetId: target.targetId,
                detail: `policy decision port failed for target '${target.targetId}'`
            });
            continue;
        }
        let policyDecisionValid = false;
        try {
            policyDecisionValid = policyDecisionIsValid(input, target.targetId, profile, policyDecision);
        }
        catch {
            policyDecisionValid = false;
        }
        if (!policyDecisionValid) {
            findings.push({
                code: "POLICY_DECISION_INVALID",
                targetId: target.targetId,
                detail: `policy decision for target '${target.targetId}' is not bound to the pinned planning authority`
            });
            continue;
        }
        if (policyDecision.disposition === "DENIED") {
            findings.push({
                code: "POLICY_DECISION_DENIED",
                targetId: target.targetId,
                detail: `policy denied target '${target.targetId}': ${policyDecision.reasonCodes.join(", ")}`
            });
            continue;
        }
        const release = input.capabilityRegistration.releases.find((candidate) => candidate.releaseId === input.request.releaseId);
        if (!release)
            continue;
        let projection;
        try {
            projection = await projectorPort.planProjection({
                planId: input.request.planId,
                targetId: target.targetId,
                capabilityId: input.capabilityRegistration.capabilityId,
                capabilityBundleDigest: release.bundleDigest,
                interfaceAuthorityDigest: input.interfaceAuthorityDigest,
                contractDigests: sorted(input.contractDigests),
                environmentProfileId: profile.profileId,
                environmentProfileDigest: profile.profileDigest,
                policyDecisionDigest: policyDecision.decisionDigest,
                projectorDigest: input.projectorDigest,
                providerBindings: bindings
            });
        }
        catch {
            findings.push({
                code: "PROJECTOR_FAILED",
                targetId: target.targetId,
                detail: `projector port failed for target '${target.targetId}'`
            });
            continue;
        }
        let projectionValid = false;
        try {
            projectionValid = projectionIsValid(input, target.targetId, profile, policyDecision, bindings, projection);
        }
        catch {
            projectionValid = false;
        }
        if (!projectionValid) {
            findings.push({
                code: "PROJECTOR_OUTPUT_INVALID",
                targetId: target.targetId,
                detail: `projection plan for target '${target.targetId}' is not bound to the selected providers and pinned authority`
            });
            continue;
        }
        resolutions.push({
            targetResolutionType: "sda-realization-target-resolution.v1",
            targetId: target.targetId,
            environmentProfileId: profile.profileId,
            environmentProfileDigest: profile.profileDigest,
            providerBindings: bindings.sort(bindingSort),
            policyDecision,
            projection
        });
    }
    return resolutions;
}
export class ConstructDeterministicRealizationPlanProvider {
    policyDecisionPort;
    projectorPort;
    responsibilityId = "resolve-admitted-authority-into-target-plans";
    constructor(policyDecisionPort, projectorPort) {
        this.policyDecisionPort = policyDecisionPort;
        this.projectorPort = projectorPort;
    }
    async execute(input) {
        const findings = [
            ...validateIntegrity(input),
            ...validateAuthorityRelationships(input)
        ];
        const targetResolutions = await resolveTargets(input, findings, this.policyDecisionPort, this.projectorPort, findings.length > 0);
        if (findings.length > 0) {
            return {
                evidenceType: "sda-realization-plan-compilation-evidence.v1",
                disposition: "BLOCKED",
                findings: findings.sort(findingSort)
            };
        }
        const release = input.capabilityRegistration.releases.find((candidate) => candidate.releaseId === input.request.releaseId);
        if (!release) {
            throw new Error("Release resolution invariant failed after admission.");
        }
        const planWithoutDigest = {
            planType: "sda-realization-plan.v1",
            planId: input.request.planId,
            intent: {
                intentId: input.intentAuthority.intentId,
                version: input.intentAuthority.version,
                authorityDigest: input.intentAuthority.authorityDigest
            },
            capabilityRegistration: {
                registrationId: input.capabilityRegistration.registrationId,
                registrationDigest: input.capabilityRegistration.registrationDigest
            },
            capabilityRelease: {
                capabilityId: input.capabilityRegistration.capabilityId,
                releaseId: release.releaseId,
                bundleDigest: release.bundleDigest
            },
            realizationPolicy: {
                policyId: input.realizationPolicy.policyId,
                version: input.realizationPolicy.version,
                policyDigest: input.realizationPolicy.policyDigest
            },
            interfaceAuthorityDigest: input.interfaceAuthorityDigest,
            contractDigests: sorted(input.contractDigests),
            capabilityGraphDigest: input.capabilityGraphDigest,
            policySnapshotDigest: input.policySnapshotDigest,
            providerCatalogId: input.providerCatalog.catalogId,
            providerCatalogDigest: input.providerCatalog.catalogDigest,
            projectorDigest: input.projectorDigest,
            targetResolutions,
            provenance: {
                compilerId: "typescript-deterministic-realization-plan-provider.v1",
                canonicalization: "RFC8785",
                digestAlgorithm: "sha256"
            }
        };
        return {
            evidenceType: "sda-realization-plan-compilation-evidence.v1",
            disposition: "PLANNED",
            findings: [],
            plan: {
                ...planWithoutDigest,
                planDigest: sha256Digest(planWithoutDigest)
            }
        };
    }
}
