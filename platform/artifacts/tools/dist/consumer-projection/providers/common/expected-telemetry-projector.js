export function projectExpectedTelemetry(telemetryAuthority, executionVector, capability) {
    const steps = Array.isArray(executionVector.steps) ? executionVector.steps : [];
    return {
        traceType: "projected-expected-consumer-trace.v1",
        telemetryId: telemetryAuthority.telemetryId,
        capabilityId: capability.capabilityId,
        rootScenarioId: capability.rootScenarioId,
        observationType: telemetryAuthority.observationType,
        lineageFields: telemetryAuthority.lineageFields,
        scenarios: capability.scenarios.map((scenario) => ({
            scenarioId: scenario.scenarioId,
            steps: steps.map((step) => step.stepId),
            expectedTransitionId: capability.transitions.find((transition) => transition.from.scenarioId === scenario.scenarioId)?.transitionId ?? null
        }))
    };
}
export class ExpectedTelemetryProjector {
    project(telemetryAuthority, executionVector, capability) {
        return projectExpectedTelemetry(telemetryAuthority, executionVector, capability);
    }
}
