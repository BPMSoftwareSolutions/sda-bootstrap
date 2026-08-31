import fs from "node:fs";
import { valueAt } from "./native-mechanic-primitives.mjs";

function runtimeFinding(code, context = {}) { return { code, context }; }

export function expectedExecutionTraceEvaluator(configuration, { observedExecution }) {
  const observations = observedExecution?.observations ?? [];
  // Nested scenario invocations are semantic executions, even though the
  // public root execution sequence deliberately remains flat.  Evidence
  // closure must account for their telemetry without changing that public
  // sequence or treating nested capability testimony as a scenario record.
  const executionById = new Map();
  for (const execution of [...(observedExecution?.executions ?? []), ...(observedExecution?.nestedExecutions ?? [])]) {
    if (execution?.executionId) executionById.set(execution.executionId, execution);
  }
  const executions = [...executionById.values()];
  if (observations.length === 0 || executions.length === 0) return [runtimeFinding("EXECUTION_NOT_OBSERVED")];
  const expectedByNode = new Map(configuration.expectedTelemetry.scenarios.map((trace) => [trace.scenarioId, trace]));
  const findings = [];
  for (const execution of executions) {
    const expected = expectedByNode.get(execution.scenarioId);
    if (!expected) { findings.push(runtimeFinding("UNAUTHORIZED_EXECUTION", { executionId: execution.executionId })); continue; }
    const actual = observations.filter((observation) => observation.executionId === execution.executionId);
    const actualSteps = actual.map((observation) => observation.stepId);
    if (actualSteps.join("|") !== expected.steps.join("|")) {
      findings.push(runtimeFinding("EXECUTION_LINEAGE_GAP", { executionId: execution.executionId,
        expectedSteps: expected.steps, observedSteps: actualSteps }));
    }
    if (actual.some((observation) => observation.rootExecutionId !== execution.rootExecutionId ||
      observation.parentExecutionId !== execution.parentExecutionId || observation.scenarioId !== execution.scenarioId)) {
      findings.push(runtimeFinding("TELEMETRY_LINEAGE_MISMATCH", { executionId: execution.executionId }));
    }
  }
  const explained = new Set(executions.map((execution) => execution.executionId));
  for (const observation of observations) if (!explained.has(observation.executionId)) {
    findings.push(runtimeFinding("UNEXPLAINED_TELEMETRY", { executionId: observation.executionId }));
  }
  return findings;
}

export function artifactBindingObservationEvaluator(configuration, { observedExecution }) {
  if (!observedExecution) return [runtimeFinding("ARTIFACT_MATERIALIZATION_NOT_OBSERVED")];
  const reference = observedExecution.executions.flatMap((execution) =>
    configuration.targetPaths.map((targetPath) => valueAt(execution.outcome, targetPath)))
    .find((candidate) => candidate?.path && candidate?.sha256);
  return reference && fs.existsSync(reference.path) ? [] : [runtimeFinding("ARTIFACT_MATERIALIZATION_NOT_OBSERVED")];
}

export function projectedOriginObservationEvaluator(configuration, { mechanicalSterility }) {
  return mechanicalSterility.disposition === configuration.requiredDisposition ? []
    : [runtimeFinding("PROJECTED_EXECUTION_MECHANIC_VIOLATION", { violations: mechanicalSterility.violations })];
}
