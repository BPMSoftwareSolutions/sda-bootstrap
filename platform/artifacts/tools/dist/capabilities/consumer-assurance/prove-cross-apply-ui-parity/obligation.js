export class ProveCrossApplyUiParityObligation {
    obligationId = "every-ui-embodiment-preserves-semantic-and-presentation-experience-native-wiring-and-projected-origin";
    evaluate(evidence) {
        const satisfied = evidence.crossApplyDisposition === "CROSS_APPLY_UI_CONFORMANT" && evidence.experienceParity === "PASS";
        return {
            kind: satisfied ? "SATISFIED" : "NOT_SATISFIED",
            conditionEvidence: [{
                    conditionId: "same-authority-closes-equivalent-experience-across-admitted-ui-embodiments",
                    disposition: satisfied ? "SATISFIED" : "NOT_SATISFIED"
                }]
        };
    }
}
