import type { RegistryBackedRealizationPlanRequest } from "../../capabilities/realization-planning/resolve-registered-realization-plan/model.js";
import { type RegisteredRealizationPlanningRun } from "./run-registered.js";
export interface FileRegisteredRealizationPlanningRun extends RegisteredRealizationPlanningRun {
    readonly authorityManifestDigest: string;
    readonly policyDecisionProfileDigest: string;
    readonly projectorProfileDigest: string;
}
export declare function runFileRegisteredRealizationPlanning(options: {
    readonly repositoryRoot: string;
    readonly registryRoot: string;
    readonly manifestRef: string;
    readonly request: RegistryBackedRealizationPlanRequest;
    readonly policyDecisionProfile: {
        readonly authorityId: string;
        readonly selector: string;
    };
    readonly projectorProfile: {
        readonly authorityId: string;
        readonly selector: string;
    };
    readonly executionId?: string;
}): Promise<FileRegisteredRealizationPlanningRun>;
