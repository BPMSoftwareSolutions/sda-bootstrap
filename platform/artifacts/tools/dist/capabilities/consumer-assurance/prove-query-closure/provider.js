import { QueryClosureObserver } from "../../../consumer-projection/proof/query-closure-observer.js";
export class ProveQueryClosureProvider {
    responsibilityId = "evaluate-declared-consumer-queries-against-observations";
    async execute(input) { return new QueryClosureObserver().observe(input.catalog, input.observations); }
}
