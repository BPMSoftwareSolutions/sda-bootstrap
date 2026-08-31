import type { GraphAdmission, RealizationOverlay, SemanticExecutionGraph } from "./model.js";
export declare class SemanticExecutionGraphValidator {
    validate(graph: SemanticExecutionGraph, overlay?: RealizationOverlay): GraphAdmission;
}
