import { evaluateMechanicalSterility } from "../../../consumer-projection/proof/mechanical-sterility-evaluator.js";
export class ProveProjectedSterilityBeforePublicationProvider {
    responsibilityId = "detect-hidden-mechanics-in-planned-consumer-artifacts";
    async execute(input) {
        return evaluateMechanicalSterility(input.plan.files);
    }
}
