import { ProjectionEquivalenceObserver } from "../../../consumer-projection/proof/projection-equivalence-observer.js";
export class ProveCrossTargetProjectionEquivalenceProvider {
    responsibilityId = "compare-consumer-outcomes-across-projected-runtimes";
    async execute(input) {
        return new ProjectionEquivalenceObserver().observe(input);
    }
}
