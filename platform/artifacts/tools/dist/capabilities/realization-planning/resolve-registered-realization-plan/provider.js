import { digestCapabilityGraph, digestWithoutField } from "../construct-deterministic-realization-plan/model.js";
function compareText(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
function findingSort(left, right) {
    return compareText(`${left.code}\u0000${left.targetId ?? ""}\u0000${left.responsibilityId ?? ""}\u0000${left.detail}`, `${right.code}\u0000${right.targetId ?? ""}\u0000${right.responsibilityId ?? ""}\u0000${right.detail}`);
}
function decisionSort(left, right) {
    return compareText(`${left.authorityKind}\u0000${left.targetId ?? ""}\u0000${left.authorityId}`, `${right.authorityKind}\u0000${right.targetId ?? ""}\u0000${right.authorityId}`);
}
function resolveAuthority(registry, options, decisions, findings) {
    const resolution = registry.resolve(options.authorityId, options.selector.selector);
    if (!resolution) {
        findings.push({
            code: options.notFoundCode,
            detail: `${options.authorityKind.toLowerCase()} '${options.authorityId}' has no selector '${options.selector.selector}'`,
            ...(options.targetId ? { targetId: options.targetId } : {})
        });
        return null;
    }
    decisions.push({
        authorityKind: options.authorityKind,
        authorityId: resolution.authorityId,
        selector: resolution.selector,
        resolvedDigest: resolution.digest,
        resolvedBy: resolution.resolvedBy,
        ...(options.targetId ? { targetId: options.targetId } : {})
    });
    if (options.selector.expectedDigest && options.selector.expectedDigest !== resolution.digest) {
        findings.push({
            code: "SELECTOR_DIGEST_STALE",
            detail: `${options.authorityKind.toLowerCase()} selector '${options.selector.selector}' resolved to '${resolution.digest}', not expected digest '${options.selector.expectedDigest}'`,
            ...(options.targetId ? { targetId: options.targetId } : {})
        });
    }
    return resolution;
}
function releaseResolutionKind(selector, bundleDigest) {
    return selector === bundleDigest ? "DIGEST" : "ALIAS";
}
function snapshotIntegrityFindings(snapshotResolution, graphResolution) {
    const findings = [];
    if (snapshotResolution) {
        const snapshot = snapshotResolution.value;
        if (snapshot.snapshotDigest !== snapshotResolution.digest ||
            digestWithoutField(snapshot, "snapshotDigest") !== snapshot.snapshotDigest) {
            findings.push({ code: "AUTHORITY_DIGEST_MISMATCH", detail: `planning snapshot '${snapshot.snapshotId}' failed digest verification` });
        }
    }
    if (graphResolution) {
        const graph = graphResolution.value;
        if (graph.graphDigest !== graphResolution.digest || digestCapabilityGraph(graph.entries) !== graph.graphDigest) {
            findings.push({ code: "CAPABILITY_GRAPH_DIGEST_MISMATCH", detail: `capability graph '${graph.capabilityId}' failed digest verification` });
        }
    }
    return findings;
}
export class ResolveRegisteredRealizationPlanProvider {
    registries;
    compiler;
    responsibilityId = "resolve-registry-selectors-and-construct-plan";
    constructor(registries, compiler) {
        this.registries = registries;
        this.compiler = compiler;
    }
    async execute(request) {
        const decisions = [];
        const findings = [];
        const intent = resolveAuthority(this.registries.intents, {
            authorityKind: "INTENT",
            authorityId: request.intent.intentId,
            selector: request.intent,
            notFoundCode: "INTENT_SELECTOR_NOT_FOUND"
        }, decisions, findings);
        const registration = resolveAuthority(this.registries.registrations, {
            authorityKind: "CAPABILITY_REGISTRATION",
            authorityId: request.capabilityRegistration.registrationId,
            selector: request.capabilityRegistration,
            notFoundCode: "REGISTRATION_SELECTOR_NOT_FOUND"
        }, decisions, findings);
        const policy = resolveAuthority(this.registries.policies, {
            authorityKind: "REALIZATION_POLICY",
            authorityId: request.realizationPolicy.policyId,
            selector: request.realizationPolicy,
            notFoundCode: "POLICY_SELECTOR_NOT_FOUND"
        }, decisions, findings);
        const snapshot = resolveAuthority(this.registries.planningSnapshots, {
            authorityKind: "PLANNING_SNAPSHOT",
            authorityId: request.planningSnapshot.snapshotId,
            selector: request.planningSnapshot,
            notFoundCode: "PLANNING_SNAPSHOT_SELECTOR_NOT_FOUND"
        }, decisions, findings);
        const profileResolutions = request.targets.map((target) => ({
            target,
            resolution: resolveAuthority(this.registries.environmentProfiles, {
                authorityKind: "ENVIRONMENT_PROFILE",
                authorityId: target.environmentProfile.profileId,
                selector: target.environmentProfile,
                notFoundCode: "ENVIRONMENT_PROFILE_SELECTOR_NOT_FOUND",
                targetId: target.targetId
            }, decisions, findings)
        }));
        const profileDigestById = new Map();
        for (const { target, resolution } of profileResolutions) {
            if (!resolution)
                continue;
            const previousDigest = profileDigestById.get(resolution.value.profileId);
            if (previousDigest && previousDigest !== resolution.digest) {
                findings.push({
                    code: "ENVIRONMENT_PROFILE_SELECTOR_CONFLICT",
                    targetId: target.targetId,
                    detail: `profile '${resolution.value.profileId}' resolves to both '${previousDigest}' and '${resolution.digest}' in one plan request`
                });
            }
            profileDigestById.set(resolution.value.profileId, resolution.digest);
        }
        let release = null;
        if (registration) {
            const candidates = registration.value.releases.filter((candidate) => candidate.releaseId === request.capabilityRelease.selector ||
                candidate.bundleDigest === request.capabilityRelease.selector ||
                candidate.aliases.includes(request.capabilityRelease.selector));
            if (candidates.length === 0) {
                findings.push({ code: "RELEASE_SELECTOR_NOT_FOUND", detail: `release selector '${request.capabilityRelease.selector}' is not registered` });
            }
            else if (candidates.length > 1) {
                findings.push({ code: "RELEASE_SELECTOR_AMBIGUOUS", detail: `release selector '${request.capabilityRelease.selector}' resolves to multiple releases` });
            }
            else {
                const selected = candidates[0];
                if (selected) {
                    release = selected;
                    decisions.push({
                        authorityKind: "CAPABILITY_RELEASE",
                        authorityId: selected.releaseId,
                        selector: request.capabilityRelease.selector,
                        resolvedDigest: selected.bundleDigest,
                        resolvedBy: releaseResolutionKind(request.capabilityRelease.selector, selected.bundleDigest)
                    });
                    if (request.capabilityRelease.expectedBundleDigest &&
                        request.capabilityRelease.expectedBundleDigest !== selected.bundleDigest) {
                        findings.push({
                            code: "SELECTOR_DIGEST_STALE",
                            detail: `capability release selector '${request.capabilityRelease.selector}' resolved to '${selected.bundleDigest}', not expected digest '${request.capabilityRelease.expectedBundleDigest}'`
                        });
                    }
                }
            }
        }
        let graph = null;
        let catalog = null;
        if (snapshot) {
            graph = resolveAuthority(this.registries.capabilityGraphs, {
                authorityKind: "CAPABILITY_GRAPH",
                authorityId: snapshot.value.capabilityId,
                selector: { selector: snapshot.value.capabilityGraphDigest, expectedDigest: snapshot.value.capabilityGraphDigest },
                notFoundCode: "CAPABILITY_GRAPH_SELECTOR_NOT_FOUND"
            }, decisions, findings);
            catalog = resolveAuthority(this.registries.providerCatalogs, {
                authorityKind: "PROVIDER_CATALOG",
                authorityId: snapshot.value.providerCatalogId,
                selector: { selector: snapshot.value.providerCatalogDigest, expectedDigest: snapshot.value.providerCatalogDigest },
                notFoundCode: "PROVIDER_CATALOG_SELECTOR_NOT_FOUND"
            }, decisions, findings);
            const capabilityIds = [
                intent?.value.capabilityId,
                registration?.value.capabilityId,
                snapshot.value.capabilityId,
                graph?.value.capabilityId
            ]
                .filter((value) => typeof value === "string");
            if (new Set(capabilityIds).size > 1) {
                findings.push({ code: "SNAPSHOT_CAPABILITY_MISMATCH", detail: `planning snapshot '${snapshot.value.snapshotId}' does not describe the selected capability` });
            }
        }
        findings.push(...snapshotIntegrityFindings(snapshot, graph));
        if (!intent || !registration || !policy || !snapshot || !release || !graph || !catalog ||
            profileResolutions.some((candidate) => !candidate.resolution) || findings.length > 0) {
            return {
                evidenceType: "sda-registry-backed-realization-plan-evidence.v1",
                disposition: "BLOCKED",
                resolutionDecisions: decisions.sort(decisionSort),
                findings: findings.sort(findingSort)
            };
        }
        const input = {
            inputType: "construct-deterministic-realization-plan-input.v1",
            request: {
                requestType: "sda-realization-plan-request.v1",
                requestId: request.requestId,
                planId: request.planId,
                intentId: intent.value.intentId,
                registrationId: registration.value.registrationId,
                releaseId: release.releaseId,
                realizationPolicyId: policy.value.policyId,
                targets: profileResolutions.map(({ target, resolution }) => ({
                    targetId: target.targetId,
                    environmentProfileId: resolution?.value.profileId ?? target.environmentProfile.profileId
                }))
            },
            intentAuthority: intent.value,
            capabilityRegistration: registration.value,
            realizationPolicy: policy.value,
            environmentProfiles: [...new Map(profileResolutions
                    .map(({ resolution }) => resolution?.value)
                    .filter((value) => !!value)
                    .map((profile) => [profile.profileId, profile])).values()]
                .sort((left, right) => compareText(left.profileId, right.profileId)),
            capabilityGraph: graph.value.entries,
            capabilityGraphDigest: graph.value.graphDigest,
            providerCatalog: catalog.value,
            interfaceAuthorityDigest: snapshot.value.interfaceAuthorityDigest,
            contractDigests: snapshot.value.contractDigests,
            policySnapshotDigest: snapshot.value.policySnapshotDigest,
            projectorDigest: snapshot.value.projectorDigest
        };
        const compilation = await this.compiler.execute(input);
        if (compilation.disposition === "BLOCKED") {
            return {
                evidenceType: "sda-registry-backed-realization-plan-evidence.v1",
                disposition: "BLOCKED",
                resolutionDecisions: decisions.sort(decisionSort),
                findings: [...compilation.findings].sort(findingSort)
            };
        }
        return {
            evidenceType: "sda-registry-backed-realization-plan-evidence.v1",
            disposition: "PLANNED",
            resolutionDecisions: decisions.sort(decisionSort),
            findings: [],
            plan: compilation.plan
        };
    }
}
