import type { ConsumerProjectionPlanFile } from "../../model/consumer-projection-plan.js";
import type { ConsumerApplicationProvider, ConsumerApplicationProviderInput } from "../consumer-application-provider.js";
export declare function renderPythonProgram(): string;
export declare class PythonConsumerApplicationProvider implements ConsumerApplicationProvider {
    readonly target: "python";
    render(_input: ConsumerApplicationProviderInput): readonly ConsumerProjectionPlanFile[];
}
