import { evaluateMechanicalSterility } from "../../../consumer-projection/proof/mechanical-sterility-evaluator.js";
export class ProveMechanicalSterilityProvider {
    responsibilityId = "inspect-projected-consumer-executable-mechanics";
    async execute(input) { return evaluateMechanicalSterility(input.plan.files); }
}
