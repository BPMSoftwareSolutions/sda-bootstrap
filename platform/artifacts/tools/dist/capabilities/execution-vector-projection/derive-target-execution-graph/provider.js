import { TargetExecutionGraphBuilder } from "../../../projection/ir/execution-graph-builder.js";
export class DeriveTargetExecutionGraphProvider {
    responsibilityId = "apply-target-execution-mechanics";
    async execute(input) {
        return new TargetExecutionGraphBuilder().build(input.canonical, input.profile.value);
    }
}
