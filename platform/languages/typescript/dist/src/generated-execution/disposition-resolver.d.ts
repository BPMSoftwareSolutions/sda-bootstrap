import type { Scenario } from "../contracts/index.js";
import type { DispositionResolver as DispositionResolverPort } from "./execution-ports.js";
/**
 * The canonical disposition resolution: purely mechanical, driven by
 * scenario.outcome.terminal — verified identical across all three
 * hand-written kernels before this generator existed.
 */
export declare class DispositionResolver implements DispositionResolverPort {
    resolve(scenario: Scenario, _admittedOutcome: unknown): string;
}
