import type { ConsumerProjectionPlanEvidence } from "../model/consumer-projection-plan.js";
import type { PlatformResponsibilityResolution } from "../model/platform-responsibility-resolution.js";
import type { ConsumerProjectionTarget, JsonRecord } from "../model/consumer-workspace-facts.js";
import type { ConsumerCrossApplyProofProfile } from "../model/consumer-workspace-facts.js";
import type { ScenarioClosure } from "../../model/semantic-model.js";
export interface ConsumerCompilationOptions {
    readonly projectionTargets?: readonly ConsumerProjectionTarget[];
    readonly failureInjection?: "before-publish";
    readonly executionId?: string;
    readonly proofProfile?: ConsumerCrossApplyProofProfile;
}
export interface ConsumerCompilationResult {
    readonly scenarios: readonly JsonRecord[];
    readonly transitions: readonly JsonRecord[];
    readonly capability: JsonRecord;
    readonly query: JsonRecord;
    readonly queries: Readonly<Record<ConsumerProjectionTarget, JsonRecord>>;
    readonly mechanicResolution: PlatformResponsibilityResolution;
    readonly mechanicResolutions: Readonly<Record<ConsumerProjectionTarget, PlatformResponsibilityResolution>>;
    readonly expectedTelemetry: JsonRecord;
    readonly plan: ConsumerProjectionPlanEvidence["plan"];
    readonly outDir: string;
    readonly closures: Readonly<Record<string, ScenarioClosure<unknown>>>;
}
export declare class ConsumerCapabilityCompiler {
    private readonly repositoryRoot;
    constructor(repositoryRoot: string);
    compile(workspaceRoot: string, options?: ConsumerCompilationOptions): Promise<ConsumerCompilationResult>;
}
