import type { ToolchainResult } from "../../../projection/toolchain/target-toolchain.js";
export interface ProveProjectedExecutionBehaviorInput {
    readonly toolchain: ToolchainResult;
    readonly behavior: ToolchainResult;
    readonly fixtureCount: number;
}
export type ProveProjectedExecutionBehaviorEvidence = ProveProjectedExecutionBehaviorInput;
export declare function isProjectedExecutionProofInput(value: unknown): value is ProveProjectedExecutionBehaviorInput;
export declare const isProjectedExecutionProofEvidence: typeof isProjectedExecutionProofInput;
