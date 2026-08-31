export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
export type JsonObject = {
    [key: string]: JsonValue;
};
export type CellAltitude = "scenario" | "mechanic" | "provider" | "physical";
export type CellExecutionKind = CellAltitude | "junction";
export type EdgeKind = "sequence" | "selection" | "broadcast" | "join" | "recurrence" | "return" | "failure" | "cancellation" | "testimony";
export interface ExecutionPort {
    readonly portId: string;
    readonly contractId: string;
    readonly cardinality?: "one" | "zero-or-one" | "many" | "named-product";
    readonly variants?: readonly string[];
}
export interface ExecutionCell {
    readonly cellId: string;
    readonly semanticAddress: string;
    readonly altitude: CellAltitude;
    readonly parentCellId: string | null;
    readonly input: ExecutionPort;
    readonly execution: {
        readonly kind: CellExecutionKind;
        readonly authorityId: string;
        readonly authorityDigest: string;
        readonly protocolRef: "cell-execution-protocol.v1";
        readonly providerSlotId?: string;
        readonly primitiveProfileId?: string;
        readonly configuration?: JsonObject;
    };
    readonly outcome: ExecutionPort;
    readonly sourcePointers: readonly string[];
    readonly sourceAuthorityDigests: readonly string[];
    readonly obligationIds?: readonly string[];
    readonly terminal?: boolean;
}
export interface ExecutionEdge {
    readonly edgeId: string;
    readonly kind: EdgeKind;
    readonly from: {
        readonly cellId: string;
        readonly portId: string;
    };
    readonly to: {
        readonly cellId: string;
        readonly portId: string;
    };
    readonly selectsVariant?: string;
    readonly bindingAuthorityId?: string;
    readonly edgeContractId: string;
    readonly groupId?: string;
    readonly joinSlotId?: string;
    readonly recurrenceAuthorityId?: string;
    readonly authorityDigest: string;
    readonly sourcePointers: readonly string[];
}
export interface EdgeGroup {
    readonly groupId: string;
    readonly kind: "selection" | "broadcast" | "join" | "recurrence" | "failure" | "cancellation";
    readonly edgeIds: readonly string[];
    readonly policy?: "exactly-one" | "all" | "all-required" | "first-admitted" | "bounded" | "first-match" | "priority";
    readonly exhaustive?: boolean;
    readonly exclusive?: boolean;
    readonly defaultEdgeId?: string;
    readonly joinCellId?: string;
    readonly requiredSlotIds?: readonly string[];
}
export interface SemanticExecutionGraph {
    readonly graphType: "sda-semantic-execution-graph.v1";
    readonly graphId: string;
    readonly graphVersion: string;
    readonly rootCellId: string;
    readonly authority: {
        readonly capabilityId: string;
        readonly authorityDigest: string;
        readonly sourceRefs: readonly string[];
    };
    readonly cells: readonly ExecutionCell[];
    readonly edges: readonly ExecutionEdge[];
    readonly decompositions: readonly {
        readonly parentCellId: string;
        readonly entryCellIds: readonly string[];
        readonly exitCellIds: readonly string[];
        readonly returnBindingAuthorityId: string;
    }[];
    readonly edgeGroups: readonly EdgeGroup[];
    readonly recurrenceAuthorities: readonly {
        readonly recurrenceAuthorityId: string;
        readonly continuationVariant: string;
        readonly continuationVariants?: readonly string[];
        readonly stopVariant: string;
        readonly maximumIterations: number;
        readonly budgetContractId?: string;
        readonly budgetValuePath?: string;
        readonly cancellationPolicy: "route-cancelled" | "complete-current" | "immediate";
        readonly authorityDigest: string;
    }[];
    readonly requiredProviderSlots: readonly {
        readonly slotId: string;
        readonly cellId: string;
        readonly mechanicId: string;
        readonly profileConstraints: readonly string[];
        readonly equivalenceClassId?: string;
    }[];
}
export interface RealizationOverlay {
    readonly overlayType: "execution-graph-realization-overlay.v1";
    readonly overlayId: string;
    readonly graphId: string;
    readonly canonicalGraphDigest: string;
    readonly targetId: string;
    readonly providerBindings: readonly {
        readonly slotId: string;
        readonly cellId: string;
        readonly mechanicId: string;
        readonly providerProfileId: string;
        readonly providerProfileDigest: string;
        readonly implementationRef: string;
    }[];
    readonly physicalCells: readonly ExecutionCell[];
    readonly physicalEdges: readonly ExecutionEdge[];
    readonly overlayDigest?: string;
}
export interface GraphFinding {
    readonly code: string;
    readonly subjectId: string;
    readonly message: string;
}
export interface GraphAdmission {
    readonly disposition: "ADMITTED" | "REJECTED";
    readonly findings: readonly GraphFinding[];
}
export interface CellExecutionTestimony {
    readonly testimonyType: "cell-execution-testimony.v1";
    readonly graphId: string;
    readonly canonicalGraphDigest: string;
    readonly realizedGraphDigest: string;
    readonly cellId: string;
    readonly cellAltitude: CellAltitude;
    readonly cellExecutionId: string;
    readonly rootExecutionId: string;
    readonly parentCellExecutionId: string | null;
    readonly iterationId?: string;
    readonly occurrenceId: string;
    readonly inputContractId: string;
    readonly inputDigest: string;
    readonly executionAuthorityId: string;
    readonly authorityDigest: string;
    readonly providerProfileId?: string;
    readonly providerProfileDigest?: string;
    readonly outcomeContractId: string;
    readonly outcomeDigest: string;
    readonly outcomeVariant: string;
    readonly disposition: "completed" | "rejected" | "failed" | "cancelled" | "held" | "skipped";
    readonly selectedEdgeIds: readonly string[];
    readonly logicalOrder: number;
}
export interface EdgeExecutionTestimony {
    readonly testimonyType: "edge-execution-testimony.v1";
    readonly graphId: string;
    readonly canonicalGraphDigest: string;
    readonly edgeId: string;
    readonly edgeAuthorityDigest: string;
    readonly sourceCellExecutionId: string;
    readonly sourceOutcomeDigest: string;
    readonly bindingAuthorityId?: string;
    readonly bindingResultDigest?: string;
    readonly destinationCellId: string;
    readonly destinationPortId: string;
    readonly groupId?: string;
    readonly iterationId?: string;
    readonly admissionDisposition: "admitted" | "rejected" | "buffered" | "cancelled";
    readonly logicalOrder: number;
}
export interface GraphExecutionResult {
    readonly disposition: "completed" | "rejected" | "failed" | "cancelled" | "held";
    readonly outcome: JsonValue;
    readonly outcomeVariant: string;
    readonly cellTestimony: readonly CellExecutionTestimony[];
    readonly edgeTestimony: readonly EdgeExecutionTestimony[];
    readonly observedPathDigest: string;
}
