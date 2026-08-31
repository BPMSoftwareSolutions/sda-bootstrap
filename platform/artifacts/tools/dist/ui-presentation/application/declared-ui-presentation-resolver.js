import { createHash } from "node:crypto";
function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(Object.keys(value).sort()
            .map((key) => [key, canonicalize(value[key])]));
    }
    return value;
}
export function semanticPresentationDigest(value) {
    const digestable = { ...value };
    delete digestable["canonicalDigest"];
    return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(digestable))).digest("hex")}`;
}
export function declaredUiAuthorityDigest(value) {
    const digestable = { ...value };
    delete digestable["authorityDigest"];
    return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(digestable))).digest("hex")}`;
}
function duplicateFindings(values, code) {
    const seen = new Set();
    const duplicates = new Set();
    for (const value of values) {
        if (seen.has(value))
            duplicates.add(value);
        seen.add(value);
    }
    return [...duplicates].sort().map((subjectRef) => ({ code, subjectRef }));
}
export function admitDeclaredUiAuthority(authority) {
    const observedAuthorityDigest = declaredUiAuthorityDigest(authority);
    const findings = [
        ...(authority.authorityDigest === observedAuthorityDigest ? [] : [{
                code: "DECLARED_UI_AUTHORITY_DIGEST_MISMATCH",
                subjectRef: authority.authorityId
            }]),
        ...duplicateFindings(authority.elements.map((item) => item.elementId), "DUPLICATE_SEMANTIC_ELEMENT"),
        ...duplicateFindings(authority.relationships.map((item) => item.relationshipId), "DUPLICATE_SEMANTIC_RELATIONSHIP"),
        ...duplicateFindings(authority.adaptationIntents.map((item) => item.adaptationId), "DUPLICATE_ADAPTATION_INTENT"),
        ...duplicateFindings(authority.promisedExperiences.map((item) => item.experienceRef), "DUPLICATE_PROMISED_EXPERIENCE")
    ].sort((left, right) => `${left.code}:${left.subjectRef}`.localeCompare(`${right.code}:${right.subjectRef}`));
    return Object.freeze({
        evidenceType: "declared-ui-source-admission-evidence.v1",
        authorityId: authority.authorityId,
        declaredAuthorityDigest: authority.authorityDigest,
        observedAuthorityDigest,
        findings,
        disposition: findings.length === 0 ? "ADMITTED" : "REJECTED"
    });
}
function sortStrings(values) {
    return [...values].sort((left, right) => left.localeCompare(right));
}
function normalizeLineage(values) {
    return [...values].sort((left, right) => `${left.originType}:${left.originRef}:${left.authorityDigest}`.localeCompare(`${right.originType}:${right.originRef}:${right.authorityDigest}`));
}
function normalizeElement(element) {
    const normalized = {
        elementId: element.elementId,
        semanticKind: element.semanticKind,
        semanticRole: element.semanticRole,
        informationRefs: sortStrings(element.informationRefs),
        interactionRefs: sortStrings(element.interactionRefs),
        feedbackRefs: sortStrings(element.feedbackRefs),
        stateRefs: sortStrings(element.stateRefs),
        eventRefs: sortStrings(element.eventRefs),
        accessibilityObligations: [...element.accessibilityObligations].sort((left, right) => `${left.kind}:${left.obligationRef}`.localeCompare(`${right.kind}:${right.obligationRef}`)),
        lineage: normalizeLineage(element.lineage)
    };
    return element.content === undefined ? normalized : { ...normalized, content: element.content };
}
export function resolveDeclaredUiPresentation(authority) {
    const elements = [...authority.elements].map(normalizeElement)
        .sort((left, right) => left.elementId.localeCompare(right.elementId));
    const relationships = [...authority.relationships].map((relationship) => ({
        ...relationship,
        lineage: normalizeLineage(relationship.lineage)
    })).sort((left, right) => left.relationshipId.localeCompare(right.relationshipId));
    const adaptationIntents = [...authority.adaptationIntents].map((intent) => ({
        ...intent,
        allowedChangeKinds: [...intent.allowedChangeKinds].sort(),
        invariantRefs: sortStrings(intent.invariantRefs)
    })).sort((left, right) => left.adaptationId.localeCompare(right.adaptationId));
    const withoutDigest = {
        presentationType: "sda-ui-semantic-presentation.v1",
        presentationId: `${authority.authorityId}:semantic-presentation`,
        sourceAuthority: {
            authorityType: authority.authorityType,
            authorityId: authority.authorityId,
            authorityDigest: authority.authorityDigest
        },
        promisedExperienceRefs: sortStrings(authority.promisedExperiences.map((item) => item.experienceRef)),
        elements,
        relationships,
        adaptationIntents,
        presentationProfileRefs: sortStrings(authority.presentationProfileRefs)
    };
    const presentation = Object.freeze({ ...withoutDigest, canonicalDigest: semanticPresentationDigest(withoutDigest) });
    const elementResults = elements.map((element) => ({
        subjectId: element.elementId,
        originCount: element.lineage.length,
        disposition: element.lineage.length > 0 ? "JUSTIFIED" : "UNJUSTIFIED"
    }));
    const relationshipResults = relationships.map((relationship) => ({
        subjectId: relationship.relationshipId,
        originCount: relationship.lineage.length,
        disposition: relationship.lineage.length > 0 ? "JUSTIFIED" : "UNJUSTIFIED"
    }));
    const elementIds = new Set(elements.map((element) => element.elementId));
    const lineageFindings = [
        ...elementResults.filter((result) => result.disposition === "UNJUSTIFIED")
            .map((result) => ({ code: "UNJUSTIFIED_PRESENTATION_ELEMENT", subjectRef: result.subjectId })),
        ...relationshipResults.filter((result) => result.disposition === "UNJUSTIFIED")
            .map((result) => ({ code: "UNJUSTIFIED_PRESENTATION_RELATIONSHIP", subjectRef: result.subjectId })),
        ...relationships.filter((relationship) => !elementIds.has(relationship.sourceElementId) || !elementIds.has(relationship.targetElementId))
            .map((relationship) => ({ code: "UNKNOWN_RELATIONSHIP_ENDPOINT", subjectRef: relationship.relationshipId }))
    ].sort((left, right) => `${left.code}:${left.subjectRef}`.localeCompare(`${right.code}:${right.subjectRef}`));
    const lineageEvidence = Object.freeze({
        evidenceType: "semantic-presentation-lineage-evidence.v1",
        sourceAuthorityDigest: authority.authorityDigest,
        presentationDigest: presentation.canonicalDigest,
        elementResults,
        relationshipResults,
        findings: lineageFindings,
        disposition: lineageFindings.length === 0 ? "ADMITTED" : "REJECTED"
    });
    const promiseResults = [...authority.promisedExperiences].sort((left, right) => left.experienceRef.localeCompare(right.experienceRef))
        .map((promise) => ({
        experienceRef: promise.experienceRef,
        disposition: promise.presentationRequirement === "OBSERVABLE_OR_OPERABLE" && !elements.some((element) => element.lineage.some((origin) => origin.originType === "PROMISED_EXPERIENCE" && origin.originRef === promise.experienceRef))
            ? "MISSING_PRESENTATION"
            : "SATISFIED"
    }));
    const closureFindings = promiseResults.filter((result) => result.disposition === "MISSING_PRESENTATION")
        .map((result) => ({ code: "MISSING_PRESENTATION_FOR_EXPERIENCE", subjectRef: result.experienceRef }));
    const empty = elements.length === 0 && relationships.length === 0 && adaptationIntents.length === 0 && authority.presentationProfileRefs.length === 0;
    const closureEvidence = Object.freeze({
        evidenceType: "presentation-closure-evidence.v1",
        sourceAuthorityDigest: authority.authorityDigest,
        presentationDigest: presentation.canonicalDigest,
        promiseResults,
        zeroOpinionCounts: {
            visibleElements: elements.length,
            interactions: elements.reduce((count, element) => count + element.interactionRefs.length, 0),
            stylingDecisions: 0,
            implicitActions: 0,
            implicitLayouts: 0,
            defaultPresentationProfiles: 0
        },
        findings: closureFindings,
        disposition: closureFindings.length > 0 || lineageEvidence.disposition === "REJECTED"
            ? "REJECTED"
            : empty ? "VALID_EMPTY_PRESENTATION" : "CLOSED"
    });
    return Object.freeze({ presentation, lineageEvidence, closureEvidence });
}
const STAGE_IDS = [
    "admit-declared-ui",
    "resolve-ui-presentation-lineage",
    "reject-unjustified-presentation",
    "resolve-semantic-presentation-composition",
    "resolve-semantic-interaction-presentation",
    "resolve-adaptive-presentation",
    "resolve-declared-presentation-profile",
    "produce-canonical-semantic-presentation"
];
function stages(dispositions) {
    return STAGE_IDS.map((stageId, index) => ({ stageId, disposition: dispositions[index] ?? "NOT_REACHED" }));
}
export function executeDeclaredUiPresentationResolution(authority) {
    const admissionEvidence = admitDeclaredUiAuthority(authority);
    if (admissionEvidence.disposition === "REJECTED") {
        const resolutionEvidence = Object.freeze({
            evidenceType: "semantic-presentation-resolution-evidence.v1",
            sourceAuthorityDigest: authority.authorityDigest,
            presentationDigest: null,
            stages: stages(["FAIL", "NOT_REACHED", "NOT_REACHED", "NOT_REACHED", "NOT_REACHED", "NOT_REACHED", "NOT_REACHED", "NOT_REACHED"]),
            findings: admissionEvidence.findings,
            disposition: "REJECTED"
        });
        return Object.freeze({ admissionEvidence, resolutionEvidence });
    }
    const resolved = resolveDeclaredUiPresentation(authority);
    const lineageFindings = resolved.lineageEvidence.findings;
    const compositionFindings = lineageFindings.filter((finding) => finding.code === "UNKNOWN_RELATIONSHIP_ENDPOINT");
    const justificationFindings = lineageFindings.filter((finding) => finding.code !== "UNKNOWN_RELATIONSHIP_ENDPOINT");
    const interactionFindings = resolved.presentation.elements
        .filter((element) => {
        if (!["ACTION", "INPUT", "NAVIGATION"].includes(element.semanticKind))
            return false;
        if (element.interactionRefs.length === 0)
            return true;
        return element.semanticKind === "INPUT"
            ? element.eventRefs.length === 0 && element.stateRefs.length === 0
            : element.eventRefs.length === 0;
    })
        .map((element) => ({ code: "MISSING_INTERACTION_PRESENTATION", subjectRef: element.elementId }));
    const promiseRefs = new Set(authority.promisedExperiences.map((item) => item.experienceRef));
    const adaptationFindings = authority.adaptationIntents
        .filter((intent) => intent.invariantRefs.some((invariantRef) => !promiseRefs.has(invariantRef)))
        .map((intent) => ({ code: "UNKNOWN_ADAPTATION_INVARIANT", subjectRef: intent.adaptationId }));
    const closureFindings = resolved.closureEvidence.findings;
    const findings = [...justificationFindings, ...compositionFindings, ...interactionFindings, ...adaptationFindings, ...closureFindings]
        .sort((left, right) => `${left.code}:${left.subjectRef}`.localeCompare(`${right.code}:${right.subjectRef}`));
    const lineagePass = justificationFindings.length === 0;
    const compositionPass = compositionFindings.length === 0;
    const interactionPass = interactionFindings.length === 0;
    const adaptationPass = adaptationFindings.length === 0;
    const canonicalPass = findings.length === 0;
    const resolutionEvidence = Object.freeze({
        evidenceType: "semantic-presentation-resolution-evidence.v1",
        sourceAuthorityDigest: authority.authorityDigest,
        presentationDigest: canonicalPass ? resolved.presentation.canonicalDigest : null,
        stages: stages([
            "PASS",
            lineagePass ? "PASS" : "FAIL",
            lineagePass ? "PASS" : "FAIL",
            compositionPass ? "PASS" : "FAIL",
            interactionPass ? "PASS" : "FAIL",
            adaptationPass ? "PASS" : "FAIL",
            "PASS",
            canonicalPass ? "PASS" : "FAIL"
        ]),
        findings,
        disposition: canonicalPass ? "RESOLVED" : "REJECTED"
    });
    return canonicalPass
        ? Object.freeze({ admissionEvidence, presentation: resolved.presentation, lineageEvidence: resolved.lineageEvidence, closureEvidence: resolved.closureEvidence, resolutionEvidence })
        : Object.freeze({ admissionEvidence, lineageEvidence: resolved.lineageEvidence, closureEvidence: resolved.closureEvidence, resolutionEvidence });
}
