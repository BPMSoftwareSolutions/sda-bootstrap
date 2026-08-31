import type { Scenario, Disposition } from "../contracts/index.js";
/**
 * Embodies the happy-path half of resolve-disposition: given an admitted
 * outcome, is this execution "completed" (a transition may follow, at a
 * capability-orchestration layer this project doesn't own yet) or
 * "terminated" (scenario.outcome.terminal). The other two canonical
 * dispositions — "rejected" (admission failure) and "failed" (execution
 * failure) — aren't resolution decisions; they're the direct result of
 * ContractValidator/SemanticExecutor throwing, handled in the kernel
 * itself rather than through this port.
 */
export interface DispositionResolver {
    resolve(scenario: Scenario, admittedOutcome: unknown): Disposition;
}
