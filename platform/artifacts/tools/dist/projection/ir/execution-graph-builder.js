const kinds = new Set(["admission", "execution", "unprotected"]);
const failureDispositions = new Set(["rejected", "failed"]);
const admittedStepOrder = [
    "admit-input",
    "resolve-event-authority",
    "execute-event-authority",
    "admit-outcome",
    "resolve-disposition"
];
function requiredString(value, pointer) {
    if (typeof value !== "string" || value.length === 0)
        throw new Error(`${pointer} must be a non-empty string.`);
    return value;
}
export class CanonicalExecutionGraphBuilder {
    build(value, sourcePointer = "kernel/contracts/execution/scenario-kernel-execution-vector.json") {
        if (!value || typeof value !== "object")
            throw new Error("Canonical execution vector must be an object.");
        const raw = value;
        if (raw.vectorType !== "scenario-kernel-execution-vector.v1")
            throw new Error("Unsupported execution vector type.");
        if (!Array.isArray(raw.steps))
            throw new Error("Canonical execution vector must declare steps.");
        const steps = raw.steps.map((candidate, sequence) => {
            if (!candidate || typeof candidate !== "object")
                throw new Error(`Execution step ${sequence} must be an object.`);
            const step = candidate;
            const stepId = requiredString(step.stepId, `/steps/${sequence}/stepId`);
            if (!kinds.has(step.kind))
                throw new Error(`/steps/${sequence}/kind is not admitted.`);
            const kind = step.kind;
            if (!Array.isArray(step.consumes) || !step.consumes.every((item) => typeof item === "string")) {
                throw new Error(`/steps/${sequence}/consumes must contain semantic identifiers.`);
            }
            const failure = step.onFailureDisposition;
            if (kind === "unprotected" && failure !== undefined)
                throw new Error(`${stepId} is unprotected and cannot resolve a failure disposition.`);
            if (kind !== "unprotected" && !failureDispositions.has(failure)) {
                throw new Error(`${stepId} must declare an admitted failure disposition.`);
            }
            return Object.freeze({
                stepId,
                sequence,
                kind,
                consumes: Object.freeze([...step.consumes]),
                produces: requiredString(step.produces, `/steps/${sequence}/produces`),
                ...(failure === undefined ? {} : { onFailureDisposition: failure }),
                sourcePointer: `${sourcePointer}#/steps/${sequence}`
            });
        });
        if (steps.length !== admittedStepOrder.length || steps.some((step, index) => step.stepId !== admittedStepOrder[index])) {
            throw new Error(`Execution vector step order must be ${admittedStepOrder.join(" -> ")}.`);
        }
        return Object.freeze({
            vectorType: "scenario-kernel-execution-vector.v1",
            kernelSpecificationId: requiredString(raw.kernelSpecification?.specificationId, "/kernelSpecification/specificationId"),
            steps: Object.freeze(steps),
            sourcePointer
        });
    }
}
export class TargetExecutionGraphBuilder {
    build(canonical, profile) {
        const mechanics = profile.executionMechanics;
        if (!mechanics || typeof mechanics.kernelOutputDirectory !== "string") {
            throw new Error(`Projection profile '${profile.language}' does not declare execution mechanics.`);
        }
        const asyncMechanics = typeof mechanics.asyncType === "string"
            ? mechanics.asyncType
            : typeof mechanics.asyncKeyword === "string"
                ? mechanics.asyncKeyword
                : typeof mechanics.asyncMethodModifier === "string"
                    ? mechanics.asyncMethodModifier
                    : typeof mechanics.asyncDefKeyword === "string" ? mechanics.asyncDefKeyword : "runtime-native";
        const cancellationMechanics = typeof mechanics.cancellationMechanics === "string"
            ? mechanics.cancellationMechanics
            : typeof mechanics.cancellationCatchType === "string"
                ? mechanics.cancellationCatchType
                : typeof mechanics.cancellationCheckStyle === "string" ? mechanics.cancellationCheckStyle : "runtime-native";
        return Object.freeze({
            graphType: "target-execution-graph.v1",
            target: profile.language,
            renderingMode: mechanics.renderingMode === "admitted-kernel-delegation"
                ? "admitted-kernel-delegation"
                : "generated-orchestrator",
            asyncMechanics,
            cancellationMechanics,
            steps: canonical.steps.map((step) => Object.freeze({ ...step })),
            sourcePointers: Object.freeze([canonical.sourcePointer])
        });
    }
}
