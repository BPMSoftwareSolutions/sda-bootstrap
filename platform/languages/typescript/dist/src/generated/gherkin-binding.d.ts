import type { GherkinStep } from "./gherkin-step.js";
export interface GherkinBinding {
    given: GherkinStep;
    when: GherkinStep;
    then: GherkinStep;
    featureId?: string;
}
