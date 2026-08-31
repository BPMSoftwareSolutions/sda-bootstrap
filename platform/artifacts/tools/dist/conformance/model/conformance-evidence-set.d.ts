export interface LanguageObligation {
    readonly language: string;
    readonly bindingPath: string;
    readonly binding: Record<string, unknown> & {
        readonly implementationId: string;
    };
    readonly status: string;
    readonly isActiveObligation: boolean;
}
export interface ImplementationOriginEvidence {
    readonly origin: "HAND_AUTHORED" | "PROJECTED" | "MIXED" | "UNKNOWN";
    readonly projectedCount?: number;
    readonly handWrittenCount?: number;
    readonly reason?: string;
}
export interface AdmissionObligationEvidence {
    readonly id: string;
    readonly group: string;
    readonly label: string;
    readonly disposition: "PASS" | "FAIL" | "NOT_READY";
    readonly scenarioId: string;
    readonly obligationId: string;
    readonly evidenceRef: string;
}
export interface ConformanceEvidenceSet {
    readonly evidenceSetType: "conformance-evidence-set.v1";
    readonly language: string;
    readonly implementationId: string;
    readonly evidenceRefs: Readonly<Record<string, string>>;
    readonly workspacePlacement: {
        readonly conforming: boolean;
    };
    readonly kernelSpecification: {
        readonly valid: boolean;
    };
    readonly schemaFamily: {
        readonly valid: boolean;
    };
    readonly executionVector: {
        readonly valid: boolean;
    };
    readonly languageDeclaration: {
        readonly bindingValid: boolean;
        readonly conformanceClaimValid: boolean;
    };
    readonly shape: {
        readonly conforming: boolean;
    };
    readonly execution: {
        readonly conforming: boolean;
    };
    readonly authority: {
        readonly conforming: boolean;
    };
    readonly behavioral: {
        readonly ran: boolean;
        readonly conforming: boolean;
    };
    readonly executionClosure: {
        readonly ran: boolean;
        readonly conforming: boolean;
    };
    readonly implementationOrigin: ImplementationOriginEvidence;
}
export interface ImplementationAdmission {
    readonly language: string;
    readonly implementationId: string;
    readonly evaluationDisposition: "COMPLETE";
    readonly admissionDisposition: "ADMITTED" | "BLOCKED";
    readonly implementationOrigin: ImplementationOriginEvidence;
    readonly obligations: readonly AdmissionObligationEvidence[];
    readonly blockingObligations: readonly string[];
    readonly notReadyObligations: readonly string[];
    readonly details: Readonly<Record<string, unknown>>;
}
