export class FunctionContractAdmission {
    predicates;
    constructor(predicates) {
        this.predicates = predicates;
    }
    async admit(contract, value) {
        const predicate = this.predicates.get(contract.contractId);
        if (!predicate)
            throw new Error(`No contract admission provider for '${contract.contractId}'.`);
        if (!predicate(value))
            throw new Error(`Value was rejected by '${contract.contractId}'.`);
        return value;
    }
}
