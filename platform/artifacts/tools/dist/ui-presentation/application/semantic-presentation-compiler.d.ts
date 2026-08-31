import type { DeclaredAdaptationIntent, DeclaredRelationship, DeclaredSemanticElement } from "./declared-ui-presentation-resolver.js";
type Digest = `sha256:${string}`;
export interface CanonicalSemanticPresentation {
    readonly presentationType: "sda-ui-semantic-presentation.v1";
    readonly presentationId: string;
    readonly sourceAuthority: Readonly<{
        authorityType: "declared-ui-authority.v1";
        authorityId: string;
        authorityDigest: Digest;
    }>;
    readonly promisedExperienceRefs: readonly string[];
    readonly elements: readonly DeclaredSemanticElement[];
    readonly relationships: readonly DeclaredRelationship[];
    readonly adaptationIntents: readonly DeclaredAdaptationIntent[];
    readonly presentationProfileRefs: readonly string[];
    readonly canonicalDigest: Digest;
}
export interface SemanticPresentationCompilerAuthority {
    readonly authorityType: "semantic-presentation-compiler-authority.v1";
    readonly authorityId: "compile-semantic-presentation.v1";
    readonly authorityDigest: Digest;
    readonly inputContractType: "sda-ui-semantic-presentation.v1";
    readonly outputContractType: "sda-ui-presentation-ir.v3";
    readonly defaultComposition: Readonly<{
        kind: "FLOW";
        axis: "BLOCK";
        direction: "FORWARD";
        wrap: "NO_WRAP";
    }>;
    readonly supportedRelationshipKinds: readonly "FOLLOWS"[];
    readonly supportedAccessibilityObligationKinds: readonly ("NAME" | "DESCRIPTION" | "FOCUS_ORDER" | "LIVE_FEEDBACK" | "OPERABLE_ACTION" | "RELATIONSHIP")[];
    readonly presentationProfileHandling: "REFERENCE_ONLY";
    readonly eventTriggers: Readonly<Record<"ACTION" | "INPUT" | "NAVIGATION", "ACTIVATE" | "COMMIT" | "NAVIGATE">>;
    readonly adaptationOperations: Readonly<Record<"ORDER" | "VISIBILITY" | "GROUPING", "ORDER" | "VISIBILITY" | "GROUPING">>;
    readonly rules: readonly string[];
}
type FindingCode = "SEMANTIC_PRESENTATION_DIGEST_MISMATCH" | "COMPILER_AUTHORITY_DIGEST_MISMATCH" | "DUPLICATE_SEMANTIC_ELEMENT" | "DUPLICATE_SEMANTIC_RELATIONSHIP" | "DUPLICATE_ADAPTATION_INTENT" | "UNKNOWN_RELATIONSHIP_ENDPOINT" | "UNRESOLVABLE_COMPOSITION_RELATIONSHIP" | "CYCLIC_PRESENTATION_ORDER" | "MISSING_SEMANTIC_EVENT_BINDING" | "UNSUPPORTED_ADAPTATION_INTENT" | "UNKNOWN_ADAPTATION_INVARIANT" | "UNSUPPORTED_ACCESSIBILITY_OBLIGATION" | "DUPLICATE_PRESENTATION_PROFILE_REF";
export declare function compilerAuthorityDigest(authority: SemanticPresentationCompilerAuthority): Digest;
export declare function presentationIrV3Digest(ir: object): Digest;
export declare function compileSemanticPresentation(presentation: CanonicalSemanticPresentation, authority: SemanticPresentationCompilerAuthority): Readonly<{
    evidence: Readonly<{
        presentationIrDigest: null;
        findings: Readonly<{
            code: FindingCode;
            subjectRef: string;
        }>[];
        disposition: "REJECTED";
        evidenceType: "semantic-presentation-compilation-evidence.v1";
        semanticPresentationDigest: `sha256:${string}`;
        compilerAuthorityId: "compile-semantic-presentation.v1";
        compilerAuthorityDigest: `sha256:${string}`;
    }>;
}> | Readonly<{
    ir: Readonly<{
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
    evidence: Readonly<{
        presentationIrDigest: `sha256:${string}`;
        findings: never[];
        disposition: "COMPILED";
        evidenceType: "semantic-presentation-compilation-evidence.v1";
        semanticPresentationDigest: `sha256:${string}`;
        compilerAuthorityId: "compile-semantic-presentation.v1";
        compilerAuthorityDigest: `sha256:${string}`;
    }>;
}>;
export {};
