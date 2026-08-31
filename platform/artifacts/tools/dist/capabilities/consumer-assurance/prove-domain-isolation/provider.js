import { DomainIsolationEvaluator } from "../../../consumer-projection/proof/domain-isolation-evaluator.js";
export class ProveDomainIsolationProvider {
    responsibilityId = "detect-consumer-domain-vocabulary-in-platform-tooling";
    async execute(input) { return new DomainIsolationEvaluator().evaluate(input.sources.value); }
}
