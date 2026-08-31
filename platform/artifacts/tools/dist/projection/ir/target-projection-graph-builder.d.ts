import type { CanonicalTypeGraph } from "../model/canonical-type-graph.js";
import type { StructuralProjectionProfile } from "../model/projection-profile.js";
import type { TargetProjectionGraph } from "../model/target-projection-graph.js";
export declare class TargetProjectionGraphBuilder {
    private readonly canonical;
    private readonly profile;
    private readonly definitionsByPointer;
    private readonly rootTypeNames;
    private readonly targetDefinitions;
    private readonly emissionOrder;
    constructor(canonical: CanonicalTypeGraph, profile: StructuralProjectionProfile);
    build(): TargetProjectionGraph;
    private definition;
    private register;
    private mapNode;
    private mapReference;
    private mapReferenceOrStub;
    private deriveObject;
    private mapField;
}
