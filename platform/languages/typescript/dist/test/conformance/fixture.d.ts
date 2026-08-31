import type { Scenario } from "../../src/contracts/index.js";
export interface AdmissionBehavior {
    outcome: "admit" | "reject";
    admittedValue?: unknown;
}
export interface ExecutionBehavior {
    outcome: "succeed" | "throw";
    candidateOutcome?: unknown;
}
export interface ExecutionVectorFixture {
    fixtureId: string;
    expectationId: string;
    description?: string;
    scenario: Scenario;
    input: unknown;
    admitInput: AdmissionBehavior;
    executeEventAuthority?: ExecutionBehavior;
    admitOutcome?: AdmissionBehavior;
}
export interface ExecutionVectorExpectation {
    expectationId: string;
    fixtureId: string;
    expected: {
        disposition: string;
    };
}
