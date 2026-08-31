/**
 * Records every observation emitted by a ScenarioKernel run, in emission
 * order, for tests to inspect — the same shape a real telemetry sink would
 * receive, just held in memory instead of written anywhere.
 */
export class InMemoryExecutionObserver {
    observations = [];
    observe(observation) {
        this.observations.push(observation);
    }
}
