export type CanonicalExecutionStepKind = "admission" | "execution" | "unprotected";
export type FailureDisposition = "rejected" | "failed";
export interface CanonicalExecutionStep {
    readonly stepId: string;
    readonly sequence: number;
    readonly kind: CanonicalExecutionStepKind;
    readonly consumes: readonly string[];
    readonly produces: string;
    readonly onFailureDisposition?: FailureDisposition;
    readonly sourcePointer: string;
}
export interface CanonicalExecutionGraph {
    readonly vectorType: "scenario-kernel-execution-vector.v1";
    readonly kernelSpecificationId: string;
    readonly steps: readonly CanonicalExecutionStep[];
    readonly sourcePointer: string;
}
