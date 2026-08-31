import { createHash } from "node:crypto";
import { semanticPresentationDigest } from "./declared-ui-presentation-resolver.js";
function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (value !== null && typeof value === "object") {
        const record = value;
        return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalize(record[key])]));
    }
    return value;
}
function digestWithoutField(value, field) {
    const digestable = { ...value };
    delete digestable[field];
    return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(digestable))).digest("hex")}`;
}
export function compilerAuthorityDigest(authority) {
    return digestWithoutField(authority, "authorityDigest");
}
export function presentationIrV3Digest(ir) {
    return digestWithoutField(ir, "canonicalDigest");
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
function stableTopologicalOrder(elementIds, relationships) {
    const outgoing = new Map(elementIds.map((id) => [id, new Set()]));
    const indegree = new Map(elementIds.map((id) => [id, 0]));
    for (const relationship of relationships.filter((item) => item.kind === "FOLLOWS")) {
        const targets = outgoing.get(relationship.sourceElementId);
        if (!targets || !indegree.has(relationship.targetElementId) || targets.has(relationship.targetElementId))
            continue;
        targets.add(relationship.targetElementId);
        indegree.set(relationship.targetElementId, (indegree.get(relationship.targetElementId) ?? 0) + 1);
    }
    const available = elementIds.filter((id) => indegree.get(id) === 0).sort();
    const ordered = [];
    while (available.length > 0) {
        const current = available.shift();
        ordered.push(current);
        for (const target of [...(outgoing.get(current) ?? [])].sort()) {
            const next = (indegree.get(target) ?? 0) - 1;
            indegree.set(target, next);
            if (next === 0) {
                available.push(target);
                available.sort();
            }
        }
    }
    return ordered.length === elementIds.length ? ordered : null;
}
function compileFindings(presentation, authority) {
    const findings = [];
    if (semanticPresentationDigest(presentation) !== presentation.canonicalDigest) {
        findings.push({ code: "SEMANTIC_PRESENTATION_DIGEST_MISMATCH", subjectRef: presentation.presentationId });
    }
    if (compilerAuthorityDigest(authority) !== authority.authorityDigest) {
        findings.push({ code: "COMPILER_AUTHORITY_DIGEST_MISMATCH", subjectRef: authority.authorityId });
    }
    findings.push(...duplicateFindings(presentation.elements.map((item) => item.elementId), "DUPLICATE_SEMANTIC_ELEMENT"));
    findings.push(...duplicateFindings(presentation.relationships.map((item) => item.relationshipId), "DUPLICATE_SEMANTIC_RELATIONSHIP"));
    findings.push(...duplicateFindings(presentation.adaptationIntents.map((item) => item.adaptationId), "DUPLICATE_ADAPTATION_INTENT"));
    findings.push(...duplicateFindings(presentation.presentationProfileRefs, "DUPLICATE_PRESENTATION_PROFILE_REF"));
    const elementIds = new Set(presentation.elements.map((item) => item.elementId));
    for (const relationship of presentation.relationships) {
        if (!elementIds.has(relationship.sourceElementId) || !elementIds.has(relationship.targetElementId)) {
            findings.push({ code: "UNKNOWN_RELATIONSHIP_ENDPOINT", subjectRef: relationship.relationshipId });
        }
        else if (!authority.supportedRelationshipKinds.includes(relationship.kind)) {
            findings.push({ code: "UNRESOLVABLE_COMPOSITION_RELATIONSHIP", subjectRef: relationship.relationshipId });
        }
    }
    if (stableTopologicalOrder([...elementIds], presentation.relationships) === null) {
        findings.push({ code: "CYCLIC_PRESENTATION_ORDER", subjectRef: presentation.presentationId });
    }
    for (const element of presentation.elements) {
        if (["ACTION", "INPUT", "NAVIGATION"].includes(element.semanticKind) && element.eventRefs.length === 0) {
            findings.push({ code: "MISSING_SEMANTIC_EVENT_BINDING", subjectRef: element.elementId });
        }
        for (const obligation of element.accessibilityObligations) {
            if (!authority.supportedAccessibilityObligationKinds.includes(obligation.kind)) {
                findings.push({ code: "UNSUPPORTED_ACCESSIBILITY_OBLIGATION", subjectRef: obligation.obligationRef });
            }
        }
    }
    const promiseRefs = new Set(presentation.promisedExperienceRefs);
    for (const adaptation of presentation.adaptationIntents) {
        if (adaptation.allowedChangeKinds.some((kind) => !(kind in authority.adaptationOperations))) {
            findings.push({ code: "UNSUPPORTED_ADAPTATION_INTENT", subjectRef: adaptation.adaptationId });
        }
        if (adaptation.invariantRefs.some((reference) => !promiseRefs.has(reference))) {
            findings.push({ code: "UNKNOWN_ADAPTATION_INVARIANT", subjectRef: adaptation.adaptationId });
        }
    }
    return findings.sort((left, right) => `${left.code}:${left.subjectRef}`.localeCompare(`${right.code}:${right.subjectRef}`));
}
export function compileSemanticPresentation(presentation, authority) {
    const findings = compileFindings(presentation, authority);
    const evidenceBase = {
        evidenceType: "semantic-presentation-compilation-evidence.v1",
        semanticPresentationDigest: presentation.canonicalDigest,
        compilerAuthorityId: authority.authorityId,
        compilerAuthorityDigest: authority.authorityDigest
    };
    if (findings.length > 0) {
        return Object.freeze({
            evidence: Object.freeze({ ...evidenceBase, presentationIrDigest: null, findings, disposition: "REJECTED" })
        });
    }
    const orderedElementIds = stableTopologicalOrder(presentation.elements.map((item) => item.elementId), presentation.relationships) ?? [];
    const byElementId = new Map(presentation.elements.map((item) => [item.elementId, item]));
    const rootNodeId = "node.root";
    const nodes = orderedElementIds.length === 0 ? [] : [{
            nodeId: rootNodeId,
            configuration: { ...authority.defaultComposition },
            childNodeIds: [],
            semanticElementRefs: orderedElementIds,
            semanticRelationshipRefs: presentation.relationships.map((item) => item.relationshipId).sort(),
            accessibilityObligationRefs: [...new Set(orderedElementIds.flatMap((elementId) => (byElementId.get(elementId)?.accessibilityObligations ?? []).map((item) => item.obligationRef)))].sort(),
            compilerRuleRefs: presentation.relationships.length > 0
                ? ["rule.default-root-flow.v1", "rule.follows-order.v1"]
                : ["rule.default-root-flow.v1"],
            order: 0,
            visibility: { mode: "ALWAYS" }
        }];
    const eventBindings = orderedElementIds.flatMap((elementId) => {
        const element = byElementId.get(elementId);
        if (!(element.semanticKind in authority.eventTriggers))
            return [];
        const trigger = authority.eventTriggers[element.semanticKind];
        return [...element.eventRefs].sort().map((semanticEventRef, index) => ({
            bindingId: `binding.${element.elementId}.${index}`,
            semanticElementRef: element.elementId,
            semanticEventRef,
            trigger
        }));
    });
    const adaptationRules = [...presentation.adaptationIntents].sort((left, right) => left.adaptationId.localeCompare(right.adaptationId))
        .map((adaptation) => ({
        ruleId: `rule.${adaptation.adaptationId}`,
        semanticAdaptationRef: adaptation.adaptationId,
        contextRef: adaptation.contextRef,
        operations: [...adaptation.allowedChangeKinds].sort().map((kind) => ({
            kind: authority.adaptationOperations[kind],
            nodeRefs: nodes.length === 0 ? [] : [rootNodeId]
        })),
        invariantRefs: [...adaptation.invariantRefs].sort()
    }));
    const accessibilityObligations = orderedElementIds.flatMap((semanticElementRef) => [...(byElementId.get(semanticElementRef)?.accessibilityObligations ?? [])]
        .sort((left, right) => `${left.kind}:${left.obligationRef}`.localeCompare(`${right.kind}:${right.obligationRef}`))
        .map((obligation) => ({ ...obligation, semanticElementRef })))
        .sort((left, right) => left.obligationRef.localeCompare(right.obligationRef));
    const withoutDigest = {
        presentationIrType: "sda-ui-presentation-ir.v3",
        protocolIdentity: {
            semanticPresentationType: presentation.presentationType,
            semanticPresentationDigest: presentation.canonicalDigest,
            compilerAuthorityId: authority.authorityId,
            compilerAuthorityDigest: authority.authorityDigest
        },
        presentationProfileRefs: [...presentation.presentationProfileRefs].sort(),
        rootNodeIds: nodes.length === 0 ? [] : [rootNodeId],
        nodes,
        eventBindings,
        adaptationRules,
        accessibilityObligations,
        tokenReferences: []
    };
    const ir = Object.freeze({ ...withoutDigest, canonicalDigest: presentationIrV3Digest(withoutDigest) });
    return Object.freeze({
        ir,
        evidence: Object.freeze({
            ...evidenceBase,
            presentationIrDigest: ir.canonicalDigest,
            findings: [],
            disposition: "COMPILED"
        })
    });
}
