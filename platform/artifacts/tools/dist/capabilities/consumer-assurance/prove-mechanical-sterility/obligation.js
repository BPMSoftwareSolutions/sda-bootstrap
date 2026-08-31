export class ProveMechanicalSterilityObligation {
    obligationId = "every-projected-artifact-is-mechanical-or-has-a-precise-violation";
    evaluate(evidence) {
        return evidence.disposition === "PURE_PROJECTION_CONFORMS"
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "projected-executable-files-contain-no-hidden-mechanics", disposition: "SATISFIED" }] }
            : { kind: "NOT_SATISFIED", conditionEvidence: [{ conditionId: "projected-executable-files-contain-no-hidden-mechanics", disposition: "NOT_SATISFIED", detail: JSON.stringify(evidence.violations) }] };
    }
}
