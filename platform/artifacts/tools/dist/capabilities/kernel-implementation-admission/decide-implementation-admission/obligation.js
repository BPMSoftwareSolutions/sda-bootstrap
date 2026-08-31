const requiredObligationIds = new Set([
    "workspace-placement",
    "kernel-specification",
    "schema-family",
    "execution-vector",
    "binding-manifest",
    "conformance-claim",
    "shape-conformance",
    "execution-conformance",
    "authority-conformance",
    "behavioral-conformance",
    "execution-closure"
]);
export class ImplementationAdmissionObligation {
    obligationId = "every-required-obligation-participates-exactly-once-in-the-verdict";
    evaluate(evidence) {
        const ids = evidence.obligations.map((item) => item.id);
        const blocking = evidence.obligations
            .filter((item) => item.disposition === "FAIL")
            .map((item) => item.id);
        const notReady = evidence.obligations
            .filter((item) => item.disposition === "NOT_READY")
            .map((item) => item.id);
        const expectedAdmission = blocking.length === 0 && notReady.length === 0 ? "ADMITTED" : "BLOCKED";
        const complete = ids.length === requiredObligationIds.size &&
            new Set(ids).size === ids.length &&
            ids.every((id) => requiredObligationIds.has(id)) &&
            evidence.obligations.every((item) => item.scenarioId.length > 0 && item.obligationId.length > 0 && item.evidenceRef.length > 0) &&
            JSON.stringify(evidence.blockingObligations) === JSON.stringify(blocking) &&
            JSON.stringify(evidence.notReadyObligations) === JSON.stringify(notReady) &&
            evidence.admissionDisposition === expectedAdmission;
        return {
            kind: complete ? "SATISFIED" : "NOT_SATISFIED",
            conditionEvidence: [{
                    conditionId: "admission-verdict-is-complete-and-non-suppressing",
                    disposition: complete ? "SATISFIED" : "NOT_SATISFIED"
                }]
        };
    }
}
