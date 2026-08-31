import type { ClockPort } from "../../ports/infrastructure-ports.js";
export interface GateEvidence {
    readonly gate: string;
    readonly subjectDigest: string;
    readonly evidenceType: string;
    readonly evidenceVersion: string;
    readonly issuer: string;
    readonly observedAt: string;
    readonly disposition: "SATISFIED" | "NOT_SATISFIED" | "NOT_OBSERVABLE";
    readonly evidenceRef: string;
    readonly digest: string;
}
export interface GateEvidenceTrustPolicy {
    verify(evidence: GateEvidence, context: {
        readonly environment: string;
        readonly bundleDigest: string;
        readonly decidedAt: string;
    }): boolean;
}
export interface ReleaseAdmission {
    readonly admissionType: "sda-release-admission.v1";
    readonly environment: string;
    readonly bundleDigest: string;
    readonly requiredGates: readonly string[];
    readonly evidenceFreshnessMilliseconds: number;
    readonly gateEvidence: readonly GateEvidence[];
    readonly disposition: "RELEASE_ADMITTED" | "RELEASE_BLOCKED";
    readonly decidedAt: string;
}
export declare function evaluateReleaseAdmission(options: {
    readonly environment: string;
    readonly bundleDigest: string;
    readonly requiredGates: readonly string[];
    readonly gateEvidence: readonly GateEvidence[];
    readonly maximumEvidenceAgeMilliseconds: number;
    readonly evidenceTrustPolicy: GateEvidenceTrustPolicy;
    readonly clock: ClockPort;
}): ReleaseAdmission;
