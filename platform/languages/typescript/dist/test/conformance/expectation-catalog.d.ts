import type { ExecutionVectorExpectation } from "./fixture.js";
/**
 * Loads every conformance/expectations/execution/*.json once, keyed by
 * expectationId — the "then" half a fixture's expectationId resolves
 * through, kept independent of the fixture's own file.
 */
export declare function resolveExpectation(expectationId: string): ExecutionVectorExpectation;
