import { canonicalDigest, canonicalJson } from "./canonical-ui-authority.js";
const DIMENSION_GATES = Object.freeze({
    information: "INFORMATION_PARITY", availability: "AVAILABILITY_PARITY", validation: "VALIDATION_PARITY",
    state: "STATE_PARITY", feedback: "FEEDBACK_PARITY", navigation: "NAVIGATION_PARITY", accessibility: "ACCESSIBILITY_PARITY"
});
const PRESENTATION_GATES = Object.freeze({
    hierarchy: "VISUAL_HIERARCHY_PARITY", grouping: "GROUPING_PARITY", "action-emphasis": "ACTION_EMPHASIS_PARITY",
    typography: "TYPOGRAPHY_PARITY", "spacing-density": "SPACING_DENSITY_PARITY", surface: "SURFACE_PARITY",
    "state-distinction": "STATE_DISTINCTION_PARITY", "responsive-adaptive": "RESPONSIVE_ADAPTIVE_PARITY",
    focus: "FOCUS_PARITY", media: "MEDIA_PARITY", motion: "MOTION_PARITY"
});
function gate(disposition, findings = []) {
    return Object.freeze({ disposition, findings: Object.freeze([...findings]) });
}
function semanticKey(key) { return `${key.slice(0, 1).toLowerCase()}${key.slice(1)}`; }
function semanticObservation(value, containingKey = "") {
    if (Array.isArray(value))
        return value.map((member) => semanticObservation(member, containingKey));
    if (value && typeof value === "object")
        return Object.fromEntries(Object.entries(value)
            .map(([key, member]) => {
            const admittedKey = semanticKey(key);
            return [admittedKey, semanticObservation(member, admittedKey)];
        }));
    if (typeof value === "string" && containingKey === "path")
        return "<physical-path>";
    if (typeof value === "string" && ["observedAt", "startedAt", "completedAt", "timestamp"].includes(containingKey))
        return "<runtime-time>";
    return value;
}
function dimensionValues(testimony, dimension) {
    return testimony.vectorResults.map((vector) => ({
        vectorId: vector.vectorId,
        steps: vector.steps.map((step) => ({ stepId: step.stepId, values: semanticObservation(step.observations[dimension]) }))
            .filter((step) => step.values.length > 0)
    }));
}
function actionValues(testimony) {
    return testimony.vectorResults.map((vector) => ({
        vectorId: vector.vectorId, disposition: vector.interactionDisposition,
        steps: vector.steps.filter((step) => step.semanticAction === "invoke-action")
            .map((step) => ({ stepId: step.stepId, target: step.target, disposition: step.interactionDisposition }))
    }));
}
function presentationValues(claimant, dimension) {
    return claimant.presentation.observations.filter((observation) => observation.dimension === dimension)
        .map((observation) => ({ target: observation.target, declaredIntent: observation.declaredIntent, disposition: observation.disposition }));
}
function compareClaimants(label, claimants, project) {
    const baseline = claimants[0];
    const expected = canonicalJson(project(baseline));
    const findings = claimants.slice(1).filter((claimant) => canonicalJson(project(claimant)) !== expected)
        .map((claimant) => `${label} differs between ${baseline.target} and ${claimant.target} testimony.`);
    return findings.length === 0 ? gate("PASS") : gate("FAIL", findings);
}
function relationshipSignature(values) {
    return values.map((value) => `${value.targetConceptId}:${value.cardinality}`).sort();
}
function conceptSignature(concept) {
    return {
        conceptId: concept.conceptId, members: [...concept.members].sort(), relationships: relationshipSignature(concept.relationships),
        behaviors: [...concept.behaviors].sort()
    };
}
function structuralFindings(model, testimony) {
    const claims = new Map(testimony.concepts.map((concept) => [concept.conceptId, concept]));
    const findings = [];
    for (const required of model.concepts) {
        const claim = claims.get(required.conceptId);
        if (!claim) {
            findings.push(`${testimony.embodimentTarget} does not represent ${required.conceptId}.`);
            continue;
        }
        const members = new Set(claim.members);
        const behaviors = new Set(claim.behaviors);
        const relationships = new Set(relationshipSignature(claim.relationships));
        findings.push(...required.requiredMembers.filter((member) => !members.has(member))
            .map((member) => `${testimony.embodimentTarget}:${required.conceptId} is missing member ${member}.`));
        findings.push(...required.requiredBehaviors.filter((behavior) => !behaviors.has(behavior))
            .map((behavior) => `${testimony.embodimentTarget}:${required.conceptId} is missing behavior ${behavior}.`));
        findings.push(...relationshipSignature(required.relationships).filter((relationship) => !relationships.has(relationship))
            .map((relationship) => `${testimony.embodimentTarget}:${required.conceptId} is missing relationship ${relationship}.`));
    }
    return findings;
}
function structuralValues(model, testimony, layer) {
    const admitted = new Set(model.concepts.filter((concept) => layer === undefined || concept.layer === layer).map((concept) => concept.conceptId));
    return testimony.concepts.filter((concept) => admitted.has(concept.conceptId)).map(conceptSignature)
        .sort((left, right) => String(left.conceptId).localeCompare(String(right.conceptId)));
}
export class UiParityEvaluator {
    evaluate(input) {
        if (input.claimants.length < 2)
            throw new Error("Cross-apply UI parity requires at least two admitted claimants.");
        const targets = input.claimants.map((claimant) => claimant.target);
        if (new Set(targets).size !== targets.length)
            throw new Error("Cross-apply UI parity claimant targets must be unique.");
        for (const claimant of input.claimants) {
            if ([claimant.testimony, claimant.presentation, claimant.wiring, claimant.structure]
                .some((item) => item.embodimentTarget !== claimant.target))
                throw new Error(`Claimant bundle '${claimant.target}' contains target-divergent testimony.`);
        }
        const corpusDigest = canonicalDigest(input.vectors);
        const objectModelDigest = canonicalDigest(input.objectModel);
        const gates = {};
        const targetGates = {};
        gates.AUTHORITY_IDENTITY = input.claimants.every((claimant) => claimant.testimony.authorityDigest === input.identity.authorityDigest &&
            claimant.presentation.authorityDigest === input.identity.authorityDigest && claimant.wiring.authorityDigest === input.identity.authorityDigest)
            ? gate("PASS") : gate("FAIL", ["One or more embodiments executed a different UI authority digest."]);
        gates.OBJECT_MODEL_IDENTITY = input.claimants.every((claimant) => claimant.structure.objectModelDigest === objectModelDigest)
            ? gate("PASS") : gate("FAIL", ["One or more embodiments claimed a different canonical UI object-model digest."]);
        gates.STRUCTURAL_PARITY = compareClaimants("semantic implementation structure", input.claimants, (claimant) => structuralValues(input.objectModel, claimant.structure));
        gates.EVIDENCE_STRUCTURE_PARITY = compareClaimants("evidence object structure", input.claimants, (claimant) => structuralValues(input.objectModel, claimant.structure, "evidence"));
        gates.VECTOR_CORPUS_IDENTITY = input.claimants.every((claimant) => claimant.testimony.vectorCorpusDigest === corpusDigest)
            ? gate("PASS") : gate("FAIL", ["One or more embodiments executed a different UI vector corpus digest."]);
        const admittedConceptIds = new Set(input.objectModel.concepts.map((concept) => concept.conceptId));
        for (const claimant of input.claimants) {
            const structural = structuralFindings(input.objectModel, claimant.structure);
            const boundary = claimant.structure.rawAuthorityAccessSites.filter((site) => site.disposition !== "ADMISSION_BOUNDARY")
                .map((site) => `${claimant.target} raw authority access leaked into ${site.implementationRef}:${site.member}.`);
            const ownership = [
                ...claimant.structure.targetOwnedSemanticConcepts,
                ...claimant.structure.concepts.map((concept) => concept.conceptId).filter((conceptId) => !admittedConceptIds.has(conceptId))
            ].map((conceptId) => `${claimant.target} owns undeclared semantic concept ${conceptId}.`);
            const native = claimant.presentation.observations.filter((observation) => observation.disposition !== "OBSERVED")
                .map((observation) => `${claimant.target} did not realize ${observation.dimension}:${observation.target}.`);
            const wiring = [
                ...claimant.wiring.unboundRequiredInteractions.map((item) => `${claimant.target} did not realize ${item.semanticKind}:${item.refId}.`),
                ...claimant.wiring.inventedInteractions.map((item) => `${claimant.target} invented ${item.semanticKind}:${item.refId}.`)
            ];
            targetGates[claimant.target] = Object.freeze({
                SEMANTIC_STRUCTURE: structural.length === 0 && claimant.structure.disposition === "PASS" ? gate("PASS") : gate("FAIL", structural.length > 0 ? structural : [`${claimant.target} structural testimony disposition is FAIL.`]),
                RAW_AUTHORITY_BOUNDARY: boundary.length === 0 ? gate("PASS") : gate("FAIL", boundary),
                TARGET_SEMANTIC_OWNERSHIP: ownership.length === 0 ? gate("PASS") : gate("FAIL", ownership),
                PLATFORM_NATIVE: native.length === 0 && claimant.presentation.platformNativeDisposition === "PASS" ? gate("PASS") : gate("FAIL", native.length > 0 ? native : [`${claimant.target} platform-native disposition is FAIL.`]),
                FRAMEWORK_WIRING: wiring.length === 0 && claimant.wiring.disposition === "PASS" ? gate("PASS") : gate("FAIL", wiring.length > 0 ? wiring : [`${claimant.target} wiring disposition is FAIL.`]),
                EXECUTABLE_ORIGIN: claimant.testimony.executableOrigin === "PROJECTED_ONLY" ? gate("PROJECTED_ONLY") : gate("FAIL", [`${claimant.target} executable origin was not PROJECTED_ONLY.`])
            });
        }
        for (const [dimension, gateId] of Object.entries(DIMENSION_GATES)) {
            gates[gateId] = compareClaimants(dimension, input.claimants, (claimant) => dimensionValues(claimant.testimony, dimension));
        }
        gates.ACTION_PARITY = compareClaimants("action disposition", input.claimants, (claimant) => actionValues(claimant.testimony));
        gates.PRESENTATION_PROFILE_IDENTITY = input.claimants.every((claimant) => claimant.presentation.presentationProfileDigest === input.claimants[0].presentation.presentationProfileDigest)
            ? gate("PASS") : gate("FAIL", ["One or more embodiments executed a different presentation profile digest."]);
        for (const [dimension, gateId] of Object.entries(PRESENTATION_GATES)) {
            gates[gateId] = compareClaimants(`${dimension} presentation intent`, input.claimants, (claimant) => presentationValues(claimant, dimension));
        }
        const expected = new Map(input.vectors.vectors.map((vector) => [vector.vectorId, vector.expectedDisposition]));
        const closureFindings = input.claimants.flatMap((claimant) => claimant.testimony.vectorResults.map((result) => ({
            target: claimant.target, vectorId: result.vectorId, expected: expected.get(result.vectorId), actual: result.interactionDisposition
        }))).filter((item) => item.expected !== item.actual)
            .map((item) => `${item.target}:${item.vectorId} expected ${String(item.expected)} but observed ${item.actual}.`);
        const vectorIds = new Set(input.vectors.vectors.map((vector) => vector.vectorId));
        const coveredConditions = new Set(input.coverage.conditions.map((condition) => condition.conditionId));
        closureFindings.push(...input.identity.experienceConditionIds.filter((conditionId) => !coveredConditions.has(conditionId))
            .map((conditionId) => `Experience condition '${conditionId}' has no admitted UI vector coverage.`));
        closureFindings.push(...input.coverage.conditions.filter((condition) => !input.identity.experienceConditionIds.includes(condition.conditionId))
            .map((condition) => `Experience coverage references unknown condition '${condition.conditionId}'.`));
        closureFindings.push(...input.coverage.conditions.flatMap((condition) => condition.vectorIds.filter((vectorId) => !vectorIds.has(vectorId))
            .map((vectorId) => `Experience condition '${condition.conditionId}' references unknown vector '${vectorId}'.`)));
        const prerequisitePass = Object.values(gates).every((value) => value.disposition !== "FAIL") &&
            Object.values(targetGates).flatMap((value) => Object.values(value)).every((value) => value.disposition !== "FAIL");
        gates.EXPERIENCE_PARITY = prerequisitePass && closureFindings.length === 0 ? gate("PASS")
            : gate("FAIL", closureFindings.length > 0 ? closureFindings : ["A required cross-apply gate failed."]);
        const experienceParity = gates.EXPERIENCE_PARITY.disposition === "PASS" ? "PASS" : "FAIL";
        return Object.freeze({
            parityEvidenceType: "consumer-ui-parity-evidence.v1", applicationId: input.identity.applicationId,
            targets: Object.freeze(targets), authorityDigest: input.identity.authorityDigest, objectModelDigest,
            vectorCorpusDigest: corpusDigest, experienceCoverageDigest: canonicalDigest(input.coverage),
            presentationProfileDigest: input.claimants[0].presentation.presentationProfileDigest,
            gates: Object.freeze(gates), targetGates: Object.freeze(targetGates),
            proofCellCount: Object.keys(gates).length + Object.values(targetGates).reduce((count, value) => count + Object.keys(value).length, 0),
            crossApplyDisposition: experienceParity === "PASS" ? "CROSS_APPLY_UI_CONFORMANT" : "CROSS_APPLY_UI_DIVERGENT", experienceParity
        });
    }
}
