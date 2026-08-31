/**
 * Test double for execute-event-authority, configured per fixture. Real
 * domain execution mechanisms don't exist yet (that's
 * languages/typescript/src/adapters/, not built), so this is driven entirely by
 * the fixture's prescribed behavior, never invented.
 */
export class FixtureDrivenSemanticExecutor {
    behavior;
    constructor(behavior) {
        this.behavior = behavior;
    }
    async execute(_authority, _admittedInput) {
        if (this.behavior.outcome === "succeed") {
            return this.behavior.candidateOutcome;
        }
        if (this.behavior.outcome === "throw") {
            throw new Error("Fixture-prescribed execution failure.");
        }
        throw new Error(`Unknown execution outcome '${this.behavior.outcome}'.`);
    }
}
