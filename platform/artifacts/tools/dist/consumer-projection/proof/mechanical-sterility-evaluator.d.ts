import type { ConsumerProjectionPlan, ConsumerProjectionPlanFile } from "../model/consumer-projection-plan.js";
export declare const FORBIDDEN_EXECUTABLE_MECHANICS: Readonly<{
    branch: RegExp;
    iteration: RegExp;
    "exception-handling": RegExp;
    throw: RegExp;
    "object-construction": RegExp;
    serialization: RegExp;
    normalization: RegExp;
    validation: RegExp;
    fallback: RegExp;
    retry: RegExp;
    "state-mutation": RegExp;
    "meaning-hidden-in-text": RegExp;
}>;
export type ForbiddenMechanic = keyof typeof FORBIDDEN_EXECUTABLE_MECHANICS;
export interface MechanicalSterilityEvidence {
    readonly conformanceType: "projected-artifact-mechanical-sterility.v1";
    readonly sourceOrigin: "PROJECTED";
    readonly forbiddenExecutableMechanics: Readonly<Record<ForbiddenMechanic, number>>;
    readonly violations: readonly {
        readonly file: string;
        readonly mechanic: ForbiddenMechanic;
        readonly count: number;
    }[];
    readonly disposition: "PURE_PROJECTION_CONFORMS" | "PROJECTED_EXECUTION_MECHANIC_VIOLATION";
}
export declare function evaluateMechanicalSterility(files: readonly ConsumerProjectionPlanFile[]): MechanicalSterilityEvidence;
export declare function addSterilityEvidence(plan: ConsumerProjectionPlan, evidence: MechanicalSterilityEvidence): ConsumerProjectionPlan;
