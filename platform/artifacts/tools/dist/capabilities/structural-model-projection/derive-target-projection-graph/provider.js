import { TargetProjectionGraphBuilder } from "../../../projection/ir/target-projection-graph-builder.js";
export class DeriveTargetProjectionGraphProvider {
    responsibilityId = "apply-target-structural-projection-policy";
    async execute(input) {
        return new TargetProjectionGraphBuilder(input.canonical, input.profile.value).build();
    }
}
