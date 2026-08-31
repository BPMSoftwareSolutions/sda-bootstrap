import type { RegisteredTargetProvider } from "../../projection/model/language-target-registration.js";
import type { ProjectionPlan } from "../../projection/model/projection-plan.js";
import type { ProjectionTarget, StructuralProjectionProfile } from "../../projection/model/projection-profile.js";
import type { ShapeEvidence } from "../../projection/model/shape-evidence.js";
import type { TargetExecutionGraph } from "../../projection/model/target-execution-graph.js";
import type { TargetProjectionGraph } from "../../projection/model/target-projection-graph.js";
import type { AdmittedProjectionFile, ProjectedShapeObserver } from "../../projection/proof/projected-shape-observer.js";
import type { ExecutionProjectionProvider } from "../../projection/providers/execution-projection-provider.js";
import type { StructuralProjectionProvider } from "../../projection/providers/structural-projection-provider.js";
export declare class ProcessJsonStructuralProjectionProvider implements StructuralProjectionProvider {
    private readonly repositoryRoot;
    readonly target: ProjectionTarget;
    private readonly provider;
    constructor(repositoryRoot: string, target: ProjectionTarget, provider: RegisteredTargetProvider);
    render(graph: TargetProjectionGraph, profile: StructuralProjectionProfile): ProjectionPlan;
}
export declare class ProcessJsonExecutionProjectionProvider implements ExecutionProjectionProvider {
    private readonly repositoryRoot;
    readonly target: ProjectionTarget;
    private readonly provider;
    constructor(repositoryRoot: string, target: ProjectionTarget, provider: RegisteredTargetProvider);
    render(graph: TargetExecutionGraph, profile: StructuralProjectionProfile): ProjectionPlan;
}
export declare class ProcessJsonProjectedShapeObserver implements ProjectedShapeObserver {
    private readonly repositoryRoot;
    readonly target: ProjectionTarget;
    private readonly provider;
    constructor(repositoryRoot: string, target: ProjectionTarget, provider: RegisteredTargetProvider);
    observe(admittedFiles: readonly AdmittedProjectionFile[], plan: ProjectionPlan): ShapeEvidence;
}
