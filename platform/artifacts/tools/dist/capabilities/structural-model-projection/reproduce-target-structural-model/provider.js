import { structuralProjectionProvider } from "../../../projection/providers/structural-provider-registry.js";
export class ReproduceTargetStructuralModelProvider {
    responsibilityId = "render-target-structural-model-from-target-graph";
    async execute(input) {
        return structuralProjectionProvider(input.profile.value.language).render(input.targetGraph, input.profile.value);
    }
}
