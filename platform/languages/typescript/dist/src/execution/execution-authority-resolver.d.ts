import type { ScenarioEvent } from "../contracts/index.js";
/**
 * The resolved target of a ScenarioEvent's executionAuthorityId. `handler`
 * is intentionally untyped — the kernel does not know what shape a
 * resolved authority takes; only an adapter implementation does.
 */
export interface ExecutionAuthority {
    executionAuthorityId: string;
    handler: unknown;
}
/**
 * Embodies resolve-event-authority from the canonical execution vector.
 */
export interface ExecutionAuthorityResolver {
    resolve(scenarioEvent: ScenarioEvent, signal?: AbortSignal): Promise<ExecutionAuthority>;
}
