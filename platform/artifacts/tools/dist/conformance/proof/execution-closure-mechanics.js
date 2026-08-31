function verdict(executionId, observedSteps, canonicalSteps, conforming, reason) { return { executionClosureType: "scenario-kernel-execution-closure.v1", executionId, conforming, observedSteps, expectedSteps: canonicalSteps.slice(0, observedSteps.length), ...(reason ? { reason } : {}) }; }
export function evaluateExecutionClosureTrace(observations, canonicalSteps) {
    const first = observations[0];
    if (!first)
        throw new Error("evaluateExecutionClosureTrace requires at least one observation for the execution being evaluated.");
    const executionId = first.executionId;
    const rootExecutionId = first.rootExecutionId;
    const parentExecutionId = first.parentExecutionId ?? null;
    const scenarioId = first.scenarioId;
    const observedSteps = observations.map((item) => item.stepId);
    if (observations.some((item) => item.executionId !== executionId || item.rootExecutionId !== rootExecutionId || (item.parentExecutionId ?? null) !== parentExecutionId || item.scenarioId !== scenarioId))
        return verdict(executionId, observedSteps, canonicalSteps, false, "LINEAGE_MISMATCH: not every observation in this trace shares the same executionId/rootExecutionId/parentExecutionId/scenarioId");
    const seen = new Set();
    for (const stepId of observedSteps) {
        if (seen.has(stepId))
            return verdict(executionId, observedSteps, canonicalSteps, false, `DUPLICATE_STEP_OBSERVATION: step '${stepId}' was observed more than once`);
        seen.add(stepId);
    }
    const expectedPrefix = canonicalSteps.slice(0, observedSteps.length);
    for (let index = 0; index < observedSteps.length; index += 1) {
        const observed = observedSteps[index];
        const expected = expectedPrefix[index];
        const observation = observations[index];
        if (!observation)
            continue;
        if (observed !== expected)
            return verdict(executionId, observedSteps, canonicalSteps, false, `UNEXPECTED_STEP_ORDER: expected step '${expected}' at position ${index}, observed '${observed}'`);
        if (observation.sequence !== index)
            return verdict(executionId, observedSteps, canonicalSteps, false, `UNEXPECTED_STEP_ORDER: step '${observed}' declared sequence ${observation.sequence}, expected ${index}`);
    }
    const ranToCompletion = observedSteps.length === canonicalSteps.length;
    for (let index = 0; index < observations.length; index += 1) {
        const observation = observations[index];
        if (!observation)
            continue;
        const isFinal = index === observations.length - 1;
        if ((!isFinal || ranToCompletion) && observation.status !== "observed")
            return verdict(executionId, observedSteps, canonicalSteps, false, `EXECUTION_LINEAGE_GAP: step '${observation.stepId}' has status '${observation.status}' but is not the step where the run stopped`);
        if (isFinal && !ranToCompletion && observation.status === "observed")
            return verdict(executionId, observedSteps, canonicalSteps, false, `EXECUTION_LINEAGE_GAP: the trace stops after step '${observation.stepId}' without a failure status, but only ${observedSteps.length} of ${canonicalSteps.length} canonical steps were observed`);
    }
    return verdict(executionId, observedSteps, canonicalSteps, true);
}
