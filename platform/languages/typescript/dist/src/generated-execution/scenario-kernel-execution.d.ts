import type { Scenario } from "../contracts/index.js";
import type { ExecuteOptions, ExecutionAuthorityResolver, ContractValidator, SemanticExecutor, DispositionResolver, ExecutionObserver, ExecutionClock } from "./execution-ports.js";
export declare class ScenarioKernel {
    private readonly contracts;
    private readonly authorityResolver;
    private readonly executor;
    private readonly dispositions;
    private readonly observer;
    private readonly clock;
    constructor(contracts: ContractValidator, authorityResolver: ExecutionAuthorityResolver, executor: SemanticExecutor, dispositions: DispositionResolver, observer: ExecutionObserver, clock: ExecutionClock);
    execute(scenario: Scenario, options: ExecuteOptions): Promise<{
        executionId: string;
        scenarioId: string;
        rootExecutionId: string;
        parentExecutionId: string | null;
        input: unknown;
        event: unknown;
        outcome: unknown;
        disposition: string;
    }>;
}
