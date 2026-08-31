import path from "node:path";
import { pathToFileURL } from "node:url";
function toKernelScenario(scenario) {
    return {
        scenarioId: scenario.scenarioId,
        input: scenario.input,
        event: {
            eventId: scenario.event.eventId,
            executionAuthorityId: scenario.event.executionAuthorityId,
            ...(scenario.event.executionAuthorityVersion
                ? { executionAuthorityVersion: scenario.event.executionAuthorityVersion }
                : {}),
            ...(scenario.event.executionAuthorityDigest
                ? { executionAuthorityDigest: scenario.event.executionAuthorityDigest }
                : {})
        },
        outcome: {
            outcomeId: scenario.outcome.outcomeId,
            contract: scenario.outcome.evidence.contract,
            ...(scenario.outcome.terminal !== undefined ? { terminal: scenario.outcome.terminal } : {})
        }
    };
}
export class NodeScenarioKernelRunner {
    repositoryRoot;
    clock;
    constructor(repositoryRoot, clock = { now: () => new Date().toISOString() }) {
        this.repositoryRoot = repositoryRoot;
        this.clock = clock;
    }
    async run(options) {
        const moduleUrl = pathToFileURL(path.join(this.repositoryRoot, "languages", "typescript", "dist", "src", "index.js")).href;
        const kernelModule = await import(moduleUrl);
        const authority = {
            executionAuthorityId: options.scenario.event.executionAuthorityId,
            handler: options.provider
        };
        const kernel = new kernelModule.ScenarioKernel({
            admit: async (contract, value) => {
                try {
                    return await options.contracts.admit(contract, value);
                }
                catch (error) {
                    throw new kernelModule.ContractAdmissionException(error instanceof Error ? error.message : "contract admission failed", { cause: error });
                }
            }
        }, { resolve: async () => authority }, {
            execute: async (_resolved, input, signal) => options.provider.execute(input, signal)
        }, { resolve: (scenario) => scenario.outcome.terminal ? "terminated" : "completed" }, options.observer, this.clock);
        const execution = await kernel.execute(toKernelScenario(options.scenario), {
            executionId: options.executionId,
            rootExecutionId: options.rootExecutionId,
            input: options.input,
            ...(options.signal ? { signal: options.signal } : {})
        });
        return {
            executionId: execution.executionId,
            scenarioId: execution.scenarioId,
            outcome: execution.outcome,
            disposition: execution.disposition
        };
    }
}
