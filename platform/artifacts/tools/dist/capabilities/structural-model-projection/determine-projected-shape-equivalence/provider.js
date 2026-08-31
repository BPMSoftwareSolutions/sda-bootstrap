import { projectedShapeObserver } from "../../../projection/proof/projected-shape-observer-registry.js";
export class DetermineProjectedShapeEquivalenceProvider {
    responsibilityId = "compare-projected-and-admitted-structural-shape";
    async execute(input) {
        return projectedShapeObserver(input.plan.target).observe(input.admittedSource.value, input.plan);
    }
}
