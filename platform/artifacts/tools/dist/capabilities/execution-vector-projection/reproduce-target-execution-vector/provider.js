import { executionProjectionProvider } from "../../../projection/providers/execution-provider-registry.js";
export class ReproduceTargetExecutionVectorProvider {
    responsibilityId = "render-target-execution-projection-plan";
    async execute(input) {
        return executionProjectionProvider(input.profile.value.language).render(input.targetGraph, input.profile.value);
    }
}
