import type { JsonObject, SemanticExecutionGraph } from "./model.js";
export interface GraphCompilationSources {
    readonly capability: JsonObject;
    readonly scenarios: readonly JsonObject[];
    readonly transitions: readonly JsonObject[];
    readonly executionAuthorities: readonly JsonObject[];
    readonly interfaceAuthority: JsonObject;
    readonly semanticTransformations?: readonly JsonObject[];
    readonly edgeGroups?: readonly JsonObject[];
    readonly recurrenceAuthorities?: readonly JsonObject[];
    readonly scenarioOutcomes?: readonly JsonObject[];
    readonly sourceRefs?: readonly string[];
    readonly authorityDigest?: string;
}
export interface GraphCompilationResult {
    readonly graph: SemanticExecutionGraph;
    readonly sourceMap: Readonly<Record<string, readonly string[]>>;
}
export declare class SemanticExecutionGraphCompiler {
    #private;
    compile(sources: GraphCompilationSources): GraphCompilationResult;
    execute(sources: GraphCompilationSources): Promise<GraphCompilationResult>;
    private edge;
}
export declare class SemanticExecutionGraphCompilerObligation {
    evaluate(evidence: GraphCompilationResult): {
        readonly kind: "SATISFIED" | "NOT_SATISFIED";
        readonly evidence: GraphCompilationResult;
    };
}
