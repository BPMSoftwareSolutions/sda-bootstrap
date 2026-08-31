import { type DeclaredUiAuthority } from "./declared-ui-presentation-resolver.js";
import { type CanonicalSemanticPresentation, type SemanticPresentationCompilerAuthority } from "./semantic-presentation-compiler.js";
type Digest = `sha256:${string}`;
type JsonRecord = Record<string, unknown>;
type LegacySourceType = "consumer-ui-authority.v1" | "sda-ui-presentation-ir.v2" | "UNKNOWN";
type TargetKind = "PROMISED_EXPERIENCE" | "ELEMENT" | "RELATIONSHIP" | "ADAPTATION" | "PRESENTATION_PROFILE";
type FactClass = "SEMANTIC" | "PHYSICAL_PRESENTATION" | "VISUAL_PRESENTATION" | "TARGET_RECIPE";
export interface LegacyOriginManifest {
    readonly manifestType: "legacy-ui-semantic-origin-manifest.v1";
    readonly manifestId: string;
    readonly sourceType: Exclude<LegacySourceType, "UNKNOWN">;
    readonly sourceDigest: Digest;
    readonly declaredAuthorityDigest: Digest;
    readonly factMappings: readonly Readonly<{
        sourcePath: string;
        targetKind: TargetKind;
        targetRef: string;
    }>[];
    readonly manifestDigest: Digest;
}
interface CandidateFact {
    readonly sourcePath: string;
    readonly candidateKind: TargetKind;
    readonly valueDigest: Digest;
}
interface PreservedFact {
    readonly sourcePath: string;
    readonly factClass: Exclude<FactClass, "SEMANTIC">;
    readonly valueDigest: Digest;
}
export declare function legacySourceDigest(value: object): Digest;
export declare function legacyOriginManifestDigest(value: object): Digest;
export declare function legacyRepairWorkbenchDigest(value: object): Digest;
export declare function inspectLegacyUiFacts(source: JsonRecord): Readonly<{
    sourceType: LegacySourceType;
    sourceDigest: `sha256:${string}`;
    semanticCandidates: CandidateFact[];
    preservedLegacyFacts: PreservedFact[];
}>;
export declare function importLegacyUiPresentation(source: JsonRecord, repair?: Readonly<{
    manifest: LegacyOriginManifest;
    declaredAuthority: DeclaredUiAuthority;
}>, compilerAuthority?: SemanticPresentationCompilerAuthority): Readonly<{
    evidence: Readonly<{
        originManifestDigest: null;
        declaredAuthorityDigest: null;
        semanticPresentationDigest: null;
        successorIrDigest: null;
        factResults: ({
            sourcePath: string;
            factClass: "SEMANTIC";
            valueDigest: `sha256:${string}`;
            targetRef: null;
            disposition: "UNRESOLVED";
        } | {
            sourcePath: string;
            factClass: "PHYSICAL_PRESENTATION" | "VISUAL_PRESENTATION" | "TARGET_RECIPE";
            valueDigest: `sha256:${string}`;
            targetRef: null;
            disposition: "PRESERVED_AS_LEGACY_FACT";
        })[];
        findings: {
            code: string;
            subjectRef: string;
        }[];
        disposition: "SEMANTIC_ORIGIN_UNRESOLVED";
        evidenceType: "legacy-ui-compatibility-evidence.v1";
        sourceType: LegacySourceType;
        sourceDigest: `sha256:${string}`;
    }>;
    workbench: Readonly<{
        canonicalDigest: `sha256:${string}`;
        workbenchType: "legacy-ui-repair-workbench.v1";
        sourceType: LegacySourceType;
        sourceDigest: `sha256:${string}`;
        unresolvedFacts: {
            sourcePath: string;
            candidateKind: TargetKind;
            reason: "SEMANTIC_ORIGIN_REQUIRES_EXPLICIT_MAPPING";
        }[];
        preservedLegacyFacts: readonly PreservedFact[];
        requiredRepairArtifactType: "legacy-ui-semantic-origin-manifest.v1";
    }>;
}> | Readonly<{
    evidence: Readonly<{
        originManifestDigest: null;
        declaredAuthorityDigest: null;
        semanticPresentationDigest: null;
        successorIrDigest: null;
        factResults: {
            sourcePath: string;
            factClass: "PHYSICAL_PRESENTATION" | "VISUAL_PRESENTATION" | "TARGET_RECIPE";
            valueDigest: `sha256:${string}`;
            targetRef: null;
            disposition: "PRESERVED_AS_LEGACY_FACT";
        }[];
        findings: {
            code: string;
            subjectRef: string;
        }[];
        disposition: "INCOMPATIBLE";
        evidenceType: "legacy-ui-compatibility-evidence.v1";
        sourceType: LegacySourceType;
        sourceDigest: `sha256:${string}`;
    }>;
    workbench: Readonly<{
        canonicalDigest: `sha256:${string}`;
        workbenchType: "legacy-ui-repair-workbench.v1";
        sourceType: LegacySourceType;
        sourceDigest: `sha256:${string}`;
        unresolvedFacts: {
            sourcePath: string;
            candidateKind: TargetKind;
            reason: "SEMANTIC_ORIGIN_REQUIRES_EXPLICIT_MAPPING";
        }[];
        preservedLegacyFacts: readonly PreservedFact[];
        requiredRepairArtifactType: "legacy-ui-semantic-origin-manifest.v1";
    }>;
}> | Readonly<{
    evidence: Readonly<{
        originManifestDigest: `sha256:${string}`;
        declaredAuthorityDigest: `sha256:${string}`;
        semanticPresentationDigest: null;
        successorIrDigest: null;
        factResults: ({
            sourcePath: string;
            factClass: "SEMANTIC";
            valueDigest: `sha256:${string}`;
            targetRef: string | null;
            disposition: "REJECTED" | "UNRESOLVED";
        } | {
            sourcePath: string;
            factClass: "PHYSICAL_PRESENTATION" | "VISUAL_PRESENTATION" | "TARGET_RECIPE";
            valueDigest: `sha256:${string}`;
            targetRef: null;
            disposition: "PRESERVED_AS_LEGACY_FACT";
        })[];
        findings: {
            code: string;
            subjectRef: string;
        }[];
        disposition: "SEMANTIC_ORIGIN_UNRESOLVED" | "INCOMPATIBLE";
        evidenceType: "legacy-ui-compatibility-evidence.v1";
        sourceType: LegacySourceType;
        sourceDigest: `sha256:${string}`;
    }>;
    workbench: Readonly<{
        canonicalDigest: `sha256:${string}`;
        workbenchType: "legacy-ui-repair-workbench.v1";
        sourceType: LegacySourceType;
        sourceDigest: `sha256:${string}`;
        unresolvedFacts: {
            sourcePath: string;
            candidateKind: TargetKind;
            reason: "SEMANTIC_ORIGIN_REQUIRES_EXPLICIT_MAPPING";
        }[];
        preservedLegacyFacts: readonly PreservedFact[];
        requiredRepairArtifactType: "legacy-ui-semantic-origin-manifest.v1";
    }>;
}> | Readonly<{
    ir?: Readonly<{
        canonicalDigest: `sha256:${string}`;
        presentationIrType: "sda-ui-presentation-ir.v3";
        protocolIdentity: {
            semanticPresentationType: "sda-ui-semantic-presentation.v1";
            semanticPresentationDigest: `sha256:${string}`;
            compilerAuthorityId: "compile-semantic-presentation.v1";
            compilerAuthorityDigest: `sha256:${string}`;
        };
        presentationProfileRefs: string[];
        rootNodeIds: string[];
        nodes: {
            nodeId: string;
            configuration: {
                kind: "FLOW";
                axis: "BLOCK";
                direction: "FORWARD";
                wrap: "NO_WRAP";
            };
            childNodeIds: never[];
            semanticElementRefs: readonly string[];
            semanticRelationshipRefs: string[];
            accessibilityObligationRefs: string[];
            compilerRuleRefs: string[];
            order: number;
            visibility: {
                mode: "ALWAYS";
            };
        }[];
        eventBindings: {
            bindingId: string;
            semanticElementRef: string;
            semanticEventRef: string;
            trigger: "ACTIVATE" | "COMMIT" | "NAVIGATE";
        }[];
        adaptationRules: {
            ruleId: string;
            semanticAdaptationRef: string;
            contextRef: string;
            operations: {
                kind: "ORDER" | "VISIBILITY" | "GROUPING";
                nodeRefs: string[];
            }[];
            invariantRefs: string[];
        }[];
        accessibilityObligations: {
            semanticElementRef: string;
            obligationRef: string;
            kind: "NAME" | "DESCRIPTION" | "FOCUS_ORDER" | "LIVE_FEEDBACK" | "OPERABLE_ACTION" | "RELATIONSHIP";
        }[];
        tokenReferences: never[];
    }>;
    compilationEvidence?: Readonly<{
        presentationIrDigest: null;
        findings: Readonly<{
            code: "DUPLICATE_SEMANTIC_ELEMENT" | "DUPLICATE_SEMANTIC_RELATIONSHIP" | "DUPLICATE_ADAPTATION_INTENT" | "UNKNOWN_RELATIONSHIP_ENDPOINT" | "UNKNOWN_ADAPTATION_INVARIANT" | "SEMANTIC_PRESENTATION_DIGEST_MISMATCH" | "COMPILER_AUTHORITY_DIGEST_MISMATCH" | "UNRESOLVABLE_COMPOSITION_RELATIONSHIP" | "CYCLIC_PRESENTATION_ORDER" | "MISSING_SEMANTIC_EVENT_BINDING" | "UNSUPPORTED_ADAPTATION_INTENT" | "UNSUPPORTED_ACCESSIBILITY_OBLIGATION" | "DUPLICATE_PRESENTATION_PROFILE_REF";
            subjectRef: string;
        }>[];
        disposition: "REJECTED";
        evidenceType: "semantic-presentation-compilation-evidence.v1";
        semanticPresentationDigest: `sha256:${string}`;
        compilerAuthorityId: "compile-semantic-presentation.v1";
        compilerAuthorityDigest: `sha256:${string}`;
    }> | Readonly<{
        presentationIrDigest: `sha256:${string}`;
        findings: never[];
        disposition: "COMPILED";
        evidenceType: "semantic-presentation-compilation-evidence.v1";
        semanticPresentationDigest: `sha256:${string}`;
        compilerAuthorityId: "compile-semantic-presentation.v1";
        compilerAuthorityDigest: `sha256:${string}`;
    }>;
    presentation?: CanonicalSemanticPresentation;
    evidence: Readonly<{
        originManifestDigest: `sha256:${string}`;
        declaredAuthorityDigest: `sha256:${string}`;
        semanticPresentationDigest: `sha256:${string}` | null;
        successorIrDigest: `sha256:${string}` | null;
        factResults: ({
            sourcePath: string;
            factClass: "SEMANTIC";
            valueDigest: `sha256:${string}`;
            targetRef: string;
            disposition: "REJECTED" | "CONVERTED";
        } | {
            sourcePath: string;
            factClass: "PHYSICAL_PRESENTATION" | "VISUAL_PRESENTATION" | "TARGET_RECIPE";
            valueDigest: `sha256:${string}`;
            targetRef: null;
            disposition: "PRESERVED_AS_LEGACY_FACT";
        })[];
        findings: {
            code: string;
            subjectRef: string;
        }[];
        disposition: "INCOMPATIBLE" | "LOSSLESS" | "ADMITTED_WITH_LEGACY_PRESENTATION_FACTS";
        evidenceType: "legacy-ui-compatibility-evidence.v1";
        sourceType: LegacySourceType;
        sourceDigest: `sha256:${string}`;
    }>;
}>;
export {};
