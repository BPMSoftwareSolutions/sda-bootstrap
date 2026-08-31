#!/usr/bin/env node
import type { UiEmbodimentTarget } from "../../ui-parity/model/ui-parity.js";
export declare function evaluateUiCandidate(workspaceRoot: string, requestedTarget: UiEmbodimentTarget): {
    admissionEvidenceType: string;
    applicationId: string;
    claimantTarget: string;
    baselineTargets: string[];
    candidateEvidenceRoot: string;
    schemaAdmission: {
        testimony: string;
        presentation: string;
        wiring: string;
        structure: string;
    };
    staticImplementationDisposition: "PASS" | "FAIL";
    crossApplyProof: import("../../ui-parity/model/ui-parity.js").UiParityEvidence;
    findings: string[];
    disposition: string;
};
