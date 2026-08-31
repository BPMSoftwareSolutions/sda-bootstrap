import type { ContractReference } from "../../src/contracts/index.js";
import type { ContractValidator } from "../../src/execution/index.js";
import type { AdmissionBehavior } from "./fixture.js";
/**
 * Test double for the one adapter-variable step the vector calls twice
 * (admit-input, then admit-outcome). Configured with the fixture's
 * prescribed behaviors in call order and dequeues one per call — never
 * invents behavior independently of the fixture, since a real
 * ContractValidator implementation (JSON Schema or otherwise) doesn't
 * exist yet.
 */
export declare class FixtureDrivenContractValidator implements ContractValidator {
    private readonly behaviors;
    constructor(behaviors: AdmissionBehavior[]);
    admit(contract: ContractReference, _value: unknown): Promise<unknown>;
}
