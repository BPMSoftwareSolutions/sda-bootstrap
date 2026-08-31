import { CanonicalExecutionGraphBuilder } from "../../../projection/ir/execution-graph-builder.js";
export class DeriveCanonicalExecutionGraphProvider {
    responsibilityId = "resolve-canonical-execution-vector-meaning";
    async execute(input) {
        return new CanonicalExecutionGraphBuilder().build(input.vector.value, input.vector.sourceRef);
    }
}
