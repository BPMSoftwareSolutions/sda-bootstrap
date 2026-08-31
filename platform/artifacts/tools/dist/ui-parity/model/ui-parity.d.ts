import type { JsonRecord } from "../../consumer-projection/model/consumer-workspace-facts.js";
export type UiEmbodimentTarget = string;
export type UiDimension = "information" | "availability" | "validation" | "state" | "feedback" | "navigation" | "accessibility";
export type UiPresentationDimension = "hierarchy" | "grouping" | "action-emphasis" | "typography" | "spacing-density" | "surface" | "state-distinction" | "responsive-adaptive" | "focus" | "media" | "motion" | "platform-adaptation";
export type UiInteractionDisposition = "COMPLETED" | "BLOCKED_BY_VALIDATION" | "UNAVAILABLE" | "FAILED_TO_REALIZE";
export interface UiObjectModelRelationship extends JsonRecord {
    readonly targetConceptId: string;
    readonly cardinality: "one" | "optional" | "many";
}
export interface UiObjectModelConcept extends JsonRecord {
    readonly conceptId: string;
    readonly layer: "authority" | "runtime" | "evidence";
    readonly requiredMembers: readonly string[];
    readonly relationships: readonly UiObjectModelRelationship[];
    readonly requiredBehaviors: readonly string[];
}
export interface UiObjectModel extends JsonRecord {
    readonly objectModelType: "consumer-ui-object-model.v1";
    readonly modelId: string;
    readonly concepts: readonly UiObjectModelConcept[];
    readonly targetRules: {
        readonly languageNativeRepresentation: "ALLOWED";
        readonly rawAuthorityAccess: "ADMISSION_BOUNDARY_ONLY";
        readonly targetOwnedSemanticConcepts: "FORBIDDEN";
    };
}
export interface UiStructuralConceptClaim extends JsonRecord {
    readonly conceptId: string;
    readonly representation: string;
    readonly implementationRef: string;
    readonly members: readonly string[];
    readonly relationships: readonly UiObjectModelRelationship[];
    readonly behaviors: readonly string[];
}
export interface UiStructuralTestimony extends JsonRecord {
    readonly structuralTestimonyType: "consumer-ui-structural-testimony.v1";
    readonly embodimentTarget: UiEmbodimentTarget;
    readonly objectModelDigest: `sha256:${string}`;
    readonly implementationRefs: readonly string[];
    readonly concepts: readonly UiStructuralConceptClaim[];
    readonly rawAuthorityAccessSites: readonly {
        readonly implementationRef: string;
        readonly member: string;
        readonly disposition: "ADMISSION_BOUNDARY" | "RUNTIME_LEAK";
    }[];
    readonly targetOwnedSemanticConcepts: readonly string[];
    readonly disposition: "PASS" | "FAIL";
}
export interface UiAuthorityIdentity extends JsonRecord {
    readonly identityType: "consumer-ui-authority-identity.v1";
    readonly authorityRef: string;
    readonly uiAuthorityType: "consumer-ui-authority.v1";
    readonly applicationId: string;
    readonly experienceConditionIds: readonly string[];
    readonly canonicalization: "recursive-key-order.v1";
    readonly authorityDigest: `sha256:${string}`;
}
export interface UiVectorStep extends JsonRecord {
    readonly stepId: string;
    readonly action: "set-state" | "invoke-action" | "observe";
    readonly target: string;
    readonly value?: unknown;
    readonly dimension?: UiDimension;
}
export interface UiVector extends JsonRecord {
    readonly vectorId: string;
    readonly purpose: string;
    readonly expectedDisposition: UiInteractionDisposition;
    readonly steps: readonly UiVectorStep[];
}
export interface UiVectorCorpus extends JsonRecord {
    readonly vectorCorpusType: "consumer-ui-vector-corpus.v1";
    readonly corpusId: string;
    readonly authorityIdentity: {
        readonly authorityRef: string;
        readonly authorityDigest: `sha256:${string}`;
    };
    readonly vectors: readonly UiVector[];
}
export interface UiExperienceCoverage extends JsonRecord {
    readonly coverageType: "consumer-ui-experience-coverage.v1";
    readonly authorityDigest: `sha256:${string}`;
    readonly vectorCorpusDigest: `sha256:${string}`;
    readonly conditions: readonly {
        readonly conditionId: string;
        readonly vectorIds: readonly string[];
    }[];
}
export interface UiObservation extends JsonRecord {
    readonly target: string;
    readonly value: unknown;
}
export type UiObservations = Readonly<Record<UiDimension, readonly UiObservation[]>>;
export interface UiStepTestimony extends JsonRecord {
    readonly stepId: string;
    readonly semanticAction: UiVectorStep["action"];
    readonly target: string;
    readonly interactionDisposition: UiInteractionDisposition;
    readonly observations: UiObservations;
}
export interface UiVectorTestimony extends JsonRecord {
    readonly vectorId: string;
    readonly interactionDisposition: UiInteractionDisposition;
    readonly steps: readonly UiStepTestimony[];
}
export interface UiTestimony extends JsonRecord {
    readonly testimonyType: "consumer-ui-testimony.v1";
    readonly applicationId: string;
    readonly embodimentTarget: UiEmbodimentTarget;
    readonly authorityDigest: `sha256:${string}`;
    readonly vectorCorpusDigest: `sha256:${string}`;
    readonly executableOrigin: "PROJECTED_ONLY";
    readonly vectorResults: readonly UiVectorTestimony[];
}
export interface UiPresentationObservation extends JsonRecord {
    readonly dimension: UiPresentationDimension;
    readonly target: string;
    readonly declaredIntent: unknown;
    readonly disposition: "OBSERVED" | "NOT_OBSERVED";
    readonly nativeEvidence: Readonly<Record<string, unknown>> & {
        readonly mechanism: string;
        readonly locator: string;
    };
}
export interface UiPresentationTestimony extends JsonRecord {
    readonly presentationTestimonyType: "consumer-ui-presentation-testimony.v1";
    readonly applicationId: string;
    readonly embodimentTarget: UiEmbodimentTarget;
    readonly authorityDigest: `sha256:${string}`;
    readonly presentationProfileDigest: `sha256:${string}`;
    readonly renderContexts: readonly {
        readonly contextId: "compact" | "standard" | "wide";
        readonly viewport: {
            readonly width: number;
            readonly height: number;
        };
        readonly scale: number;
        readonly theme: "light" | "dark" | "high-contrast";
        readonly reducedMotion: boolean;
        readonly screenshotDigest?: `sha256:${string}`;
    }[];
    readonly observations: readonly UiPresentationObservation[];
    readonly platformNativeDisposition: "PASS" | "FAIL";
}
export interface UiRequiredInteraction extends JsonRecord {
    readonly semanticKind: "input" | "action";
    readonly refId: string;
}
export interface UiNativeRealization extends UiRequiredInteraction {
    readonly nativeRole: string;
    readonly nativeLocator: string;
}
export interface UiWiringConformance extends JsonRecord {
    readonly wiringConformanceType: "consumer-ui-wiring-conformance.v1";
    readonly applicationId: string;
    readonly embodimentTarget: UiEmbodimentTarget;
    readonly authorityDigest: `sha256:${string}`;
    readonly requiredInteractions: readonly UiRequiredInteraction[];
    readonly realizedInteractions: readonly UiNativeRealization[];
    readonly unboundRequiredInteractions: readonly UiRequiredInteraction[];
    readonly inventedInteractions: readonly UiNativeRealization[];
    readonly disposition: "PASS" | "FAIL";
}
export type UiParityGateId = "AUTHORITY_IDENTITY" | "OBJECT_MODEL_IDENTITY" | "STRUCTURAL_PARITY" | "EVIDENCE_STRUCTURE_PARITY" | "VECTOR_CORPUS_IDENTITY" | "INFORMATION_PARITY" | "AVAILABILITY_PARITY" | "STATE_PARITY" | "ACTION_PARITY" | "VALIDATION_PARITY" | "FEEDBACK_PARITY" | "NAVIGATION_PARITY" | "ACCESSIBILITY_PARITY" | "PRESENTATION_PROFILE_IDENTITY" | "VISUAL_HIERARCHY_PARITY" | "GROUPING_PARITY" | "ACTION_EMPHASIS_PARITY" | "TYPOGRAPHY_PARITY" | "SPACING_DENSITY_PARITY" | "SURFACE_PARITY" | "STATE_DISTINCTION_PARITY" | "RESPONSIVE_ADAPTIVE_PARITY" | "FOCUS_PARITY" | "MEDIA_PARITY" | "MOTION_PARITY" | "EXPERIENCE_PARITY";
export type UiTargetGateId = "SEMANTIC_STRUCTURE" | "RAW_AUTHORITY_BOUNDARY" | "TARGET_SEMANTIC_OWNERSHIP" | "PLATFORM_NATIVE" | "FRAMEWORK_WIRING" | "EXECUTABLE_ORIGIN";
export interface UiParityGate extends JsonRecord {
    readonly disposition: "PASS" | "FAIL" | "PROJECTED_ONLY";
    readonly findings: readonly string[];
}
export interface UiParityEvidence extends JsonRecord {
    readonly parityEvidenceType: "consumer-ui-parity-evidence.v1";
    readonly applicationId: string;
    readonly targets: readonly UiEmbodimentTarget[];
    readonly authorityDigest: `sha256:${string}`;
    readonly objectModelDigest: `sha256:${string}`;
    readonly vectorCorpusDigest: `sha256:${string}`;
    readonly experienceCoverageDigest: `sha256:${string}`;
    readonly presentationProfileDigest: `sha256:${string}`;
    readonly gates: Readonly<Record<UiParityGateId, UiParityGate>>;
    readonly targetGates: Readonly<Partial<Record<UiEmbodimentTarget, Readonly<Record<UiTargetGateId, UiParityGate>>>>>;
    readonly proofCellCount: number;
    readonly crossApplyDisposition: "CROSS_APPLY_UI_CONFORMANT" | "CROSS_APPLY_UI_DIVERGENT";
    readonly experienceParity: "PASS" | "FAIL";
}
export interface UiClaimantEvidence {
    readonly target: UiEmbodimentTarget;
    readonly testimony: UiTestimony;
    readonly presentation: UiPresentationTestimony;
    readonly wiring: UiWiringConformance;
    readonly structure: UiStructuralTestimony;
}
