import { MechanicConformanceObserver } from "../../../consumer-projection/proof/mechanic-conformance-observer.js";
export class DeterminePlatformMechanicConformanceProvider {
    responsibilityId = "evaluate-current-platform-mechanic-proofs";
    async execute(input) {
        return new MechanicConformanceObserver().observe(input);
    }
}
