export class ShapeConformanceObligation {
    obligationId = "every-canonical-object-has-an-explicit-shape-disposition";
    evaluate(evidence) { if (!evidence.manifestFound)
        return { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "every-canonical-object-has-a-shape-disposition", reason: "conformance manifest not found" }] }; return { kind: evidence.conforming ? "SATISFIED" : "NOT_SATISFIED", conditionEvidence: [{ conditionId: "every-canonical-object-has-a-shape-disposition", disposition: evidence.conforming ? "SATISFIED" : "NOT_SATISFIED", evidenceRef: evidence.manifestPath }] }; }
}
