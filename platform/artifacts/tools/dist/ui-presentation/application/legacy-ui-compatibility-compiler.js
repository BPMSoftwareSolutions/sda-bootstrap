import { createHash } from "node:crypto";
import { declaredUiAuthorityDigest, executeDeclaredUiPresentationResolution } from "./declared-ui-presentation-resolver.js";
import { compileSemanticPresentation } from "./semantic-presentation-compiler.js";
function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (value !== null && typeof value === "object") {
        const record = value;
        return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalize(record[key])]));
    }
    return value;
}
function digest(value) {
    return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}
function digestWithoutField(value, field) {
    const digestable = { ...value };
    delete digestable[field];
    return digest(digestable);
}
export function legacySourceDigest(value) {
    return digest(value);
}
export function legacyOriginManifestDigest(value) {
    return digestWithoutField(value, "manifestDigest");
}
export function legacyRepairWorkbenchDigest(value) {
    return digestWithoutField(value, "canonicalDigest");
}
function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function array(value) {
    return Array.isArray(value) ? value.filter((item) => record(item) !== undefined) : [];
}
function sourceType(source) {
    if (source.uiAuthorityType === "consumer-ui-authority.v1")
        return "consumer-ui-authority.v1";
    if (source.presentationIrType === "sda-ui-presentation-ir.v2")
        return "sda-ui-presentation-ir.v2";
    return "UNKNOWN";
}
function semanticCandidates(source, type) {
    if (type === "UNKNOWN")
        return [];
    const v1 = type === "consumer-ui-authority.v1";
    const interactionPath = v1 ? "/interactionAuthority" : "/application/interaction";
    const experiencePath = v1 ? "/experienceAuthority" : "/application/experience";
    const presentationPath = v1 ? "/presentationProfile" : "/application/presentation";
    const application = v1 ? source : record(source.application) ?? {};
    const interaction = record(v1 ? source.interactionAuthority : application.interaction) ?? {};
    const experience = record(v1 ? source.experienceAuthority : application.experience) ?? {};
    const presentation = record(v1 ? source.presentationProfile : application.presentation) ?? {};
    const candidates = [];
    array(experience.conditions).forEach((item, index) => candidates.push({
        sourcePath: `${experiencePath}/conditions/${index}`,
        candidateKind: "PROMISED_EXPERIENCE",
        valueDigest: digest(item)
    }));
    for (const collection of ["information", "inputs", "actions", "collections", "feedback", "navigation"]) {
        array(interaction[collection]).forEach((item, index) => candidates.push({
            sourcePath: `${interactionPath}/${collection}/${index}`,
            candidateKind: "ELEMENT",
            valueDigest: digest(item)
        }));
    }
    array(interaction.views).forEach((view, viewIndex) => {
        const members = array(view.members);
        members.forEach((item, memberIndex) => candidates.push({
            sourcePath: `${interactionPath}/views/${viewIndex}/members/${memberIndex}`,
            candidateKind: "ELEMENT",
            valueDigest: digest(item)
        }));
    });
    if (typeof presentation.profileId === "string")
        candidates.push({
            sourcePath: `${presentationPath}/profileId`,
            candidateKind: "PRESENTATION_PROFILE",
            valueDigest: digest(presentation.profileId)
        });
    return candidates.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
}
function escapePath(value) {
    return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
function presentationFacts(source, type) {
    if (type === "UNKNOWN")
        return [];
    const v1 = type === "consumer-ui-authority.v1";
    const application = v1 ? source : record(source.application) ?? {};
    const presentation = record(v1 ? source.presentationProfile : application.presentation);
    if (!presentation)
        return [];
    const rootPath = v1 ? "/presentationProfile" : "/application/presentation";
    const facts = [];
    function visit(value, path) {
        if (Array.isArray(value)) {
            value.forEach((item, index) => visit(item, `${path}/${index}`));
            return;
        }
        const object = record(value);
        if (object) {
            Object.keys(object).sort().forEach((key) => {
                if (path === rootPath && key === "profileId")
                    return;
                visit(object[key], `${path}/${escapePath(key)}`);
            });
            return;
        }
        const factClass = path.includes("/tokens/") ? "VISUAL_PRESENTATION"
            : path.includes("/intent/") ? "TARGET_RECIPE"
                : "PHYSICAL_PRESENTATION";
        facts.push({ sourcePath: path, factClass, valueDigest: digest(value) });
    }
    visit(presentation, rootPath);
    return facts.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
}
export function inspectLegacyUiFacts(source) {
    const type = sourceType(source);
    const sourceDigestValue = legacySourceDigest(source);
    return Object.freeze({
        sourceType: type,
        sourceDigest: sourceDigestValue,
        semanticCandidates: semanticCandidates(source, type),
        preservedLegacyFacts: presentationFacts(source, type)
    });
}
function targetExists(authority, mapping) {
    if (mapping.targetKind === "PROMISED_EXPERIENCE") {
        return authority.promisedExperiences.some((item) => item.experienceRef === mapping.targetRef);
    }
    if (mapping.targetKind === "ELEMENT")
        return authority.elements.some((item) => item.elementId === mapping.targetRef);
    if (mapping.targetKind === "RELATIONSHIP")
        return authority.relationships.some((item) => item.relationshipId === mapping.targetRef);
    if (mapping.targetKind === "ADAPTATION")
        return authority.adaptationIntents.some((item) => item.adaptationId === mapping.targetRef);
    return authority.presentationProfileRefs.includes(mapping.targetRef);
}
function workbench(type, sourceDigestValue, unresolved, preserved) {
    const withoutDigest = {
        workbenchType: "legacy-ui-repair-workbench.v1",
        sourceType: type,
        sourceDigest: sourceDigestValue,
        unresolvedFacts: unresolved.map((item) => ({
            sourcePath: item.sourcePath,
            candidateKind: item.candidateKind,
            reason: "SEMANTIC_ORIGIN_REQUIRES_EXPLICIT_MAPPING"
        })),
        preservedLegacyFacts: preserved,
        requiredRepairArtifactType: "legacy-ui-semantic-origin-manifest.v1"
    };
    return Object.freeze({ ...withoutDigest, canonicalDigest: legacyRepairWorkbenchDigest(withoutDigest) });
}
export function importLegacyUiPresentation(source, repair, compilerAuthority) {
    const type = sourceType(source);
    const sourceDigestValue = legacySourceDigest(source);
    const candidates = semanticCandidates(source, type);
    const preserved = presentationFacts(source, type);
    const findings = [];
    const evidenceBase = {
        evidenceType: "legacy-ui-compatibility-evidence.v1",
        sourceType: type,
        sourceDigest: sourceDigestValue
    };
    if (type === "UNKNOWN")
        findings.push({ code: "UNSUPPORTED_LEGACY_SOURCE", subjectRef: "legacy-source" });
    if (!repair && findings.length === 0) {
        const resultWorkbench = workbench(type, sourceDigestValue, candidates, preserved);
        return Object.freeze({
            evidence: Object.freeze({
                ...evidenceBase,
                originManifestDigest: null,
                declaredAuthorityDigest: null,
                semanticPresentationDigest: null,
                successorIrDigest: null,
                factResults: [
                    ...candidates.map((item) => ({ sourcePath: item.sourcePath, factClass: "SEMANTIC", valueDigest: item.valueDigest, targetRef: null, disposition: "UNRESOLVED" })),
                    ...preserved.map((item) => ({ sourcePath: item.sourcePath, factClass: item.factClass, valueDigest: item.valueDigest, targetRef: null, disposition: "PRESERVED_AS_LEGACY_FACT" }))
                ],
                findings: candidates.map((item) => ({ code: "UNMAPPED_SEMANTIC_FACT", subjectRef: item.sourcePath })),
                disposition: "SEMANTIC_ORIGIN_UNRESOLVED"
            }),
            workbench: resultWorkbench
        });
    }
    if (!repair) {
        const resultWorkbench = workbench(type, sourceDigestValue, [], preserved);
        return Object.freeze({
            evidence: Object.freeze({
                ...evidenceBase,
                originManifestDigest: null,
                declaredAuthorityDigest: null,
                semanticPresentationDigest: null,
                successorIrDigest: null,
                factResults: preserved.map((item) => ({ sourcePath: item.sourcePath, factClass: item.factClass, valueDigest: item.valueDigest, targetRef: null, disposition: "PRESERVED_AS_LEGACY_FACT" })),
                findings,
                disposition: "INCOMPATIBLE"
            }),
            workbench: resultWorkbench
        });
    }
    const { manifest, declaredAuthority } = repair;
    if (manifest.sourceType !== type || manifest.sourceDigest !== sourceDigestValue) {
        findings.push({ code: "LEGACY_SOURCE_DIGEST_MISMATCH", subjectRef: manifest.manifestId });
    }
    if (legacyOriginManifestDigest(manifest) !== manifest.manifestDigest) {
        findings.push({ code: "ORIGIN_MANIFEST_DIGEST_MISMATCH", subjectRef: manifest.manifestId });
    }
    if (declaredUiAuthorityDigest(declaredAuthority) !== declaredAuthority.authorityDigest || manifest.declaredAuthorityDigest !== declaredAuthority.authorityDigest) {
        findings.push({ code: "DECLARED_AUTHORITY_DIGEST_MISMATCH", subjectRef: declaredAuthority.authorityId });
    }
    const candidatesByPath = new Map(candidates.map((item) => [item.sourcePath, item]));
    const mappingsByPath = new Map(manifest.factMappings.map((item) => [item.sourcePath, item]));
    const mappingCounts = new Map();
    for (const mapping of manifest.factMappings)
        mappingCounts.set(mapping.sourcePath, (mappingCounts.get(mapping.sourcePath) ?? 0) + 1);
    for (const [mappingPath, count] of mappingCounts) {
        if (count > 1)
            findings.push({ code: "DUPLICATE_FACT_MAPPING", subjectRef: mappingPath });
    }
    for (const mapping of manifest.factMappings) {
        const candidate = candidatesByPath.get(mapping.sourcePath);
        if (!candidate || candidate.candidateKind !== mapping.targetKind) {
            findings.push({ code: "UNKNOWN_LEGACY_FACT_PATH", subjectRef: mapping.sourcePath });
        }
        else if (!targetExists(declaredAuthority, mapping)) {
            findings.push({ code: "UNKNOWN_DECLARED_TARGET", subjectRef: mapping.targetRef });
        }
    }
    const unresolved = candidates.filter((candidate) => !mappingsByPath.has(candidate.sourcePath));
    findings.push(...unresolved.map((item) => ({ code: "UNMAPPED_SEMANTIC_FACT", subjectRef: item.sourcePath })));
    findings.sort((left, right) => `${left.code}:${left.subjectRef}`.localeCompare(`${right.code}:${right.subjectRef}`));
    if (findings.length > 0) {
        return Object.freeze({
            evidence: Object.freeze({
                ...evidenceBase,
                originManifestDigest: manifest.manifestDigest,
                declaredAuthorityDigest: declaredAuthority.authorityDigest,
                semanticPresentationDigest: null,
                successorIrDigest: null,
                factResults: [
                    ...candidates.map((item) => ({ sourcePath: item.sourcePath, factClass: "SEMANTIC", valueDigest: item.valueDigest, targetRef: mappingsByPath.get(item.sourcePath)?.targetRef ?? null, disposition: mappingsByPath.has(item.sourcePath) ? "REJECTED" : "UNRESOLVED" })),
                    ...preserved.map((item) => ({ sourcePath: item.sourcePath, factClass: item.factClass, valueDigest: item.valueDigest, targetRef: null, disposition: "PRESERVED_AS_LEGACY_FACT" }))
                ],
                findings,
                disposition: findings.some((item) => item.code === "UNMAPPED_SEMANTIC_FACT") ? "SEMANTIC_ORIGIN_UNRESOLVED" : "INCOMPATIBLE"
            }),
            workbench: workbench(type, sourceDigestValue, unresolved, preserved)
        });
    }
    const resolution = executeDeclaredUiPresentationResolution(declaredAuthority);
    if (!("presentation" in resolution)) {
        findings.push({ code: "DECLARED_AUTHORITY_REJECTED", subjectRef: declaredAuthority.authorityId });
    }
    const presentation = "presentation" in resolution ? resolution.presentation : undefined;
    const compilation = presentation && compilerAuthority ? compileSemanticPresentation(presentation, compilerAuthority) : undefined;
    if (compilation && !("ir" in compilation)) {
        findings.push({ code: "SUCCESSOR_COMPILATION_REJECTED", subjectRef: presentation.presentationId });
    }
    const ir = compilation && "ir" in compilation ? compilation.ir : undefined;
    const admitted = findings.length === 0 && presentation !== undefined;
    return Object.freeze({
        evidence: Object.freeze({
            ...evidenceBase,
            originManifestDigest: manifest.manifestDigest,
            declaredAuthorityDigest: declaredAuthority.authorityDigest,
            semanticPresentationDigest: admitted ? presentation.canonicalDigest : null,
            successorIrDigest: admitted && ir ? ir.canonicalDigest : null,
            factResults: [
                ...candidates.map((item) => ({ sourcePath: item.sourcePath, factClass: "SEMANTIC", valueDigest: item.valueDigest, targetRef: mappingsByPath.get(item.sourcePath).targetRef, disposition: admitted ? "CONVERTED" : "REJECTED" })),
                ...preserved.map((item) => ({ sourcePath: item.sourcePath, factClass: item.factClass, valueDigest: item.valueDigest, targetRef: null, disposition: "PRESERVED_AS_LEGACY_FACT" }))
            ],
            findings,
            disposition: admitted ? preserved.length === 0 ? "LOSSLESS" : "ADMITTED_WITH_LEGACY_PRESENTATION_FACTS" : "INCOMPATIBLE"
        }),
        ...(presentation ? { presentation } : {}),
        ...(ir ? { ir, compilationEvidence: compilation.evidence } : {})
    });
}
