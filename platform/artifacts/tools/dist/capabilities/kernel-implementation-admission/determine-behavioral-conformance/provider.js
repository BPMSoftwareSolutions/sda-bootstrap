export class BehavioralConformanceProvider {
    responsibilityId = "evaluate-attributable-language-behavior-observation";
    async execute(input) { return input.observation?.value ?? { language: input.language, toolchainAvailable: false, ran: false, conforming: false, reason: `no behavioral observation was admitted for language "${input.language}"` }; }
}
