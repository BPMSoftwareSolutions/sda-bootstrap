import type { EdgeGroup, ExecutionCell, ExecutionEdge, JsonObject } from "./model.js";
export interface TransformationGraphFragment {
    readonly entryCellIds: readonly string[];
    readonly exitCellIds: readonly string[];
    readonly cells: readonly ExecutionCell[];
    readonly edges: readonly ExecutionEdge[];
    readonly edgeGroups: readonly EdgeGroup[];
    readonly recurrenceAuthorities: readonly {
        readonly recurrenceAuthorityId: string;
        readonly continuationVariant: string;
        readonly stopVariant: string;
        readonly maximumIterations: number;
        readonly cancellationPolicy: "immediate";
        readonly authorityDigest: string;
    }[];
    readonly requiredProviderSlots: readonly {
        readonly slotId: string;
        readonly cellId: string;
        readonly mechanicId: string;
        readonly profileConstraints: readonly string[];
    }[];
}
export declare class SemanticTransformationGraphCompiler {
    compile(transformationId: string, root: JsonObject, parentCellId: string, authorityDigest?: string, maximumCollectionIterations?: number, scopeId?: string): TransformationGraphFragment;
    private compileNode;
    private compileIf;
    private edge;
}
