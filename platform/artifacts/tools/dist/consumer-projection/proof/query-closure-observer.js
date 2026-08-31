import { satisfies, valueAt } from "./assertion-evaluator.js";
export class QueryClosureObserver {
    observe(catalog, facts) {
        const observations = facts.map((fact) => {
            const assertions = fact.assertions.map((assertion) => {
                const actual = valueAt(fact.result, assertion.path);
                return { path: assertion.path, operator: assertion.operator, expected: assertion.value, actual: actual ?? null, satisfied: satisfies(actual, assertion) };
            });
            return {
                queryId: fact.queryId,
                fixtureId: fact.fixtureId,
                params: fact.params,
                result: fact.result,
                assertions,
                disposition: assertions.every((assertion) => assertion.satisfied) ? "OBSERVED" : "NOT_OBSERVED"
            };
        });
        const queries = Array.isArray(catalog.queries) ? catalog.queries : [];
        const implemented = queries.filter((query) => query.status === "IMPLEMENTED");
        const observedIds = new Set(observations.filter((item) => item.disposition === "OBSERVED").map((item) => String(item.queryId)));
        const complete = observations.every((item) => item.disposition === "OBSERVED") && implemented.every((query) => observedIds.has(String(query.queryId)));
        return Object.freeze({
            conformanceType: "consumer-query-catalog-conformance.v1",
            catalogId: String(catalog.catalogId),
            projectionTarget: "node",
            coverage: { declared: queries.length, implemented: implemented.length, observed: implemented.filter((query) => observedIds.has(String(query.queryId))).length },
            queries: observations,
            disposition: complete ? "ALL_IMPLEMENTED_QUERIES_OBSERVED" : "QUERY_CATALOG_GAP"
        });
    }
}
