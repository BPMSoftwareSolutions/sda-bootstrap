import type { JsonObject, RealizationOverlay, SemanticExecutionGraph } from "./model.js";
export interface ConsumerExecutionEmbodimentPlanV3 {
    readonly executionEmbodimentPlanType: "consumer-execution-embodiment-plan.v3";
    readonly target: string;
    readonly capabilityId: string;
    readonly canonicalGraph: SemanticExecutionGraph;
    readonly canonicalGraphDigest: string;
    readonly realizationOverlay: RealizationOverlay;
    readonly realizedGraphDigest: string;
    readonly sourceMap: Readonly<Record<string, readonly string[]>>;
    readonly contractCatalog: JsonObject;
    readonly bindingAuthorities: readonly JsonObject[];
    readonly cellProtocolVersion: "cell-execution-protocol.v1";
    readonly conformanceClosures: readonly string[];
    readonly expectedCanonicalTopology: JsonObject;
    readonly executionPolicy: {
        readonly scheduler: "graph-token-scheduler.v1";
        readonly logicalOrdering: "deterministic";
        readonly undeclaredControlFlow: "reject";
    };
    readonly effectPolicy: {
        readonly graphIssuedContextRequired: true;
        readonly providerTestimonyRequired: true;
    };
}
export declare function createPlanV3(graph: SemanticExecutionGraph, overlay: RealizationOverlay, sourceMap: Readonly<Record<string, readonly string[]>>, contractCatalog?: JsonObject, bindingAuthorities?: readonly JsonObject[]): ConsumerExecutionEmbodimentPlanV3;
