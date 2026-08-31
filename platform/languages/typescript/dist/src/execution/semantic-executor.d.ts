import type { ExecutionAuthority } from "./execution-authority-resolver.js";
/**
 * Embodies execute-event-authority from the canonical execution vector.
 * Consumes the resolved authority and the admitted input, produces a
 * candidate outcome that has not yet been admitted against the scenario's
 * outcome contract.
 */
export interface SemanticExecutor {
    execute(authority: ExecutionAuthority, admittedInput: unknown, signal?: AbortSignal): Promise<unknown>;
}
