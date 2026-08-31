import type { ScenarioClosure, ScenarioV2 } from "../model/semantic-model.js";
import type { AtomicScenarioRunner, ContractAdmissionPort, ExecutionObservationPort, ObligationEvaluator, ResponsibilityProvider } from "../ports/capability-ports.js";
export declare class ToolCapabilityHost {
    private readonly runner;
    private readonly contracts;
    private readonly observer;
    constructor(runner: AtomicScenarioRunner, contracts: ContractAdmissionPort, observer: ExecutionObservationPort);
    executeScenario<TInput, TEvidence>(options: {
        readonly scenario: ScenarioV2;
        readonly input: TInput;
        readonly provider: ResponsibilityProvider<TInput, TEvidence>;
        readonly obligation: ObligationEvaluator<TEvidence>;
        readonly executionId: string;
        readonly rootExecutionId?: string;
        readonly signal?: AbortSignal;
    }): Promise<ScenarioClosure<TEvidence>>;
}
