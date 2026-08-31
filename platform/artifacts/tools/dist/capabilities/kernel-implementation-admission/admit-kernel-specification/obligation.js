export class KernelSpecificationAdmissionObligation {
    obligationId = "every-specification-requirement-is-admitted-or-identified";
    evaluate(evidence) {
        if (!evidence.found)
            return { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "canonical-specification-is-schema-admitted", reason: evidence.errors[0] ?? "specification unavailable" }] };
        return { kind: evidence.valid ? "SATISFIED" : "NOT_SATISFIED", conditionEvidence: [{ conditionId: "canonical-specification-is-schema-admitted", disposition: evidence.valid ? "SATISFIED" : "NOT_SATISFIED", evidenceRef: evidence.specificationPath }] };
    }
}
