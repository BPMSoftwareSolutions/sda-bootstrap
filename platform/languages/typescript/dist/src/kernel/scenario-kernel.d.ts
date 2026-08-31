import type { Scenario, ScenarioExecution } from "../contracts/index.js";
import type { ContractValidator, ExecutionAuthorityResolver, SemanticExecutor, DispositionResolver, ExecutionObserver, ExecutionClock } from "../execution/index.js";
export interface ExecuteOptions {
    executionId: string;
    rootExecutionId: string;
    input: unknown;
    parentExecutionId?: string | null;
    signal?: AbortSignal;
}
/**
 * The canonical execution vector, mechanically:
 * admit-input -> resolve-event-authority -> execute-event-authority ->
 * admit-outcome -> resolve-disposition.
 * See kernel/contracts/execution/scenario-kernel-execution-vector.json.
 *
 * No domain routing, no provider logic, no child-scenario hardcoding —
 * every decision that isn't purely structural is delegated to one of the
 * four ports. The four disposition literals below ("completed",
 * "terminated", "rejected", "failed") are canonical kernel vocabulary from
 * scenario-execution.schema.json's own closed enum, not invented domain
 * authority — the same category as "narrowing"/"termination" on
 * ScenarioTransition.semanticProgress.
 *
 * An AbortSignal abort (surfaced as an Error named "AbortError", the same
 * convention Node's own signal-aware APIs use) is explicitly re-thrown
 * rather than mapped to "failed" — cancellation is not a semantic outcome
 * unless the kernel specification says it is.
 *
 * Each step, on completing or on the failure that ends the run early,
 * emits exactly one scenario-execution-observation.v1 via the injected
 * ExecutionObserver — see kernel/schemas/scenario-execution-observation.schema.json
 * and governance rules K011-K013. This is execution testimony, not
 * application logging: the kernel emits it unconditionally, so no consumer
 * can produce a conforming execution without also producing its telemetry.
 * An aborted step emits nothing — cancellation isn't a vector outcome, so
 * there's no step disposition to testify to.
 */
export declare class ScenarioKernel {
    private readonly contracts;
    private readonly authorityResolver;
    private readonly executor;
    private readonly dispositions;
    private readonly observer;
    private readonly clock;
    constructor(contracts: ContractValidator, authorityResolver: ExecutionAuthorityResolver, executor: SemanticExecutor, dispositions: DispositionResolver, observer: ExecutionObserver, clock: ExecutionClock);
    execute(scenario: Scenario, options: ExecuteOptions): Promise<ScenarioExecution>;
}
