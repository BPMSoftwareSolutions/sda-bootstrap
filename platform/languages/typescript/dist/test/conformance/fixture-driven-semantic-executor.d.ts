import type { ExecutionAuthority, SemanticExecutor } from "../../src/execution/index.js";
import type { ExecutionBehavior } from "./fixture.js";
/**
 * Test double for execute-event-authority, configured per fixture. Real
 * domain execution mechanisms don't exist yet (that's
 * languages/typescript/src/adapters/, not built), so this is driven entirely by
 * the fixture's prescribed behavior, never invented.
 */
export declare class FixtureDrivenSemanticExecutor implements SemanticExecutor {
    private readonly behavior;
    constructor(behavior: ExecutionBehavior);
    execute(_authority: ExecutionAuthority, _admittedInput: unknown): Promise<unknown>;
}
