import { sha256 } from "../../primitives/sha256.js";
import { executionTemplates } from "./execution-template-catalog.js";
export function renderExecutionProjection(target, graph, profile) {
    if (graph.target !== target || profile.language !== target)
        throw new Error(`Execution provider '${target}' received another target.`);
    const admittedSemantics = [
        ["admit-input", "admission", "rejected"],
        ["resolve-event-authority", "unprotected", undefined],
        ["execute-event-authority", "execution", "failed"],
        ["admit-outcome", "admission", "rejected"],
        ["resolve-disposition", "unprotected", undefined]
    ];
    if (graph.steps.length !== admittedSemantics.length || graph.steps.some((step, index) => {
        const expected = admittedSemantics[index];
        return !expected || step.stepId !== expected[0] || step.kind !== expected[1] || step.onFailureDisposition !== expected[2];
    })) {
        throw new Error(`Execution provider '${target}' cannot embody an unadmitted execution semantic change.`);
    }
    const template = executionTemplates[target];
    if (!template)
        throw new Error(`Execution provider '${target}' has no admitted built-in template.`);
    const declaredOutput = profile.executionMechanics?.kernelOutputDirectory;
    if (declaredOutput !== template.outputDirectory)
        throw new Error(`Execution output policy drift for '${target}'.`);
    const sourcePointers = graph.steps.map((step) => step.sourcePointer);
    return Object.freeze({
        planType: "projection-plan.v1",
        target,
        outputDirectory: template.outputDirectory,
        files: Object.freeze(template.files.map((file) => Object.freeze({
            ...file,
            digest: sha256(file.content),
            sourcePointers: Object.freeze([...sourcePointers])
        })))
    });
}
