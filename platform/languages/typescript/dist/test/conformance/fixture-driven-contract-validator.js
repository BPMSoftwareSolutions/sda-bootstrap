import { ContractAdmissionException } from "../../src/execution/index.js";
/**
 * Test double for the one adapter-variable step the vector calls twice
 * (admit-input, then admit-outcome). Configured with the fixture's
 * prescribed behaviors in call order and dequeues one per call — never
 * invents behavior independently of the fixture, since a real
 * ContractValidator implementation (JSON Schema or otherwise) doesn't
 * exist yet.
 */
export class FixtureDrivenContractValidator {
    behaviors;
    constructor(behaviors) {
        this.behaviors = [...behaviors];
    }
    async admit(contract, _value) {
        const behavior = this.behaviors.shift();
        if (!behavior) {
            throw new Error("FixtureDrivenContractValidator received more admission calls than the fixture prescribed.");
        }
        if (behavior.outcome === "admit") {
            return behavior.admittedValue;
        }
        if (behavior.outcome === "reject") {
            throw new ContractAdmissionException(`Fixture-prescribed rejection for contract '${contract.contractId}'.`);
        }
        throw new Error(`Unknown admission outcome '${behavior.outcome}'.`);
    }
}
