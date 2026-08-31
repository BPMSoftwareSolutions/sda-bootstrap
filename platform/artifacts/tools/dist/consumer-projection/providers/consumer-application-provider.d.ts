import type { ConsumerProjectionPlanFile } from "../model/consumer-projection-plan.js";
import type { ConsumerInterfaceAuthority, ConsumerProjectionTarget, JsonRecord } from "../model/consumer-workspace-facts.js";
export interface ConsumerApplicationProviderInput {
    readonly repositoryRoot: string;
    readonly workspaceRoot: string;
    readonly capabilityId: string;
    readonly interfaceAuthority: ConsumerInterfaceAuthority;
    readonly query: JsonRecord;
}
export interface ConsumerApplicationProvider {
    readonly target: ConsumerProjectionTarget;
    render(input: ConsumerApplicationProviderInput): readonly ConsumerProjectionPlanFile[];
}
