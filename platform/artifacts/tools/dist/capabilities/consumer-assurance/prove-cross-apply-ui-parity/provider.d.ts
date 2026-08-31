import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ProveCrossApplyUiParityEvidence, ProveCrossApplyUiParityInput } from "./model.js";
export declare class ProveCrossApplyUiParityProvider implements ResponsibilityProvider<ProveCrossApplyUiParityInput, ProveCrossApplyUiParityEvidence> {
    readonly responsibilityId = "compare-semantic-presentation-and-native-ui-testimony-across-embodiments";
    execute(input: ProveCrossApplyUiParityInput): Promise<ProveCrossApplyUiParityEvidence>;
}
