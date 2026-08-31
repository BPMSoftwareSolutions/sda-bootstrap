import { ContractAdmissionException } from "../execution/index.js";
function isAbortError(error) {
    return error instanceof Error && error.name === "AbortError";
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
export class ScenarioKernel {
    contracts;
    authorityResolver;
    executor;
    dispositions;
    observer;
    clock;
    constructor(contracts, authorityResolver, executor, dispositions, observer, clock) {
        this.contracts = contracts;
        this.authorityResolver = authorityResolver;
        this.executor = executor;
        this.dispositions = dispositions;
        this.observer = observer;
        this.clock = clock;
    }
    async execute(scenario, options) {
        const { executionId, rootExecutionId, input, parentExecutionId = null, signal } = options;
        const observe = (stepId, sequence, status) => {
            this.observer.observe({
                observationType: "scenario-execution-observation.v1",
                executionId,
                rootExecutionId,
                parentExecutionId,
                scenarioId: scenario.scenarioId,
                stepId,
                sequence,
                status,
                observedAt: this.clock.now()
            });
        };
        let admittedInput;
        try {
            // admit-input
            admittedInput = await this.contracts.admit(scenario.input.contract, input, signal);
            observe("admit-input", 0, "observed");
        }
        catch (error) {
            if (isAbortError(error))
                throw error;
            if (error instanceof ContractAdmissionException) {
                observe("admit-input", 0, "admission-rejected");
                return {
                    executionId,
                    scenarioId: scenario.scenarioId,
                    rootExecutionId,
                    parentExecutionId,
                    input,
                    event: scenario.event,
                    outcome: null,
                    disposition: "rejected"
                };
            }
            throw error;
        }
        // resolve-event-authority
        const authority = await this.authorityResolver.resolve(scenario.event, signal);
        observe("resolve-event-authority", 1, "observed");
        let candidateOutcome;
        try {
            // execute-event-authority
            candidateOutcome = await this.executor.execute(authority, admittedInput, signal);
            observe("execute-event-authority", 2, "observed");
        }
        catch (error) {
            if (isAbortError(error))
                throw error;
            observe("execute-event-authority", 2, "execution-failed");
            return {
                executionId,
                scenarioId: scenario.scenarioId,
                rootExecutionId,
                parentExecutionId,
                input: admittedInput,
                event: scenario.event,
                outcome: null,
                disposition: "failed"
            };
        }
        let admittedOutcome;
        try {
            // admit-outcome
            admittedOutcome = await this.contracts.admit(scenario.outcome.contract, candidateOutcome, signal);
            observe("admit-outcome", 3, "observed");
        }
        catch (error) {
            if (isAbortError(error))
                throw error;
            if (error instanceof ContractAdmissionException) {
                observe("admit-outcome", 3, "admission-rejected");
                return {
                    executionId,
                    scenarioId: scenario.scenarioId,
                    rootExecutionId,
                    parentExecutionId,
                    input: admittedInput,
                    event: scenario.event,
                    outcome: candidateOutcome,
                    disposition: "rejected"
                };
            }
            throw error;
        }
        // resolve-disposition
        const disposition = this.dispositions.resolve(scenario, admittedOutcome);
        observe("resolve-disposition", 4, "observed");
        return {
            executionId,
            scenarioId: scenario.scenarioId,
            rootExecutionId,
            parentExecutionId,
            input: admittedInput,
            event: scenario.event,
            outcome: admittedOutcome,
            disposition
        };
    }
}
