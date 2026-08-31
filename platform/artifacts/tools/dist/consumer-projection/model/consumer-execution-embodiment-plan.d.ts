import type { ConsumerProjectionTarget, JsonRecord } from "./consumer-workspace-facts.js";
export interface ConsumerExecutionPlanFinding {
    readonly code: string;
    readonly context: JsonRecord;
}
export interface ConsumerExecutionPlanMechanicBinding {
    readonly bindingId: string;
    readonly mechanicType: "contract-admission" | "event-port" | "state-projection";
    readonly providerCapabilityId: string;
    readonly provider: string;
    readonly implementationRef: string;
    readonly configuration: JsonRecord;
}
export type ConsumerExecutionEmbodimentOperation = Readonly<{
    readonly operationId: string;
    readonly mechanicBindingId: string;
}> | Readonly<{
    readonly operationId: string;
    readonly kind: "invoke-port";
    readonly mechanicBindingId: string;
}> | Readonly<{
    readonly operationId: string;
    readonly kind: "invoke-scenario";
    readonly scenarioNodeId: string;
}> | Readonly<{
    readonly operationId: string;
    readonly kind: "project-state";
    readonly mechanicBindingId: string;
}>;
export interface ConsumerExecutionPlanClosure {
    readonly closureId: string;
    readonly evaluation: "compiled" | "runtime-evidence";
    readonly disposition?: "PASS" | "FAIL";
    readonly findings?: readonly ConsumerExecutionPlanFinding[];
    readonly evaluatorId?: "expected-execution-trace.v1" | "artifact-binding-observation.v1" | "projected-origin-observation.v1";
    readonly configuration?: JsonRecord;
}
export interface ConsumerExecutionEmbodimentPlan {
    readonly executionEmbodimentPlanType: "consumer-execution-embodiment-plan.v1" | "consumer-execution-embodiment-plan.v2";
    readonly target: ConsumerProjectionTarget;
    readonly capabilityId: string;
    readonly source: {
        readonly queryType: "projected-consumer-conformance-query.v1";
        readonly queryId: string;
        readonly queryDigest: string;
        readonly capabilityAuthorityDigest: string;
        readonly mechanicResolutionDigest: string;
    };
    readonly rootNodeId: string;
    readonly nodes: readonly {
        readonly nodeId: string;
        readonly scenario: JsonRecord;
        readonly operations: readonly ConsumerExecutionEmbodimentOperation[];
        readonly transition: {
            readonly transitionId: string;
            readonly nextNodeId: string;
            readonly mechanicBindingId: string | null;
        } | null;
    }[];
    readonly compositionPolicy?: {
        readonly carrierMode: "previous-admitted-outcome";
        readonly contractAdmissionMode: "each-scenario-boundary";
        readonly lineageMode: "retain-root-and-parent-execution";
        readonly failureMode: "stop-at-first-non-success";
        readonly cycleMode: "reject-recursive-invocation";
    };
    readonly mechanicBindings: readonly ConsumerExecutionPlanMechanicBinding[];
    readonly conformance: {
        readonly queryId: string;
        readonly platformMechanics: JsonRecord;
        readonly executableOrigin: JsonRecord;
        readonly closures: readonly ConsumerExecutionPlanClosure[];
    };
    readonly requiredProviderCapabilityIds: readonly string[];
}
