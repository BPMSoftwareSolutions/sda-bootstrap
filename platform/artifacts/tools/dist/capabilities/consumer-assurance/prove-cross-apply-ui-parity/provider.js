import { UiParityEvaluator } from "../../../ui-parity/proof/ui-parity-evaluator.js";
export class ProveCrossApplyUiParityProvider {
    responsibilityId = "compare-semantic-presentation-and-native-ui-testimony-across-embodiments";
    async execute(input) {
        return new UiParityEvaluator().evaluate(input);
    }
}
