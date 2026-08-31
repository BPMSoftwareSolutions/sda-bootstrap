import type { GraphExecutionResult, JsonValue, RealizationOverlay, SemanticExecutionCell, SemanticExecutionEdge, SemanticExecutionGraph } from "./model.js";
export interface GraphProviderOutcome {
    readonly outcomeValue: JsonValue;
    readonly outcomeVariant?: string;
    readonly disposition?: "completed" | "rejected" | "failed" | "cancelled" | "held";
}
export interface GraphEffectTestimony {
    readonly effectId: string;
    readonly primitiveProfileId: string;
    readonly cellExecutionId: string;
    readonly providerProfileId: string;
    readonly inputDigest: string;
    readonly outcomeDigest: string;
}
export interface GraphExecutionContext {
    readonly graphId: string;
    readonly cellId: string;
    readonly cellExecutionId: string;
    readonly rootExecutionId: string;
    readonly providerProfileId?: string;
    readonly iterationId?: string;
    readonly configuration?: Readonly<Record<string, JsonValue>>;
    invokePhysicalEffect<T extends JsonValue>(primitiveProfileId: string, input: JsonValue, effect: () => Promise<T> | T): Promise<T>;
}
export type GraphProvider = (input: JsonValue, context: GraphExecutionContext) => Promise<GraphProviderOutcome | JsonValue> | GraphProviderOutcome | JsonValue;
export type ContractAdmission = (contractId: string, value: JsonValue, direction: "input" | "outcome", cellId: string) => boolean;
export interface GraphSchedulerOptions {
    readonly providers: Readonly<Record<string, GraphProvider>>;
    readonly admitContract?: ContractAdmission;
    readonly rootExecutionId?: string;
    readonly effectSink?: (testimony: GraphEffectTestimony) => void;
    readonly cancelled?: () => boolean;
    readonly projectBinding?: (bindingAuthorityId: string, input: JsonValue, context: Readonly<{
        edge: SemanticExecutionEdge;
        sourceCell: SemanticExecutionCell;
        targetCell: SemanticExecutionCell;
        rootExecutionId: string;
        sourceCellExecutionId: string;
    }>) => Promise<JsonValue> | JsonValue;
}
export declare class GraphTokenScheduler {
    #private;
    constructor(graph: SemanticExecutionGraph, overlay: RealizationOverlay, options: GraphSchedulerOptions);
    execute(input: JsonValue): Promise<GraphExecutionResult>;
    private admit;
    private executeCell;
    private selectEdges;
    private complete;
    private result;
}
