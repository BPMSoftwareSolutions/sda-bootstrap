import { sha256Digest } from "../../../enterprise/control-plane/canonical-json.js";
export function digestWithoutField(value, digestField) {
    const digestable = { ...value };
    delete digestable[digestField];
    return sha256Digest(digestable);
}
function compareText(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
export function digestCapabilityGraph(entries) {
    const normalized = entries.map((entry) => ({
        ...entry,
        requiredMechanics: [...entry.requiredMechanics].sort(compareText)
    })).sort((left, right) => compareText(`${left.scenarioId}\u0000${left.responsibilityId}\u0000${left.obligationId}\u0000${left.experienceId}`, `${right.scenarioId}\u0000${right.responsibilityId}\u0000${right.obligationId}\u0000${right.experienceId}`));
    return sha256Digest(normalized);
}
export function isConstructDeterministicRealizationPlanInput(value) {
    if (!value || typeof value !== "object")
        return false;
    const input = value;
    return input.inputType === "construct-deterministic-realization-plan-input.v1" &&
        !!input.request &&
        !!input.intentAuthority &&
        !!input.capabilityRegistration &&
        !!input.realizationPolicy &&
        Array.isArray(input.environmentProfiles) &&
        Array.isArray(input.capabilityGraph) &&
        !!input.providerCatalog;
}
export function isRealizationPlanCompilationEvidence(value) {
    if (!value || typeof value !== "object")
        return false;
    const evidence = value;
    if (evidence.evidenceType !== "sda-realization-plan-compilation-evidence.v1" || !Array.isArray(evidence.findings)) {
        return false;
    }
    if (evidence.disposition === "PLANNED") {
        return evidence.findings.length === 0 && !!evidence.plan && typeof evidence.plan === "object";
    }
    return evidence.disposition === "BLOCKED" && evidence.findings.length > 0 && evidence.plan === undefined;
}
