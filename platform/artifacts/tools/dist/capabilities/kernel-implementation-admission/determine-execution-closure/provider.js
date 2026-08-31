export class ExecutionClosureProvider {
    responsibilityId = "evaluate-order-lineage-failure-boundary-and-terminal-disposition";
    async execute(input) { if (!input.observation)
        return { language: input.language, ran: false, conforming: false, reason: `no execution-closure observation was admitted for language "${input.language}"` }; const value = input.observation.value; return { language: input.language, ran: value.ran, conforming: value.ran && value.conforming, ...(value.reason ? { reason: value.reason } : {}), ...(value.fixtures ? { fixtures: value.fixtures } : {}) }; }
}
