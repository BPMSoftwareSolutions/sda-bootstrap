import type { ScenarioEvent } from "../../src/contracts/index.js";
import type { ExecutionAuthority, ExecutionAuthorityResolver } from "../../src/execution/index.js";
/**
 * resolve-event-authority is exercised for real in every fixture — none of
 * the five vectors prescribes a resolution failure (see
 * conformance/corpus/execution/README.md, RESOLUTION_FAILURE_DISPOSITION_UNSPECIFIED),
 * so this test double always succeeds, wrapping the declared
 * executionAuthorityId as the resolved handle.
 */
export declare class PassthroughExecutionAuthorityResolver implements ExecutionAuthorityResolver {
    resolve(scenarioEvent: ScenarioEvent): Promise<ExecutionAuthority>;
}
