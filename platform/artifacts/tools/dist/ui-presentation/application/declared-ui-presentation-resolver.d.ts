type Digest = `sha256:${string}`;
export interface DeclaredLineageOrigin {
    readonly originType: "SCENARIO_OBLIGATION" | "PROMISED_EXPERIENCE" | "INFORMATION" | "RELATIONSHIP" | "INTERACTION" | "FEEDBACK" | "ACCESSIBILITY" | "ADAPTATION" | "PRESENTATION_PROFILE";
    readonly originRef: string;
    readonly authorityDigest: Digest;
}
export interface DeclaredSemanticElement {
    readonly elementId: string;
    readonly semanticKind: "INFORMATION" | "ACTION" | "INPUT" | "NAVIGATION" | "FEEDBACK" | "REGION";
    readonly semanticRole: "PRIMARY" | "SUPPORTING" | "LEADING" | "PERSISTENT" | "ON_DEMAND" | "GROUP" | "STATUS" | "DOCUMENT" | "NAVIGATION";
    readonly content?: Readonly<{
        literal: string;
    } | {
        readModelRef: string;
    }>;
    readonly informationRefs: readonly string[];
    readonly interactionRefs: readonly string[];
    readonly feedbackRefs: readonly string[];
    readonly stateRefs: readonly string[];
    readonly eventRefs: readonly string[];
    readonly accessibilityObligations: readonly Readonly<{
        obligationRef: string;
        kind: "NAME" | "DESCRIPTION" | "FOCUS_ORDER" | "LIVE_FEEDBACK" | "OPERABLE_ACTION" | "RELATIONSHIP";
    }>[];
    readonly lineage: readonly DeclaredLineageOrigin[];
}
export interface DeclaredRelationship {
    readonly relationshipId: string;
    readonly kind: "CONTAINS" | "FOLLOWS" | "GROUPED" | "RELATED_TO" | "CONTINUITY" | "NAVIGATION" | "INDEPENDENTLY_NAVIGABLE";
    readonly sourceElementId: string;
    readonly targetElementId: string;
    readonly lineage: readonly DeclaredLineageOrigin[];
}
export interface DeclaredAdaptationIntent {
    readonly adaptationId: string;
    readonly contextRef: string;
    readonly allowedChangeKinds: readonly ("ORDER" | "VISIBILITY" | "GROUPING" | "DENSITY" | "NAVIGATION" | "CONTENT_PRIORITY")[];
    readonly invariantRefs: readonly string[];
}
export interface DeclaredUiAuthority {
    readonly authorityType: "declared-ui-authority.v1";
    readonly authorityId: string;
    readonly authorityDigest: Digest;
    readonly promisedExperiences: readonly Readonly<{
        experienceRef: string;
        presentationRequirement: "OBSERVABLE_OR_OPERABLE" | "NO_OBSERVABLE_PRESENTATION";
    }>[];
    readonly elements: readonly DeclaredSemanticElement[];
    readonly relationships: readonly DeclaredRelationship[];
    readonly adaptationIntents: readonly DeclaredAdaptationIntent[];
    readonly presentationProfileRefs: readonly string[];
}
export declare function semanticPresentationDigest(value: object): Digest;
export declare function declaredUiAuthorityDigest(value: DeclaredUiAuthority): Digest;
type AdmissionFindingCode = "DECLARED_UI_AUTHORITY_DIGEST_MISMATCH" | "DUPLICATE_SEMANTIC_ELEMENT" | "DUPLICATE_SEMANTIC_RELATIONSHIP" | "DUPLICATE_ADAPTATION_INTENT" | "DUPLICATE_PROMISED_EXPERIENCE";
export declare function admitDeclaredUiAuthority(authority: DeclaredUiAuthority): Readonly<{
    evidenceType: "declared-ui-source-admission-evidence.v1";
    authorityId: string;
    declaredAuthorityDigest: `sha256:${string}`;
    observedAuthorityDigest: `sha256:${string}`;
    findings: {
        code: AdmissionFindingCode;
        subjectRef: string;
    }[];
    disposition: "ADMITTED" | "REJECTED";
}>;
export declare function resolveDeclaredUiPresentation(authority: DeclaredUiAuthority): Readonly<{
    presentation: Readonly<{
        canonicalDigest: `sha256:${string}`;
        presentationType: "sda-ui-semantic-presentation.v1";
        presentationId: string;
        sourceAuthority: {
            authorityType: "declared-ui-authority.v1";
            authorityId: string;
            authorityDigest: `sha256:${string}`;
        };
        promisedExperienceRefs: string[];
        elements: DeclaredSemanticElement[];
        relationships: {
            lineage: DeclaredLineageOrigin[];
            relationshipId: string;
            kind: "CONTAINS" | "FOLLOWS" | "GROUPED" | "RELATED_TO" | "CONTINUITY" | "NAVIGATION" | "INDEPENDENTLY_NAVIGABLE";
            sourceElementId: string;
            targetElementId: string;
        }[];
        adaptationIntents: {
            allowedChangeKinds: ("NAVIGATION" | "ORDER" | "VISIBILITY" | "GROUPING" | "DENSITY" | "CONTENT_PRIORITY")[];
            invariantRefs: string[];
            adaptationId: string;
            contextRef: string;
        }[];
        presentationProfileRefs: string[];
    }>;
    lineageEvidence: Readonly<{
        evidenceType: "semantic-presentation-lineage-evidence.v1";
        sourceAuthorityDigest: `sha256:${string}`;
        presentationDigest: `sha256:${string}`;
        elementResults: {
            subjectId: string;
            originCount: number;
            disposition: "JUSTIFIED" | "UNJUSTIFIED";
        }[];
        relationshipResults: {
            subjectId: string;
            originCount: number;
            disposition: "JUSTIFIED" | "UNJUSTIFIED";
        }[];
        findings: {
            code: "UNJUSTIFIED_PRESENTATION_ELEMENT" | "UNJUSTIFIED_PRESENTATION_RELATIONSHIP" | "UNKNOWN_RELATIONSHIP_ENDPOINT";
            subjectRef: string;
        }[];
        disposition: "ADMITTED" | "REJECTED";
    }>;
    closureEvidence: Readonly<{
        evidenceType: "presentation-closure-evidence.v1";
        sourceAuthorityDigest: `sha256:${string}`;
        presentationDigest: `sha256:${string}`;
        promiseResults: {
            experienceRef: string;
            disposition: "SATISFIED" | "MISSING_PRESENTATION";
        }[];
        zeroOpinionCounts: {
            visibleElements: number;
            interactions: number;
            stylingDecisions: 0;
            implicitActions: 0;
            implicitLayouts: 0;
            defaultPresentationProfiles: 0;
        };
        findings: {
            code: "MISSING_PRESENTATION_FOR_EXPERIENCE";
            subjectRef: string;
        }[];
        disposition: "REJECTED" | "VALID_EMPTY_PRESENTATION" | "CLOSED";
    }>;
}>;
type StageDisposition = "PASS" | "FAIL" | "NOT_REACHED";
export declare function executeDeclaredUiPresentationResolution(authority: DeclaredUiAuthority): Readonly<{
    admissionEvidence: Readonly<{
        evidenceType: "declared-ui-source-admission-evidence.v1";
        authorityId: string;
        declaredAuthorityDigest: `sha256:${string}`;
        observedAuthorityDigest: `sha256:${string}`;
        findings: {
            code: AdmissionFindingCode;
            subjectRef: string;
        }[];
        disposition: "ADMITTED" | "REJECTED";
    }>;
    resolutionEvidence: Readonly<{
        evidenceType: "semantic-presentation-resolution-evidence.v1";
        sourceAuthorityDigest: `sha256:${string}`;
        presentationDigest: null;
        stages: {
            stageId: "admit-declared-ui" | "resolve-ui-presentation-lineage" | "reject-unjustified-presentation" | "resolve-semantic-presentation-composition" | "resolve-semantic-interaction-presentation" | "resolve-adaptive-presentation" | "resolve-declared-presentation-profile" | "produce-canonical-semantic-presentation";
            disposition: StageDisposition;
        }[];
        findings: {
            code: AdmissionFindingCode;
            subjectRef: string;
        }[];
        disposition: "REJECTED";
    }>;
}> | Readonly<{
    admissionEvidence: Readonly<{
        evidenceType: "declared-ui-source-admission-evidence.v1";
        authorityId: string;
        declaredAuthorityDigest: `sha256:${string}`;
        observedAuthorityDigest: `sha256:${string}`;
        findings: {
            code: AdmissionFindingCode;
            subjectRef: string;
        }[];
        disposition: "ADMITTED" | "REJECTED";
    }>;
    lineageEvidence: Readonly<{
        evidenceType: "semantic-presentation-lineage-evidence.v1";
        sourceAuthorityDigest: `sha256:${string}`;
        presentationDigest: `sha256:${string}`;
        elementResults: {
            subjectId: string;
            originCount: number;
            disposition: "JUSTIFIED" | "UNJUSTIFIED";
        }[];
        relationshipResults: {
            subjectId: string;
            originCount: number;
            disposition: "JUSTIFIED" | "UNJUSTIFIED";
        }[];
        findings: {
            code: "UNJUSTIFIED_PRESENTATION_ELEMENT" | "UNJUSTIFIED_PRESENTATION_RELATIONSHIP" | "UNKNOWN_RELATIONSHIP_ENDPOINT";
            subjectRef: string;
        }[];
        disposition: "ADMITTED" | "REJECTED";
    }>;
    closureEvidence: Readonly<{
        evidenceType: "presentation-closure-evidence.v1";
        sourceAuthorityDigest: `sha256:${string}`;
        presentationDigest: `sha256:${string}`;
        promiseResults: {
            experienceRef: string;
            disposition: "SATISFIED" | "MISSING_PRESENTATION";
        }[];
        zeroOpinionCounts: {
            visibleElements: number;
            interactions: number;
            stylingDecisions: 0;
            implicitActions: 0;
            implicitLayouts: 0;
            defaultPresentationProfiles: 0;
        };
        findings: {
            code: "MISSING_PRESENTATION_FOR_EXPERIENCE";
            subjectRef: string;
        }[];
        disposition: "REJECTED" | "VALID_EMPTY_PRESENTATION" | "CLOSED";
    }>;
    resolutionEvidence: Readonly<{
        evidenceType: "semantic-presentation-resolution-evidence.v1";
        sourceAuthorityDigest: `sha256:${string}`;
        presentationDigest: `sha256:${string}` | null;
        stages: {
            stageId: "admit-declared-ui" | "resolve-ui-presentation-lineage" | "reject-unjustified-presentation" | "resolve-semantic-presentation-composition" | "resolve-semantic-interaction-presentation" | "resolve-adaptive-presentation" | "resolve-declared-presentation-profile" | "produce-canonical-semantic-presentation";
            disposition: StageDisposition;
        }[];
        findings: Readonly<{
            code: string;
            subjectRef: string;
        }>[];
        disposition: "REJECTED" | "RESOLVED";
    }>;
}>;
export {};
