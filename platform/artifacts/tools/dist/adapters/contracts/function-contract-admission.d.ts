import type { ContractReference } from "../../model/semantic-model.js";
import type { ContractAdmissionPort } from "../../ports/capability-ports.js";
export type ContractPredicate = (value: unknown) => boolean;
export declare class FunctionContractAdmission implements ContractAdmissionPort {
    private readonly predicates;
    constructor(predicates: ReadonlyMap<string, ContractPredicate>);
    admit(contract: ContractReference, value: unknown): Promise<unknown>;
}
