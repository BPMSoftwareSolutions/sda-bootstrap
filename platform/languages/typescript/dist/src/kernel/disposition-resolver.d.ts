import type { Scenario, Disposition } from "../contracts/index.js";
import type { DispositionResolver as DispositionResolverPort } from "../execution/index.js";
/**
 * The canonical disposition resolution: purely mechanical, driven by
 * scenario.outcome.terminal. Unlike ContractValidator,
 * ExecutionAuthorityResolver, or SemanticExecutor — where the mechanism
 * legitimately varies by adapter (JSON Schema vs. something else, DI/
 * registry lookup vs. a lookup table, in-process vs. remote dispatch) —
 * there is exactly one correct answer here with no infrastructure
 * dependency, so it lives in the kernel itself rather than being left for
 * an adapter to supply.
 */
export declare class DispositionResolver implements DispositionResolverPort {
    resolve(scenario: Scenario, _admittedOutcome: unknown): Disposition;
}
