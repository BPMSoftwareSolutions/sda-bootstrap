import type { ConsumerCrossApplyProofProfile, ConsumerProjectionTarget, JsonRecord } from "./consumer-workspace-facts.js";
import type { PlatformResponsibilityResolution } from "./platform-responsibility-resolution.js";
import type { ConsumerExecutionEmbodimentPlan } from "./consumer-execution-embodiment-plan.js";
export interface ConsumerProjectionPlanFile {
    readonly relativePath: string;
    readonly content: string;
    readonly digest: string;
    readonly sourcePointers: readonly string[];
    readonly target: ConsumerProjectionTarget | "shared";
}
export interface ConsumerProjectionPlan {
    readonly planType: "consumer-projection-plan.v1";
    readonly workspaceRoot: string;
    readonly outputDirectory: "projected";
    readonly targets: readonly ConsumerProjectionTarget[];
    readonly preserveUntargeted: boolean;
    readonly proofProfile?: ConsumerCrossApplyProofProfile;
    readonly authorityRefs: readonly string[];
    readonly admittedPlatformCapabilityIds: readonly string[];
    readonly files: readonly ConsumerProjectionPlanFile[];
}
export interface ConsumerProjectionPlanEvidence {
    readonly evidenceType: "consumer-projection-plan-evidence.v1";
    readonly plan: ConsumerProjectionPlan;
    readonly scenarios: readonly JsonRecord[];
    readonly transitions: readonly JsonRecord[];
    readonly capability: JsonRecord;
    readonly query: JsonRecord;
    readonly queries: Readonly<Record<ConsumerProjectionTarget, JsonRecord>>;
    readonly mechanicResolution: PlatformResponsibilityResolution;
    readonly mechanicResolutions: Readonly<Record<ConsumerProjectionTarget, PlatformResponsibilityResolution>>;
    readonly expectedTelemetry: JsonRecord;
    readonly executionPlans: Readonly<Partial<Record<ConsumerProjectionTarget, ConsumerExecutionEmbodimentPlan>>>;
}
export interface ConsumerPublicationEvidence {
    readonly evidenceType: "consumer-capability-publication-evidence.v1";
    readonly outputDirectory: string;
    readonly publishedFiles: readonly {
        readonly relativePath: string;
        readonly digest: string;
    }[];
    readonly preservedTargets: readonly string[];
    readonly disposition: "PUBLISHED";
}
