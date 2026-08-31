import { createHash } from "node:crypto";
import { presentationIrV3Digest } from "./semantic-presentation-compiler.js";
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
export function capabilityVectorDigest(value) {
    return digestWithoutField(value, "canonicalDigest");
}
export function targetProfileDigest(value) {
    return digestWithoutField(value, "canonicalDigest");
}
export function providerCatalogDigest(value) {
    return digestWithoutField(value, "catalogDigest");
}
export function providerDigest(value) {
    return digestWithoutField(value, "providerDigest");
}
export function embodimentPlanDigest(value) {
    return digestWithoutField(value, "canonicalDigest");
}
function slug(value) {
    return value.toLowerCase().replaceAll("_", "-");
}
function addRequirement(requirements, capabilityId, category, sourceRef, evidence) {
    const current = requirements.get(capabilityId) ?? {
        category,
        sourceRefs: new Set(),
        evidenceRequirements: new Set()
    };
    current.sourceRefs.add(sourceRef);
    evidence.forEach((item) => current.evidenceRequirements.add(item));
    requirements.set(capabilityId, current);
}
export function resolveUiEmbodimentRequirements(ir) {
    if (presentationIrV3Digest(ir) !== ir.canonicalDigest) {
        throw new Error("PRESENTATION_IR_DIGEST_MISMATCH");
    }
    const requirements = new Map();
    for (const node of ir.nodes) {
        addRequirement(requirements, `composition.${slug(node.configuration.kind)}.v1`, "COMPOSITION", node.nodeId, ["OBSERVATION"]);
        for (const semanticElementRef of node.semanticElementRefs) {
            addRequirement(requirements, "content.semantic-element.v1", "CONTENT", semanticElementRef, ["OBSERVATION"]);
        }
    }
    for (const binding of ir.eventBindings) {
        addRequirement(requirements, `interaction.${slug(binding.trigger)}.v1`, "INTERACTION", binding.bindingId, ["OBSERVATION"]);
    }
    for (const rule of ir.adaptationRules) {
        for (const operation of rule.operations) {
            addRequirement(requirements, `adaptation.${slug(operation.kind)}.v1`, "ADAPTATION", rule.ruleId, ["ADAPTATION", "OBSERVATION"]);
        }
    }
    for (const obligation of ir.accessibilityObligations) {
        addRequirement(requirements, `accessibility.${slug(obligation.kind)}.v1`, "ACCESSIBILITY", obligation.obligationRef, ["ACCESSIBILITY", "OBSERVATION"]);
    }
    for (const profileRef of ir.presentationProfileRefs) {
        addRequirement(requirements, "profile.reference.v1", "PROFILE", profileRef, ["OBSERVATION"]);
    }
    for (const token of ir.tokenReferences) {
        addRequirement(requirements, `token.${slug(token.semanticPurpose)}.v1`, "TOKEN", token.tokenRef, ["OBSERVATION"]);
    }
    const normalized = [...requirements.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([capabilityId, value]) => ({
        capabilityId,
        category: value.category,
        sourceRefs: [...value.sourceRefs].sort(),
        evidenceRequirements: [...value.evidenceRequirements].sort()
    }));
    const withoutDigest = {
        vectorType: "ui-capability-vector.v1",
        sourcePresentationIrType: ir.presentationIrType,
        sourcePresentationIrDigest: ir.canonicalDigest,
        requirements: normalized
    };
    return Object.freeze({ ...withoutDigest, canonicalDigest: capabilityVectorDigest(withoutDigest) });
}
function providerSupports(provider, vector, profile) {
    const features = new Set(provider.features.map((feature) => feature.capabilityId));
    const evidence = new Set(provider.evidenceCapabilities);
    const requiredEvidence = new Set([
        ...profile.requiredEvidenceCapabilities,
        ...vector.requirements.flatMap((requirement) => requirement.evidenceRequirements)
    ]);
    return provider.targetKinds.includes(profile.targetKind) &&
        vector.requirements.every((requirement) => features.has(requirement.capabilityId)) &&
        [...requiredEvidence].every((requirement) => evidence.has(requirement));
}
export function resolveUiEmbodimentProvider(vector, profile, registry) {
    const findings = [];
    if (capabilityVectorDigest(vector) !== vector.canonicalDigest) {
        findings.push({ code: "CAPABILITY_VECTOR_DIGEST_MISMATCH", subjectRef: vector.vectorType });
    }
    if (targetProfileDigest(profile) !== profile.canonicalDigest) {
        findings.push({ code: "TARGET_PROFILE_DIGEST_MISMATCH", subjectRef: profile.targetId });
    }
    if (providerCatalogDigest(registry) !== registry.catalogDigest) {
        findings.push({ code: "PROVIDER_CATALOG_DIGEST_MISMATCH", subjectRef: registry.registryType });
    }
    for (const provider of registry.providers) {
        if (providerDigest(provider) !== provider.providerDigest) {
            findings.push({ code: "PROVIDER_DIGEST_MISMATCH", subjectRef: provider.providerId });
        }
    }
    let candidates = registry.providers.filter((provider) => providerSupports(provider, vector, profile));
    if (profile.requestedProviderId !== null) {
        const requested = registry.providers.find((provider) => provider.providerId === profile.requestedProviderId);
        if (!requested)
            findings.push({ code: "REQUESTED_PROVIDER_NOT_FOUND", subjectRef: profile.requestedProviderId });
        candidates = candidates.filter((provider) => provider.providerId === profile.requestedProviderId);
    }
    if (findings.length === 0 && candidates.length === 0) {
        findings.push({ code: "NO_COMPATIBLE_PROVIDER", subjectRef: profile.targetId });
    }
    candidates.sort((left, right) => right.priority - left.priority || left.providerId.localeCompare(right.providerId));
    const highestPriority = candidates[0]?.priority;
    const finalists = candidates.filter((provider) => provider.priority === highestPriority);
    if (findings.length === 0 && finalists.length > 1) {
        findings.push({ code: "AMBIGUOUS_PROVIDER", subjectRef: profile.targetId });
    }
    findings.sort((left, right) => `${left.code}:${left.subjectRef}`.localeCompare(`${right.code}:${right.subjectRef}`));
    const selected = findings.length === 0 ? finalists[0] : undefined;
    return Object.freeze({
        resolutionType: "provider-resolution.v1",
        capabilityVectorDigest: vector.canonicalDigest,
        targetProfileDigest: profile.canonicalDigest,
        providerCatalogDigest: registry.catalogDigest,
        selectedProviderId: selected?.providerId ?? null,
        selectedProviderDigest: selected?.providerDigest ?? null,
        findings,
        disposition: selected ? "SELECTED" : "REJECTED"
    });
}
export function planUiEmbodiment(presentation, ir, vector, profile, registry) {
    if (semanticPresentationDigest(presentation) !== presentation.canonicalDigest || presentation.canonicalDigest !== ir.protocolIdentity.semanticPresentationDigest) {
        throw new Error("SEMANTIC_PRESENTATION_PLAN_INPUT_DIVERGENCE");
    }
    const derivedVector = resolveUiEmbodimentRequirements(ir);
    if (vector.sourcePresentationIrDigest !== ir.canonicalDigest || vector.canonicalDigest !== derivedVector.canonicalDigest) {
        throw new Error("CAPABILITY_VECTOR_PLAN_INPUT_DIVERGENCE");
    }
    const resolution = resolveUiEmbodimentProvider(vector, profile, registry);
    if (resolution.disposition !== "SELECTED" || resolution.selectedProviderId === null)
        return Object.freeze({ resolution });
    const provider = registry.providers.find((candidate) => candidate.providerId === resolution.selectedProviderId);
    if (!provider || provider.providerDigest !== resolution.selectedProviderDigest)
        return Object.freeze({ resolution });
    const features = new Map(provider.features.map((feature) => [feature.capabilityId, feature]));
    const bindings = vector.requirements.map((requirement) => ({
        capabilityId: requirement.capabilityId,
        mechanicId: features.get(requirement.capabilityId).mechanicId,
        sourceRefs: [...requirement.sourceRefs]
    }));
    const mechanicFor = (capabilityId) => features.get(capabilityId).mechanicId;
    const instructions = [
        ...presentation.elements.map((element) => ({
            instructionId: `instruction.element.${element.elementId}`,
            instructionKind: "REALIZE_SEMANTIC_ELEMENT",
            sourceRef: element.elementId,
            capabilityId: "content.semantic-element.v1",
            mechanicId: mechanicFor("content.semantic-element.v1"),
            semanticKind: element.semanticKind,
            semanticRole: element.semanticRole,
            content: element.content === undefined ? null : "literal" in element.content
                ? { kind: "LITERAL", value: element.content.literal }
                : { kind: "READ_MODEL_REF", value: element.content.readModelRef },
            stateRefs: [...element.stateRefs],
            eventRefs: [...element.eventRefs]
        })),
        ...ir.nodes.map((node) => ({
            instructionId: `instruction.composition.${node.nodeId}`,
            instructionKind: "COMPOSE_NODE",
            sourceRef: node.nodeId,
            capabilityId: `composition.${slug(node.configuration.kind)}.v1`,
            mechanicId: mechanicFor(`composition.${slug(node.configuration.kind)}.v1`),
            configuration: { ...node.configuration },
            childNodeRefs: [...node.childNodeIds],
            semanticElementRefs: [...node.semanticElementRefs]
        })),
        ...ir.eventBindings.map((binding) => ({
            instructionId: `instruction.event.${binding.bindingId}`,
            instructionKind: "BIND_EVENT",
            sourceRef: binding.bindingId,
            capabilityId: `interaction.${slug(binding.trigger)}.v1`,
            mechanicId: mechanicFor(`interaction.${slug(binding.trigger)}.v1`),
            semanticElementRef: binding.semanticElementRef,
            semanticEventRef: binding.semanticEventRef,
            trigger: binding.trigger
        })),
        ...ir.adaptationRules.flatMap((rule) => rule.operations.map((operation, index) => ({
            instructionId: `instruction.adaptation.${rule.ruleId}.${index}`,
            instructionKind: "APPLY_ADAPTATION",
            sourceRef: rule.ruleId,
            capabilityId: `adaptation.${slug(operation.kind)}.v1`,
            mechanicId: mechanicFor(`adaptation.${slug(operation.kind)}.v1`),
            semanticAdaptationRef: rule.semanticAdaptationRef,
            contextRef: rule.contextRef,
            operationKind: operation.kind,
            nodeRefs: [...operation.nodeRefs],
            invariantRefs: [...rule.invariantRefs]
        }))),
        ...ir.accessibilityObligations.map((obligation) => ({
            instructionId: `instruction.accessibility.${obligation.obligationRef}`,
            instructionKind: "APPLY_ACCESSIBILITY",
            sourceRef: obligation.obligationRef,
            capabilityId: `accessibility.${slug(obligation.kind)}.v1`,
            mechanicId: mechanicFor(`accessibility.${slug(obligation.kind)}.v1`),
            semanticElementRef: obligation.semanticElementRef,
            obligationKind: obligation.kind
        })),
        ...ir.presentationProfileRefs.map((profileRef) => ({
            instructionId: `instruction.profile.${profileRef}`,
            instructionKind: "APPLY_PROFILE_REFERENCE",
            sourceRef: profileRef,
            capabilityId: "profile.reference.v1",
            mechanicId: mechanicFor("profile.reference.v1"),
            profileRef
        })),
        ...ir.tokenReferences.map((token) => ({
            instructionId: `instruction.token.${token.tokenRef}`,
            instructionKind: "APPLY_TOKEN_REFERENCE",
            sourceRef: token.tokenRef,
            capabilityId: `token.${slug(token.semanticPurpose)}.v1`,
            mechanicId: mechanicFor(`token.${slug(token.semanticPurpose)}.v1`),
            semanticPurpose: token.semanticPurpose,
            profileRef: token.profileRef
        }))
    ].sort((left, right) => left.instructionId.localeCompare(right.instructionId));
    const withoutDigest = {
        planType: "ui-embodiment-plan.v1",
        sourcePresentationIrDigest: ir.canonicalDigest,
        semanticPresentationDigest: ir.protocolIdentity.semanticPresentationDigest,
        compilerAuthorityDigest: ir.protocolIdentity.compilerAuthorityDigest,
        capabilityVectorDigest: vector.canonicalDigest,
        targetProfileDigest: profile.canonicalDigest,
        providerCatalogDigest: registry.catalogDigest,
        providerId: provider.providerId,
        providerVersion: provider.providerVersion,
        providerDigest: provider.providerDigest,
        rootNodeRefs: [...ir.rootNodeIds],
        bindings,
        instructions,
        adaptationObligationRefs: ir.adaptationRules.map((rule) => rule.ruleId).sort(),
        accessibilityObligationRefs: ir.accessibilityObligations.map((obligation) => obligation.obligationRef).sort(),
        observationRequirements: [...new Set([
                ...profile.requiredEvidenceCapabilities,
                ...vector.requirements.flatMap((requirement) => requirement.evidenceRequirements)
            ])].sort()
    };
    return Object.freeze({ resolution, plan: Object.freeze({ ...withoutDigest, canonicalDigest: embodimentPlanDigest(withoutDigest) }) });
}
