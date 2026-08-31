/**
 * resolve-event-authority is exercised for real in every fixture — none of
 * the five vectors prescribes a resolution failure (see
 * conformance/corpus/execution/README.md, RESOLUTION_FAILURE_DISPOSITION_UNSPECIFIED),
 * so this test double always succeeds, wrapping the declared
 * executionAuthorityId as the resolved handle.
 */
export class PassthroughExecutionAuthorityResolver {
    async resolve(scenarioEvent) {
        return { executionAuthorityId: scenarioEvent.executionAuthorityId, handler: scenarioEvent };
    }
}
