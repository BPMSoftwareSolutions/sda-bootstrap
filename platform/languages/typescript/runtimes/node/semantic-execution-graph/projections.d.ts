import type { SemanticExecutionGraph } from "./model.js";
export declare function renderExecutionGraphMermaid(graph: SemanticExecutionGraph): string;
export declare function graphProjectionData(graph: SemanticExecutionGraph): Readonly<{
    graphId: string;
    rootCellId: string;
    cells: readonly {
        cellId: string;
        altitude: string;
        authorityId: string;
    }[];
    routes: readonly {
        edgeId: string;
        kind: string;
        fromCellId: string;
        toCellId: string;
        variant: string | null;
    }[];
}>;
export declare function reverseExecutionLineage(graph: SemanticExecutionGraph, leafCellId: string): readonly string[];
