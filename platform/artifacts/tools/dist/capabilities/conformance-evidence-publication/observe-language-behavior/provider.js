export class ObserveLanguageBehaviorProvider {
    toolchain;
    responsibilityId = "invoke-real-language-suite-and-capture-attributable-results";
    constructor(toolchain) {
        this.toolchain = toolchain;
    }
    async execute(input) { return this.toolchain.observeBehavior(input.obligation); }
}
