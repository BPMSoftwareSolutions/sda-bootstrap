import type { ConsumerPlatformObservation } from "../model/platform-mechanic-conformance.js";
import { type ProveCrossApplyUiParityEvidence, type ProveCrossApplyUiParityInput } from "../../capabilities/consumer-assurance/prove-cross-apply-ui-parity/model.js";
import type { ConsumerCompilationResult } from "./consumer-capability-compiler.js";
import type { ConsumerProjectionTarget } from "../model/consumer-workspace-facts.js";
import type { ScenarioClosure } from "../../model/semantic-model.js";
export interface AttributedAssurance<T> {
    readonly capabilityId: "consumer-assurance";
    readonly scenarioId: string;
    readonly obligationId: string;
    readonly conditionIds: readonly string[];
    readonly evidenceContractId: string;
    readonly providerId: string;
    readonly closure: ScenarioClosure<T>;
    readonly destination?: string;
}
export declare class ConsumerAssuranceService {
    private readonly repositoryRoot;
    private readonly evidenceStore;
    constructor(repositoryRoot: string);
    determinePlatformMechanicConformance(suppliedObservations?: Readonly<Record<string, ConsumerPlatformObservation>>): Promise<AttributedAssurance<unknown>>;
    proveMechanicalSterility(compilation: ConsumerCompilationResult): Promise<AttributedAssurance<unknown>>;
    proveDomainIsolation(): Promise<AttributedAssurance<unknown>>;
    proveCrossTargetEquivalence(workspaceRoot: string, compilation: ConsumerCompilationResult, targets: readonly ConsumerProjectionTarget[]): Promise<AttributedAssurance<unknown>>;
    proveQueryClosure(workspaceRoot: string, compilation: ConsumerCompilationResult, catalogReference: string): Promise<AttributedAssurance<unknown>>;
    proveExperienceClosure(workspaceRoot: string, compilation: ConsumerCompilationResult): Promise<AttributedAssurance<unknown>>;
    proveCrossApplyUiParity(workspaceRoot: string, input: ProveCrossApplyUiParityInput): Promise<AttributedAssurance<ProveCrossApplyUiParityEvidence>>;
    private execute;
    private scenario;
}
