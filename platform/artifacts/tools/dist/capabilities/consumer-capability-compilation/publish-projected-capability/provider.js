import { addSterilityEvidence } from "../../../consumer-projection/proof/mechanical-sterility-evaluator.js";
export class PublishProjectedCapabilityProvider {
    store;
    responsibilityId = "atomically-publish-proven-consumer-projection";
    constructor(store) {
        this.store = store;
    }
    async execute(input) {
        if (input.sterility.disposition !== "PURE_PROJECTION_CONFORMS") {
            throw new Error(`PROJECTED_EXECUTION_MECHANIC_VIOLATION: ${JSON.stringify(input.sterility.violations)}`);
        }
        return this.store.publish(addSterilityEvidence(input.plan, input.sterility), input.failureInjection ? { failureInjection: input.failureInjection } : {});
    }
}
