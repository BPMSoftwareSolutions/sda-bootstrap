import type { ScenarioV2 } from "../../model/semantic-model.js";
import type { AtomicScenarioRunner, ContractAdmissionPort, ExecutionObservationPort, KernelExecution, ResponsibilityProvider } from "../../ports/capability-ports.js";
export declare class NodeScenarioKernelRunner implements AtomicScenarioRunner {
    private readonly repositoryRoot;
    private readonly clock;
    constructor(repositoryRoot: string, clock?: {
        now(): string;
    });
    run<TInput, TEvidence>(options: {
        readonly scenario: ScenarioV2;
        readonly input: TInput;
        readonly provider: ResponsibilityProvider<TInput, TEvidence>;
        readonly contracts: ContractAdmissionPort;
        readonly observer: ExecutionObservationPort;
        readonly executionId: string;
        readonly rootExecutionId: string;
        readonly signal?: AbortSignal;
    }): Promise<KernelExecution<TEvidence>>;
}
