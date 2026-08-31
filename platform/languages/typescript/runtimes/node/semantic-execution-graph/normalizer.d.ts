import type { RealizationOverlay, SemanticExecutionGraph } from "./model.js";
export declare function normalizeGraph(graph: SemanticExecutionGraph): SemanticExecutionGraph;
export declare function canonicalGraphDigest(graph: SemanticExecutionGraph): string;
export declare function normalizeOverlay(overlay: RealizationOverlay): RealizationOverlay;
export declare function realizedGraphDigest(graph: SemanticExecutionGraph, overlay: RealizationOverlay): string;
